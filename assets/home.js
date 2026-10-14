/* Home page: draggable hero stickers, scroll story, trending rail, categories */
(() => {
const { $, $$, D, DESIGNS, CATEGORIES, clamp, range, ease, reduced, esc } = PW;

/* ---------- hero ---------- */
const hero = $('.hero');
hero.addEventListener('pointermove', e => {
  if (reduced) return;
  hero.style.setProperty('--mx', (e.clientX / innerWidth - .5).toFixed(3));
  hero.style.setProperty('--my', (e.clientY / innerHeight - .5).toFixed(3));
});
const FLOAT = [
  { x: 6, y: 20, s: 120, r: -12, d: 'trace' }, { x: 82, y: 16, s: 135, r: 10, d: 'sakura-night', round: true },
  { x: 9, y: 66, s: 110, r: 8, d: 'liquid', round: true }, { x: 80, y: 64, s: 115, r: -9, d: 'cascade' },
  { x: 60, y: 82, s: 82, r: 14, d: 'halftone-pop' },
];
const FLOAT_MOBILE = [
  { x: 5, y: 15, s: 120, r: -12, d: 'trace' }, { x: 75, y: 13, s: 130, r: 10, d: 'sakura-night', round: true },
  { x: 6, y: 80, s: 110, r: 8, d: 'liquid', round: true }, { x: 74, y: 82, s: 115, r: -9, d: 'cascade' },
];
let zTop = 3;
const k = clamp(innerWidth / 1300, .5, 1);
(innerWidth < 700 ? FLOAT_MOBILE : FLOAT).forEach(f => {
  const el = document.createElement('div');
  el.className = 'floater';
  el.style.cssText = `left:${f.x}%;top:${f.y}%;width:${f.s * k}px;height:${f.s * k}px`;
  el.innerHTML = `<div class="floater-in${f.round ? ' round' : ''}" style="--r:${f.r}deg;animation-delay:${(-Math.random() * 6).toFixed(2)}s"></div>`;
  el.firstChild.style.background = D[f.d].bg;
  hero.appendChild(el);
  let ox = 0, oy = 0, dragging = false;
  el.addEventListener('pointerdown', e => {
    dragging = true; el.setPointerCapture(e.pointerId); el.classList.add('grab');
    const r = el.getBoundingClientRect(), hr = hero.getBoundingClientRect();
    ox = e.clientX - r.left; oy = e.clientY - r.top;
    el.style.left = (r.left - hr.left) + 'px'; el.style.top = (r.top - hr.top) + 'px'; el.style.zIndex = ++zTop;
  });
  el.addEventListener('pointermove', e => {
    if (!dragging) return;
    const hr = hero.getBoundingClientRect();
    el.style.left = (e.clientX - hr.left - ox) + 'px'; el.style.top = (e.clientY - hr.top - oy) + 'px';
  });
  const end = () => { dragging = false; el.classList.remove('grab'); };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
});

/* ---------- scroll story ---------- */
$('#sDate').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
$('#storyPrint').style.background = D.sundown.bg;
$('#storyCam').style.background = D.sundown.bg;
const story = $('#story'), sp = $('#storyPhone'), caps = $$('.cap');
const lV = $('#lVinyl'), lP = $('#lPrint'), lL = $('#lLam'), peel = $('#peelEdge');
PW.onFrame(() => {
  const r = story.getBoundingClientRect();
  if (r.bottom < 0 || r.top > innerHeight) return;
  const p = clamp(-r.top / (story.offsetHeight - innerHeight), 0, 1);
  const turn = ease(range(p, .03, .22)), apply = ease(range(p, .25, .45));
  const ex = ease(range(p, .5, .62)) * (1 - ease(range(p, .72, .8))), zoom = ease(range(p, .82, 1));
  sp.style.transform = `rotateX(${(4 + 20 * ex + 6 * zoom).toFixed(2)}deg) rotateY(${(-25 + 205 * turn - 38 * ex - 14 * zoom).toFixed(2)}deg) scale(${(1 + .12 * zoom).toFixed(3)})`;
  sp.style.setProperty('--hide', (1 - apply).toFixed(4));
  sp.style.setProperty('--ex', ex.toFixed(3));
  peel.style.setProperty('--a', apply.toFixed(4));
  peel.style.opacity = apply > .01 && apply < .99 ? 1 : 0;
  lV.style.transform = `translateZ(${(1 + 30 * ex).toFixed(1)}px)`;
  lP.style.transform = `translateZ(${(2 + 80 * ex).toFixed(1)}px)`;
  lL.style.transform = `translateZ(${(3 + 130 * ex).toFixed(1)}px)`;
  $('#labels').style.opacity = ex.toFixed(3);
  $('#bigword').style.transform = `translate(-50%,-50%) scale(${(1 + p * 1.4).toFixed(3)})`;
  $('#storyBar').style.width = (p * 100).toFixed(1) + '%';
  caps.forEach(c => {
    const s = +c.dataset.s, e = +c.dataset.e;
    const o = Math.min(s === 0 ? 1 : range(p, s, s + .05), 1 - range(p, e - .05, e));
    c.style.opacity = o.toFixed(3);
    c.style.setProperty('--cy', ((1 - o) * (p < s + .05 ? 40 : -40)).toFixed(1) + 'px');
    c.style.pointerEvents = o > .5 ? 'auto' : 'none';
  });
});

/* ---------- trending rail ---------- */
const featured = DESIGNS.filter(d => d.featured);
$('#rail').innerHTML = featured.map((d, i) => PW.designCard(d, i)).join('');
$('#designCount').textContent = DESIGNS.length;
// drag to scroll on desktop
const rail = $('#rail'); let down = null, moved = false;
rail.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; down = { x: e.clientX, s: rail.scrollLeft }; moved = false; });
addEventListener('pointermove', e => { if (!down) return; const dx = e.clientX - down.x; if (Math.abs(dx) > 5) { moved = true; rail.classList.add('dragging'); } rail.scrollLeft = down.s - dx; });
addEventListener('pointerup', () => { down = null; rail.classList.remove('dragging'); });
rail.addEventListener('click', e => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
$$('.rail-btn').forEach(b => b.addEventListener('click', () => rail.scrollBy({ left: (b.dataset.dir === 'next' ? 1 : -1) * rail.clientWidth * .8, behavior: reduced ? 'auto' : 'smooth' })));
// cards on the home page open the full gallery at that design
rail.addEventListener('click', e => { const q = e.target.closest('[data-quick]'); if (q) location.href = `designs.html?d=${encodeURIComponent(q.dataset.quick)}`; });

/* ---------- categories ---------- */
$('#cats').innerHTML = CATEGORIES.map((c, i) => {
  const list = DESIGNS.filter(d => d.tag === c);
  const picks = [list[0], list[Math.floor(list.length / 2)], list[list.length - 1]];
  return `<a class="cat reveal" style="--d:${i * .06}s" href="designs.html?cat=${encodeURIComponent(c)}">
    <span class="cat-phones">${picks.map(d => PW.miniPhone(d.id)).join('')}</span>
    <span class="cat-name">${esc(c)}</span><span class="cat-count">${list.length} designs →</span></a>`;
}).join('');
})();
