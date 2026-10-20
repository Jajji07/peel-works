/* Account page: sign in, sign up, password reset, email confirmation, order history */
(() => {
const { $, $$, API, money, esc } = PW;
const STEPS = [['paid', 'Ordered'], ['making', 'Printing'], ['shipped', 'Shipped'], ['delivered', 'Delivered']];
const LABEL = { paid: 'Ordered', making: 'Printing', shipped: 'Shipped', delivered: 'Delivered', refunded: 'Refunded', canceled: 'Canceled' };
let resetEmail = '';

const show = id => ['#accAuth', '#accHome', '#accDown'].forEach(s => { $(s).hidden = s !== id; });
function msg(form, text, ok) {
  const m = form.querySelector('.acc-msg');
  if (!text) { m.hidden = true; return; }
  m.textContent = text; m.classList.toggle('ok', !!ok); m.hidden = false;
}
async function busy(form, fn) {
  const btn = form.querySelector('button[type="submit"]'), label = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span>';
  msg(form, '');
  try { await fn(); }
  catch (e) { msg(form, /fetch/i.test(e.message) ? 'Couldn’t reach the shop server. Check your connection and try again.' : e.message); }
  finally { btn.disabled = false; btn.innerHTML = label; }
}
const val = (form, name) => (form.elements[name].value || '').trim();

/* ---------- views on the signed-out card ---------- */
function view(name) {
  $$('.acc-form').forEach(f => { f.hidden = f.dataset.view !== name; });
  const tabs = $('.acc-tabs');
  tabs.classList.toggle('hide', name === 'forgot' || name === 'reset');
  $$('.acc-tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  const f = $(`.acc-form[data-view="${name}"]`);
  const first = f && [...f.querySelectorAll('input')].find(i => !i.value);
  if (first && PW.fine) first.focus();
  history.replaceState(null, '', name === 'login' ? location.pathname : '#' + name);
}
$$('.acc-tabs button').forEach(b => b.addEventListener('click', () => view(b.dataset.tab)));
$$('[data-go]').forEach(b => b.addEventListener('click', () => {
  if (b.dataset.go === 'forgot') $('#fForgot').elements.email.value = val($('#fLogin'), 'email');
  view(b.dataset.go);
}));

$('#fLogin').addEventListener('submit', e => {
  e.preventDefault(); const f = e.target;
  if (!val(f, 'email') || !f.elements.password.value) return msg(f, 'Enter your email and password.');
  busy(f, async () => {
    const r = await PW.authFetch('/api/auth/login', { method: 'POST', body: { email: val(f, 'email'), password: f.elements.password.value } });
    signedIn(r); PW.toast('Welcome back!');
  });
});
$('#fSignup').addEventListener('submit', e => {
  e.preventDefault(); const f = e.target;
  if (!val(f, 'name')) return msg(f, 'Please enter your name.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val(f, 'email'))) return msg(f, 'Please enter a valid email address.');
  if (f.elements.password.value.length < 8) return msg(f, 'Use at least 8 characters for your password.');
  busy(f, async () => {
    const r = await PW.authFetch('/api/auth/signup', { method: 'POST', body: { name: val(f, 'name'), email: val(f, 'email'), password: f.elements.password.value } });
    signedIn(r); PW.toast('Account created. Welcome to Peelworks!');
  });
});
$('#fForgot').addEventListener('submit', e => {
  e.preventDefault(); const f = e.target;
  if (!val(f, 'email')) return msg(f, 'Enter the email you signed up with.');
  busy(f, async () => {
    await PW.authFetch('/api/auth/forgot', { method: 'POST', body: { email: val(f, 'email') } });
    resetEmail = val(f, 'email');
    $('#resetHelp').textContent = `If ${resetEmail} has an account, a code is on its way. It works for 15 minutes.`;
    view('reset');
  });
});
$('#fReset').addEventListener('submit', e => {
  e.preventDefault(); const f = e.target;
  if (!/^\d{6}$/.test(val(f, 'code'))) return msg(f, 'Enter the 6-digit code from the email.');
  if (f.elements.password.value.length < 8) return msg(f, 'Use at least 8 characters for your password.');
  busy(f, async () => {
    const r = await PW.authFetch('/api/auth/reset', { method: 'POST', body: { email: resetEmail, code: val(f, 'code'), password: f.elements.password.value } });
    signedIn(r); PW.toast('Password updated. You’re signed in.');
  });
});

/* ---------- signed in ---------- */
function signedIn({ token, user }) {
  PW.setAuth(token, user);
  $$('.acc-form').forEach(f => f.reset());
  renderHome(user);
}
function renderHome(user) {
  PW.setAuth(null, user);
  $('#accName').textContent = (user.name || '').split(' ')[0] || 'there';
  $('#accEmail').textContent = user.email;
  $('#accVerify').hidden = !!user.verified;
  if (!user.verified) {
    $('#verifyText').textContent = user.emailEnabled
      ? `We sent a 6-digit code to ${user.email}. Enter it to confirm it’s you, and any orders you placed with this email before signing up will show up here.`
      : `Email codes aren’t switched on yet, so new orders you place while signed in will show here. To link orders you placed earlier, contact us.`;
    $('#fVerify').hidden = !user.emailEnabled;
  }
  show('#accHome');
  history.replaceState(null, '', location.pathname);
  loadOrders();
}

$('#fVerify').addEventListener('submit', e => {
  e.preventDefault(); const f = e.target;
  if (!/^\d{6}$/.test(val(f, 'code'))) return msg(f, 'Enter the 6-digit code from the email.');
  busy(f, async () => {
    const r = await PW.authFetch('/api/auth/verify', { method: 'POST', body: { code: val(f, 'code') } });
    f.reset(); PW.toast('Email confirmed ✓'); renderHome(r.user);
  });
});
$('#resend').addEventListener('click', async () => {
  const f = $('#fVerify');
  try { await PW.authFetch('/api/auth/resend', { method: 'POST', body: {} }); msg(f, 'New code sent. Check your inbox (and spam).', true); }
  catch (e) { msg(f, e.message); }
});
$('#signOut').addEventListener('click', async () => {
  try { await PW.authFetch('/api/auth/logout', { method: 'POST', body: {} }); } catch (e) {}
  PW.clearAuth(); show('#accAuth'); view('login'); PW.toast('Signed out');
});

function fmtDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function trackHTML(status) {
  const i = STEPS.findIndex(([k]) => k === status);
  if (i < 0) return '';
  return `<div class="track" style="--p:${i / (STEPS.length - 1)}"><i class="bar"></i>${STEPS.map(([, t], j) => `<span class="${j <= i ? 'done' : ''}">${t}</span>`).join('')}</div>`;
}
function trackingLink(t) {
  const n = t.replace(/\s+/g, '');
  const url = /^1Z/i.test(n) ? `https://www.ups.com/track?tracknum=${n}`
    : /^\d{12}$|^\d{15}$/.test(n) ? `https://www.fedex.com/fedextrack/?trknbr=${n}`
    : `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(n)}`;
  return `<a href="${url}" target="_blank" rel="noopener">${esc(t)}</a>`;
}
function orderHTML(o) {
  const note = o.tracking ? `<p class="order-note">Tracking number: ${trackingLink(o.tracking)}</p>`
    : o.status === 'paid' ? `<p class="order-note">We’ve got your order and will start printing it soon.</p>`
    : o.status === 'making' ? `<p class="order-note">Your order is being printed, laminated and cut by hand.</p>`
    : o.status === 'refunded' ? `<p class="order-note">This order was refunded. It can take 5–10 days to show on your statement.</p>`
    : o.status === 'canceled' ? `<p class="order-note">This order was canceled.</p>` : '';
  return `<article class="order">
    <div class="order-head">
      <div class="order-ref">Order #${esc(o.id)}<small>${esc(fmtDate(o.created))} · ${o.itemCount} item${o.itemCount === 1 ? '' : 's'}</small></div>
      <span class="order-badge ${esc(o.status)}">${esc(LABEL[o.status] || o.status)}</span>
      <span class="order-total">${money(o.total)}</span>
    </div>
    <ul class="order-items">${(o.items || []).map(it => `<li><b>×${Number(it.qty) || 1}</b>${esc(it.name || it.description || 'Item')}</li>`).join('')}</ul>
    ${trackHTML(o.status)}${note}
  </article>`;
}
async function loadOrders() {
  const box = $('#orders');
  try {
    const r = await PW.authFetch('/api/orders');
    $('#orderCount').textContent = r.orders.length ? `${r.orders.length} total` : '';
    box.innerHTML = r.orders.length ? r.orders.map(orderHTML).join('') : `<div class="acc-empty"><b>No orders yet.</b><p>${r.hiddenUntilVerified ? 'Ordered before you made an account? Confirm your email above and those orders will show up.' : 'When you place an order, it’ll show up here with its status and tracking.'}</p><a class="btn btn-dark" href="designs.html">Find a design</a></div>`;
  } catch (e) {
    if (e.status === 401) { show('#accAuth'); view('login'); PW.toast('Please sign in again.'); return; }
    box.innerHTML = `<p class="co-error">${esc(/fetch/i.test(e.message) ? 'Couldn’t load your orders right now. Please refresh in a minute.' : e.message)}</p>`;
  }
}

/* ---------- start ---------- */
if (!API) { $('#accDownText').textContent = 'Accounts aren’t switched on yet.'; show('#accDown'); return; }
if (!PW.authToken()) {
  show('#accAuth');
  const h = location.hash.slice(1);
  view(h === 'signup' || h === 'forgot' ? h : 'login');
  return;
}
const cached = PW.authUser();
if (cached) { $('#accName').textContent = (cached.name || '').split(' ')[0]; $('#accEmail').textContent = cached.email; show('#accHome'); }
PW.authFetch('/api/me')
  .then(r => renderHome(r.user))
  .catch(e => {
    if (e.status === 401) { show('#accAuth'); view('login'); return; }
    show('#accDown');
  });
})();
