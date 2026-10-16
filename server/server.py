"""
Peelworks checkout server
=========================

Runs on your own computer/server. It does two jobs:

  POST /api/upload    A customer's own photo for a custom skin. Saved in
                      server/uploads/ so you can print it later.
  POST /api/checkout  The website sends the cart here. This creates a secure
                      Stripe Checkout page and sends back its link.
  POST /api/webhook   Stripe calls this after someone pays. The order (name,
                      email, shipping address, items, total) is added to your
                      Google Sheet and to orders.csv as a backup.
  GET  /api/health    Quick "is it running?" check.

Prices live HERE, not in the website, so nobody can change a price in their
browser and pay less. Keep the prices in sync with CONFIG in assets/catalog.js.

Run:  waitress-serve --listen=127.0.0.1:4242 server:app
"""

import csv
import json
import logging
import os
import re
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

import stripe
from dotenv import load_dotenv
from flask import Flask, jsonify, request

HERE = Path(__file__).resolve().parent
load_dotenv(HERE / ".env")

# ---------------------------------------------------------------------------
# Settings (from .env)
# ---------------------------------------------------------------------------
stripe.api_key = os.environ["STRIPE_SECRET_KEY"]
# Required for the embedded Stripe checkout form (ui_mode="form").
stripe.api_version = "2026-09-30.endive; custom_checkout_payment_form_preview=v1"
WEBHOOK_SECRET = os.environ["STRIPE_WEBHOOK_SECRET"]
SITE_URL = os.environ.get("SITE_URL", "https://jajji07.github.io/peel-works/").rstrip("/") + "/"
ALLOWED_ORIGINS = {
    o.strip().rstrip("/")
    for o in os.environ.get("ALLOWED_ORIGINS", "https://jajji07.github.io").split(",")
    if o.strip()
}
SHEET_ID = os.environ.get("GOOGLE_SHEET_ID", "").strip()
GOOGLE_CREDS = os.environ.get("GOOGLE_CREDENTIALS_FILE", "google-credentials.json")
CSV_PATH = HERE / "orders.csv"
UPLOAD_DIR = HERE / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
UPLOAD_ID = re.compile(r"^[0-9a-f]{32}\.(jpg|png|webp)$")

# ---------------------------------------------------------------------------
# Products — prices in CENTS. Must match the prices in assets/catalog.js.
# ---------------------------------------------------------------------------
SKIN = 1400    # $14
PACK = 600     # $6
BUNDLE = 2000  # $20
CUSTOM = 1800  # $18

# Every design id + name comes from designs.json, which is generated from the
# website's assets/catalog.js. After adding designs run:  node tools/export-designs.js
_catalog_file = json.loads((HERE / "designs.json").read_text(encoding="utf-8"))
DESIGNS = _catalog_file["designs"]          # {"trace": "Trace (Gold)", ...}
MODELS = set(_catalog_file["models"])

CATALOG = {f"skin-{did}": {"name": f"{name} skin", "price": SKIN, "needs_model": True} for did, name in DESIGNS.items()}
CATALOG.update({
    "pack-eng":   {"name": "Engineer Sticker Pack (5)",    "price": PACK, "needs_model": False},
    "pack-nw":    {"name": "Northwest Sticker Pack (5)",   "price": PACK, "needs_model": False},
    "pack-anime": {"name": "Anime-style Sticker Pack (5)", "price": PACK, "needs_model": False},
    "bundle":     {"name": "Skin + sticker bundle",        "price": BUNDLE, "needs_model": True, "needs_design": True},
    "custom":     {"name": "Custom photo skin",            "price": CUSTOM, "needs_model": True, "custom": True},
})

MAX_QTY_PER_LINE = 20
MAX_LINES = 30

SHEET_HEADER = [
    "Date (UTC)", "Order ID", "Name", "Email", "Address line 1", "Address line 2",
    "City", "State", "ZIP", "Country", "Items", "Item count", "Total (USD)",
    "Custom photos (file in server/uploads)", "Status",
]

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("peelworks")
app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024  # 20 MB uploads
_lock = threading.Lock()


# ---------------------------------------------------------------------------
# CORS: only your website may call the checkout endpoint
# ---------------------------------------------------------------------------
@app.after_request
def add_cors(resp):
    origin = (request.headers.get("Origin") or "").rstrip("/")
    if origin in ALLOWED_ORIGINS:
        resp.headers["Access-Control-Allow-Origin"] = origin
        resp.headers["Vary"] = "Origin"
        resp.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return resp


@app.errorhandler(413)
def too_large(_):
    return jsonify(error="That photo is too large (max 20 MB)."), 413


@app.get("/api/health")
def health():
    return jsonify(ok=True)


# ---------------------------------------------------------------------------
# 0) Customer photo upload (for custom skins)
# ---------------------------------------------------------------------------
@app.route("/api/upload", methods=["POST", "OPTIONS"])
def upload():
    if request.method == "OPTIONS":
        return ("", 204)
    f = request.files.get("photo")
    if not f:
        return jsonify(error="No photo received."), 400
    head = f.stream.read(12)
    f.stream.seek(0)
    if head[:3] == b"\xff\xd8\xff":
        ext = "jpg"
    elif head[:8] == b"\x89PNG\r\n\x1a\n":
        ext = "png"
    elif head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        ext = "webp"
    else:
        return jsonify(error="Please upload a JPG, PNG or WebP image."), 400
    name = f"{uuid.uuid4().hex}.{ext}"
    f.save(UPLOAD_DIR / name)
    log.info("Saved customer photo %s", name)
    return jsonify(id=name)


# ---------------------------------------------------------------------------
# 1) Create a Stripe Checkout session from the cart
# ---------------------------------------------------------------------------
def bad(msg):
    return jsonify(error=msg), 400


@app.route("/api/checkout", methods=["POST", "OPTIONS"])
def checkout():
    if request.method == "OPTIONS":
        return ("", 204)

    data = request.get_json(silent=True) or {}
    items = data.get("items")
    if not isinstance(items, list) or not items:
        return bad("Your cart is empty.")
    if len(items) > MAX_LINES:
        return bad("Too many items in the cart.")

    line_items, custom_notes = [], {}
    for it in items:
        if not isinstance(it, dict):
            return bad("Invalid cart.")
        pid = it.get("id")
        product = CATALOG.get(pid)
        if not product:
            return bad("One of the items is no longer available.")
        try:
            qty = int(it.get("qty", 1))
        except (TypeError, ValueError):
            return bad("Invalid quantity.")
        if not 1 <= qty <= MAX_QTY_PER_LINE:
            return bad(f"Quantity must be between 1 and {MAX_QTY_PER_LINE}.")

        name, model = product["name"], ""
        if product["needs_model"]:
            model = it.get("model")
            if model not in MODELS:
                return bad("Please choose a phone model.")
            name = f"{name} ({model})"

        meta = {"product_id": pid, "model": model}
        if product.get("needs_design"):
            design = it.get("design")
            if design not in DESIGNS:
                return bad("Please choose a design for your bundle.")
            name = f"{product['name']}: {DESIGNS[design]} ({model})"
            meta["design"] = design
        if product.get("custom"):
            upload_id = it.get("upload")
            if not isinstance(upload_id, str) or not UPLOAD_ID.match(upload_id) or not (UPLOAD_DIR / upload_id).exists():
                return bad("Your photo couldn't be found. Please upload it again.")
            try:
                zoom = min(3.0, max(1.0, float(it.get("zoom", 1))))
                px = min(100.0, max(0.0, float(it.get("x", 50))))
                py = min(100.0, max(0.0, float(it.get("y", 50))))
            except (TypeError, ValueError):
                return bad("Invalid photo position.")
            meta["upload"] = upload_id
            custom_notes[f"custom_{len(custom_notes) + 1}"] = (
                f"{qty} x {model} | file {upload_id} | zoom {zoom:.2f} | position {px:.0f}% across, {py:.0f}% down"
            )

        line_items.append({
            "quantity": qty,
            "price_data": {
                "currency": "usd",
                "unit_amount": product["price"],  # price comes from the server, never the browser
                "product_data": {"name": name, "metadata": meta},
            },
        })

    try:
        session = stripe.checkout.Session.create(
            ui_mode="form",  # embedded checkout form on checkout.html
            mode="payment",
            line_items=line_items,
            billing_address_collection="auto",
            phone_number_collection={"enabled": False},
            automatic_tax={"enabled": False},
            submit_type="auto",
            integration_identifier="custom_embedded_web_0001",
            # Stripe shows cards, Apple Pay, Google Pay, etc. automatically,
            # based on what you turn on in Dashboard -> Settings -> Payment methods.
            shipping_address_collection={"allowed_countries": ["US"]},
            shipping_options=[{
                "shipping_rate_data": {
                    "type": "fixed_amount",
                    "fixed_amount": {"amount": 0, "currency": "usd"},
                    "display_name": "Free shipping (USPS)",
                    "delivery_estimate": {
                        "minimum": {"unit": "business_day", "value": 3},
                        "maximum": {"unit": "business_day", "value": 8},
                    },
                },
            }],
            metadata=custom_notes,  # photo file + crop for each custom skin
            # Where Stripe sends the customer after paying (embedded forms use return_url).
            return_url=SITE_URL + "checkout.html?session_id={CHECKOUT_SESSION_ID}",
        )
    except Exception:
        log.exception("Stripe checkout creation failed")
        return jsonify(error="Payment service error. Please try again."), 502

    return jsonify(client_secret=session.client_secret)


# ---------------------------------------------------------------------------
# 2) Stripe tells us a payment went through -> save the order
# ---------------------------------------------------------------------------
@app.post("/api/webhook")
def webhook():
    payload = request.get_data()
    sig = request.headers.get("Stripe-Signature", "")
    try:
        # Proves the message really came from Stripe.
        stripe.Webhook.construct_event(payload, sig, WEBHOOK_SECRET)
    except Exception:
        log.warning("Rejected webhook with bad signature")
        return ("Invalid signature", 400)

    event = json.loads(payload)
    etype = event.get("type")
    session = event.get("data", {}).get("object", {})

    paid_now = etype == "checkout.session.completed" and session.get("payment_status") == "paid"
    paid_later = etype == "checkout.session.async_payment_succeeded"
    if paid_now or paid_later:
        try:
            record_order(session)
        except Exception:
            log.exception("Failed to record order %s", session.get("id"))
            return ("Error", 500)  # Stripe will retry later
    return ("", 200)


def already_recorded(order_id):
    if not CSV_PATH.exists():
        return False
    with CSV_PATH.open(newline="", encoding="utf-8") as f:
        return any(row and row[1] == order_id for row in csv.reader(f))


def record_order(s):
    order_id = s["id"]
    with _lock:
        if already_recorded(order_id):  # Stripe can send the same event twice
            log.info("Order %s already recorded, skipping", order_id)
            return

        details = s.get("customer_details") or {}
        shipping = (s.get("collected_information") or {}).get("shipping_details") or s.get("shipping_details") or {}
        addr = shipping.get("address") or details.get("address") or {}

        items = stripe.checkout.Session.list_line_items(order_id, limit=100)
        lines = [(li["quantity"], li["description"]) for li in items.auto_paging_iter()]

        row = [
            datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M"),
            order_id,
            shipping.get("name") or details.get("name") or "",
            details.get("email") or "",
            addr.get("line1") or "",
            addr.get("line2") or "",
            addr.get("city") or "",
            addr.get("state") or "",
            addr.get("postal_code") or "",
            addr.get("country") or "",
            "; ".join(f"{q} x {d}" for q, d in lines),
            sum(q for q, _ in lines),
            f"{(s.get('amount_total') or 0) / 100:.2f}",
            "\n".join(v for k, v in sorted((s.get("metadata") or {}).items()) if k.startswith("custom_")),
            "New",
        ]

        # Local backup first, so an order is never lost.
        new_file = not CSV_PATH.exists()
        with CSV_PATH.open("a", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            if new_file:
                w.writerow(SHEET_HEADER)
            w.writerow(row)

    log.info("Recorded order %s for %s", order_id, row[3])
    append_to_sheet(row)


_sheet = None


def append_to_sheet(row):
    """Add the order to Google Sheets. Failures are logged; orders.csv still has it."""
    global _sheet
    if not SHEET_ID:
        return
    try:
        if _sheet is None:
            import gspread
            creds = GOOGLE_CREDS if os.path.isabs(GOOGLE_CREDS) else str(HERE / GOOGLE_CREDS)
            _sheet = gspread.service_account(filename=creds).open_by_key(SHEET_ID).sheet1
            if not _sheet.row_values(1):
                _sheet.append_row(SHEET_HEADER)
        _sheet.append_row(row, value_input_option="USER_ENTERED")
    except Exception:
        _sheet = None
        log.exception("Could not write to Google Sheets (order is saved in orders.csv)")


if __name__ == "__main__":
    # For quick local testing only. Use waitress-serve for the real thing.
    app.run(host="127.0.0.1", port=4242, debug=False)
