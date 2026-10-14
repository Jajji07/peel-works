/* =========================================================
   Peelworks catalog — settings, designs and products.
   Every design is drawn in code (no image files needed).
   ========================================================= */
(() => {
const CONFIG = {
  // Public address of YOUR server (server/server.py), no trailing slash.
  // Example: 'https://api.yourdomain.com'. Leave empty until the server runs.
  apiBase: '',
  shippingNote: 'Free shipping on every US order',
  skinPrice: 14,
  packPrice: 6,
  bundlePrice: 20,
  customPrice: 18,
  // Must match MODELS in server/server.py
  models: ['iPhone 17 Pro', 'iPhone 17', 'iPhone 16 Pro', 'iPhone 16', 'iPhone 15', 'Pixel 10', 'Galaxy S25'],
};

/* ---------- drawing helpers ---------- */
const W = 300, H = 615;               // skin area is 1 : 2.05
const f = n => (+n).toFixed(1);
const url = s => `url('data:image/svg+xml,${encodeURIComponent(s).replace(/'/g, '%27')}')`;
const svg = (body, w = W, h = H) => `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}' preserveAspectRatio='xMidYMid slice'>${body}</svg>`;
const cover = body => `${url(svg(body))} center/cover no-repeat`;
const tile = (body, w, size, bg) => `${url(svg(body, w, w))} 0 0/${size}px ${size}px, ${bg}`;
const vgrad = (id, a, b) => `<linearGradient id='${id}' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient>`;
function rng(seed) {
  let a = 0; for (const ch of seed) a = (a * 31 + ch.charCodeAt(0)) | 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ---------- design generators ---------- */
const MAKE = {
  trace: p => tile(`<rect width='120' height='120' fill='${p.bg}'/><g fill='none' stroke='${p.fg}' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><path d='M10 10h40v30h30'/><path d='M0 70h30l20 20h40v30'/><path d='M70 0v18h40'/><path d='M100 58h20M100 58v32'/><path d='M20 120v-22'/></g><g fill='${p.fg}'><circle cx='80' cy='40' r='5'/><circle cx='100' cy='90' r='5'/><circle cx='110' cy='18' r='5'/><circle cx='20' cy='96' r='4'/><circle cx='10' cy='10' r='4'/></g>`, 120, 80, p.bg),

  band: p => `linear-gradient(180deg, ${p.body} 0 13%, ${p.b[0]} 13% 21%, ${p.body} 21% 29%, ${p.b[1]} 29% 37%, ${p.body} 37% 45%, ${p.b[2]} 45% 53%, ${p.body} 53% 67%, ${p.b[3]} 67% 75%, ${p.body} 75% 100%)`,

  oscillo: p => {
    let g = '';
    for (let x = 0; x <= W; x += 30) g += `<path d='M${x} 0V${H}'/>`;
    for (let y = 0; y <= H; y += 30) g += `<path d='M0 ${y}H${W}'/>`;
    const wave = (y, a, fr, ph) => { let d = ''; for (let x = 0; x <= W; x += 5) d += (x ? 'L' : 'M') + x + ' ' + f(y + a * Math.sin(x / W * Math.PI * 2 * fr + ph)) + ' '; return d; };
    return cover(`<rect width='${W}' height='${H}' fill='${p.bg}'/><g stroke='${p.grid}' stroke-width='1'>${g}</g><g fill='none' stroke-width='3' stroke-linecap='round'><path d='${wave(190, 45, 2, 0)}' stroke='${p.w[0]}'/><path d='${wave(330, 30, 3.5, 1)}' stroke='${p.w[1]}'/><path d='${wave(470, 55, 1.5, 2)}' stroke='${p.w[2]}'/></g>`);
  },

  logic: p => tile(`<rect width='100' height='100' fill='${p.bg}'/><g fill='none' stroke='${p.fg}' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='M28 30h16a16 16 0 0 1 0 32h-16z'/><path d='M12 38h16M12 54h16M60 46h14'/><circle cx='77' cy='46' r='3'/><path d='M80 46h20'/><path d='M50 75l12 8-12 8z'/><path d='M38 83h12M62 83h10'/></g>`, 100, 70, p.bg),

  cascade: p => {
    const r = rng('cascade' + p.s[0]); let trees = '';
    for (let i = 0; i < 13; i++) { const x = i * 24 - 6, h = 70 + r() * 50; trees += `M${f(x)} ${H}L${f(x + 14)} ${f(H - h)}L${f(x + 28)} ${H}Z `; }
    return cover(`<defs><linearGradient id='s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='${p.s[0]}'/><stop offset='.5' stop-color='${p.s[1]}'/><stop offset='1' stop-color='${p.s[2]}'/></linearGradient></defs><rect width='${W}' height='${H}' fill='url(#s)'/><circle cx='205' cy='215' r='48' fill='${p.sun}'/><path d='M0 360L70 255L120 315L190 205L300 335V${H}H0Z' fill='${p.m[0]}'/><path d='M168 236L190 205L214 236L200 230L190 240Z' fill='${p.snow}' opacity='.85'/><path d='M0 440L60 375L130 425L210 335L300 415V${H}H0Z' fill='${p.m[1]}'/><path d='${trees}' fill='${p.m[2]}'/>`);
  },

  rain: p => {
    const r = rng('rain' + p.top); let lines = '', drops = '';
    for (let i = 0; i < 140; i++) { const x = r() * 340 - 20, y = r() * 660 - 30, l = 14 + r() * 26; lines += `<path d='M${f(x)} ${f(y)}l${f(-l * .35)} ${f(l)}'/>`; }
    for (let i = 0; i < 30; i++) drops += `<circle cx='${f(r() * W)}' cy='${f(r() * H)}' r='${f(1.5 + r() * 2)}'/>`;
    return cover(`<defs>${vgrad('g', p.top, p.bot)}</defs><rect width='${W}' height='${H}' fill='url(#g)'/><g stroke='${p.streak}' stroke-width='1.6' stroke-linecap='round' opacity='.55'>${lines}</g><g fill='${p.streak}' opacity='.7'>${drops}</g>`);
  },

  topo: p => {
    const ring = (cx, cy, rad, k) => { let d = ''; for (let i = 0; i <= 72; i++) { const a = i / 72 * Math.PI * 2, rr = rad * (1 + .16 * Math.sin(3 * a + k * .5) + .08 * Math.sin(5 * a + k)); d += (i ? 'L' : 'M') + f(cx + rr * Math.cos(a)) + ' ' + f(cy + rr * Math.sin(a)); } return d + 'Z'; };
    let d = '';
    for (let k = 1; k <= 16; k++) d += ring(120, 230, k * 20, k);
    for (let k = 1; k <= 12; k++) d += ring(240, 520, k * 18, k + 3);
    return cover(`<rect width='${W}' height='${H}' fill='${p.bg}'/><path d='${d}' fill='none' stroke='${p.line}' stroke-width='2' opacity='.9'/>`);
  },

  liquid: p => `radial-gradient(circle at 28% 18%, rgba(255,255,255,.9), transparent 30%), radial-gradient(circle at 75% 70%, rgba(255,255,255,.55), transparent 28%), conic-gradient(from 210deg at 55% 55%, ${p.c[0]}, ${p.c[1]}, ${p.c[2]}, ${p.c[3]}, ${p.c[0]})`,

  sundown: p => {
    let stripes = '', grid = '';
    for (let i = 0; i < 6; i++) stripes += `<rect x='40' y='${252 + i * 13}' width='220' height='${f(2.5 + i * 1.4)}' fill='${p.stripe}'/>`;
    for (let i = -10; i <= 10; i++) grid += `<path d='M${150 + i * 5} 330L${150 + i * 55} ${H}'/>`;
    for (let k = 1; k <= 9; k++) grid += `<path d='M0 ${f(330 + 285 * (k / 9) ** 2)}H${W}'/>`;
    return cover(`<defs>${vgrad('k', p.sky[0], p.sky[1])}${vgrad('u', p.sun[0], p.sun[1])}</defs><rect width='${W}' height='330' fill='url(#k)'/><circle cx='150' cy='270' r='96' fill='url(#u)'/>${stripes}<rect y='330' width='${W}' height='${H - 330}' fill='${p.ground}'/><g stroke='${p.grid}' stroke-width='1.6' opacity='.85'>${grid}</g>`);
  },

  aura: p => `radial-gradient(circle at 20% 22%, ${p.c[0]} 0, transparent 46%), radial-gradient(circle at 82% 45%, ${p.c[1]} 0, transparent 50%), radial-gradient(circle at 35% 85%, ${p.c[2]} 0, transparent 50%), ${p.bg}`,

  sakura: p => {
    const r = rng('sakura' + p.petal + p.s[0]); let petals = '', blossoms = '';
    const flower = (x, y, s) => `<g transform='translate(${f(x)} ${f(y)}) scale(${s.toFixed(2)})'>${[0, 72, 144, 216, 288].map(a => `<ellipse cx='0' cy='-9' rx='6' ry='9' transform='rotate(${a})'/>`).join('')}<circle r='3.5' fill='${p.center}'/></g>`;
    for (let i = 0; i < 55; i++) petals += `<path transform='translate(${f(r() * W)} ${f(r() * H)}) rotate(${f(r() * 360)}) scale(${(.6 + r() * 1.1).toFixed(2)})' d='M0 0C6-8 14-4 12 4C10 10 2 8 0 0Z'/>`;
    [[40, 128, 1.1], [95, 132, 1.3], [150, 128, 1], [190, 150, 1.2], [85, 100, .9], [120, 84, 1.1], [30, 160, .8]].forEach(([x, y, s]) => blossoms += flower(x, y, s));
    for (let i = 0; i < 6; i++) blossoms += flower(r() * W, 250 + r() * 340, .7 + r() * .6);
    return cover(`<defs>${vgrad('g', p.s[0], p.s[1])}</defs><rect width='${W}' height='${H}' fill='url(#g)'/><circle cx='215' cy='175' r='58' fill='${p.moon}' opacity='.92'/><g fill='none' stroke='${p.branch}' stroke-linecap='round'><path d='M-10 120C60 140 120 110 195 152' stroke-width='7'/><path d='M60 133C80 104 100 92 132 82' stroke-width='4'/><path d='M140 125C150 140 165 152 178 170' stroke-width='3'/></g><g fill='${p.petal}'>${blossoms}</g><g fill='${p.petal}' opacity='.9'>${petals}</g>`);
  },

  alley: p => {
    const r = rng('alley' + p.n[0]); let far = '', near = '', win = '', neon = '';
    let x = -10; while (x < W) { const w = 26 + r() * 40, h = 260 + r() * 230; far += `<rect x='${f(x)}' y='${f(H - h)}' width='${f(w)}' height='${f(h)}'/>`; x += w + 3; }
    x = -10;
    while (x < W) {
      const w = 34 + r() * 46, h = 170 + r() * 260, y = H - h;
      near += `<rect x='${f(x)}' y='${f(y)}' width='${f(w)}' height='${f(h)}'/>`;
      for (let wy = y + 12; wy < H - 20; wy += 16) for (let wx = x + 6; wx < x + w - 8; wx += 11) if (r() < .33) win += `<rect x='${f(wx)}' y='${f(wy)}' width='5' height='7'/>`;
      if (r() < .7) { const col = r() < .5 ? p.n[0] : p.n[1], sx = x + w * .35, sy = y + 24 + r() * 110, sh = 40 + r() * 70; neon += `<rect x='${f(sx)}' y='${f(sy)}' width='14' height='${f(sh)}' rx='5' stroke='${col}'/>`; }
      x += w + 2;
    }
    return cover(`<defs>${vgrad('g', p.s[0], p.s[1])}</defs><rect width='${W}' height='${H}' fill='url(#g)'/><g fill='${p.far}'>${far}</g><g fill='${p.bld}'>${near}</g><g fill='${p.win}' opacity='.85'>${win}</g><g fill='none' stroke-width='9' opacity='.22'>${neon}</g><g fill='none' stroke-width='3'>${neon}</g>`);
  },

  ink: p => {
    const ridge = (base, amp, seed) => { let d = `M0 ${H}`; for (let x = 0; x <= W; x += 6) d += `L${x} ${f(base - amp * (.6 * Math.abs(Math.sin(x * .02 + seed)) + .4 * Math.abs(Math.sin(x * .047 + seed * 2.1))))}`; return d + `L${W} ${H}Z`; };
    const layers = [[330, 150, .3, 1.2], [400, 120, .48, 2.7], [470, 95, .7, 4.1], [545, 70, .95, 5.3]].map(([b, a, o, s]) => `<path d='${ridge(b, a, s)}' fill='${p.ink}' opacity='${o}'/>`).join('');
    return cover(`<rect width='${W}' height='${H}' fill='${p.paper}'/><circle cx='205' cy='180' r='38' fill='${p.sun}'/><g fill='none' stroke='${p.ink}' stroke-width='2' stroke-linecap='round' opacity='.7'><path d='M70 120q8-7 16 0q8-7 16 0'/><path d='M110 150q6-5 12 0q6-5 12 0'/></g>${layers}`);
  },

  koi: p => {
    const r = rng('koi' + p.water[0]); let ripples = '';
    for (let i = 0; i < 9; i++) { const cx = r() * W, cy = r() * H, rx = 20 + r() * 40; ripples += `<ellipse cx='${f(cx)}' cy='${f(cy)}' rx='${f(rx)}' ry='${f(rx * .45)}'/><ellipse cx='${f(cx)}' cy='${f(cy)}' rx='${f(rx * .6)}' ry='${f(rx * .27)}'/>`; }
    const fish = (x, y, rot, s) => `<g transform='translate(${x} ${y}) rotate(${rot}) scale(${s})'><path d='M78 0L100-15L94 0L100 15Z' fill='${p.f[0]}' opacity='.85'/><path d='M30-9L42-20L48-8ZM30 9L42 20L48 8Z' fill='${p.f[0]}' opacity='.8'/><path d='M0 0C20-14 60-12 80 0C60 12 20 14 0 0Z' fill='${p.f[0]}'/><circle cx='28' cy='-3' r='5' fill='${p.f[1]}'/><circle cx='47' cy='3' r='6' fill='${p.f[1]}'/><circle cx='8' cy='-2.5' r='2' fill='#111'/></g>`;
    const pad = (x, y, rot, s) => `<path transform='translate(${x} ${y}) rotate(${rot}) scale(${s})' d='M0 0L22-6A23 23 0 1 1 22 6Z' fill='${p.pad}'/>`;
    return cover(`<defs>${vgrad('g', p.water[0], p.water[1])}</defs><rect width='${W}' height='${H}' fill='url(#g)'/><g fill='none' stroke='${p.ripple}' stroke-width='1.5' opacity='.35'>${ripples}</g>${pad(240, 90, 30, 1.6)}${pad(40, 420, 200, 1.3)}${pad(250, 560, 120, 1.1)}${fish(50, 180, -20, 1.3)}${fish(250, 350, 160, 1.5)}${fish(70, 520, 8, 1.15)}`);
  },

  speed: p => {
    const r = rng('speed' + p.bg); let rays = '', dots = '';
    const cx = 150, cy = 300;
    for (let i = 0; i < 110; i++) {
      const a = i / 110 * Math.PI * 2 + r() * .03, inner = 110 + r() * 90, w = .01 + r() * .02;
      rays += `M${f(cx + inner * Math.cos(a))} ${f(cy + inner * Math.sin(a))}L${f(cx + 800 * Math.cos(a - w))} ${f(cy + 800 * Math.sin(a - w))}L${f(cx + 800 * Math.cos(a + w))} ${f(cy + 800 * Math.sin(a + w))}Z`;
    }
    for (let gy = 0; gy <= H; gy += 14) for (let gx = 0; gx <= W; gx += 14) {
      const rad = Math.max(5.5 - Math.hypot(gx, gy - H) / 45, 5 - Math.hypot(gx - W, gy) / 40);
      if (rad > .5) dots += `<circle cx='${gx}' cy='${gy}' r='${f(rad)}'/>`;
    }
    return cover(`<rect width='${W}' height='${H}' fill='${p.bg}'/><path d='${rays}' fill='${p.line}'/><g fill='${p.dot}'>${dots}</g>`);
  },

  halftone: p => {
    let dots = '';
    for (let gy = 8; gy <= H; gy += 15) for (let gx = 8; gx <= W; gx += 15) { const rad = 6.2 * (gy / H) ** 1.2; if (rad > .4) dots += `<circle cx='${gx}' cy='${gy}' r='${f(rad)}'/>`; }
    return cover(`<rect width='${W}' height='${H}' fill='${p.bg}'/><circle cx='190' cy='230' r='118' fill='${p.accent}'/><g fill='${p.dot}'>${dots}</g>`);
  },

  terrazzo: p => {
    const r = rng('terrazzo' + p.bg); let chips = '';
    for (let i = 0; i < 170; i++) {
      const cx = r() * W, cy = r() * H, s = 4 + r() * 9, a0 = r() * 6.3;
      const pts = [0, 2.1 + r() * .5, 4.2 + r() * .5].map(o => `${f(cx + s * Math.cos(a0 + o))},${f(cy + s * Math.sin(a0 + o))}`).join(' ');
      chips += `<polygon points='${pts}' fill='${p.chips[i % p.chips.length]}'/>`;
    }
    return cover(`<rect width='${W}' height='${H}' fill='${p.bg}'/>${chips}`);
  },

  racer: p => `linear-gradient(90deg, ${p.bg} 0 56%, ${p.s[0]} 56% 66%, ${p.bg} 66% 70%, ${p.s[1]} 70% 76%, ${p.bg} 76%)`,

  swell: p => {
    let bands = '';
    for (let k = 0; k < 6; k++) {
      const y0 = H * (k + 1) / 7 - 40; let d = `M0 ${f(y0)}`;
      for (let x = 0; x <= W; x += 6) d += `L${x} ${f(y0 + 16 * Math.sin(x / W * Math.PI * 2 * 1.5 + k * 1.3))}`;
      bands += `<path d='${d}L${W} ${H}L0 ${H}Z' fill='${p.c[k]}'/>`;
    }
    return cover(`<rect width='${W}' height='${H}' fill='${p.c[0]}'/>${bands}`);
  },
};

/* ---------- design families + colorways ---------- */
// [colorway name, palette, optional fixed id]
const BASES = [
  { id: 'trace', name: 'Trace', tag: 'Circuits', desc: 'Circuit-board traces, inspired by the boards on every engineer’s desk.', ways: [
    ['Gold', { bg: '#0b3d2e', fg: '#d9a94e' }, 'trace'], ['Copper', { bg: '#101b33', fg: '#e08a4f' }], ['Mint', { bg: '#0e0f10', fg: '#3dffb0' }], ['Rose', { bg: '#2a0f1f', fg: '#ff7aa8' }]] },
  { id: 'band', name: 'Band', tag: 'Circuits', desc: 'Oversized resistor color bands. Nerdy if you know, just stylish if you don’t.', ways: [
    ['Classic', { body: '#efe4cc', b: ['#6b3e1f', '#151515', '#e0372b', '#c9a227'] }, 'band'], ['Midnight', { body: '#14141a', b: ['#ff6b3d', '#ffd23d', '#3dd9ff', '#b98cff'] }], ['Film', { body: '#3d6fd1', b: ['#f2efe6', '#151515', '#ff5b5b', '#d9c27a'] }]] },
  { id: 'oscillo', name: 'Oscillo', tag: 'Circuits', desc: 'Signals on a scope grid. Three channels, always running.', ways: [
    ['Phosphor', { bg: '#06100a', grid: '#14301f', w: ['#3dff8f', '#ffd43d', '#3dd9ff'] }, 'oscillo'], ['Amber', { bg: '#120a02', grid: '#2e1d08', w: ['#ffb02e', '#ff8a1f', '#ffd27a'] }], ['Paper', { bg: '#f3efe4', grid: '#ddd5c2', w: ['#111111', '#e0372b', '#2f62d9'] }], ['Ultra', { bg: '#0c0820', grid: '#231a4d', w: ['#ff4fd8', '#7c5cff', '#3dd9ff'] }]] },
  { id: 'logic', name: 'Logic', tag: 'Circuits', desc: 'A tiled field of logic gates, drawn like a clean schematic.', ways: [
    ['Blueprint', { bg: '#163d73', fg: '#e8f1ff' }], ['Neon', { bg: '#0b0b10', fg: '#c6ff3d' }], ['Cream', { bg: '#f1ead9', fg: '#1b1b1b' }]] },
  { id: 'cascade', name: 'Cascade', tag: 'Northwest', desc: 'Peaks, pines and big sky. A little piece of the PNW for your pocket.', ways: [
    ['Dusk', { s: ['#ffc29a', '#f2817f', '#6d4f9c'], sun: '#ffe6b8', m: ['#4b3c7c', '#30295d', '#18163a'], snow: '#ffffff' }, 'cascade'], ['Night', { s: ['#0b1630', '#1d2f63', '#2c4a8a'], sun: '#f2f4ff', m: ['#24386b', '#182850', '#0b142e'], snow: '#dfe8ff' }], ['Mist', { s: ['#e9efe9', '#c8d6cf', '#9fb3a8'], sun: '#ffffff', m: ['#7f978b', '#5d7569', '#3a5146'], snow: '#ffffff' }], ['Sunrise', { s: ['#ffe39a', '#ffb35c', '#f26b4f'], sun: '#fff6d8', m: ['#c4553f', '#8f3a33', '#4e1f2a'], snow: '#ffffff' }]] },
  { id: 'rain', name: 'Drizzle', tag: 'Northwest', desc: 'Soft diagonal rain over a moody gradient. Very Seattle.', ways: [
    ['Slate', { top: '#3b4a5c', bot: '#141b24', streak: '#cfe1ff' }], ['Teal', { top: '#1f6f78', bot: '#0b2730', streak: '#bff6ff' }], ['Violet', { top: '#5a3d8a', bot: '#1a1030', streak: '#f0d9ff' }]] },
  { id: 'topo', name: 'Topo', tag: 'Northwest', desc: 'Contour lines from an imaginary trail map.', ways: [
    ['Trail', { bg: '#e9dcc2', line: '#8a5a2b' }], ['Night', { bg: '#101214', line: '#ff8a3d' }], ['Forest', { bg: '#163323', line: '#b7f06a' }], ['Paper', { bg: '#fafafa', line: '#1a1a1a' }]] },
  { id: 'liquid', name: 'Liquid', tag: 'Aesthetic', desc: 'Soft iridescent chrome that shifts as you tilt it.', ways: [
    ['Pastel', { c: ['#b9c6ff', '#f3d0ff', '#c4f4e8', '#fff1c0'] }, 'liquid'], ['Sunset', { c: ['#ffc2a8', '#ff8fb1', '#ffd57e', '#f7a8ff'] }], ['Ocean', { c: ['#8fd3ff', '#a6fff0', '#7c9cff', '#d6f7ff'] }], ['Chrome', { c: ['#d9d9de', '#9a9aa3', '#f4f4f6', '#b8bcc6'] }]] },
  { id: 'sundown', name: 'Sundown', tag: 'Aesthetic', desc: 'A retro sun over an endless neon grid. Loud in the best way.', ways: [
    ['Synth', { sky: ['#1b0b3d', '#ff4f8b'], sun: ['#ffd76e', '#ff3d77'], stripe: '#df4580', ground: '#13062c', grid: '#ff52d9' }, 'sundown'], ['Tidal', { sky: ['#03142b', '#1fb5c9'], sun: ['#c8fff4', '#38d9ff'], stripe: '#1a9fb3', ground: '#020d1c', grid: '#3dfff0' }], ['Ember', { sky: ['#1a0605', '#ff6a2b'], sun: ['#fff0a8', '#ff9d2b'], stripe: '#e6552b', ground: '#140504', grid: '#ffb02e' }]] },
  { id: 'aura', name: 'Aura', tag: 'Aesthetic', desc: 'Glowing, blurry color fields. Calm and a little dreamy.', ways: [
    ['Bloom', { bg: '#fdf3ee', c: ['#ffb39c', '#c2b2ff', '#9fe8d2'] }], ['Dusk', { bg: '#1a1530', c: ['#ff5b8a', '#7c5cff', '#2fd3a6'] }], ['Citrus', { bg: '#fffbe8', c: ['#ffd23d', '#ff8a3d', '#9be15d'] }]] },
  { id: 'sakura', name: 'Sakura', tag: 'Anime-style', desc: 'Cherry blossom petals drifting past a full moon.', ways: [
    ['Night', { s: ['#0d1033', '#2b2160'], moon: '#fff4dc', petal: '#ffb7d1', center: '#ff6f9e', branch: '#1a0d14' }], ['Dawn', { s: ['#ffe3ec', '#ffc3d6'], moon: '#ffffff', petal: '#ffffff', center: '#ff8fb1', branch: '#5a3a3a' }], ['Ember', { s: ['#140a0a', '#2b0f12'], moon: '#ffd6a8', petal: '#ff5b5b', center: '#ffd23d', branch: '#000000' }]] },
  { id: 'alley', name: 'Neon Alley', tag: 'Anime-style', desc: 'A neon-lit city alley after dark, glowing signs and all.', ways: [
    ['Magenta', { s: ['#120a2a', '#3b1450'], far: '#1d1236', bld: '#0b0716', win: '#ffd88a', n: ['#ff3dbb', '#3de8ff'] }], ['Amber', { s: ['#0d1418', '#1c3a40'], far: '#13242a', bld: '#081014', win: '#ffe08a', n: ['#ff8a3d', '#3dffd2'] }], ['Toxic', { s: ['#0a1408', '#1d3a1a'], far: '#132a12', bld: '#060d05', win: '#e6ff8a', n: ['#9dff3d', '#c13dff'] }]] },
  { id: 'ink', name: 'Ink Peaks', tag: 'Anime-style', desc: 'Misty mountains in ink-wash layers with a single red sun.', ways: [
    ['Paper', { paper: '#f3ede0', ink: '#1d1d1f', sun: '#d63a2f' }], ['Moon', { paper: '#121316', ink: '#c9ccd3', sun: '#f1e6c8' }], ['Indigo', { paper: '#e6ebf5', ink: '#1f2f5c', sun: '#e5533d' }]] },
  { id: 'koi', name: 'Koi Pond', tag: 'Anime-style', desc: 'Koi gliding through a quiet pond between lily pads.', ways: [
    ['Pond', { water: ['#1d7c86', '#0b3d47'], f: ['#ff7a2e', '#ffffff'], ripple: '#bff6ff', pad: '#3f9c4a' }], ['Night', { water: ['#0e1a2b', '#050a12'], f: ['#ffc83d', '#ff6a2b'], ripple: '#6a8bb5', pad: '#1f5a3a' }], ['Snow', { water: ['#f2f6f7', '#cfe2e6'], f: ['#e0372b', '#111111'], ripple: '#7aa8b3', pad: '#6fae6a' }]] },
  { id: 'speed', name: 'Speedlines', tag: 'Anime-style', desc: 'Manga-style speed lines for a maximum dramatic entrance.', ways: [
    ['Ink', { bg: '#ffffff', line: '#111111', dot: '#111111' }], ['Volt', { bg: '#ffe03d', line: '#111111', dot: '#111111' }], ['Crimson', { bg: '#e0262b', line: '#ffffff', dot: '#ffffff' }]] },
  { id: 'halftone', name: 'Halftone', tag: 'Anime-style', desc: 'Comic halftone dots with one bold pop of color.', ways: [
    ['Pop', { bg: '#ffd9e6', dot: '#ff3d7a', accent: '#2f62d9' }], ['Lemon', { bg: '#fff6c2', dot: '#111111', accent: '#ff5b2e' }], ['Cyan', { bg: '#d7f7ff', dot: '#0a6fb8', accent: '#ffd23d' }]] },
  { id: 'terrazzo', name: 'Terrazzo', tag: 'Minimal', desc: 'Confetti-like stone chips on a smooth base.', ways: [
    ['Classic', { bg: '#f3eee6', chips: ['#e07a5f', '#3d405b', '#81b29a', '#f2cc8f'] }], ['Night', { bg: '#1b1b22', chips: ['#ff8a3d', '#7c5cff', '#2fd3a6', '#f2f2f2'] }], ['Candy', { bg: '#ffe9f1', chips: ['#ff5b8a', '#5bc0ff', '#ffd23d', '#7ad97a'] }]] },
  { id: 'racer', name: 'Racer', tag: 'Minimal', desc: 'Two clean racing stripes. Simple and fast-looking.', ways: [
    ['Classic', { bg: '#f2f2ef', s: ['#111111', '#e0262b'] }], ['Night', { bg: '#111114', s: ['#ffd23d', '#ffffff'] }], ['Mint', { bg: '#bff0dc', s: ['#0b3d2e', '#ffffff'] }]] },
  { id: 'swell', name: 'Swell', tag: 'Minimal', desc: 'Stacked waves in layered color.', ways: [
    ['Ocean', { c: ['#d6f3ff', '#9ad8f0', '#4fa9d6', '#2a6fb0', '#173e75', '#0b1f40'] }], ['Sunset', { c: ['#ffe9c7', '#ffc58a', '#ff9468', '#e6576b', '#a8366e', '#5b2163'] }], ['Forest', { c: ['#e6f2d7', '#b7d99c', '#7fb56b', '#4f8a4a', '#2f5e34', '#183a22'] }]] },
];
const CATEGORIES = ['Circuits', 'Northwest', 'Aesthetic', 'Anime-style', 'Minimal'];

const mixWhite = (hex, t) => { const n = parseInt(hex.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v + (255 - v) * t)); return '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''); };

const DESIGNS = [];
BASES.forEach(b => b.ways.forEach(([way, pal, fixed], i) => {
  const first = (JSON.stringify(pal).match(/#[0-9a-f]{6}/i) || ['#dddddd'])[0];
  DESIGNS.push({
    id: fixed || `${b.id}-${way.toLowerCase()}`, base: b.id, name: b.name, way, tag: b.tag, desc: b.desc,
    featured: i === 0, bg: MAKE[b.id](pal), tint: mixWhite(first, .84),
  });
}));
const D = Object.fromEntries(DESIGNS.map(d => [d.id, d]));

const PRODUCTS = [
  ...DESIGNS.map(d => ({ id: 'skin-' + d.id, type: 'skin', name: `${d.name} skin`, price: CONFIG.skinPrice, design: d.id })),
  { id: 'custom', type: 'custom', name: 'Custom photo skin', sub: 'Upload your own picture', price: CONFIG.customPrice },
  { id: 'pack-eng', type: 'pack', name: 'Engineer Pack', sub: '5 vinyl stickers', price: CONFIG.packPrice, designs: ['trace', 'band', 'oscillo'] },
  { id: 'pack-nw', type: 'pack', name: 'Northwest Pack', sub: '5 vinyl stickers', price: CONFIG.packPrice, designs: ['cascade', 'topo-trail', 'rain-teal'] },
  { id: 'pack-anime', type: 'pack', name: 'Anime-style Pack', sub: '5 vinyl stickers', price: CONFIG.packPrice, designs: ['sakura-night', 'alley-magenta', 'koi-pond'] },
  { id: 'bundle', type: 'bundle', name: 'Skin + sticker bundle', sub: 'Any skin + 5 matching stickers', price: CONFIG.bundlePrice },
];
const P = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));

window.PW_CATALOG = { CONFIG, BASES, CATEGORIES, DESIGNS, D, PRODUCTS, P };
})();
