/* Invitación animada — Magno Evento Empresarial (Black Ring Business Network)
 *
 * Motor determinista: cada cuadro se calcula sólo a partir de t (segundos).
 * seek(t) deja el escenario exactamente en ese instante; el render a video
 * (render/render.mjs) llama seek() cuadro por cuadro y captura la pantalla.
 * Abierto en un navegador normal funciona como reproductor con controles.
 */
(() => {
'use strict';

const C = window.CONFIG, K = C.cues, EV = C.evento;
const W = 1080, H = 1920, TAU = Math.PI * 2, D2R = Math.PI / 180;
const RENDER = /[?&]render=1/.test(location.search);
const $ = (s, r = document) => r.querySelector(s);

/* ------------------------------------------------------------------ utilidades */
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, p) => a + (b - a) * p;
const E = {
  lin: x => x,
  inQuad: x => x * x,
  outQuad: x => 1 - (1 - x) * (1 - x),
  inCubic: x => x * x * x,
  outCubic: x => 1 - Math.pow(1 - x, 3),
  inOutCubic: x => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outQuart: x => 1 - Math.pow(1 - x, 4),
  outExpo: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inOutSine: x => -(Math.cos(Math.PI * x) - 1) / 2,
  outBack: x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  outBounce: x => {
    const n = 7.5625, d = 2.75;
    if (x < 1 / d) return n * x * x;
    if (x < 2 / d) return n * (x -= 1.5 / d) * x + .75;
    if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + .9375;
    return n * (x -= 2.625 / d) * x + .984375;
  },
};
// progreso 0..1 de una animación que empieza en t0 y dura d
const P = (t, t0, d, e = E.outCubic) => e(clamp((t - t0) / d));
// interpolación por fotogramas clave: [[t, v1, v2, ...], ...]
function kf(t, frames, e = E.inOutSine) {
  if (t <= frames[0][0]) return frames[0].slice(1);
  for (let i = 0; i < frames.length - 1; i++) {
    const a = frames[i], b = frames[i + 1];
    if (t < b[0]) { const p = e((t - a[0]) / (b[0] - a[0])); return a.slice(1).map((v, k) => lerp(v, b[k + 1], p)); }
  }
  return frames[frames.length - 1].slice(1);
}
// PRNG con semilla (mulberry32): mismo resultado en cada render
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f2 = n => n.toFixed(2);

function S(el, o) {
  let tf = '';
  if (o.x || o.y) tf += `translate(${f2(o.x || 0)}px,${f2(o.y || 0)}px) `;
  if (o.ry) tf += `rotateY(${f2(o.ry)}deg) `;
  if (o.r) tf += `rotate(${f2(o.r)}deg) `;
  if (o.s != null && o.s !== 1) tf += `scale(${o.s.toFixed(4)}) `;
  if (o.sx != null) tf += `scaleX(${o.sx.toFixed(4)}) `;
  if (o.sy != null) tf += `scaleY(${o.sy.toFixed(4)}) `;
  el.style.transform = tf;
  if (o.o != null) el.style.opacity = clamp(o.o).toFixed(3);
  if (o.blur != null) el.style.filter = o.blur > .05 ? `blur(${f2(o.blur)}px)` : '';
  if (o.clip != null) el.style.clipPath = o.clip;
}
const vis = (el, on) => { const v = on ? 'visible' : 'hidden'; if (el.style.visibility !== v) el.style.visibility = v; };
function mk(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
function splitChars(node, text, cls = '') {
  node.textContent = '';
  return [...text].map(ch => mk('span', 'ch ' + cls, node, ch === ' ' ? ' ' : ch));
}

/* ------------------------------------------------------------------ construcción */
const stage = $('#stage'), cam = $('#cam');
const SC = { s1: $('#s1'), s2: $('#s2'), s3: $('#s3'), s4: $('#s4'), s5a: $('#s5a'), s5b: $('#s5b') };

// Bisel metálico (SVG): luz especular animable por palabra
const defs = $('#defs defs');
const BEV = {};
function bevel(id, o = {}) {
  const { lx = 280, ly = -240, lz = 300, spec = 1.15, exp = 26, depth = 6, dil = 2.5, sb = 16, sy = 18, surf = 6, blur = 3 } = o;
  defs.insertAdjacentHTML('beforeend', `
    <filter id="${id}" x="-20%" y="-45%" width="140%" height="200%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="${blur}" result="b"/>
      <feSpecularLighting in="b" surfaceScale="${surf}" specularConstant="${spec}" specularExponent="${exp}" lighting-color="#fff4d6" result="s">
        <fePointLight x="${lx}" y="${ly}" z="${lz}"/>
      </feSpecularLighting>
      <feComposite in="s" in2="SourceAlpha" operator="in" result="si"/>
      <feComposite in="SourceGraphic" in2="si" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="lit"/>
      <feMorphology in="SourceAlpha" operator="dilate" radius="${dil}" result="d"/>
      <feFlood flood-color="#3a2404"/><feComposite in2="d" operator="in" result="edge"/>
      <feOffset in="edge" dy="${depth}" result="ext"/>
      <feGaussianBlur in="SourceAlpha" stdDeviation="${sb}" result="sh"/><feOffset in="sh" dy="${sy}" result="sho"/>
      <feFlood flood-color="#000" flood-opacity=".9"/><feComposite in2="sho" operator="in" result="shadow"/>
      <feMerge><feMergeNode in="shadow"/><feMergeNode in="ext"/><feMergeNode in="edge"/><feMergeNode in="lit"/></feMerge>
    </filter>`);
  const f = document.getElementById(id);
  BEV[id] = { light: f.querySelector('fePointLight'), spec: f.querySelector('feSpecularLighting'), base: spec, lx };
}
bevel('fMagno'); bevel('fEvento');
bevel('fDia', { surf: 8, blur: 4, depth: 8, dil: 3.5, sb: 22, sy: 24, lx: 300 });
bevel('fMagno2', { surf: 5, blur: 2.4, depth: 4, dil: 2, sb: 12, sy: 12 });
bevel('fEvento2', { surf: 5, blur: 2.4, depth: 4, dil: 2, sb: 12, sy: 12 });

// Logo "BLΛCK RING® / BUSINESS / NETWORK"
function makeLogo(root) {
  const main = mk('div', 'logo-main', root);
  const chars = [];
  let lam = null;
  for (const c of 'BLACK RING') {
    if (c === 'A') {
      lam = mk('span', 'ch lam', main);
      lam.innerHTML = '<svg viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="0,100 50,0 100,100 80,100 50,40 20,100" fill="url(#gLam)"/></svg>';
      chars.push(lam);
    } else chars.push(mk('span', 'ch silver', main, c === ' ' ? ' ' : c));
  }
  const reg = mk('span', 'reg', main, '®');
  const sub = mk('div', 'logo-sub', root, 'BUSINESS');
  const net = mk('div', 'logo-net', root);
  const l1 = mk('i', 'ln', net), nt = mk('span', '', net, 'NETWORK'), l2 = mk('i', 'ln r', net);
  return { root, main, chars, lam, reg, sub, nt, l1, l2 };
}

// Caja con marco dorado que se dibuja desde arriba al centro
function makeBox(root, o) {
  const { w, h, text, fs, ls, wings = 0 } = o, r = 10;
  root.style.width = w + 'px'; root.style.height = h + 'px'; root.style.marginLeft = -w / 2 + 'px';
  const fill = mk('div', 'fill', root);
  root.insertAdjacentHTML('beforeend', `<svg class="frame" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <path pathLength="1" d="M${w / 2} 0H${w - r}Q${w} 0 ${w} ${r}V${h - r}Q${w} ${h} ${w - r} ${h}H${w / 2}"/>
    <path pathLength="1" d="M${w / 2} 0H${r}Q0 0 0 ${r}V${h - r}Q0 ${h} ${r} ${h}H${w / 2}"/></svg>`);
  const paths = [...root.querySelectorAll('.frame path')];
  const bt = mk('div', 'bt', root);
  bt.style.fontSize = fs + 'px'; bt.style.letterSpacing = ls + 'em'; bt.style.paddingLeft = ls + 'em';
  const chars = splitChars(bt, text, 'gold');
  const wg = wings ? [mk('i', 'wing l', root), mk('i', 'wing r', root)] : [];
  wg.forEach(x => (x.style.width = wings + 'px'));
  return { root, fill, paths, chars, wings: wg };
}

const ICONS = {
  red: `<g fill="none" stroke="url(#gIcon)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="36" cy="22" r="8.5"/><path d="M21 53c0-9 6.5-15 15-15s15 6 15 15"/>
      <circle cx="14.5" cy="29" r="6.5"/><path d="M2.5 54c0-7 4.8-11.5 11.5-11.5 3 0 5.4.8 7.3 2.2"/>
      <circle cx="57.5" cy="29" r="6.5"/><path d="M69.5 54c0-7-4.8-11.5-11.5-11.5-3 0-5.4.8-7.3 2.2"/></g>`,
  cafe: `<g fill="none" stroke="url(#gIcon)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M13 34h37v8c0 10-8.3 17-18.5 17S13 52 13 42z"/><path d="M50 37.5h4a6.5 6.5 0 0 1 0 13h-5.5"/><path d="M7 65h52"/>
      <path class="steam" d="M23 27c-3-4 3-6 0-10s3-6 0-10"/><path class="steam" d="M31.5 27c-3-4 3-6 0-10s3-6 0-10"/><path class="steam" d="M40 27c-3-4 3-6 0-10s3-6 0-10"/></g>`,
  crecimiento: `<g fill="none" stroke="url(#gIcon)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 64h60"/><rect class="bar" x="11" y="50" width="10" height="14" rx="1.5"/><rect class="bar" x="27.5" y="41" width="10" height="23" rx="1.5"/>
      <rect class="bar" x="44" y="31" width="10" height="33" rx="1.5"/>
      <path class="arw" pathLength="1" d="M8 36 22 23l10 7L60 6"/><path class="arwh" d="M48.5 6H60v11.5"/></g>`,
  chip: `<g fill="none" stroke="url(#gIcon)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="17" y="17" width="38" height="38" rx="6"/>
      <path d="M27 17V9M36 17V9M45 17V9M27 55v8M36 55v8M45 55v8M17 27H9M17 36H9M17 45H9M55 27h8M55 36h8M55 45h8"/></g>
      <path class="spark" d="M36 24.5l2.9 8.6 8.6 2.9-8.6 2.9-2.9 8.6-2.9-8.6-8.6-2.9 8.6-2.9z" fill="url(#gIcon)"/>`,
  mas: `<g fill="url(#gIcon)"><circle class="dot" cx="19" cy="36" r="5.4"/><circle class="dot" cx="36" cy="36" r="5.4"/><circle class="dot" cx="53" cy="36" r="5.4"/></g>`,
};

/* escena 1 */
const L1 = makeLogo($('#logo1'));
/* escena 2 */
const hostsEl = $('#hosts');
const invitaCh = splitChars($('#invita'), EV.invita);
const magnoEl = $('#magno'), eventoEl = $('#evento');
$('#magno text').textContent = EV.titulo1;
$('#evento text').textContent = EV.titulo2;
const box1 = makeBox($('#box1'), { w: 700, h: 96, text: EV.titulo3, fs: 50, ls: .26, wings: 150 });
const fechaEl = $('#fecha');
fechaEl.innerHTML = `<span class="fit">${EV.fechaLinea} <b>·</b> ${EV.ciudad}</span>`;
const swCore = $('#swCore'), swGlow = $('#swGlow'), swHead = $('#swHead');
const SW_LEN = swCore.getTotalLength();
swCore.style.strokeDasharray = swGlow.style.strokeDasharray = '1';
/* escena 3 */
const h3 = $('#h3');
h3.querySelector('span').textContent = 'LO QUE VIVIRÁS';
const ROWS = C.pilares.map((p, i) => {
  const row = mk('div', 'row', $('#rows'));
  row.style.top = (470 + i * 205) + 'px';
  const ico = mk('div', 'ico', row);
  ico.innerHTML = `<svg class="ring" viewBox="0 0 140 140"><circle class="disk" cx="70" cy="70" r="63"/><circle class="stroke" cx="70" cy="70" r="67" pathLength="1"/></svg>
    <svg class="glyph" viewBox="0 0 72 72">${ICONS[p.icono] || ICONS.mas}</svg>`;
  const txt = mk('div', 'txt', row);
  const l1 = mk('div', 'l1', txt, p.l1);
  const l2 = p.l2 ? mk('div', 'l2 gold', txt, p.l2) : null;
  txt.style.top = (p.l2 ? 102 - 58 : 102 - 29) + 'px';
  const dv = i < C.pilares.length - 1 ? mk('i', 'dv', row) : null;
  const q = s => [...ico.querySelectorAll(s)];
  return { row, ico, ring: ico.querySelector('.stroke'), disk: ico.querySelector('.disk'), glyph: ico.querySelector('.glyph'),
    txt, l1, l2, dv, steam: q('.steam'), bars: q('.bar'), arw: q('.arw'), arwh: q('.arwh'), spark: q('.spark'), dots: q('.dot') };
});
ROWS.forEach(R => [...R.steam, ...R.bars, ...R.spark, ...R.dots, ...R.arwh].forEach(e => (e.style.transformBox = 'fill-box')));
ROWS.forEach(R => R.bars.forEach(b => (b.style.transformOrigin = '50% 100%')));
ROWS.forEach(R => [...R.spark, ...R.dots].forEach(e => (e.style.transformOrigin = '50% 50%')));
/* escena 4 */
const box4 = makeBox($('#box4'), { w: 640, h: 92, text: 'PATROCINADO POR', fs: 40, ls: .2, wings: 120 });
const CARDS = C.patrocinadores.slice(0, 9).map((s, i) => {
  const r = Math.floor(i / 3), c = i % 3;
  const card = mk('div', 'card', $('#grid'));
  card.style.left = (c * 330) + 'px'; card.style.top = (r * 304) + 'px';
  const inn = mk('div', 'card-in', card);
  const img = mk('img', '', inn); img.src = s.logo; img.alt = s.nombre;
  return { card, img, r, c };
});
/* escena 5a */
const fotoEl = $('#sede-foto'), diaEl = $('#dia');
$('#dia text').textContent = EV.dia;
const mesEl = $('#mes'), mesCh = splitChars(mesEl, EV.mes);
const rule5 = $('#rule5'), horaEl = $('#hora'), horaTxt = $('#horaTxt');
horaTxt.textContent = EV.horario;
const hh = $('#hh'), mh = $('#mh'), horaIco = horaEl.querySelector('svg');
[hh, mh].forEach(e => { e.style.transformBox = 'view-box'; e.style.transformOrigin = '36px 36px'; });
const pinBody = $('#pinBody'), pinShadow = $('#pinShadow');
pinShadow.style.transformBox = 'fill-box'; pinShadow.style.transformOrigin = '50% 50%';
const sede1 = $('#sede1'), sede2 = $('#sede2');
sede1.innerHTML = `<span class="fit">${EV.sede}</span>`; sede2.textContent = EV.sedeCiudad;
/* escena 5b */
const bigring = $('#bigring'), br1 = $('#br1'), br2 = $('#br2');
bigring.style.webkitMaskImage = bigring.style.maskImage = 'linear-gradient(180deg, #000 0px, #000 720px, transparent 930px)';
const L2 = makeLogo($('#logo2'));
const magno2El = $('#magno2'), evento2El = $('#evento2');
$('#magno2 text').textContent = EV.titulo1;
$('#evento2 text').textContent = EV.titulo2;
const box2 = makeBox($('#box2'), { w: 500, h: 64, text: EV.titulo3, fs: 34, ls: .26, wings: 110 });
const panel = $('#panel'), PRS = [...panel.querySelectorAll('.pr')];
$('#p1').textContent = EV.fechaLinea; $('#p2').textContent = EV.horario;
$('#p3').textContent = EV.sede; $('#p3b').textContent = EV.sedeCiudad;
const cta = $('#cta'), ctaShine = $('#cta i');
$('#ctaTxt').textContent = C.cta;
const webCh = splitChars($('#web'), C.web);
const lema1 = $('#lema1'), lema2 = $('#lema2');
lema1.textContent = C.lema[0]; lema2.textContent = C.lema[1] || '';

// Ajuste de textos largos para que nunca se salgan del cuadro (mide sin escalas CSS)
function shrinkToFit(el, max, min = 18) {
  let fs = parseFloat(getComputedStyle(el).fontSize);
  while (el.offsetWidth > max && fs > min) { fs -= 1; el.style.fontSize = fs + 'px'; }
}
function layoutFits() {
  const rowMax = 1080 - 330 - 48;
  const widest = Math.max(...ROWS.map(R => R.txt.offsetWidth));
  if (widest > rowMax) {
    const fs = Math.floor(50 * rowMax / widest);
    ROWS.forEach(R => [R.l1, R.l2].forEach(e => e && (e.style.fontSize = fs + 'px')));
  }
  shrinkToFit(fechaEl.querySelector('.fit'), 1000);
  shrinkToFit(sede1.querySelector('.fit'), 1000);
  const p3 = $('#p3'); p3.style.display = 'inline-block'; shrinkToFit(p3, 920 - 52 - 58 - 26 - 36);
  const ct = $('#ctaTxt'); shrinkToFit(ct, 720 - 64 - 58);
}

/* ------------------------------------------------------------------ escena 1: globo */
const gcv = $('#globe'), g = gcv.getContext('2d');
const GL = { cx: 540, cy: 760, R0: 250 };
const GDL = [20.6597 * D2R, -103.3496 * D2R];
const DOTS = (() => {
  const a = window.GLOBE_DOTS || [], n = a.length / 2, r = rng(11), out = new Float32Array(n * 5);
  for (let i = 0; i < n; i++) {
    const la = a[2 * i] * D2R, lo = a[2 * i + 1] * D2R;
    out.set([la, lo, r(), Math.cos(la), Math.sin(la)], i * 5);
  }
  return out;
})();

function sprite(r, stops) {
  const c = document.createElement('canvas'); c.width = c.height = r * 2;
  const x = c.getContext('2d'), gr = x.createRadialGradient(r, r, 0, r, r, r);
  stops.forEach(([o, col]) => gr.addColorStop(o, col));
  x.fillStyle = gr; x.fillRect(0, 0, r * 2, r * 2);
  return c;
}
const SPR_DOT = sprite(32, [[0, 'rgba(255,250,232,1)'], [.16, 'rgba(255,228,160,.9)'], [.42, 'rgba(232,172,64,.26)'], [1, 'rgba(200,140,40,0)']]);
const SPR_BOKEH = sprite(64, [[0, 'rgba(255,214,140,.5)'], [.62, 'rgba(255,200,110,.32)'], [.86, 'rgba(255,200,110,.12)'], [1, 'rgba(255,200,110,0)']]);
const SPR_STAR = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 160;
  const x = c.getContext('2d');
  x.translate(80, 80);
  x.drawImage(sprite(40, [[0, 'rgba(255,250,235,1)'], [.3, 'rgba(255,220,150,.55)'], [1, 'rgba(255,200,110,0)']]), -40, -40);
  for (const rot of [0, Math.PI / 2]) {
    x.save(); x.rotate(rot);
    const gr = x.createLinearGradient(-80, 0, 80, 0);
    gr.addColorStop(0, 'rgba(255,220,150,0)'); gr.addColorStop(.5, 'rgba(255,252,240,1)'); gr.addColorStop(1, 'rgba(255,220,150,0)');
    x.fillStyle = gr; x.beginPath(); x.moveTo(-80, 0); x.lineTo(0, -3.2); x.lineTo(80, 0); x.lineTo(0, 3.2); x.fill();
    x.restore();
  }
  return c;
})();

function view(t) {
  const pr = E.inOutSine(clamp(t / K.zoom));
  const zoom = clamp((t - K.zoom) / (K.s2 - K.zoom)), zE = E.inCubic(zoom);
  const R = GL.R0 * (.86 + .14 * P(t, 0, 1.6)) * Math.exp(4.6 * zE);
  return { lam: lerp(0, GDL[1], pr), phi: lerp(34 * D2R, GDL[0], pr), R, zoom, zE };
}
function proj(la, lo, v) {
  const cl = Math.cos(la), d = lo - v.lam, x = cl * Math.sin(d), y = Math.sin(la), z = cl * Math.cos(d);
  const sp = Math.sin(v.phi), cp = Math.cos(v.phi);
  return [GL.cx + v.R * x, GL.cy - v.R * (y * cp - z * sp), y * sp + z * cp];
}
function ringOf(t, v) {
  const rx = v.R * 1.5 * (1 + 2.6 * v.zE);
  return { p: P(t, K.ringStart, K.ringClose - K.ringStart, E.inOutCubic), rx, ry: rx * .3, rot: -13 * D2R, a0: .62 * Math.PI, fade: 1 - clamp(v.zoom / .5) };
}
function ringPt(s, a) {
  const x = s.rx * Math.cos(a), y = s.ry * Math.sin(a), c = Math.cos(s.rot), sn = Math.sin(s.rot);
  return [GL.cx + x * c - y * sn, GL.cy + x * sn + y * c];
}
function drawRing(s, t, half) {
  if (s.p <= 0 || s.fade <= 0) return;
  const end = s.a0 + TAU * s.p, segs = [];
  for (let k = -1; k <= 2; k++) {
    const lo = (half === 'front' ? 0 : Math.PI) + k * TAU, hi = lo + Math.PI;
    const a = Math.max(lo, s.a0), b = Math.min(hi, end);
    if (b > a) segs.push([a, b]);
  }
  const base = g.globalAlpha, dim = half === 'back' ? .5 : 1;
  g.save(); g.translate(GL.cx, GL.cy); g.rotate(s.rot);
  const gr = g.createLinearGradient(-s.rx, 0, s.rx, 0);
  gr.addColorStop(0, '#5e3d0c'); gr.addColorStop(.24, '#c99232'); gr.addColorStop(.5, '#fff1bf'); gr.addColorStop(.76, '#c99232'); gr.addColorStop(1, '#5e3d0c');
  g.lineCap = 'round';
  for (const [a, b] of segs) {
    g.globalAlpha = base * s.fade * .24 * dim; g.strokeStyle = '#f0b850'; g.lineWidth = Math.max(20, s.rx * .07); g.filter = 'blur(10px)';
    g.beginPath(); g.ellipse(0, 0, s.rx, s.ry, 0, a, b); g.stroke(); g.filter = 'none';
    g.globalAlpha = base * s.fade * dim; g.strokeStyle = gr; g.lineWidth = Math.max(9, s.rx * .028);
    g.beginPath(); g.ellipse(0, 0, s.rx, s.ry, 0, a, b); g.stroke();
    g.globalAlpha = base * s.fade * .85 * dim; g.strokeStyle = 'rgba(255,247,215,.9)'; g.lineWidth = Math.max(1.6, s.rx * .005);
    g.beginPath(); g.ellipse(0, -s.rx * .008, s.rx * .996, s.ry * .965, 0, a, b); g.stroke();
  }
  g.restore();
  // destello que recorre el anillo (cometa mientras se dibuja, brillo suave después)
  const head = s.p < 1 ? end : s.a0 + (t - K.ringClose) * 2.1;
  const inFront = Math.sin(head) > 0;
  if ((half === 'front') === inFront) {
    const [x, y] = ringPt(s, head), big = s.p < 1 ? 1 : .55;
    g.globalAlpha = base * s.fade * (half === 'back' ? .5 : 1);
    g.globalCompositeOperation = 'lighter';
    g.drawImage(SPR_DOT, x - 48 * big, y - 48 * big, 96 * big, 96 * big);
    g.globalCompositeOperation = 'source-over';
  }
  g.globalAlpha = base;
}
const BUCKETS = 10;
function drawGlobe(t) {
  g.clearRect(0, 0, W, H);
  const on = t < K.s2 + .02; vis(gcv, on); if (!on) return;
  const v = view(t), { cx, cy } = GL, R = v.R;
  g.globalAlpha = P(t, 0, .8) * (1 - P(t, K.s2 - .16, .16, E.inQuad));
  if (R < 4000) { // atmósfera dorada
    const at = g.createRadialGradient(cx, cy, R * .92, cx, cy, R * 1.3);
    at.addColorStop(0, 'rgba(232,180,80,.32)'); at.addColorStop(.35, 'rgba(232,180,80,.1)'); at.addColorStop(1, 'rgba(232,180,80,0)');
    g.fillStyle = at; g.beginPath(); g.arc(cx, cy, R * 1.3, 0, TAU); g.fill();
  }
  const s = ringOf(t, v);
  drawRing(s, t, 'back');
  const sg = g.createRadialGradient(cx - R * .35, cy - R * .4, R * .05, cx, cy, R * 1.05);
  sg.addColorStop(0, '#231c11'); sg.addColorStop(.55, '#0c0a07'); sg.addColorStop(1, '#030303');
  g.fillStyle = sg; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(240,200,120,.38)'; g.lineWidth = 1.6; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke();
  // retícula
  if (R < 2600) {
    g.save(); g.strokeStyle = 'rgba(232,186,96,.12)'; g.lineWidth = 1.1; g.beginPath();
    for (let lo = -180; lo < 180; lo += 30) {
      let pen = false;
      for (let la = -84; la <= 84; la += 3) {
        const [x, y, z] = proj(la * D2R, lo * D2R, v);
        if (z > 0) { pen ? g.lineTo(x, y) : g.moveTo(x, y); pen = true; } else pen = false;
      }
    }
    for (let la = -60; la <= 60; la += 30) {
      let pen = false;
      for (let lo = -180; lo <= 180; lo += 3) {
        const [x, y, z] = proj(la * D2R, lo * D2R, v);
        if (z > 0) { pen ? g.lineTo(x, y) : g.moveTo(x, y); pen = true; } else pen = false;
      }
    }
    g.stroke(); g.restore();
  }
  // continentes en puntos (por cubetas de opacidad para dibujar rápido)
  const reveal = P(t, .05, 1.5, E.inOutQuad) * 1.2, zoomed = v.zE > .015;
  const dr = Math.max(1.1, R * .0066), paths = Array.from({ length: BUCKETS }, () => new Path2D());
  const sp = Math.sin(v.phi), cp = Math.cos(v.phi);
  for (let i = 0; i < DOTS.length; i += 5) {
    const h = DOTS[i + 2], ap = clamp((reveal - h) / .18);
    if (ap <= 0) continue;
    const d = DOTS[i + 1] - v.lam, cl = DOTS[i + 3], z = cl * Math.cos(d), y = DOTS[i + 4];
    const z2 = y * sp + z * cp;
    if (z2 <= .02) continue;
    const X = cx + R * cl * Math.sin(d), Y = cy - R * (y * cp - z * sp);
    if (X < -80 || X > W + 80 || Y < -80 || Y > H + 80) continue;
    const a = ap * (.22 + .78 * Math.pow(z2, 1.3));
    const b = Math.min(BUCKETS - 1, (a * BUCKETS) | 0), rr = dr * (.55 + .45 * z2);
    if (zoomed) {
      const k = 1 - .32 * v.zE;
      paths[b].moveTo(cx + (X - cx) * k, cy + (Y - cy) * k); paths[b].lineTo(X, Y);
    } else { paths[b].moveTo(X + rr, Y); paths[b].arc(X, Y, rr, 0, TAU); }
  }
  for (let b = 0; b < BUCKETS; b++) {
    const a = (b + .5) / BUCKETS;
    if (zoomed) { g.strokeStyle = `rgba(255,226,160,${a})`; g.lineWidth = Math.min(dr * 1.1, 1.6 + 3.2 * v.zE); g.lineCap = 'round'; g.stroke(paths[b]); }
    else { g.fillStyle = `rgba(255,228,165,${a})`; g.fill(paths[b]); }
  }
  drawRing(s, t, 'front');
  // marcador de Guadalajara
  const ma = P(t, K.marker, .3) * (1 - P(t, K.zoom + .08, .2));
  if (ma > 0) {
    const [x, y, z] = proj(GDL[0], GDL[1], v);
    if (z > 0) {
      g.save(); g.globalAlpha *= ma;
      for (let k = 0; k < 2; k++) {
        const ph = ((t - K.marker) * 1.5 + k * .5) % 1;
        g.strokeStyle = `rgba(255,214,120,${(1 - ph) * .9})`; g.lineWidth = 2.5;
        g.beginPath(); g.arc(x, y, 8 + ph * 46, 0, TAU); g.stroke();
      }
      g.globalCompositeOperation = 'lighter'; g.drawImage(SPR_DOT, x - 26, y - 26, 52, 52); g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#fff6dc'; g.beginPath(); g.arc(x, y, 5.5, 0, TAU); g.fill();
      const lp = P(t, K.marker + .08, .25, E.outCubic), hp = P(t, K.marker + .2, .3, E.outCubic);
      const x1 = x + 74 * lp, y1 = y - 74 * lp;
      g.strokeStyle = 'rgba(240,200,110,.95)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x + 6, y - 6); g.lineTo(x1, y1); g.lineTo(x1 + 250 * hp, y1); g.stroke();
      g.font = '700 25px Montserrat'; g.letterSpacing = '7px'; g.shadowColor = 'rgba(0,0,0,.95)'; g.shadowBlur = 10;
      g.fillStyle = `rgba(246,216,142,${P(t, K.marker + .25, .25)})`;
      g.fillText(EV.ciudad, x1 + 8, y1 - 14);
      g.restore();
    }
  }
  g.globalAlpha = 1;
}

function logoIn(L, t, t0) {
  const ls = lerp(.3, .03, P(t, t0, 1.1, E.outExpo));
  L.main.style.letterSpacing = ls + 'em'; L.main.style.paddingLeft = ls + 'em';
  if (L.lam) L.lam.style.marginRight = ls + 'em';
  L.chars.forEach((c, i) => {
    const p = P(t, t0 + i * .045, .75, E.outExpo);
    S(c, { o: P(t, t0 + i * .045, .3), y: 34 * (1 - p), s: lerp(1.3, 1, p), blur: 14 * (1 - p) });
  });
  S(L.reg, { o: P(t, t0 + .55, .4) });
  const sp = P(t, t0 + .35, 1.0, E.outExpo), sls = lerp(1.1, .5, sp);
  L.sub.style.letterSpacing = sls + 'em'; L.sub.style.paddingLeft = sls + 'em';
  S(L.sub, { o: P(t, t0 + .35, .5), blur: 6 * (1 - sp) });
  const np = P(t, t0 + .5, .9, E.outExpo);
  S(L.nt, { o: P(t, t0 + .5, .5) }); S(L.l1, { sx: np }); S(L.l2, { sx: np });
}
function sheen(el, t, t0, d, x0 = -420, x1 = 1120) {
  const p = (t - t0) / d;
  if (p <= 0 || p >= 1) { el.style.opacity = 0; return; }
  el.style.opacity = 1;
  S(el.firstElementChild, { x: lerp(x0, x1, E.inOutSine(p)), r: 14 });
}
function scene1(t) {
  const on = t < K.s2; vis(SC.s1, on); if (!on) return;
  logoIn(L1, t, K.logoIn);
  const o = P(t, K.logoOut, .3, E.inCubic);
  S(L1.root, { o: 1 - o, y: 46 * o, blur: 8 * o });
  sheen($('#sheen1'), t, K.logoIn + 1.0, .8);
}

/* ------------------------------------------------------------------ transiciones */
const TAN = Math.tan(16 * D2R);
const wipeX = (t, t0) => lerp(-340, 1420, E.inOutCubic(clamp((t - t0) / .55)));
function wipeClip(t, t0, side) {
  const xc = wipeX(t, t0), xt = xc + 1060 * TAN, xb = xc - 1060 * TAN;
  return side === 'left'
    ? `polygon(-3000px -100px, ${f2(xt)}px -100px, ${f2(xb)}px 2020px, -3000px 2020px)`
    : `polygon(${f2(xt)}px -100px, 4000px -100px, 4000px 2020px, ${f2(xb)}px 2020px)`;
}
const IRIS = [540, 760];
const irisR = t => lerp(0, 1300, E.inOutCubic(clamp((t - K.iris) / .6)));
function slam(t, t0, from, d = .24) {
  if (t < t0 - d) return { o: 0, s: from, blur: 0 };
  if (t < t0) { const p = (t - t0 + d) / d, e = p * p * p; return { o: clamp(p * 3.5), s: lerp(from, 1, e), blur: 7 * (1 - e) }; }
  const q = clamp((t - t0) / .36);
  return { o: 1, s: 1 - .05 * Math.sin(Math.PI * q) * (1 - q), blur: 0 };
}
// Luz especular: destello al impacto y barrido de brillo
function bevLight(id, t, tImpact, tGlint, d = .95) {
  const b = BEV[id], gp = (t - tGlint) / d, sweeping = gp > 0 && gp < 1;
  b.light.setAttribute('x', (sweeping ? lerp(-520, 1600, E.inOutSine(gp)) : b.lx).toFixed(1));
  const boost = t >= tImpact ? 1.8 * Math.exp(-(t - tImpact) * 7) : 0;
  b.spec.setAttribute('specularConstant', (b.base + boost + (sweeping ? .55 * Math.sin(Math.PI * gp) : 0)).toFixed(3));
}
function boxAnim(B, t, t0) {
  const fp = P(t, t0, .65, E.outCubic);
  B.paths.forEach(p => (p.style.strokeDashoffset = (1 - fp).toFixed(4)));
  B.fill.style.opacity = (P(t, t0 + .15, .5) * .95).toFixed(3);
  const mid = (B.chars.length - 1) / 2;
  B.chars.forEach((c, i) => {
    const p = P(t, t0 + .12 + Math.abs(i - mid) * .035, .5);
    S(c, { o: p, y: 10 * (1 - p), blur: 5 * (1 - p) });
  });
  B.wings.forEach(w => S(w, { sx: P(t, t0 + .3, .7, E.outExpo) }));
}

/* ------------------------------------------------------------------ escena 2: título */
function scene2(t) {
  const on = t >= K.s2 - .02 && t < K.wipe1 + .6; vis(SC.s2, on); if (!on) return;
  SC.s2.style.clipPath = t > K.wipe1 ? wipeClip(t, K.wipe1, 'right') : 'none';
  const hp = P(t, K.hosts, .9);
  S(hostsEl, { o: hp, y: 46 * (1 - hp), s: 1.07 - .07 * hp + .025 * P(t, K.hosts, 2.5, E.lin), blur: 9 * (1 - hp) });
  invitaCh.forEach((c, i) => {
    const p = P(t, K.invita + i * .028, .55);
    S(c, { o: p, y: 16 * (1 - p), blur: 6 * (1 - p) });
  });
  S(magnoEl, slam(t, K.magno, 2.3));
  S(eventoEl, slam(t, K.evento, 2.0));
  bevLight('fMagno', t, K.magno, K.glint);
  bevLight('fEvento', t, K.evento, K.glint + .12);
  boxAnim(box1, t, K.box);
  const fp = P(t, K.fecha, .9, E.outExpo), fls = lerp(.55, .2, fp);
  fechaEl.style.letterSpacing = fls + 'em'; fechaEl.style.paddingLeft = fls + 'em';
  S(fechaEl, { o: P(t, K.fecha, .45), y: 10 * (1 - fp) });
  const sp = P(t, K.evento + .15, 1.1, E.inOutCubic);
  swCore.style.strokeDashoffset = swGlow.style.strokeDashoffset = (1 - sp).toFixed(4);
  const L = SW_LEN * sp, a = swCore.getPointAtLength(Math.max(0, L - 6)), b = swCore.getPointAtLength(L);
  swHead.setAttribute('transform', `translate(${f2(b.x)} ${f2(b.y)}) rotate(${f2(Math.atan2(b.y - a.y, b.x - a.x) / D2R)}) scale(${f2(P(t, K.evento + 1.05, .25, E.outBack))})`);
  sheen($('#sheen2'), t, K.glint + .1, .9);
}

/* ------------------------------------------------------------------ escena 3: pilares */
function hdrAnim(el, t, t0) {
  const p = P(t, t0, 1.0, E.outExpo), sp = el.querySelector('span'), ls = lerp(.9, .45, p);
  sp.style.letterSpacing = ls + 'em'; sp.style.paddingLeft = ls + 'em';
  S(sp, { o: P(t, t0, .5), blur: 6 * (1 - p) });
  el.querySelectorAll('.ln').forEach(l => S(l, { sx: P(t, t0 + .15, .8, E.outExpo) }));
}
function scene3(t) {
  const on = t >= K.wipe1 && t < K.wipe2 + .6; vis(SC.s3, on); if (!on) return;
  SC.s3.style.clipPath = t < K.wipe1 + .56 ? wipeClip(t, K.wipe1, 'left') : t > K.wipe2 ? wipeClip(t, K.wipe2, 'right') : 'none';
  hdrAnim(h3, t, K.header3);
  ROWS.forEach((R, i) => {
    const t0 = K.row0 + i * K.rowGap;
    R.ring.style.strokeDashoffset = (1 - P(t, t0, .7)).toFixed(4);
    R.disk.style.opacity = P(t, t0 + .1, .45).toFixed(3);
    S(R.glyph, { o: P(t, t0 + .12, .2), s: lerp(.35, 1, P(t, t0 + .12, .55, E.outBack)) });
    const p1 = P(t, t0 + .14, .65, E.outExpo), p2 = P(t, t0 + .24, .65, E.outExpo);
    S(R.l1, { x: 34 * (1 - p1), o: P(t, t0 + .14, .2), clip: `inset(-20% ${f2(100 * (1 - p1))}% -20% -3%)` });
    if (R.l2) S(R.l2, { x: 34 * (1 - p2), o: P(t, t0 + .24, .2), clip: `inset(-20% ${f2(100 * (1 - p2))}% -20% -3%)` });
    if (R.dv) S(R.dv, { sx: P(t, t0 + .2, .9, E.outExpo) });
    // destello al completar el ícono + barrido de luz que recorre las filas hacia abajo
    const dt = t - (t0 + .55), sy = lerp(300, 1650, E.inOutSine(clamp((t - K.sweep3) / 1.1)));
    const sw = t > K.sweep3 && t < K.sweep3 + 1.1 ? Math.exp(-Math.pow((sy - (572 + i * 205)) / 130, 2)) : 0;
    const pulse = Math.max(dt > 0 ? Math.exp(-dt * 3) : 0, sw);
    R.ico.style.filter = `drop-shadow(0 0 ${f2(6 + 20 * pulse)}px rgba(240,190,90,${(.22 + .5 * pulse).toFixed(3)}))`;
    R.txt.style.filter = sw > .01 ? `brightness(${(1 + .55 * sw).toFixed(3)})` : '';
    // micro-animaciones de los íconos
    R.steam.forEach((e, k) => {
      const ph = (t * .8 + k * .33) % 1;
      S(e, { y: -5 * ph, o: Math.sin(Math.PI * ph) * P(t, t0 + .3, .4) });
    });
    R.bars.forEach((e, k) => S(e, { sy: P(t, t0 + .2 + k * .08, .5, E.outBack) }));
    R.arw.forEach(e => (e.style.strokeDashoffset = (1 - P(t, t0 + .35, .5)).toFixed(4)));
    R.arw.forEach(e => (e.style.strokeDasharray = '1'));
    R.arwh.forEach(e => S(e, { o: P(t, t0 + .75, .15) }));
    R.spark.forEach(e => S(e, { r: t * 50, s: .85 + .25 * Math.sin(t * 5) }));
    R.dots.forEach((e, k) => S(e, { s: 1 + .32 * Math.max(0, Math.sin(TAU * (t * .9 - k * .16))) }));
  });
}

/* ------------------------------------------------------------------ escena 4: patrocinadores */
function scene4(t) {
  const on = t >= K.wipe2 && t < K.iris + .65; vis(SC.s4, on); if (!on) return;
  SC.s4.style.clipPath = t < K.wipe2 + .56 ? wipeClip(t, K.wipe2, 'left') : 'none';
  const m = t > K.iris ? `radial-gradient(circle at ${IRIS[0]}px ${IRIS[1]}px, transparent ${f2(irisR(t))}px, #000 ${f2(irisR(t) + 2)}px)` : 'none';
  SC.s4.style.webkitMaskImage = SC.s4.style.maskImage = m;
  boxAnim(box4, t, K.header4);
  CARDS.forEach(cd => {
    const t0 = K.cards + (cd.r + cd.c) * .09, p = P(t, t0, .85, E.lin);
    S(cd.card, { ry: lerp(-100, 0, E.outBack(p)), o: P(t, t0, .22), y: 26 * (1 - E.outCubic(p)) });
    S(cd.img, { s: lerp(.82, 1, P(t, t0 + .25, .55)), o: P(t, t0 + .2, .35) });
  });
  sheen($('#sheen4'), t, K.sweep4, 1.0);
}

/* ------------------------------------------------------------------ escena 5a: fecha y sede */
function scene5a(t) {
  const on = t >= K.iris && t < K.out5 + .6; vis(SC.s5a, on); if (!on) return;
  SC.s5a.style.clipPath = t < K.iris + .62 ? `circle(${f2(irisR(t))}px at ${IRIS[0]}px ${IRIS[1]}px)` : 'none';
  const out = k => P(t, K.out5 + k * .05, .45, E.inCubic);
  const fp = P(t, K.photo5, 1.0);
  S(fotoEl, { o: fp * (1 - out(0)), s: 1.02 + .05 * P(t, K.photo5, 4, E.lin), y: -40 * out(0) });
  const d = slam(t, K.dia, 2.6, .26);
  S(diaEl, { o: d.o * (1 - out(1)), s: d.s, blur: d.blur + 8 * out(1), y: -50 * out(1) });
  bevLight('fDia', t, K.dia, K.dia + 1.25, 1.1);
  const mp = P(t, K.mes, 1.0, E.outExpo), mls = lerp(.9, .38, mp);
  mesEl.style.letterSpacing = mls + 'em'; mesEl.style.paddingLeft = mls + 'em';
  mesCh.forEach((c, i) => { const p = P(t, K.mes + i * .04, .5); S(c, { o: p, y: 14 * (1 - p), blur: 6 * (1 - p) }); });
  S(mesEl, { o: 1 - out(2), y: -50 * out(2) });
  S(rule5, { sx: P(t, K.mes + .4, .8, E.outExpo), o: 1 - out(2) });
  const hp = P(t, K.hora, .55, E.outBack);
  S(horaIco, { s: lerp(.3, 1, hp), o: P(t, K.hora, .2) });
  const turn = P(t, K.hora, 1.1, E.outCubic);
  S(hh, { r: 90 * turn }); S(mh, { r: 1080 * turn });
  const tp = P(t, K.hora + .15, .6, E.outExpo);
  S(horaTxt, { x: 26 * (1 - tp), clip: `inset(-20% ${f2(100 * (1 - tp))}% -20% -3%)` });
  S(horaEl, { o: 1 - out(3), y: -50 * out(3) });
  const pp = clamp((t - K.sede) / .75);
  S(pinBody, { y: -60 * (1 - E.outBounce(pp)), o: P(t, K.sede, .15) });
  S(pinShadow, { s: lerp(.2, 1, E.outBounce(pp)), o: P(t, K.sede, .3) });
  const s1p = P(t, K.sede + .25, .7, E.outExpo), s2p = P(t, K.sede + .4, .9, E.outExpo);
  S(sede1, { o: P(t, K.sede + .25, .3), y: 18 * (1 - s1p), blur: 5 * (1 - s1p) });
  const s2ls = lerp(.9, .42, s2p);
  sede2.style.letterSpacing = s2ls + 'em'; sede2.style.paddingLeft = s2ls + 'em';
  S(sede2, { o: P(t, K.sede + .4, .4) });
  S($('#sede'), { o: 1 - out(4), y: -50 * out(4) });
}

/* ------------------------------------------------------------------ escena 5b: cierre */
function scene5b(t) {
  const on = t >= K.s5b - .05; vis(SC.s5b, on); if (!on) return;
  const t0 = K.s5b;
  br1.style.strokeDashoffset = (1 - P(t, t0, 1.4, E.inOutCubic)).toFixed(4);
  br1.setAttribute('transform', `rotate(${f2(-90 + (t - t0) * 6)} 540 620)`);
  br2.setAttribute('transform', `rotate(${f2(-(t - t0) * 9)} 540 620)`);
  br2.style.opacity = (.5 * P(t, t0 + .6, .8)).toFixed(3);
  const lp = P(t, t0 + .05, .8);
  S(L2.root, { o: lp, y: -26 * (1 - lp), blur: 6 * (1 - lp) });
  logoIn(L2, t, t0 - .4);
  const mp = P(t, t0 + .25, .7, E.outExpo), ep = P(t, t0 + .4, .7, E.outExpo);
  S(magno2El, { o: P(t, t0 + .25, .3), s: lerp(1.3, 1, mp), blur: 6 * (1 - mp) });
  S(evento2El, { o: P(t, t0 + .4, .3), s: lerp(1.3, 1, ep), blur: 6 * (1 - ep) });
  bevLight('fMagno2', t, 99, K.glint5);
  bevLight('fEvento2', t, 99, K.glint5 + .12);
  boxAnim(box2, t, t0 + .55);
  const pp = P(t, t0 + .75, .6);
  S(panel, { o: pp, y: 24 * (1 - pp), s: lerp(.97, 1, pp) });
  PRS.forEach((r, i) => { const q = P(t, t0 + .9 + i * .16, .6, E.outExpo); S(r, { o: P(t, t0 + .9 + i * .16, .3), x: -30 * (1 - q) }); });
  const cp = P(t, K.cta, .7, E.outBack);
  S(cta, { o: P(t, K.cta, .14), s: lerp(.55, 1, cp) });
  const pulse = t > K.cta + .6 ? .5 + .5 * Math.sin((t - K.cta - .6) * TAU / 1.4 - Math.PI / 2) : 0;
  cta.style.setProperty('--ga', (.3 + .38 * pulse).toFixed(3));
  cta.style.setProperty('--gr', (34 + 34 * pulse).toFixed(1) + 'px');
  const sh = t > K.cta + .45 ? ((t - K.cta - .45) % 2.0) / .75 : 2;
  S(ctaShine, { x: lerp(-170, 880, clamp(sh)), o: sh < 1 ? 1 : 0 });
  webCh.forEach((c, i) => { const p = P(t, K.web + i * .022, .35); S(c, { o: p, y: 8 * (1 - p) }); });
  [lema1, lema2].forEach((l, i) => { const p = P(t, K.lema + i * .22, .8); S(l, { o: p, y: 16 * (1 - p), blur: 4 * (1 - p) }); });
  sheen($('#sheen5'), t, K.glint5, 1.1);
}

/* ------------------------------------------------------------------ fondo, partículas, luces */
const glowEl = $('#glow'), raysEl = $('#rays');
const GLOWK = [[0, 760, 0], [1.2, 760, .55], [3.3, 760, .6], [3.5, 1030, 1], [8.0, 1030, .85], [8.6, 940, .42], [13.0, 940, .42],
  [13.6, 1050, .55], [17.0, 1050, .55], [17.6, 860, .78], [21.0, 860, .72], [21.6, 640, .8], [30, 640, .8]];
function background(t) {
  const [y, o] = kf(t, GLOWK);
  glowEl.style.top = f2(y) + 'px'; glowEl.style.opacity = o.toFixed(3);
  const r2 = Math.min(P(t, K.s2, .7), 1 - P(t, K.wipe1, .5)), r5 = P(t, K.s5b, 1.2);
  raysEl.style.opacity = (Math.max(r2 * .55, r5 * .4)).toFixed(3);
  raysEl.style.top = (t < 15 ? 1000 : 640) + 'px';
  raysEl.style.transform = `rotate(${f2(t * 4)}deg)`;
}

const acv = $('#arcs'), ac = acv.getContext('2d');
const ARCS = [
  { pts: [[-90, 1590], [260, 1380], [760, 1560], [1170, 1250]], period: 3.2, off: 0, w: 2.4 },
  { pts: [[-90, 470], [320, 290], [760, 360], [1170, 160]], period: 3.8, off: 1.3, w: 2 },
  { pts: [[1170, 1730], [820, 1500], [420, 1850], [-90, 1640]], period: 4.4, off: 2.1, w: 1.8 },
];
const bez = (p, s) => { const u = 1 - s, a = u * u * u, b = 3 * u * u * s, c = 3 * u * s * s, d = s * s * s; return [a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0], a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1]]; };
const ARCK = [[0, 0], [3.4, 0], [3.9, 1], [8.0, 1], [8.6, .45], [17.0, .45], [17.6, .7], [21.0, .7], [21.6, 1], [30, 1]];
function arcs(t) {
  ac.clearRect(0, 0, W, H);
  const [a] = kf(t, ARCK);
  if (a < .01) return;
  ac.globalCompositeOperation = 'lighter'; ac.lineCap = 'round';
  for (const A of ARCS) {
    ac.globalAlpha = .1 * a; ac.strokeStyle = '#d9a845'; ac.lineWidth = 1.2; ac.beginPath();
    for (let i = 0; i <= 80; i++) { const [x, y] = bez(A.pts, i / 80); i ? ac.lineTo(x, y) : ac.moveTo(x, y); }
    ac.stroke();
    const h = (((t + A.off) / A.period) % 1) * 1.5 - .25, tail = .38, N = 40;
    for (let k = 0; k < N; k++) {
      const s0 = h - tail + tail * k / N, s1 = h - tail + tail * (k + 1) / N;
      if (s1 < 0 || s0 > 1) continue;
      const q = (k + 1) / N, [x0, y0] = bez(A.pts, clamp(s0)), [x1, y1] = bez(A.pts, clamp(s1));
      ac.globalAlpha = a * q * q * .22; ac.lineWidth = A.w * 5 * q; ac.strokeStyle = '#f0b850';
      ac.beginPath(); ac.moveTo(x0, y0); ac.lineTo(x1, y1); ac.stroke();
      ac.globalAlpha = a * q * q * .9; ac.lineWidth = A.w * (.5 + q); ac.strokeStyle = q > .85 ? '#fff4d0' : '#f0bf5a';
      ac.beginPath(); ac.moveTo(x0, y0); ac.lineTo(x1, y1); ac.stroke();
    }
    if (h >= 0 && h <= 1) { const [x, y] = bez(A.pts, h); ac.globalAlpha = a * .9; ac.drawImage(SPR_DOT, x - 28, y - 28, 56, 56); }
  }
  ac.globalCompositeOperation = 'source-over'; ac.globalAlpha = 1;
}

const fcv = $('#fx'), fc = fcv.getContext('2d');
const DUST = (() => { const r = rng(7); return Array.from({ length: 140 }, () => ({ x: r() * W, y: r() * H, vy: -(5 + r() * 24), vx: (r() - .5) * 8, s: .5 + r() * 1.5, f: .2 + r() * .9, ph: r() * TAU, a: .12 + r() * .5, wob: 5 + r() * 16 })); })();
const BOKEH = (() => { const r = rng(9); return Array.from({ length: 16 }, () => ({ x: r() * W, y: r() * H, R: 28 + r() * 70, vy: -(3 + r() * 8), vx: (r() - .5) * 6, a: .03 + r() * .07, ph: r() * TAU })); })();
const DUSTK = [[0, 0], [1, .7], [3.3, .7], [3.6, 1], [30, 1]];
const BURSTS = [
  { t: K.ringClose, ring: true, n: 70, sp: 380, life: 1.2, seed: 21 },
  { t: K.magno, x: 540, y: 962, w: 860, n: 110, sp: 900, life: 1.15, seed: 22 },
  { t: K.evento, x: 540, y: 1118, w: 800, n: 70, sp: 700, life: 1.0, seed: 23 },
  { t: K.dia, x: 540, y: 880, w: 560, n: 110, sp: 900, life: 1.25, seed: 24 },
  { t: K.cta, x: 540, y: 1331, w: 780, n: 70, sp: 560, life: 1.0, seed: 25 },
].map(b => {
  const r = rng(b.seed);
  b.parts = Array.from({ length: b.n }, () => ({ u: r(), v: r() - .5, a: r() * TAU, sp: b.sp * (.25 + .75 * r()), k: 2.2 + r() * 2.2, s: .8 + r() * 1.8, life: b.life * (.5 + .5 * r()) }));
  if (b.ring) { const s = ringOf(b.t, view(b.t)); b.origin = p => ringPt(s, s.a0 + p.u * TAU); } else b.origin = p => [b.x + (p.u - .5) * b.w, b.y + p.v * 50];
  return b;
});
const SPARKS = [
  [K.ringClose + .02, 430, 897, 1.2], [K.magno + .05, 150, 910, 1.1], [K.magno + .12, 960, 940, .9], [K.evento + .08, 905, 1075, .8],
  [K.glint + .35, 300, 898, .9], [K.glint + .62, 820, 902, 1], [K.glint + .82, 640, 1068, .8], [K.box + .5, 190, 1218, .7], [K.box + .56, 890, 1314, .7],
  [K.dia + .1, 330, 760, 1.2], [K.dia + 1.6, 760, 742, .9], [K.cta + .15, 150, 1282, .9], [K.cta + .25, 930, 1382, .9],
  [K.glint5 + .3, 230, 500, .9], [K.glint5 + .6, 850, 505, 1], [25.0, 540, 1272, .8],
];
const FLASHES = [
  { t: K.ringClose, a: .14, d: .45, pre: .04 }, { t: K.s2, a: .85, d: .32, pre: .1 }, { t: K.magno, a: .26, d: .4, pre: .03 },
  { t: K.evento, a: .14, d: .35, pre: .03 }, { t: K.dia, a: .28, d: .45, pre: .03 }, { t: K.s5b + .05, a: .1, d: .5, pre: .2 }, { t: K.cta, a: .12, d: .4, pre: .03 },
];
const SHAKES = [{ t: K.magno, a: 15, d: .45 }, { t: K.evento, a: 9, d: .35 }, { t: K.dia, a: 16, d: .5 }, { t: K.cta, a: 4, d: .3 }];

function particles(t) {
  fc.clearRect(0, 0, W, H);
  fc.globalCompositeOperation = 'lighter';
  const [I] = kf(t, DUSTK);
  for (const b of BOKEH) {
    const x = b.x + b.vx * t, y = ((b.y + b.vy * t) % (H + 200) + H + 200) % (H + 200) - 100;
    fc.globalAlpha = b.a * I * (.7 + .3 * Math.sin(t * .7 + b.ph));
    fc.drawImage(SPR_BOKEH, x - b.R, y - b.R, b.R * 2, b.R * 2);
  }
  for (const p of DUST) {
    const y = ((p.y + p.vy * t) % (H + 60) + H + 60) % (H + 60) - 30;
    const x = p.x + p.vx * t + p.wob * Math.sin(.5 * t + p.ph);
    const s = 9 * p.s;
    fc.globalAlpha = p.a * I * (.55 + .45 * Math.sin(p.f * t * TAU + p.ph));
    fc.drawImage(SPR_DOT, x - s, y - s, s * 2, s * 2);
  }
  fc.lineCap = 'round';
  for (const b of BURSTS) {
    const tau = t - b.t;
    if (tau <= 0 || tau > b.life) continue;
    for (const p of b.parts) {
      if (tau > p.life) continue;
      const [ox, oy] = b.origin(p), dx = Math.cos(p.a), dy = Math.sin(p.a);
      const pos = tt => { const dd = p.sp * (1 - Math.exp(-p.k * tt)) / p.k; return [ox + dx * dd, oy + dy * dd + 90 * tt * tt]; };
      const [x0, y0] = pos(Math.max(0, tau - .035)), [x1, y1] = pos(tau);
      const al = Math.pow(1 - tau / p.life, 1.5);
      fc.globalAlpha = al; fc.strokeStyle = '#ffe2a0'; fc.lineWidth = p.s;
      fc.beginPath(); fc.moveTo(x0, y0); fc.lineTo(x1, y1); fc.stroke();
      fc.globalAlpha = al * .6; fc.drawImage(SPR_DOT, x1 - 8 * p.s, y1 - 8 * p.s, 16 * p.s, 16 * p.s);
    }
  }
  for (const [t0, x, y, sc] of SPARKS) {
    const q = (t - t0) / .5;
    if (q <= 0 || q >= 1) continue;
    const s = Math.sin(Math.PI * q) * sc;
    fc.save(); fc.globalAlpha = Math.sin(Math.PI * q); fc.translate(x, y); fc.rotate(q * .8); fc.scale(s, s);
    fc.drawImage(SPR_STAR, -80, -80); fc.restore();
  }
  if (t > K.iris && t < K.iris + .7) { // anillo dorado de la transición
    const r = irisR(t), a = 1 - P(t, K.iris + .42, .25);
    fc.globalAlpha = a * .3; fc.strokeStyle = '#f0b850'; fc.lineWidth = 26;
    fc.beginPath(); fc.arc(IRIS[0], IRIS[1], r, 0, TAU); fc.stroke();
    fc.globalAlpha = a; fc.strokeStyle = '#ffe6a3'; fc.lineWidth = 5;
    fc.beginPath(); fc.arc(IRIS[0], IRIS[1], r, 0, TAU); fc.stroke();
  }
  fc.globalCompositeOperation = 'source-over'; fc.globalAlpha = 1;
}

const sweepEl = $('#sweep'), flashEl = $('#flash');
function overlays(t) {
  let w = -1;
  for (const t0 of [K.wipe1, K.wipe2]) if (t > t0 - .05 && t < t0 + .6) w = t0;
  if (w >= 0) {
    const p = clamp((t - w) / .55);
    sweepEl.style.opacity = Math.sin(Math.PI * clamp(p * 1.05)).toFixed(3);
    sweepEl.style.transform = `translateX(${f2(wipeX(t, w) - 230)}px) rotate(16deg)`;
  } else sweepEl.style.opacity = 0;
  let f = 0;
  for (const e of FLASHES) {
    const dt = t - e.t;
    if (dt < -e.pre || dt > e.d) continue;
    f = Math.max(f, dt < 0 ? e.a * (1 + dt / e.pre) : e.a * Math.pow(1 - dt / e.d, 2));
  }
  flashEl.style.opacity = f.toFixed(3);
  let x = 0, y = 0;
  for (const s of SHAKES) {
    const q = (t - s.t) / s.d;
    if (q < 0 || q > 1) continue;
    const amp = s.a * Math.pow(1 - q, 2);
    x += amp * (Math.sin(t * 91) * .6 + Math.sin(t * 57 + 1.7) * .4);
    y += amp * (Math.sin(t * 77 + .6) * .6 + Math.sin(t * 43 + 2.3) * .4);
  }
  cam.style.transform = x || y ? `translate(${f2(x)}px,${f2(y)}px)` : '';
}

const grc = $('#grain').getContext('2d');
const NOISE = (() => {
  const c = document.createElement('canvas'); c.width = 720; c.height = 1140;
  const x = c.getContext('2d'), id = x.createImageData(720, 1140), r = rng(3);
  for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (r() - .5) * 230; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
  x.putImageData(id, 0, 0);
  return c;
})();
function grain(t) {
  const r = rng(1000 + Math.round(t * C.fps));
  grc.drawImage(NOISE, -Math.floor(r() * 170), -Math.floor(r() * 170));
}

/* ------------------------------------------------------------------ seek */
function seek(t) {
  background(t); arcs(t); drawGlobe(t);
  scene1(t); scene2(t); scene3(t); scene4(t); scene5a(t); scene5b(t);
  particles(t); overlays(t); grain(t);
}
window.seek = seek;
window.DURATION = C.duration;

window.READY = (async () => {
  await document.fonts.ready;
  await Promise.all(['600 20px Montserrat', '800 20px Montserrat', '900 20px Archivo', 'italic 600 20px Cormorant'].map(f => document.fonts.load(f)));
  await Promise.all([...document.images].map(im => (im.decode ? im.decode().catch(() => {}) : null)));
  layoutFits();
  seek(0);
  return true;
})();

/* ------------------------------------------------------------------ reproductor (vista previa) */
if (RENDER) { document.body.classList.add('render'); return; }
const vp = $('#viewport'), btn = $('#play'), scrub = $('#scrub'), tc = $('#tc'), audio = $('#music');
scrub.max = C.duration;
const fit = () => { stage.style.transform = `scale(${Math.min(vp.clientWidth / W, vp.clientHeight / H)})`; };
addEventListener('resize', fit); fit();
let playing = false, clock0 = 0, t0 = 0, cur = 0, audioOK = false;
audio.addEventListener('canplay', () => (audioOK = true));
audio.addEventListener('error', () => (audioOK = false));
const show = t => { cur = t; seek(t); scrub.value = t; tc.textContent = t.toFixed(2); };
function tick() {
  if (!playing) return;
  let t = audioOK && !audio.paused ? audio.currentTime : t0 + (performance.now() - clock0) / 1000;
  if (t >= C.duration) { t = 0; t0 = 0; clock0 = performance.now(); if (audioOK) { audio.currentTime = 0; audio.play().catch(() => {}); } }
  show(t);
  requestAnimationFrame(tick);
}
function toggle() {
  playing = !playing; btn.textContent = playing ? '❚❚' : '▶';
  if (playing) {
    t0 = cur >= C.duration - .01 ? 0 : cur; clock0 = performance.now();
    if (audioOK) { audio.currentTime = t0; audio.play().catch(() => (audioOK = false)); }
    requestAnimationFrame(tick);
  } else audio.pause();
}
btn.addEventListener('click', toggle);
addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); toggle(); } });
scrub.addEventListener('input', () => {
  const t = +scrub.value; show(t); t0 = t; clock0 = performance.now();
  if (audioOK) audio.currentTime = t;
});
window.READY.then(() => show(0));
})();
