"""
Customer accounts for Peelworks
===============================

  POST /api/auth/signup   {name, email, password}      -> {token, user}
  POST /api/auth/login    {email, password}            -> {token, user}
  POST /api/auth/logout                                 (signed in)
  POST /api/auth/verify   {code}                        (signed in) confirm email
  POST /api/auth/resend                                 (signed in) new email code
  POST /api/auth/forgot   {email}                       email a reset code
  POST /api/auth/reset    {email, code, password}       -> {token, user}
  GET  /api/me                                          (signed in)
  GET  /api/orders                                      (signed in) order history

Everything is stored in server/peelworks.db (SQLite). Passwords are hashed,
sign-in tokens and email codes are stored only as hashes.

Emails (verification + password reset) are sent through your Gmail with an
"App password" — see SMTP_* in .env. Without it, accounts still work, but
customers only see orders they placed while signed in.
"""

import hashlib
import json
import logging
import os
import re
import secrets
import smtplib
import sqlite3
import threading
import time
from email.message import EmailMessage
from pathlib import Path

from flask import Blueprint, g, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

log = logging.getLogger("peelworks")
bp = Blueprint("accounts", __name__)

HERE = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("DB_PATH", HERE / "peelworks.db"))
SESSION_DAYS = 60
CODE_MINUTES = 15
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "465"))
SMTP_USER = os.environ.get("SMTP_USER", "").strip()
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "").replace(" ", "").strip()
SMTP_FROM = os.environ.get("SMTP_FROM", SMTP_USER).strip()
EMAIL_ENABLED = bool(SMTP_USER and SMTP_PASSWORD)

_local = threading.local()


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
def db():
    conn = getattr(_local, "conn", None)
    if conn is None:
        conn = sqlite3.connect(DB_PATH, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA journal_mode = WAL")
        _local.conn = conn
    return conn


def init_db():
    c = db()
    c.executescript("""
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      pw_hash TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0,
      created REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS codes (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires REAL NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, purpose)
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      account_id INTEGER,
      email TEXT,
      name TEXT,
      created TEXT NOT NULL,
      items TEXT NOT NULL,
      item_count INTEGER NOT NULL,
      total_cents INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'paid',
      tracking TEXT
    );
    CREATE INDEX IF NOT EXISTS orders_email ON orders(email);
    CREATE INDEX IF NOT EXISTS orders_account ON orders(account_id);
    """)
    c.commit()


def sha(s):
    return hashlib.sha256(s.encode()).hexdigest()


def user_json(u):
    return {"id": u["id"], "name": u["name"], "email": u["email"], "verified": bool(u["verified"]),
            "emailEnabled": EMAIL_ENABLED}


# ---------------------------------------------------------------------------
# Rate limiting (simple, in memory)
# ---------------------------------------------------------------------------
_hits = {}
_hits_lock = threading.Lock()


def too_many(key, limit=10, window=600):
    now = time.time()
    with _hits_lock:
        recent = [t for t in _hits.get(key, []) if now - t < window]
        recent.append(now)
        _hits[key] = recent
        return len(recent) > limit


def client_ip():
    return (request.headers.get("CF-Connecting-IP") or request.headers.get("X-Forwarded-For", "").split(",")[0]
            or request.remote_addr or "?").strip()


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------
def new_session(user_id):
    token = secrets.token_urlsafe(32)
    c = db()
    c.execute("DELETE FROM sessions WHERE expires < ?", (time.time(),))
    c.execute("INSERT INTO sessions VALUES (?,?,?)", (sha(token), user_id, time.time() + SESSION_DAYS * 86400))
    c.commit()
    return token


def current_user():
    """The signed-in user for this request, or None."""
    if hasattr(g, "_pw_user"):
        return g._pw_user
    user = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        row = db().execute(
            "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash=? AND s.expires>?",
            (sha(auth[7:].strip()), time.time())).fetchone()
        user = row
    g._pw_user = user
    return user


def need_user():
    u = current_user()
    if not u:
        return None, (jsonify(error="Please sign in again."), 401)
    return u, None


# ---------------------------------------------------------------------------
# Email codes
# ---------------------------------------------------------------------------
def send_email(to, subject, text):
    if not EMAIL_ENABLED:
        log.warning("Email not configured (SMTP_USER/SMTP_PASSWORD). Would have sent to %s: %s", to, subject)
        return

    def go():
        try:
            msg = EmailMessage()
            msg["From"] = f"Peelworks <{SMTP_FROM}>"
            msg["To"] = to
            msg["Subject"] = subject
            msg.set_content(text)
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=20) as s:
                s.login(SMTP_USER, SMTP_PASSWORD)
                s.send_message(msg)
            log.info("Sent '%s' email to %s", subject, to)
        except Exception:
            log.exception("Could not send email to %s", to)

    threading.Thread(target=go, daemon=True).start()


def issue_code(user, purpose):
    code = f"{secrets.randbelow(1_000_000):06d}"
    c = db()
    c.execute("INSERT OR REPLACE INTO codes VALUES (?,?,?,?,0)",
              (user["id"], purpose, sha(code), time.time() + CODE_MINUTES * 60))
    c.commit()
    if purpose == "verify":
        send_email(user["email"], f"{code} is your Peelworks code",
                   f"Hi {user['name']},\n\nYour Peelworks verification code is: {code}\n\n"
                   f"It expires in {CODE_MINUTES} minutes. If you didn't create an account, you can ignore this email.\n\n— Peelworks")
    else:
        send_email(user["email"], f"{code} is your Peelworks reset code",
                   f"Hi {user['name']},\n\nUse this code to reset your Peelworks password: {code}\n\n"
                   f"It expires in {CODE_MINUTES} minutes. If you didn't ask for this, you can ignore this email; "
                   f"your password won't change.\n\n— Peelworks")


def check_code(user_id, purpose, code):
    c = db()
    row = c.execute("SELECT * FROM codes WHERE user_id=? AND purpose=?", (user_id, purpose)).fetchone()
    if not row or row["expires"] < time.time() or row["attempts"] >= 5:
        return False
    if not secrets.compare_digest(row["code_hash"], sha(str(code).strip())):
        c.execute("UPDATE codes SET attempts = attempts + 1 WHERE user_id=? AND purpose=?", (user_id, purpose))
        c.commit()
        return False
    c.execute("DELETE FROM codes WHERE user_id=? AND purpose=?", (user_id, purpose))
    c.commit()
    return True


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
def body():
    return request.get_json(silent=True) or {}


def clean_email(v):
    return str(v or "").strip().lower()[:200]


def password_problem(pw):
    if not isinstance(pw, str) or len(pw) < 8:
        return "Use at least 8 characters for your password."
    if len(pw) > 200:
        return "That password is too long."
    return None


@bp.route("/api/auth/<path:_any>", methods=["OPTIONS"])
@bp.route("/api/me", methods=["OPTIONS"])
@bp.route("/api/orders", methods=["OPTIONS"])
def _preflight(_any=None):
    return ("", 204)


@bp.post("/api/auth/signup")
def signup():
    if too_many("signup:" + client_ip(), limit=8):
        return jsonify(error="Too many attempts. Please try again in a few minutes."), 429
    d = body()
    name = str(d.get("name") or "").strip()[:80]
    email = clean_email(d.get("email"))
    if not name:
        return jsonify(error="Please enter your name."), 400
    if not EMAIL_RE.match(email):
        return jsonify(error="Please enter a valid email address."), 400
    problem = password_problem(d.get("password"))
    if problem:
        return jsonify(error=problem), 400
    c = db()
    if c.execute("SELECT 1 FROM users WHERE email=?", (email,)).fetchone():
        return jsonify(error="An account with that email already exists. Try signing in."), 409
    cur = c.execute("INSERT INTO users (email, name, pw_hash, verified, created) VALUES (?,?,?,0,?)",
                    (email, name, generate_password_hash(d["password"]), time.time()))
    c.commit()
    user = c.execute("SELECT * FROM users WHERE id=?", (cur.lastrowid,)).fetchone()
    issue_code(user, "verify")
    log.info("New account %s", email)
    return jsonify(token=new_session(user["id"]), user=user_json(user))


@bp.post("/api/auth/login")
def login():
    d = body()
    email = clean_email(d.get("email"))
    if too_many("login:" + client_ip(), limit=20) or too_many("login:" + email, limit=8):
        return jsonify(error="Too many attempts. Please wait a few minutes and try again."), 429
    user = db().execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    if not user or not check_password_hash(user["pw_hash"], str(d.get("password") or "")):
        return jsonify(error="That email and password don't match."), 401
    return jsonify(token=new_session(user["id"]), user=user_json(user))


@bp.post("/api/auth/logout")
def logout():
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        c = db()
        c.execute("DELETE FROM sessions WHERE token_hash=?", (sha(auth[7:].strip()),))
        c.commit()
    return jsonify(ok=True)


@bp.get("/api/me")
def me():
    u, err = need_user()
    return err or jsonify(user=user_json(u))


@bp.post("/api/auth/verify")
def verify():
    u, err = need_user()
    if err:
        return err
    if not check_code(u["id"], "verify", body().get("code", "")):
        return jsonify(error="That code isn't right or has expired. Request a new one."), 400
    c = db()
    c.execute("UPDATE users SET verified=1 WHERE id=?", (u["id"],))
    c.commit()
    u = c.execute("SELECT * FROM users WHERE id=?", (u["id"],)).fetchone()
    return jsonify(user=user_json(u))


@bp.post("/api/auth/resend")
def resend():
    u, err = need_user()
    if err:
        return err
    if too_many("resend:" + str(u["id"]), limit=4):
        return jsonify(error="Please wait a few minutes before asking for another code."), 429
    if not EMAIL_ENABLED:
        return jsonify(error="Email isn't set up on the shop yet, so codes can't be sent."), 503
    issue_code(u, "verify")
    return jsonify(ok=True)


@bp.post("/api/auth/forgot")
def forgot():
    email = clean_email(body().get("email"))
    if too_many("forgot:" + client_ip(), limit=6) or too_many("forgot:" + email, limit=3):
        return jsonify(error="Too many requests. Please wait a few minutes."), 429
    if not EMAIL_ENABLED:
        return jsonify(error="Password reset by email isn't available yet. Please contact us."), 503
    user = db().execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    if user:
        issue_code(user, "reset")
    # Same answer either way, so nobody can test which emails have accounts.
    return jsonify(ok=True)


@bp.post("/api/auth/reset")
def reset():
    d = body()
    email = clean_email(d.get("email"))
    if too_many("reset:" + email, limit=8):
        return jsonify(error="Too many attempts. Please request a new code later."), 429
    problem = password_problem(d.get("password"))
    if problem:
        return jsonify(error=problem), 400
    c = db()
    user = c.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    if not user or not check_code(user["id"], "reset", d.get("code", "")):
        return jsonify(error="That code isn't right or has expired."), 400
    # Resetting by email also proves they own the address.
    c.execute("UPDATE users SET pw_hash=?, verified=1 WHERE id=?", (generate_password_hash(d["password"]), user["id"]))
    c.execute("DELETE FROM sessions WHERE user_id=?", (user["id"],))  # sign out everywhere else
    c.commit()
    user = c.execute("SELECT * FROM users WHERE id=?", (user["id"],)).fetchone()
    return jsonify(token=new_session(user["id"]), user=user_json(user))


@bp.get("/api/orders")
def orders():
    u, err = need_user()
    if err:
        return err
    if u["verified"]:
        rows = db().execute("SELECT * FROM orders WHERE account_id=? OR lower(email)=? ORDER BY created DESC",
                            (u["id"], u["email"])).fetchall()
    else:
        rows = db().execute("SELECT * FROM orders WHERE account_id=? ORDER BY created DESC", (u["id"],)).fetchall()
    out = [{
        "id": r["id"][-8:].upper(),
        "created": r["created"],
        "items": json.loads(r["items"]),
        "itemCount": r["item_count"],
        "total": r["total_cents"] / 100,
        "status": r["status"],
        "tracking": r["tracking"],
    } for r in rows]
    return jsonify(orders=out, hiddenUntilVerified=not u["verified"])


# ---------------------------------------------------------------------------
# Used by server.py
# ---------------------------------------------------------------------------
def save_order(order_id, account_id, email, name, created, lines, total_cents):
    c = db()
    c.execute("INSERT OR IGNORE INTO orders (id, account_id, email, name, created, items, item_count, total_cents) "
              "VALUES (?,?,?,?,?,?,?,?)",
              (order_id, account_id, (email or "").lower(), name, created,
               json.dumps([{"qty": q, "name": d} for q, d in lines]), sum(q for q, _ in lines), total_cents))
    c.commit()


def import_csv_orders(csv_path):
    """Copy orders from orders.csv (recorded before accounts existed) into the database."""
    import csv
    if not csv_path.exists():
        return
    with csv_path.open(newline="", encoding="utf-8") as f:
        rows = list(csv.reader(f))[1:]
    for r in rows:
        if len(r) < 13:
            continue
        lines = []
        for part in filter(None, (p.strip() for p in r[10].split(";"))):
            m = re.match(r"^(\d+) x (.+)$", part)
            if m:
                lines.append((int(m.group(1)), m.group(2)))
        try:
            total = round(float(r[12]) * 100)
        except ValueError:
            total = 0
        save_order(r[1], None, r[3], r[2], r[0], lines, total)


STATUSES = ["paid", "making", "shipped", "delivered", "refunded", "canceled"]


def set_status(order_ref, status, tracking=None):
    """Update an order's status (used by orders_admin.py)."""
    if status not in STATUSES:
        raise ValueError(f"status must be one of {STATUSES}")
    c = db()
    row = c.execute("SELECT id FROM orders WHERE id=? OR upper(substr(id, -8))=?",
                    (order_ref, order_ref.upper())).fetchone()
    if not row:
        raise KeyError(order_ref)
    c.execute("UPDATE orders SET status=?, tracking=COALESCE(?, tracking) WHERE id=?", (status, tracking, row["id"]))
    c.commit()
    return row["id"]
