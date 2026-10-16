# Stripe Integration TODO

Your site now takes payment with **Stripe's embedded checkout form**: customers pay on your own `checkout.html` page instead of being sent to a Stripe page. This file lists everything left to do.

## Values to Replace

The following values are placeholders and must be updated before going live.

**Files containing placeholders:**
- [assets/catalog.js](assets/catalog.js)
- [server/.env.example](server/.env.example) (copy it to `server/.env` and fill it in)

| Field | Current Value | What to Set |
|-------|--------------|-------------|
| `CONFIG.stripePublishableKey` (assets/catalog.js) | ✅ Set to your **live** key (`pk_live_51UR3…`) | Done. Because it's live, `server/.env` must use your **live** secret key (`sk_live_…`) and a live-mode webhook secret. Test cards won't work. To test for free, swap in your `pk_test_` key and `sk_test_` key together. |
| `CONFIG.apiBase` (assets/catalog.js) | `''` (empty) | Your server's public address with no slash at the end, e.g. `https://api.yourdomain.com`. |
| `STRIPE_SECRET_KEY` (server/.env) | `sk_test_replace_me` | Your **secret** key from the same page (starts with `sk_test_`). Server only. Never put it in the website or on GitHub. |
| `STRIPE_WEBHOOK_SECRET` (server/.env) | `whsec_replace_me` | The signing secret of your webhook endpoint (see step 4 below). |
| `SITE_URL` (server/.env) | `https://jajji07.github.io/peel-works/` | Change only if your site moves (for example to your own domain). Customers return to `SITE_URL` + `checkout.html` after paying. |

`mode` and `line_items` already have real values, so there's nothing to replace there:
- `mode` is `"payment"`, because skins and stickers are one-time purchases.
- `line_items` is built from each customer's cart with prices set by the server (`price_data`), so you don't need Price IDs from the Dashboard. If you'd rather manage prices in the Stripe Dashboard, create Products and Prices there and swap `price_data` for `price: "price_..."`.

## Configured Parameters

These parameters were configured in Checkout Studio and are already set correctly.

**Files containing these parameters:**
- [server/server.py](server/server.py) (the `stripe.checkout.Session.create(...)` call and `stripe.api_version`)
- [assets/checkout.js](assets/checkout.js) (Stripe.js setup and form appearance)

| Parameter | Value |
|-----------|-------|
| ui_mode | `form` |
| billing_address_collection | `auto` |
| phone_number_collection | `{ enabled: false }` |
| automatic_tax | `{ enabled: false }` |
| submit_type | `auto` |
| integration_identifier | `custom_embedded_web_0001` |
| Stripe API version (server) | `2026-09-30.endive; custom_checkout_payment_form_preview=v1` |
| Stripe.js | `https://js.stripe.com/dahlia/stripe.js` with beta `custom_checkout_payment_form_1` |
| Form layout | `expanded`, with the Checkout Studio appearance (theme `stripe`, primary `#0570de`, 4px corners) |

`payment_method_collection` is **not** set, because it only applies to subscriptions and this shop uses `mode: "payment"`.

### Choices that differ from the generic Stripe instructions

- **Kept `shipping_address_collection`, `shipping_options` and `metadata`.** The shop needs the shipping address to mail orders and fill the Google Sheet, offers free USPS shipping, and uses `metadata` to record which photo goes with each custom skin. Removing them would break order fulfillment.
- **Replaced `success_url` / `cancel_url` with `return_url`.** Embedded forms don't use those two; Stripe sends the customer to `return_url` after paying.
- **`ui_mode` is `form`, not `custom`.** The "below 21.0.0, use `custom`" rule refers to Stripe's Node.js library. This server uses the Python library, and version 16.0.0 lists `form` as supported. `requirements.txt` now requires `stripe>=16.0`. If Stripe ever rejects `ui_mode="form"`, upgrade with `pip install -U stripe`.

## Setup

1. **Install the server packages** (in the `server` folder, inside your virtual environment):
   ```bash
   pip install -r requirements.txt
   ```
2. **Fill in `server/.env`** from the table above, then restart the server:
   ```bash
   waitress-serve --listen=127.0.0.1:4242 server:app
   ```
3. **Fill in `assets/catalog.js`**: set `apiBase` and `stripePublishableKey`, then upload the site to GitHub.
4. **Webhook** (Stripe Dashboard → Developers → Webhooks → Add endpoint):
   - URL: `https://YOUR-SERVER-ADDRESS/api/webhook`
   - Events: `checkout.session.completed` and `checkout.session.async_payment_succeeded`
   - Copy the signing secret into `STRIPE_WEBHOOK_SECRET` and restart the server.
5. **Payment methods**: in Dashboard → Settings → Payment methods, turn on the ones you want (cards are on by default; Apple Pay and Google Pay show up automatically where supported).

`README.md` has the longer walkthrough (Google Sheet, Cloudflare Tunnel, keeping the server running).

## New and changed files

| File | What changed |
|------|--------------|
| `checkout.html` | **New.** Checkout page: order summary + Stripe's embedded form. Loads Stripe.js in the `<head>`. |
| `assets/checkout.js` | **New.** Gets the client secret from your server, mounts the form, handles payment confirmation and errors, shows the thank-you screen. |
| `assets/catalog.js` | Added `stripePublishableKey`. |
| `assets/core.js` | The cart's "Secure checkout" button now opens `checkout.html`. |
| `assets/style.css` | Styles for the checkout page. |
| `server/server.py` | Checkout Studio parameters, API version, `return_url`, and returns `{ client_secret }` instead of a redirect link. |
| `server/requirements.txt` | `stripe>=16.0`. |

## How it works

```
Cart → "Secure checkout" → checkout.html
  → POST your-server/api/checkout with the cart
  → server checks every item, sets prices, creates a Checkout Session (ui_mode "form")
  → returns { client_secret }
  → Stripe.js shows the payment form on checkout.html
  → customer pays → Stripe sends them to checkout.html?session_id=...  → "Thank you" + cart cleared
  → Stripe calls your-server/api/webhook → order saved to Google Sheet + server/orders.csv
```

Prices are always set by the server, so editing a price in the browser can't change what's charged.

## Testing

Use **test mode** keys (`pk_test_` / `sk_test_`). No real money moves.

| Card number | Result |
|-------------|--------|
| `4242 4242 4242 4242` | Payment succeeds |
| `4000 0025 0000 3155` | Asks for 3D Secure authentication |
| `4000 0000 0000 9995` | Declined (insufficient funds) |

Use any future expiry date, any 3-digit CVC and any ZIP. After a successful test payment you should see the thank-you screen, the payment under Dashboard → Payments, and a new row in your Google Sheet.

To forward webhooks to your computer while testing, install the Stripe CLI and run:
```bash
stripe listen --forward-to localhost:4242/api/webhook
```
Use the `whsec_...` it prints as `STRIPE_WEBHOOK_SECRET` while testing.

## Going live

1. Finish account activation in the Stripe Dashboard (identity and bank details).
2. Switch off Test mode and copy the **live** keys: `pk_live_...` into `assets/catalog.js`, `sk_live_...` into `server/.env`.
3. Create the webhook again in live mode and copy its new `whsec_...` into `server/.env`.
4. Restart the server, upload the site, and make one small real purchase to confirm.

## Next steps

- **New products or prices:** edit `assets/catalog.js` (display) and the prices at the top of `server/server.py` (what's charged), then run `node tools/export-designs.js`.
- **Fulfillment:** each paid order appears in your Google Sheet with a `Status` column. Change it to "Printed" / "Shipped" as you go.
- **Refunds:** issue them from Dashboard → Payments → the payment → Refund.

## Resources

- Stripe support: https://support.stripe.com
- Stripe docs for AI tools (MCP): https://docs.stripe.com/mcp
