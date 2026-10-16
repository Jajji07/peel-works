/* Checkout page: order summary + Stripe's embedded checkout form */
(() => {
const { $, CONFIG, API, money, esc } = PW;
const qs = new URLSearchParams(location.search);

function showState({ icon, title, text, actions }) {
  $('#coPay').hidden = true;
  $('#coState').hidden = false;
  $('#coIcon').textContent = icon;
  $('#coTitle').textContent = title;
  $('#coText').textContent = text;
  $('#coActions').innerHTML = actions.map(([href, label, dark]) => `<a href="${href}" class="btn ${dark ? 'btn-dark' : 'btn-light'}">${esc(label)}</a>`).join('');
}
function showError(msg) {
  $('#coLoading').hidden = true;
  const e = $('#coError'); e.textContent = msg; e.hidden = false;
}

/* ---------- coming back from Stripe after paying ---------- */
if (qs.get('session_id')) {
  PW.clearCart();
  history.replaceState(null, '', location.pathname);
  showState({ icon: '✓', title: 'Thank you! Your order is in.', text: 'A receipt is on its way to your email. We’ll print, laminate and cut your order, then mail it within a few business days.', actions: [['designs.html', 'Keep browsing', true], ['index.html', 'Back home', false]] });
  return;
}

const lines = PW.cartLines();
if (!lines.length) {
  showState({ icon: '◠‿◠', title: 'Your cart is empty.', text: 'Find a design you love, then come back here to pay.', actions: [['designs.html', 'Browse designs', true], ['studio.html', 'Make your own', false]] });
  return;
}
if (!API || !CONFIG.stripePublishableKey || CONFIG.stripePublishableKey.includes('...')) {
  console.warn('Set CONFIG.apiBase and CONFIG.stripePublishableKey in assets/catalog.js to turn on checkout.');
  showState({ icon: '⏳', title: 'Checkout is coming soon.', text: 'Payments aren’t switched on yet. Your cart is saved, so check back soon.', actions: [['designs.html', 'Keep browsing', true]] });
  return;
}

/* ---------- order summary ---------- */
$('#coPay').hidden = false;
$('#coLines').innerHTML = lines.map((l, i) => `
  <div class="co-line"><span class="ci-thumb" data-i="${i}"></span>
    <div><b>${esc(l.info.name)}</b><small>${esc(l.info.sub)}</small></div>
    <span class="co-qty">×${l.qty}</span><b>${money(l.info.price * l.qty)}</b></div>`).join('');
lines.forEach((l, i) => { $(`.co-line .ci-thumb[data-i="${i}"]`).style.background = l.info.bg; });
$('#coSub').textContent = money(lines.reduce((s, l) => s + l.info.price * l.qty, 0));

/* ---------- Stripe embedded checkout form ---------- */
if (typeof Stripe === 'undefined') { showError('The payment form couldn’t load. Check your connection, turn off any ad blocker for this site, and refresh.'); return; }

const stripe = Stripe(CONFIG.stripePublishableKey, { betas: ['custom_checkout_payment_form_1'] });
const appearance = {
  theme: 'stripe',
  labels: 'auto',
  inputs: 'spaced',
  variables: {
    borderRadius: '4px',
    colorBackground: '#ffffff',
    colorDanger: '#df1b41',
    colorPrimary: '#0570de',
    colorSuccess: '#00c853',
    colorText: '#30313d',
    fontFamily: 'default',
    fontSizeBase: '16px',
    spacingUnit: '4px',
  },
};

// Your server checks the cart, sets the real prices, and returns a client secret.
const clientSecret = fetch(API + '/api/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ items: PW.cartPayload() }),
})
  .then(async res => {
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.client_secret) throw new Error(json.error || 'Couldn’t start checkout. Please try again.');
    return json.client_secret;
  });
clientSecret.catch(err => { console.error(err); showError(/fetch/i.test(err.message) ? 'Couldn’t reach the checkout server. Please try again in a minute.' : err.message); });

(async () => {
  try {
    const checkout = stripe.initCheckoutFormSdk({ clientSecret, appearance });
    const form = checkout.createForm({ layout: 'expanded' });
    form.mount('#checkout-form');
    await clientSecret;
    $('#coLoading').hidden = true;

    const loadActionsResult = await checkout.loadActions();
    if (loadActionsResult.type === 'success') {
      form.on('confirm', async event => {
        $('#coError').hidden = true;
        try {
          // On success Stripe sends the customer to checkout.html?session_id=...
          const result = await loadActionsResult.actions.confirm({ formConfirmEvent: event });
          if (result && result.type === 'error') showError(result.error.message);
        } catch (error) {
          console.error('Payment confirmation error:', error);
          showError('Payment didn’t go through. Please check your details and try again.');
        }
      });
    } else {
      showError('The payment form couldn’t load. Please refresh and try again.');
    }
  } catch (err) {
    console.error(err);
    if ($('#coError').hidden) showError('The payment form couldn’t load. Please refresh and try again.');
  }
})();
})();
