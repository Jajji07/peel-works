/* Designs gallery: search, filters, infinite scroll, quick view */
(() => {
const { $, $$, D, DESIGNS, CATEGORIES, PRODUCTS, CONFIG, money, reduced, esc, clamp } = PW;
const qs = new URLSearchParams(location.search);
const BATCH = 12;

$('#totalCount').textContent = DESIGNS.length;
$('#tbModel').innerHTML = PW.modelOptions();
$('#qvModel').innerHTML = PW.modelOptions();

/* ---------- state ---------- */
const state = { cat: CATEGORIES.includes(qs.get('cat')) ? qs.get('cat') : 'All', q: '', sort: 'featured' };
let list = [], shown = 0, shuffleSeed = Math.random();

$('#chips').innerHTML = ['All', ...CATEGORIES].map(c => `<button class="chip${c === state.cat ? ' active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
$('#chips').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  state.cat = b.dataset.cat; $$('.chip').forEach(c => c.classList.toggle('active', c === b));
  const u = new URL(location.href); if (state.cat === 'All') u.searchParams.delete('cat'); else u.searchParams.set('cat', state.cat);
  history.replaceState(null, '', u);
  refresh(true);
});
let searchT;
$('#search').addEventListener('input', e => { clearTimeout(searchT); searchT = setTimeout(() => { state.q = e.target.value.trim().toLowerCase(); refresh(true); }, 160); });
$('#sort').addEventListener('change', e => { state.sort = e.target.value; shuffleSeed = Math.random(); refresh(true); });

function compute() {
  let out = DESIGNS.filter(d => (state.cat === 'All' || d.tag === state.cat) &&
    (!state.q || `${d.name} ${d.way} ${d.tag} ${d.desc}`.toLowerCase().includes(state.q)));
  if (state.sort === 'featured') out = [...out.filter(d => d.featured), ...out.filter(d => !d.featured)];
  if (state.sort === 'az') out = [...out].sort((a, b) => (a.name + a.way).localeCompare(b.name + b.way));
  if (state.sort === 'shuffle') {
    let s = shuffleSeed * 1e9 | 0; const r = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    out = [...out]; for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  }
  return out;
}
function refresh(scrollUp) {
  list = compute(); shown = 0;
  $('#grid').innerHTML = '';
  $('#resultCount').textContent = list.length ? `${list.length} design${list.length === 1 ? '' : 's'}${state.cat !== 'All' ? ' in ' + state.cat : ''}${state.q ? ` matching “${state.q}”` : ''}` : '';
  $('#endNote').hidden = true;
  if (!list.length) { $('#grid').innerHTML = `<div class="no-results"><b>No designs match that.</b><button class="link-btn" id="clearFilters">Clear filters</button></div>`; $('#sentinel').hidden = true; return; }
  more();
  if (scrollUp) { const top = $('.gallery').getBoundingClientRect().top + scrollY - 170; if (scrollY > top) scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' }); }
}
function more() {
  if (shown >= list.length) return;
  const next = list.slice(shown, shown + BATCH);
  const tmp = document.createElement('div');
  tmp.innerHTML = next.map((d, i) => PW.designCard(d, i)).join('');
  const nodes = [...tmp.children];
  nodes.forEach(n => $('#grid').appendChild(n));
  nodes.forEach(n => PW.paint(n)); PW.tilt($('#grid'));
  shown += next.length;
  const done = shown >= list.length;
  $('#sentinel').hidden = done;
  $('#endNote').hidden = !done || list.length < BATCH;
  $('#endNote').innerHTML = `You've seen all ${list.length}. <button class="link-btn" id="reshuffle">Shuffle and go again</button>`;
  // keep loading while the bottom of the grid is still near the screen
  if (!done) requestAnimationFrame(() => { if ($('#sentinel').getBoundingClientRect().top < innerHeight + 600) more(); });
}
document.addEventListener('click', e => {
  if (e.target.closest('#clearFilters')) { state.cat = 'All'; state.q = ''; $('#search').value = ''; $$('.chip').forEach(c => c.classList.toggle('active', c.dataset.cat === 'All')); refresh(true); }
  if (e.target.closest('#reshuffle')) { state.sort = 'shuffle'; $('#sort').value = 'shuffle'; shuffleSeed = Math.random(); refresh(true); }
});
new IntersectionObserver(([en]) => { if (en.isIntersecting) more(); }, { rootMargin: '600px' }).observe($('#sentinel'));

/* ---------- packs & bundles ---------- */
const packs = PRODUCTS.filter(p => p.type === 'pack');
$('#packGrid').innerHTML = packs.map(p => `
  <article class="card"><div class="card-art" style="--tint:${D[p.designs[0]].tint}"><span class="pack">${p.designs.map((id, i) => `<span class="stk s${i}" data-bg="${id}"></span>`).join('')}</span><span class="card-glare"></span></div>
    <div class="card-body"><div><h3>${esc(p.name)}</h3><p>${esc(p.sub)}</p></div><div class="card-actions"><span class="card-price">${money(p.price)}</span><button class="add" data-add-pack="${p.id}" aria-label="Add ${esc(p.name)} to cart">+</button></div></div></article>`).join('') + `
  <article class="card info-card"><div class="card-art" style="--tint:#efe9fb"><span class="bundle">${PW.miniPhone('sundown-tidal')}<span class="stk s1" data-bg="sundown-tidal"></span><span class="stk s2" data-bg="liquid-ocean"></span></span></div>
    <div class="card-body"><div><h3>Skin + sticker bundle</h3><p>Open any design and choose “Bundle” · ${money(CONFIG.bundlePrice)}</p></div></div></article>
  <article class="card info-card"><a class="card-art" href="studio.html" style="--tint:#ffe9df"><span class="mini-phone"><span class="mini-skin photo-ph"><svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="14" rx="3"/><circle cx="12" cy="13" r="3.5"/><path d="M9 6l1.5-2h3L15 6"/></svg></span><span class="mini-cam"><span class="mini-cam-skin photo-ph"></span></span></span></a>
    <div class="card-body"><div><h3>Custom photo skin</h3><p>Use your own picture · ${money(CONFIG.customPrice)}</p></div><a class="add" href="studio.html" aria-label="Open the Studio">→</a></div></article>`;

/* ---------- quick view ---------- */
const qv = $('#qv'), qvFill = $('#qvFill'), qvCam = $('#qvCam'), qvPhone = $('#qvPhone'), qvStage = $('#qvStage'), qvGlare = $('#qvGlare');
let cur = null, lastFocus = null;
$('#qvPrice').textContent = money(CONFIG.skinPrice);
$('#qvBundlePrice').textContent = money(CONFIG.bundlePrice);

function setDesign(d, dir = 0) {
  cur = d;
  const swap = () => {
    qvFill.style.background = d.bg; qvCam.style.background = d.bg;
    $('#qvTag').textContent = d.tag; $('#qvName').textContent = d.name;
    $('#qvWay').textContent = `${d.way} colorway`; $('#qvDesc').textContent = d.desc;
    const ways = DESIGNS.filter(x => x.base === d.base);
    $('#qvWays').innerHTML = ways.map(w => `<button class="swatch${w === d ? ' active' : ''}" data-way="${w.id}" aria-label="${esc(w.way)}" title="${esc(w.way)}"></button>`).join('');
    $$('#qvWays .swatch').forEach(s => { s.style.background = D[s.dataset.way].bg; });
    $('#qvStudio').href = `studio.html?d=${encodeURIComponent(d.id)}`;
    const i = list.indexOf(d);
    $('#qvPos').textContent = i >= 0 ? `${i + 1} / ${list.length}` : '';
  };
  if (dir && !reduced) {
    qvPhone.animate([{ transform: qvPhone.style.transform || 'none', opacity: 1 }, { transform: `translateX(${-dir * 60}px) rotateY(${-dir * 40}deg)`, opacity: 0 }], { duration: 180, easing: 'ease-in' }).onfinish = () => {
      swap();
      qvPhone.animate([{ transform: `translateX(${dir * 60}px) rotateY(${dir * 40}deg)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
    };
  } else swap();
  const u = new URL(location.href); u.searchParams.set('d', d.id); history.replaceState(null, '', u);
}
function openQV(id) {
  const d = D[id]; if (!d) return;
  lastFocus = document.activeElement;
  setDesign(d);
  qv.classList.add('open'); qv.setAttribute('aria-hidden', 'false'); document.body.classList.add('no-scroll');
  setTimeout(() => $('.qv-close').focus(), 50);
}
function closeQV() {
  if (!qv.classList.contains('open')) return;
  qv.classList.remove('open'); qv.setAttribute('aria-hidden', 'true'); document.body.classList.remove('no-scroll');
  const u = new URL(location.href); u.searchParams.delete('d'); history.replaceState(null, '', u);
  if (lastFocus) lastFocus.focus();
}
function step(dir) {
  const pool = list.length ? list : DESIGNS;
  let i = pool.indexOf(cur); if (i < 0) i = 0;
  const next = pool[(i + dir + pool.length) % pool.length];
  setDesign(next, dir);
  // keep the grid loaded up to where you are, so closing lands near it
  while (list.indexOf(next) >= shown && shown < list.length) more();
}
document.addEventListener('click', e => {
  const q = e.target.closest('[data-quick]'); if (q) { e.preventDefault(); openQV(q.dataset.quick); return; }
  if (e.target.closest('[data-close]')) closeQV();
  const w = e.target.closest('[data-way]'); if (w) setDesign(D[w.dataset.way]);
});
$('#qvPrev').addEventListener('click', () => step(-1));
$('#qvNext').addEventListener('click', () => step(1));
$('#qvAdd').addEventListener('click', e => PW.addSkin(cur.id, e.currentTarget));
$('#qvBundle').addEventListener('click', e => PW.addBundle(cur.id, e.currentTarget));
addEventListener('keydown', e => {
  if (!qv.classList.contains('open')) return;
  if (e.key === 'Escape') closeQV();
  if (e.key === 'ArrowRight') step(1);
  if (e.key === 'ArrowLeft') step(-1);
});
// swipe left/right on phones
let sx = null;
qvStage.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
qvStage.addEventListener('touchend', e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1); sx = null; });
// tilt
let tx = 0, ty = 0, cx = 0, cy = 0, hover = false;
qvStage.addEventListener('pointermove', e => { const r = qvStage.getBoundingClientRect(); hover = true; tx = (e.clientX - r.left) / r.width - .5; ty = (e.clientY - r.top) / r.height - .5; });
qvStage.addEventListener('pointerleave', () => { hover = false; });
PW.onFrame(t => {
  if (!qv.classList.contains('open')) return;
  const gx = reduced ? 0 : hover ? tx : Math.sin(t / 1800) * .2, gy = reduced ? 0 : hover ? ty : Math.cos(t / 2300) * .1;
  cx += (gx - cx) * .08; cy += (gy - cy) * .08;
  qvPhone.parentElement.style.transform = `rotateY(${(cx * 46).toFixed(2)}deg) rotateX(${(-cy * 32).toFixed(2)}deg)`;
  qvGlare.style.background = `radial-gradient(circle at ${(50 + cx * 90).toFixed(1)}% ${(40 + cy * 90).toFixed(1)}%, rgba(255,255,255,.38), transparent 52%)`;
});

/* ---------- surprise me ---------- */
$('#surprise').addEventListener('click', () => {
  const pool = list.length ? list : DESIGNS;
  let d; do { d = pool[Math.floor(Math.random() * pool.length)]; } while (pool.length > 1 && d === cur);
  if (qv.classList.contains('open')) setDesign(d, 1); else openQV(d.id);
});

/* ---------- start ---------- */
refresh(false);
if (qs.get('d') && D[qs.get('d')]) openQV(qs.get('d'));
if (location.hash === '#packs') setTimeout(() => $('#packs').scrollIntoView(), 100);
})();
