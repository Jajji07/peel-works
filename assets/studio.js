/* Studio: try every design on a 3D phone, or upload your own photo */
(() => {
const { $, $$, D, DESIGNS, CATEGORIES, CONFIG, money, reduced, clamp, esc, API } = PW;
const qs = new URLSearchParams(location.search);

const stage = $('#tryStage'), tp = $('#tryPhone'), glare = $('#tryGlare');
const tryBase = $('#tryBase'), tryNext = $('#tryNext'), tryCamBase = $('#tryCamBase'), tryCamNext = $('#tryCamNext');
const photoInput = $('#photoInput');
let current = D[qs.get('d')] || DESIGNS[0], pending = null, photo = null, stripCat = 'All';

$('#model').innerHTML = PW.modelOptions();
$('#tryBundlePrice').textContent = money(CONFIG.bundlePrice);
const paint = bg => { tryBase.style.background = bg; tryCamBase.style.background = bg; };

/* ---------- swatch strip ---------- */
const UPLOAD = `<button class="swatch upload-swatch" data-id="custom" aria-label="Use your own photo"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>`;
$('#studioChips').innerHTML = ['All', ...CATEGORIES].map(c => `<button class="chip${c === stripCat ? ' active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
function renderStrip() {
  const ds = DESIGNS.filter(d => stripCat === 'All' || d.tag === stripCat);
  $('#swatches').innerHTML = UPLOAD + ds.map(d => `<button class="swatch" data-id="${d.id}" aria-label="${esc(d.name)} ${esc(d.way)}" title="${esc(d.name)} · ${esc(d.way)}"></button>`).join('');
  $$('#swatches .swatch').forEach(sw => { if (D[sw.dataset.id]) sw.style.background = D[sw.dataset.id].bg; });
  const up = $('.upload-swatch');
  if (photo) { up.style.background = `url("${photo.thumb}") center/cover`; up.classList.add('has-photo'); }
  markActive();
}
function markActive() {
  $$('#swatches .swatch').forEach(sw => sw.classList.toggle('active', sw.dataset.id === current.id));
  const a = $('#swatches .swatch.active'), strip = $('#swatches');
  // scroll only the strip (scrollIntoView would also nudge the whole page sideways on phones)
  if (a) strip.scrollTo({ left: a.offsetLeft - strip.offsetLeft - strip.clientWidth / 2 + a.clientWidth / 2, behavior: reduced ? 'auto' : 'smooth' });
}
$('#studioChips').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; stripCat = b.dataset.cat; $$('#studioChips .chip').forEach(c => c.classList.toggle('active', c === b)); renderStrip(); });
$('#swatches').addEventListener('click', e => {
  const b = e.target.closest('.swatch'); if (!b) return;
  if (b.dataset.id === 'custom') { if (photo) showDesign(photoDesign()); else photoInput.click(); }
  else showDesign(D[b.dataset.id]);
});

/* ---------- switching designs ---------- */
function finishPending() {
  if (!pending) return;
  clearTimeout(pending); pending = null; paint(current.bg);
  [tryNext, tryCamNext].forEach(el => { el.style.transition = 'none'; el.style.clipPath = 'inset(0% 0% 100% 0%)'; });
}
function setText(d) {
  const isCustom = d.id === 'custom';
  $('#tryName').textContent = d.name;
  $('#tryWay').textContent = isCustom ? 'Custom photo skin' : `${d.way} colorway · ${d.tag}`;
  $('#tryDesc').textContent = d.desc;
  $('#customTools').hidden = !isCustom;
  $('#tryBundle').hidden = isCustom;
  stage.classList.toggle('panning', isCustom);
  $('#tryHint').textContent = isCustom ? 'Drag to move your photo' : 'Move or drag to tilt';
  $('#tryPrice').textContent = money(isCustom ? CONFIG.customPrice : CONFIG.skinPrice);
  if (!isCustom) { const u = new URL(location.href); u.searchParams.set('d', d.id); history.replaceState(null, '', u); }
}
function showDesign(d) {
  if (!d || d === current) return;
  finishPending();
  current = d; markActive(); setText(d);
  [tryNext, tryCamNext].forEach(el => { el.style.transition = 'none'; el.style.clipPath = 'inset(0% 0% 100% 0%)'; el.style.background = d.bg; });
  void tryNext.offsetHeight;
  tryNext.style.transition = reduced ? 'none' : 'clip-path .9s cubic-bezier(.7,0,.2,1)';
  tryCamNext.style.transition = tryNext.style.transition;
  tryNext.style.clipPath = 'inset(0% 0% 0% 0%)'; tryCamNext.style.clipPath = 'inset(0% 0% 0% 0%)';
  pending = setTimeout(finishPending, reduced ? 0 : 950);
  if (!reduced) ['#tryName', '#tryWay', '#tryDesc'].forEach((s, i) => $(s).animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: i * 50, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
}

/* ---------- your own photo ---------- */
const baseW = () => Math.max(100, 205 * photo.w / photo.h);   // keeps the photo covering the 1:2.05 skin at zoom 1
const photoBg = () => `url("${photo.url}") ${photo.x.toFixed(2)}% ${photo.y.toFixed(2)}% / ${(baseW() * photo.zoom).toFixed(2)}% auto no-repeat, #111`;
const photoDesign = () => ({ id: 'custom', name: 'Your photo', desc: 'Drag the phone to position it and use the slider to zoom. It wraps the camera island too.', bg: photoBg() });
const livePaint = () => { if (current.id === 'custom') { finishPending(); current.bg = photoBg(); paint(current.bg); } };
const loadImage = file => new Promise((res, rej) => { const img = new Image(), u = URL.createObjectURL(file); img.onload = () => { URL.revokeObjectURL(u); res(img); }; img.onerror = () => { URL.revokeObjectURL(u); rej(new Error('decode')); }; img.src = u; });
photoInput.addEventListener('change', async () => {
  const f = photoInput.files[0]; photoInput.value = '';
  if (!f) return;
  if (f.type && !f.type.startsWith('image/')) return PW.toast('Please choose an image file.');
  if (f.size > 40e6) return PW.toast('That photo is too large (max 40 MB).');
  try {
    const img = await loadImage(f);
    const sc = Math.min(1, 4000 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * sc), h = Math.round(img.naturalHeight * sc);
    const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .92)); if (!blob) throw new Error('encode');
    const t = document.createElement('canvas'), ts = 160 / Math.max(w, h); t.width = Math.round(w * ts); t.height = Math.round(h * ts);
    t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
    if (photo) URL.revokeObjectURL(photo.url);
    photo = { url: URL.createObjectURL(blob), blob, w, h, thumb: t.toDataURL('image/jpeg', .8), zoom: 1, x: 50, y: 50, uploadId: null };
    $('#zoom').value = 1; $('#rights').checked = false; $('#resWarn').hidden = Math.min(w, h) >= 900;
    renderStrip(); showDesign(photoDesign());
  } catch (err) { console.error(err); PW.toast('Couldn’t open that photo. Try a JPG or PNG.'); }
});
$('#changePhoto').addEventListener('click', () => photoInput.click());
$('#zoom').addEventListener('input', e => { if (!photo) return; photo.zoom = +e.target.value; livePaint(); });
let pan = null;
stage.addEventListener('pointerdown', e => { if (!photo || current.id !== 'custom') return; pan = { x: e.clientX, y: e.clientY }; stage.setPointerCapture(e.pointerId); });
stage.addEventListener('pointermove', e => {
  if (!pan) return;
  const dx = e.clientX - pan.x, dy = e.clientY - pan.y; pan = { x: e.clientX, y: e.clientY };
  const cw = tryBase.getBoundingClientRect().width, ch = cw * 2.05, iw = cw * baseW() * photo.zoom / 100, ih = iw * photo.h / photo.w;
  if (iw - cw > 1) photo.x = clamp(photo.x - dx * 100 / (iw - cw), 0, 100);
  if (ih - ch > 1) photo.y = clamp(photo.y - dy * 100 / (ih - ch), 0, 100);
  livePaint();
});
const endPan = () => { pan = null; };
stage.addEventListener('pointerup', endPan); stage.addEventListener('pointercancel', endPan);

async function addPhoto(btn) {
  if (!photo) return photoInput.click();
  if (!$('#rights').checked) return PW.toast('Please confirm you own this photo or have permission to use it.');
  if (!API) return PW.toast('Custom photo orders are coming soon!');
  const label = btn.textContent; btn.disabled = true; btn.textContent = 'Uploading…';
  try {
    if (!photo.uploadId) {
      const fd = new FormData(); fd.append('photo', photo.blob, 'photo.jpg');
      const res = await fetch(API + '/api/upload', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.id) throw new Error(data.error || 'Upload failed');
      photo.uploadId = data.id;
    }
    PW.addCustom({ model: PW.getModel(), upload: photo.uploadId, zoom: +photo.zoom.toFixed(2), x: +photo.x.toFixed(1), y: +photo.y.toFixed(1), thumb: photo.thumb }, btn);
  } catch (err) { console.error(err); PW.toast('Upload failed. Please try again.'); }
  finally { btn.disabled = false; btn.textContent = label; }
}
$('#tryAdd').addEventListener('click', e => current.id === 'custom' ? addPhoto(e.currentTarget) : PW.addSkin(current.id, e.currentTarget));
$('#tryBundle').addEventListener('click', e => PW.addBundle(current.id, e.currentTarget));

/* ---------- tilt ---------- */
let tHover = false, tTx = 0, tTy = 0, cX = 0, cY = 0;
stage.addEventListener('pointermove', e => { const r = stage.getBoundingClientRect(); tHover = true; tTx = (e.clientX - r.left) / r.width - .5; tTy = (e.clientY - r.top) / r.height - .5; });
stage.addEventListener('pointerleave', () => { tHover = false; });
PW.onFrame(t => {
  const still = reduced || current.id === 'custom';
  const tx = still ? 0 : tHover ? tTx : Math.sin(t / 1800) * .2, ty = still ? 0 : tHover ? tTy : Math.cos(t / 2300) * .1;
  cX += (tx - cX) * .08; cY += (ty - cY) * .08;
  tp.style.transform = `rotateY(${(cX * 46).toFixed(2)}deg) rotateX(${(-cY * 32).toFixed(2)}deg)`;
  glare.style.background = `radial-gradient(circle at ${(50 + cX * 90).toFixed(1)}% ${(40 + cY * 90).toFixed(1)}%, rgba(255,255,255,.38), transparent 52%)`;
});

/* ---------- start ---------- */
paint(current.bg); setText(current); renderStrip();
if (qs.get('upload') === '1') setTimeout(() => PW.toast('Tap the + swatch to upload your photo'), 600);
})();
