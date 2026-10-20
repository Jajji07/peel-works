# peel-works

Website (hosted free on GitHub Pages):

| Page | What it is |
|---|---|
| `index.html` | Home: hero, scroll story, trending designs, categories |
| `designs.html` | Every design, with search, filters, infinite scroll and quick view |
| `studio.html` | Try any design on a 3D phone, or upload your own photo |
| `about.html` | How it's made + FAQ |
| `404.html` | Shown automatically by GitHub Pages for any address that doesn't exist |
| `assets/` | Shared styles and scripts. **`assets/catalog.js` holds your settings, prices and all designs.** |

Checkout server: `server/` (runs on your own 24/7 computer)

```
(Custom skin) customer uploads a photo → saved in server/uploads/ (/api/upload)
Customer clicks "Secure checkout"
   → website sends the cart to YOUR server (/api/checkout)
   → server creates a Stripe Checkout page (prices set by the server)
   → customer pays on Stripe (card, Apple Pay, Google Pay)
   → Stripe tells your server (/api/webhook)
   → order is added to your Google Sheet + server/orders.csv
```

Do everything in **Stripe test mode** first. No real money moves until you switch to live keys.

---

## 1. Stripe

1. Create an account at stripe.com. Keep the **Test mode** toggle on.
2. **Developers → API keys** → copy the **Secret key** (`sk_test_...`).
3. Never put this key in `index.html` or on GitHub.

## 2. Google Sheet (for orders)

1. Make a new Google Sheet called "Peelworks Orders". Copy its ID from the URL:
   `docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`
2. Go to console.cloud.google.com → create a project → search **Google Sheets API** → **Enable**.
3. **IAM & Admin → Service Accounts → Create service account** (any name) → open it → **Keys → Add key → JSON**. A file downloads.
4. Rename that file `google-credentials.json` and put it in the `server/` folder.
5. Open the JSON, copy the `client_email` (ends in `iam.gserviceaccount.com`), and **Share** your Google Sheet with that email as **Editor**.

## 3. Run the server

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                 # then open .env and fill it in
waitress-serve --listen=127.0.0.1:4242 server:app
```

Check it: open http://127.0.0.1:4242/api/health → `{"ok": true}`

## 4. Give the server a public HTTPS address (Cloudflare Tunnel)

Your website and Stripe need to reach the server over the internet. Cloudflare Tunnel does this without opening router ports.

- **Quick test (link changes every restart):**
  ```bash
  cloudflared tunnel --url http://127.0.0.1:4242
  ```
  It prints a link like `https://random-words.trycloudflare.com`.
- **Permanent:** buy a domain, add it to Cloudflare (free plan), then follow Cloudflare's "Create a tunnel" guide in **Zero Trust → Networks → Tunnels** and point a hostname such as `api.yourdomain.com` at `http://127.0.0.1:4242`.

## 5. Stripe webhook

1. Stripe → **Developers → Webhooks → Add endpoint**
2. URL: `https://YOUR-SERVER-ADDRESS/api/webhook`
3. Events: `checkout.session.completed` and `checkout.session.async_payment_succeeded`
4. Copy the **Signing secret** (`whsec_...`) into `server/.env` as `STRIPE_WEBHOOK_SECRET`, then restart the server.

## 6. Connect the website

In `assets/catalog.js`, find `CONFIG` at the top and set your server's address (no slash at the end) and your Stripe **publishable** key:

```js
apiBase: 'https://YOUR-SERVER-ADDRESS',
stripePublishableKey: 'pk_test_...',
```

Payments use Stripe's embedded form on `checkout.html`. See **STRIPE_INTEGRATION_TODO.md** for every remaining Stripe step.

Upload to GitHub: all the `.html` files (including `checkout.html` and `guide.html`), plus `CNAME`, `sitemap.xml`, `robots.txt`, the `assets/` and `tools/` folders, `README.md`, `.gitignore`, and from `server/` only `server.py`, `designs.json`, `requirements.txt`, `.env.example`. **Never** upload `.env`, `google-credentials.json`, `orders.csv` or the `uploads/` folder (customers' photos).

## 7. Test a purchase

Add something to the cart → **Secure checkout** → pay with test card
`4242 4242 4242 4242`, any future date, any CVC, any ZIP.
You should land back on the site with a "Payment received" message, and a new row should appear in your Google Sheet.

## 8. Go live

1. Finish Stripe's account activation (they'll ask for identity and bank details).
2. Turn off Test mode → copy the **live** secret key (`sk_live_...`) into `.env`.
3. Create a **new webhook** in live mode (same URL and events) and copy its new `whsec_...` into `.env`.
4. Restart the server and make one real small purchase to confirm.

---

## Custom photo orders

When someone orders a custom photo skin, the **Custom photos** column in your sheet shows something like:

```
1 x iPhone 16 | file 892c28bf...c74.jpg | zoom 1.60 | position 32% across, 22% down
```

- The photo is in `server/uploads/` with that file name.
- **zoom / position** is how the customer framed it on the website, so you can match it when you design the print file.
- Uploads that never got paid for stay in the folder; delete old ones now and then.

## Handy switches

- **Pause orders:** in `assets/catalog.js` set `storeOpen: false`. The site stays up, but checkout shows a "taking a short break" message. Set it back to `true` to reopen.
- **Photo cleanup:** the server deletes customer photos older than 90 days, once a day. To change that, add `PHOTO_KEEP_DAYS=60` (or any number) to `server/.env`.
- **Share preview:** `assets/og.png` is the image shown when someone shares a link on iMessage, Instagram, Discord, etc.

## Changing prices, phone models or designs

- **Prices** are charged by `server/server.py` (in cents at the top). The prices in `assets/catalog.js` are only for display, so change both.
- **Designs and phone models** live in `assets/catalog.js` (`BASES` and `CONFIG.models`). Each design family has a few colorways; add a colorway by adding a line to its `ways` list.
- After changing designs or models, run `node tools/export-designs.js` and copy the new `server/designs.json` to your server, then restart it. The server refuses any design it doesn't know.

## Keep the server running (Linux)

Create `/etc/systemd/system/peelworks.service`:

```ini
[Unit]
Description=Peelworks checkout server
After=network.target

[Service]
WorkingDirectory=/path/to/peel-works/server
ExecStart=/path/to/peel-works/server/.venv/bin/waitress-serve --listen=127.0.0.1:4242 server:app
Restart=always
User=YOUR_USERNAME

[Install]
WantedBy=multi-user.target
```

Then `sudo systemctl enable --now peelworks`. (Run `cloudflared service install` for the tunnel too.)

---

## Customer accounts & order history

Customers can sign up at **account.html**, sign in, and see every order with its status
(Ordered → Printing → Shipped → Delivered) and tracking number. The account icon is in the top menu.

How it works:
- Accounts live in `server/peelworks.db` (SQLite) on your CasaOS box. Passwords are stored hashed; it's never put on GitHub.
- Orders placed while signed in are linked to that account automatically.
- Orders placed as a guest (or before accounts existed, from `orders.csv`) appear once the customer
  **confirms their email** with a 6-digit code, as long as they used the same email.

### Turn on email codes (confirm email + forgot password)
1. Turn on 2-Step Verification for your Google account.
2. Go to <https://myaccount.google.com/apppasswords>, create an app password named "Peelworks", copy the 16 letters.
3. Add to `/DATA/AppData/peelworks/server/.env`:
   ```
   SMTP_USER=jatinkumarpyara@gmail.com
   SMTP_PASSWORD=abcdabcdabcdabcd
   SMTP_FROM=Peelworks <jatinkumarpyara@gmail.com>
   ```
4. Restart the `peelworks-server` container.

Without these, sign up / sign in and new-order history still work; only email codes are off.

### Update an order's status (customers see it instantly)
```
docker exec -it peelworks-server python orders_admin.py list
docker exec -it peelworks-server python orders_admin.py status AB12CD34 making
docker exec -it peelworks-server python orders_admin.py status AB12CD34 shipped 9400111899223817460912
docker exec -it peelworks-server python orders_admin.py status AB12CD34 delivered
```
Statuses: `paid`, `making`, `shipped`, `delivered`, `refunded`, `canceled`.
The order number is the last 8 characters customers see on their account page.
