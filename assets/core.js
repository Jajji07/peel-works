/* =========================================================
   Peelworks core — shared on every page:
   nav, footer, cart drawer, checkout, toasts, helpers.
   ========================================================= */
(() => {
const C = window.PW_CATALOG;
const { CONFIG, D, P } = C;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const range = (v, a, b) => clamp((v - a) / (b - a), 0, 1);
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const money = n => '$' + (Number.isInteger(n) ? n : n.toFixed(2));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(pointer: fine)').matches;
const API = CONFIG.apiBase.replace(/\/+$/, '');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};

const PW = window.PW = Object.assign({}, C, { $, $$, clamp, range, ease, money, reduced, fine, API, esc, store });

/* ---------- phone model preference (shared across pages) ---------- */
let model = store.get('pw-model', 'iPhone 16');
if (!CONFIG.models.includes(model)) model = 'iPhone 16';
PW.getModel = () => model;
PW.setModel = m => { if (CONFIG.models.includes(m)) { model = m; store.set('pw-model', m); $$('select[data-model]').forEach(s => { s.value = m; }); } };
PW.modelOptions = () => CONFIG.models.map(m => `<option${m === model ? ' selected' : ''}>${esc(m)}</option>`).join('');
document.addEventListener('change', e => { if (e.target.matches('select[data-model]')) PW.setModel(e.target.value); });

/* ---------- page chrome: nav, footer, cart, toast ---------- */
const page = document.body.dataset.page || '';
const LINKS = [['index.html', 'Home', 'home'], ['designs.html', 'Designs', 'designs'], ['studio.html', 'Studio', 'studio'], ['about.html', 'About', 'about']];
document.body.insertAdjacentHTML('afterbegin', `
<nav class="nav" id="nav">
  <a href="index.html" class="logo" aria-label="Peelworks home"><span class="logo-mark"></span><span class="logo-text">peelworks</span></a>
  <div class="nav-links">${LINKS.map(([h, t, k]) => `<a href="${h}" class="nl-${k}${k === page ? ' active' : ''}"${k === page ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</div>
  <button class="cart-btn" id="cartBtn" aria-label="Open cart">Cart <span class="cart-count" id="cartCount">0</span></button>
</nav>`);
document.body.insertAdjacentHTML('beforeend', `
<footer>
  <div class="wrap">
    <div class="foot">
      <div><a href="index.html" class="logo"><span class="logo-mark"></span>peelworks</a><p>Hand-printed phone skins and vinyl stickers, made in Washington.</p></div>
      <div class="foot-cols">
        <div><b>Shop</b><a href="designs.html">All designs</a><a href="studio.html">Make your own</a><a href="designs.html#packs">Sticker packs</a></div>
        <div><b>Help</b><a href="contact.html">Contact us</a><a href="mailto:jatinkumarpyara@gmail.com?subject=Peelworks%20question">Email us</a><a href="shipping.html">Shipping &amp; returns</a><a href="about.html#faq">FAQ</a></div>
        <div><b>Legal</b><a href="privacy-policy.html">Privacy policy</a><a href="cookie-policy.html">Cookie policy</a><a href="refund-policy.html">Refund policy</a><a href="terms.html">Terms &amp; conditions</a></div>
        <div><b>Follow</b><a href="#">Instagram</a><a href="#">TikTok</a></div>
      </div>
    </div>
    <p class="copy">© ${new Date().getFullYear()} Peelworks. All rights reserved.</p>
  </div>
</footer>
<div class="overlay" id="overlay"></div>
<aside class="drawer" id="drawer" aria-label="Cart">
  <div class="drawer-head"><h3>Your cart</h3><button class="icon-btn" id="closeCart" aria-label="Close cart">×</button></div>
  <div class="drawer-items" id="cartItems"></div>
  <div class="drawer-foot">
    <div class="sub-row"><span>Subtotal</span><span id="subtotal">$0</span></div>
    <p class="ship-note">${esc(CONFIG.shippingNote)}</p>
    <button class="btn btn-dark full" id="checkout"><svg class="lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="3"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg><span>Secure checkout</span></button>
    <p class="secure-note">Payments handled by Stripe · Cards, Apple Pay &amp; Google Pay</p>
  </div>
</aside>
<div class="toast" id="toast" role="status"></div>`);

let toastT;
PW.toast = (msg, ms = 2600) => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms); };

/* ---------- rendering helpers ---------- */
PW.paint = (root = document) => {
  $$('[data-bg]', root).forEach(el => { const d = D[el.dataset.bg]; if (d) el.style.background = d.bg; });
};
PW.miniPhone = id => `<span class="mini-phone"><span class="mini-skin" data-bg="${id}"></span><span class="mini-cam"><span class="mini-cam-skin" data-bg="${id}"></span></span></span>`;
PW.designCard = (d, i = 0) => `
  <article class="card" style="animation-delay:${(i % 12) * 40}ms">
    <button class="card-art" data-quick="${d.id}" style="--tint:${d.tint}" aria-label="View ${esc(d.name)} ${esc(d.way)}">${PW.miniPhone(d.id)}<span class="card-glare"></span></button>
    <div class="card-body"><div><h3>${esc(d.name)}</h3><p>${esc(d.way)} · ${esc(d.tag)}</p></div>
      <div class="card-actions"><span class="card-price">${money(CONFIG.skinPrice)}</span><button class="add" data-add-skin="${d.id}" aria-label="Add ${esc(d.name)} ${esc(d.way)} skin to cart">+</button></div></div>
  </article>`;
PW.tilt = (root = document) => {
  if (!fine || reduced) return;
  $$('.card:not([data-tilt])', root).forEach(card => {
    card.dataset.tilt = '1';
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      card.style.transform = `perspective(900px) rotateX(${(-y * 9).toFixed(2)}deg) rotateY(${(x * 11).toFixed(2)}deg) translateY(-4px)`;
      card.style.setProperty('--gx', ((x + .5) * 100).toFixed(1) + '%'); card.style.setProperty('--gy', ((y + .5) * 100).toFixed(1) + '%');
    });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  });
};
PW.magnetic = (root = document) => {
  if (!fine || reduced) return;
  $$('.magnetic:not([data-mag])', root).forEach(el => {
    el.dataset.mag = '1';
    el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); el.style.transform = `translate(${((e.clientX - r.left - r.width / 2) * .25).toFixed(1)}px,${((e.clientY - r.top - r.height / 2) * .35).toFixed(1)}px)`; });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
};
const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: .12 });
PW.reveal = (root = document) => $$('.reveal:not(.in)', root).forEach(el => io.observe(el));

/* ---------- cart ---------- */
let cart = store.get('peelworks-cart', []);
const lineInfo = l => {
  const p = P[l.pid]; if (!p) return null;
  if (p.type === 'skin') { const d = D[p.design]; return d && { name: `${d.name} skin`, sub: `${d.way} · ${l.model}`, price: p.price, bg: d.bg }; }
  if (p.type === 'bundle') { const d = D[l.design]; return d && { name: 'Skin + sticker bundle', sub: `${d.name} ${d.way} · ${l.model}`, price: p.price, bg: d.bg }; }
  if (p.type === 'pack') return { name: p.name, sub: p.sub, price: p.price, bg: D[p.designs[0]].bg };
  if (p.type === 'custom') return l.upload && { name: 'Custom photo skin', sub: l.model, price: p.price, bg: `url("${l.thumb}") center/cover` };
  return null;
};
cart = cart.filter(l => lineInfo(l));
const save = () => store.set('peelworks-cart', cart);

function flyToCart(el, bg) {
  if (reduced || !el) return;
  const a = el.getBoundingClientRect(), b = $('#cartBtn').getBoundingClientRect();
  const dot = document.createElement('div'); dot.className = 'fly'; dot.style.background = bg; document.body.appendChild(dot);
  const x0 = a.left + a.width / 2 - 22, y0 = a.top + a.height / 2 - 22, x1 = b.left + b.width / 2 - 22, y1 = b.top + b.height / 2 - 22;
  dot.animate([
    { transform: `translate(${x0}px,${y0}px) scale(.6) rotate(0deg)`, opacity: 1 },
    { transform: `translate(${(x0 + x1) / 2}px,${Math.min(y0, y1) - 140}px) scale(1.15) rotate(-20deg)`, opacity: 1, offset: .5 },
    { transform: `translate(${x1}px,${y1}px) scale(.3) rotate(10deg)`, opacity: .2 },
  ], { duration: 850, easing: 'cubic-bezier(.5,0,.3,1)' }).onfinish = () => dot.remove();
}
function added(line, fromEl, msg) {
  const same = cart.find(l => l.key === line.key);
  if (same) same.qty++; else cart.push(Object.assign({ qty: 1 }, line));
  save(); renderCart();
  const btn = $('#cartBtn'); btn.classList.remove('bump'); void btn.offsetWidth; btn.classList.add('bump');
  flyToCart(fromEl, lineInfo(line).bg);
  PW.toast(msg);
}
PW.addSkin = (designId, fromEl) => { const d = D[designId]; if (!d) return; added({ key: `skin-${d.id}|${model}`, pid: 'skin-' + d.id, model }, fromEl, `Added ${d.name} ${d.way} skin (${model})`); };
PW.addBundle = (designId, fromEl) => { const d = D[designId]; if (!d) return; added({ key: `bundle|${d.id}|${model}`, pid: 'bundle', design: d.id, model }, fromEl, `Added ${d.name} ${d.way} bundle (${model})`); };
PW.addPack = (pid, fromEl) => { const p = P[pid]; if (!p) return; added({ key: pid, pid, model: '' }, fromEl, `Added ${p.name}`); };
PW.addCustom = (line, fromEl) => added(Object.assign({ key: `custom|${line.upload}|${line.model}|${Date.now()}`, pid: 'custom' }, line), fromEl, 'Added your custom photo skin');

function renderCart() {
  $('#cartCount').textContent = cart.reduce((s, l) => s + l.qty, 0);
  $('#subtotal').textContent = money(cart.reduce((s, l) => s + lineInfo(l).price * l.qty, 0));
  $('#cartItems').innerHTML = cart.length ? cart.map((l, i) => {
    const info = lineInfo(l);
    return `<div class="ci"><div class="ci-thumb" data-i="${i}"></div>
      <div><h4>${esc(info.name)}</h4><small>${esc(info.sub)}</small>
      <div class="qty"><button data-act="dec" data-i="${i}" aria-label="Decrease">−</button><span>${l.qty}</span><button data-act="inc" data-i="${i}" aria-label="Increase">+</button></div></div>
      <div class="ci-right"><span>${money(info.price * l.qty)}</span><button class="rm" data-act="rm" data-i="${i}">Remove</button></div></div>`;
  }).join('') : `<div class="empty"><b>◠‿◠</b>Your cart is empty.<br><a href="designs.html">Go find a skin you love →</a></div>`;
  $$('#cartItems .ci-thumb').forEach(el => { el.style.background = lineInfo(cart[+el.dataset.i]).bg; });
}
$('#cartItems').addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const line = cart[+b.dataset.i]; if (!line) return;
  if (b.dataset.act === 'inc') line.qty = Math.min(20, line.qty + 1);
  if (b.dataset.act === 'dec') line.qty--;
  if (b.dataset.act === 'rm' || line.qty < 1) cart.splice(+b.dataset.i, 1);
  save(); renderCart();
});
PW.openCart = () => { $('#drawer').classList.add('open'); $('#overlay').classList.add('show'); };
PW.closeCart = () => { $('#drawer').classList.remove('open'); $('#overlay').classList.remove('show'); };
$('#cartBtn').addEventListener('click', PW.openCart);
$('#closeCart').addEventListener('click', PW.closeCart);
$('#overlay').addEventListener('click', PW.closeCart);
addEventListener('keydown', e => { if (e.key === 'Escape') PW.closeCart(); });

// "+" buttons anywhere on the site, and FAQ accordions
document.addEventListener('click', e => {
  const q = e.target.closest('.faq-q');
  if (q) { const item = q.parentElement, open = !item.classList.contains('open'); item.classList.toggle('open', open); q.setAttribute('aria-expanded', open); return; }
  const s = e.target.closest('[data-add-skin]'); if (s) return PW.addSkin(s.dataset.addSkin, s);
  const k = e.target.closest('[data-add-pack]'); if (k) return PW.addPack(k.dataset.addPack, k);
});

/* ---------- checkout (Stripe, via your server) ---------- */
const coBtn = $('#checkout'), coLabel = coBtn.innerHTML;
const setBusy = busy => { coBtn.disabled = busy; coBtn.innerHTML = busy ? '<span class="spin"></span><span>Opening checkout…</span>' : coLabel; };
coBtn.addEventListener('click', () => {
  if (!cart.length) return PW.toast('Your cart is empty');
  if (!API) { console.warn('Set CONFIG.apiBase in assets/catalog.js to enable checkout.'); return PW.toast('Checkout is coming soon!'); }
  if (document.body.dataset.page === 'checkout') return PW.closeCart();
  setBusy(true);
  location.href = 'checkout.html';   // Stripe's payment form lives on its own page
});
addEventListener('pageshow', () => setBusy(false));
// used by checkout.html
PW.cartLines = () => cart.map(l => Object.assign({ info: lineInfo(l) }, l));
PW.cartPayload = () => cart.map(l => ({ id: l.pid, model: l.model, qty: l.qty, design: l.design, upload: l.upload, zoom: l.zoom, x: l.x, y: l.y }));
PW.clearCart = () => { cart = []; save(); renderCart(); };
renderCart();

/* ---------- one animation loop for the whole page ---------- */
const frames = [];
PW.onFrame = fn => frames.push(fn);
const nav = $('#nav');
function frame(t) {
  const darks = $$('.dark');
  nav.classList.toggle('on-dark', darks.some(s => { const r = s.getBoundingClientRect(); return r.top < 40 && r.bottom > 90; }));
  frames.forEach(fn => fn(t));
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

requestAnimationFrame(() => setTimeout(() => document.body.classList.add('loaded'), 60));
document.addEventListener('DOMContentLoaded', () => { PW.paint(); PW.reveal(); PW.magnetic(); PW.tilt(); });
})();

/* ---------- email links: let people choose how to write to us ---------- */
(() => {
  const $ = s => document.querySelector(s);
  document.body.insertAdjacentHTML('beforeend', `
  <div class="mailx" id="mailx" aria-hidden="true">
    <div class="mailx-backdrop" data-mx-close></div>
    <div class="mailx-panel" role="dialog" aria-modal="true" aria-labelledby="mailxTitle">
      <button class="icon-btn mailx-close" data-mx-close aria-label="Close">×</button>
      <h3 id="mailxTitle">Email us</h3>
      <p class="mailx-addr" id="mailxAddr"></p>
      <div class="mailx-opts">
        <a class="mailx-opt" id="mxGmail" target="_blank" rel="noopener"><span class="mx-ic" style="background:#fdecea;color:#d93025">G</span>Open in Gmail</a>
        <a class="mailx-opt" id="mxOutlook" target="_blank" rel="noopener"><span class="mx-ic" style="background:#e6f0fb;color:#0a64c2">O</span>Open in Outlook</a>
        <a class="mailx-opt" id="mxApp"><span class="mx-ic">✉</span>Use my mail app</a>
        <button class="mailx-opt" id="mxCopy" type="button"><span class="mx-ic">⧉</span><span id="mxCopyLabel">Copy email address</span></button>
      </div>
    </div>
  </div>`);
  const box = $('#mailx');
  const close = () => { box.classList.remove('open'); box.setAttribute('aria-hidden', 'true'); };
  document.addEventListener('click', e => {
    if (e.target.closest('[data-mx-close]')) return close();
    if (e.target.closest('#mxGmail, #mxOutlook, #mxApp')) return setTimeout(close, 150);
    const a = e.target.closest('a[href^="mailto:"]');
    if (!a || a.closest('#mailx')) return;
    e.preventDefault();
    const url = new URL(a.href.replace(/^mailto:/, 'https://x/?to='));
    const to = decodeURIComponent(a.href.slice(7).split('?')[0]);
    const subject = url.searchParams.get('subject') || 'Peelworks question';
    $('#mailxAddr').textContent = to;
    $('#mxGmail').href = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}`;
    $('#mxOutlook').href = `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(to)}&subject=${encodeURIComponent(subject)}`;
    $('#mxApp').href = `mailto:${to}?subject=${encodeURIComponent(subject)}`;
    $('#mxCopyLabel').textContent = 'Copy email address';
    $('#mxCopy').onclick = async () => {
      try { await navigator.clipboard.writeText(to); }
      catch (err) { const t = document.createElement('textarea'); t.value = to; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e2) {} t.remove(); }
      $('#mxCopyLabel').textContent = 'Copied!';
    };
    box.classList.add('open'); box.setAttribute('aria-hidden', 'false');
  });
  addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
})();
