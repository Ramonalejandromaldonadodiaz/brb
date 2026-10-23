/* Video promocional — Black Ring Business · Consultoría en Inteligencia Aplicada
 *
 * Composición HyperFrames: el runtime emite `hf-seek` con el tiempo de cada cuadro y
 * seek(t) deja el escenario exactamente en ese instante (todo se deriva de t, sin relojes).
 * También expone window.seek / window.READY para el render alterno (render/render.mjs).
 */
(() => {
'use strict';

const C = window.CONFIG, K = C.cues;
const W = 1080, H = 1920, TAU = Math.PI * 2, D2R = Math.PI / 180;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const SVGNS = 'http://www.w3.org/2000/svg';

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
  outExpo: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inOutSine: x => -(Math.cos(Math.PI * x) - 1) / 2,
  outBack: x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
};
const P = (t, t0, d, e = E.outCubic) => e(clamp((t - t0) / d));
function kf(t, frames, e = E.inOutSine) {
  if (t <= frames[0][0]) return frames[0].slice(1);
  for (let i = 0; i < frames.length - 1; i++) {
    const a = frames[i], b = frames[i + 1];
    if (t < b[0]) { const p = e((t - a[0]) / (b[0] - a[0])); return a.slice(1).map((v, k) => lerp(v, b[k + 1], p)); }
  }
  return frames[frames.length - 1].slice(1);
}
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
const frac = x => x - Math.floor(x); // parte fraccionaria, siempre en [0, 1)
function S(el, o) {
  let tf = '';
  if (o.x || o.y) tf += `translate(${f2(o.x || 0)}px,${f2(o.y || 0)}px) `;
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
function sv(tag, attrs, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
function splitChars(node, text, cls = '') {
  node.textContent = '';
  return [...text].map(ch => mk('span', 'ch ' + cls, node, ch === ' ' ? ' ' : ch));
}
// texto "decodificado": cada carácter recorre glifos al azar hasta asentarse
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@';
function decode(text, t, t0, per = .045, spin = .25) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], ts = t0 + i * per;
    if (t >= ts + spin || ch === ' ' || ch === '.' || ch === ',') out += ch;
    else if (t < ts) out += ' ';
    else out += GLYPHS[(Math.floor(t * 30) * 7 + i * 13) % GLYPHS.length];
  }
  return out;
}
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

/* ------------------------------------------------------------------ escenas: referencias */
const cam = $('#cam');
const SC = { s1: $('#s1'), s2: $('#s2'), svc: [$('#svc1'), $('#svc2'), $('#svc3'), $('#svc4')], s4: $('#s4'), s5: $('#s5') };
const SVC_T = [K.svc1, K.svc2, K.svc3, K.svc4, K.infra];

/* ------------------------------------------------------------------ 1 · gancho */
const hookEl = $('#hook');
const HL = C.gancho.map((txt, i) => {
  const w = mk('div', 'hlw', hookEl);
  const l = mk('div', 'hl' + (i === 2 ? ' gold' : ''), w, txt);
  return { w, l, txt };
});
const glitchA = mk('div', 'hl glitch', HL[4].w, C.gancho[4]);
const glitchB = mk('div', 'hl glitch', HL[4].w, C.gancho[4]);
[glitchA, glitchB].forEach(e => e.setAttribute('data-layout-ignore', ''));
HL[4].w.style.position = 'relative';
glitchA.style.color = '#ffcf5a'; glitchB.style.color = '#c8102e';
let HOOK = { fs: 116, top: 600, lh: 123 };

/* ------------------------------------------------------------------ logo */
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
  return { root, main, chars, lam, reg, sub };
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
}
const L1 = makeLogo($('#logo1'));
const L2 = makeLogo($('#logo2'));
const sub1 = $('#sub1'), sub2 = $('#sub2');
sub1.textContent = C.marca.sub1; sub2.textContent = C.marca.sub2;

/* ------------------------------------------------------------------ encabezados de servicio */
function makeHeader(sec, i) {
  const s = C.servicios[i], n = String(i + 1).padStart(2, '0');
  const num = mk('div', 'sh-num', sec, n);
  num.setAttribute('data-layout-ignore', '');
  const tag = mk('div', 'sh-tag', sec); tag.innerHTML = `SERVICIO <b>${n}</b> / 05`;
  const prog = mk('div', 'sh-prog', sec);
  const segs = C.servicios.map((_, k) => mk('i', k <= i ? 'on' : '', prog));
  const lines = [s.t1, s.t2, s.t3].filter(Boolean).map((txt, k) => mk('div', 'sh-t' + (k === 1 ? ' gold' : ''), sec, txt));
  const desc = mk('div', 'sh-desc', sec, s.desc);
  return { num, tag, segs, lines, desc };
}
const HEAD = [...SC.svc, SC.s4].map((sec, i) => makeHeader(sec, i));
function layoutHeader(h, i) {
  const three = h.lines.length === 3;
  let fs = three ? 84 : 98;
  for (const l of h.lines) { l.style.fontSize = fs + 'px'; }
  const widest = Math.max(...h.lines.map(l => l.offsetWidth));
  if (widest > 930) fs = Math.floor(fs * 930 / widest);
  h.lines.forEach((l, k) => { l.style.fontSize = fs + 'px'; l.style.top = (322 + k * fs * 1.04) + 'px'; });
  h.desc.style.top = (322 + h.lines.length * fs * 1.04 + 26) + 'px';
}
function headerAnim(h, t, t0) {
  S(h.tag, { o: P(t, t0 + .05, .3), x: -24 * (1 - P(t, t0 + .05, .5, E.outExpo)) });
  h.segs.forEach((g, k) => S(g, { sx: P(t, t0 + .1 + k * .05, .4, E.outExpo) }));
  const np = P(t, t0, .7, E.outExpo);
  S(h.num, { o: np, x: 80 * (1 - np) });
  h.lines.forEach((l, k) => {
    const p = P(t, t0 + .12 + k * .1, .6, E.outExpo);
    S(l, { y: 70 * (1 - p), clip: `inset(-10% -5% ${f2(100 * (1 - p))}% -5%)` });
  });
  const dp = P(t, t0 + .4, .6);
  S(h.desc, { o: dp, y: 14 * (1 - dp) });
}

/* ------------------------------------------------------------------ 01 · dashboard */
const dash = $('#dash');
const KPIS = [
  { l: 'VENTAS', v: 1.28, fmt: v => '$' + v.toFixed(2) + 'M' },
  { l: 'CLIENTES', v: 2431, fmt: v => Math.round(v).toLocaleString('en-US') },
  { l: 'MARGEN', v: 34.6, fmt: v => v.toFixed(1) + '%' },
].map((k, i) => {
  const el = mk('div', 'kpi', dash.querySelector('.kpis'));
  mk('div', 'k-l', el, k.l);
  const v = mk('div', 'k-v', el, k.fmt(0));
  const r = rng(40 + i), pts = Array.from({ length: 9 }, (_, j) => [j * 30, 30 - (j * 2.2 + r() * 12)]);
  el.insertAdjacentHTML('beforeend', `<svg viewBox="0 0 240 34" preserveAspectRatio="none"><polyline pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" fill="none" stroke="#e9b84c" stroke-width="2.4" stroke-linejoin="round" points="${pts.map(p => p.join(',')).join(' ')}"/></svg>`);
  return { ...k, el, vEl: v, spark: el.querySelector('polyline') };
});
const chart = dash.querySelector('.chart');
const CH = { w: 868, h: 290, top: 18 };
const SERIES_A = [.28, .34, .31, .42, .47, .44, .55, .58, .62, .6, .71, .78];
const SERIES_B = [.36, .41, .5, .48, .57, .63, .61, .7, .76, .81, .86, .93];
for (let k = 0; k < 4; k++) sv('line', { x1: 0, x2: CH.w, y1: CH.top + k * (CH.h / 3), y2: CH.top + k * (CH.h / 3), stroke: 'rgba(226,184,90,.14)', 'stroke-width': 1 }, chart);
'EFMAMJJASOND'.split('').forEach((m, k) => {
  const tx = sv('text', { x: (k + .5) * CH.w / 12, y: CH.top + CH.h + 30, 'text-anchor': 'middle', fill: '#a89a7c', 'font-family': 'JetBrains Mono', 'font-size': 16, 'data-layout-ignore': '' }, chart);
  tx.textContent = m;
});
const clipId = 'chartClip';
const chClip = sv('clipPath', { id: clipId }, sv('defs', {}, chart));
const chClipRect = sv('rect', { x: 0, y: 0, width: 0, height: CH.h + CH.top + 10 }, chClip);
const chArea = sv('path', { fill: 'url(#gArea)', 'clip-path': `url(#${clipId})` }, chart);
const chLine = sv('path', { fill: 'none', stroke: '#f2c862', 'stroke-width': 4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'clip-path': `url(#${clipId})`, filter: 'url(#fGlow)' }, chart);
const chDot = sv('circle', { r: 9, fill: '#fff4d0', stroke: '#e2b54f', 'stroke-width': 4 }, chart);
const chTip = sv('g', {}, chart);
sv('rect', { x: -62, y: -66, width: 124, height: 44, rx: 10, fill: '#1b150c', stroke: 'rgba(240,200,110,.8)', 'stroke-width': 1.5 }, chTip);
const chTipT = sv('text', { x: 0, y: -37, 'text-anchor': 'middle', fill: '#f4efe6', 'font-family': 'Montserrat', 'font-weight': 800, 'font-size': 22 }, chTip);
function seriesAt(m) { return SERIES_A.map((a, k) => lerp(a, SERIES_B[k], m)); }
function chartPts(vals) { return vals.map((v, k) => [(k + .5) * CH.w / 12, CH.top + CH.h * (1 - v)]); }
function smoothPath(pts) {
  let d = `M${f2(pts[0][0])} ${f2(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], mx = (x0 + x1) / 2;
    d += ` C${f2(mx)} ${f2(y0)} ${f2(mx)} ${f2(y1)} ${f2(x1)} ${f2(y1)}`;
  }
  return d;
}
const barsSvg = dash.querySelector('.bars'), donutSvg = dash.querySelector('.donut');
const BARS = [.42, .58, .5, .74, .66, .88, .79];
let BAR_EL = [], DONUT = {};
function buildDashBottom() {
  const bw = barsSvg.clientWidth, bh = barsSvg.clientHeight;
  barsSvg.setAttribute('viewBox', `0 0 ${bw} ${bh}`);
  const lab = sv('text', { x: 24, y: 42, fill: '#c9b88f', 'font-family': 'JetBrains Mono', 'font-size': 19, 'letter-spacing': 3 }, barsSvg); lab.textContent = 'VENTAS POR DÍA';
  const n = BARS.length, gap = 16, base = bh - 44, maxH = base - 66, slot = (bw - 48) / n;
  BAR_EL = BARS.map((v, k) => {
    const x = 24 + k * slot + gap / 2;
    const r = sv('rect', { x, y: base - maxH * v, width: slot - gap, height: maxH * v, rx: 6, fill: 'url(#gBar)' }, barsSvg);
    r.style.transformBox = 'fill-box'; r.style.transformOrigin = '50% 100%';
    const tx = sv('text', { x: x + (slot - gap) / 2, y: bh - 16, 'text-anchor': 'middle', fill: '#a89a7c', 'font-family': 'JetBrains Mono', 'font-size': 15, 'data-layout-ignore': '' }, barsSvg);
    tx.textContent = 'LMMJVSD'[k];
    return r;
  });
  const dw = donutSvg.clientWidth, dh = donutSvg.clientHeight;
  donutSvg.setAttribute('viewBox', `0 0 ${dw} ${dh}`);
  const cx = dw / 2, cy = dh / 2 - 6, rr = Math.min(dw, dh) / 2 - 46;
  sv('circle', { cx, cy, r: rr, fill: 'none', stroke: 'rgba(226,181,79,.16)', 'stroke-width': 20 }, donutSvg);
  const arc = sv('circle', { cx, cy, r: rr, fill: 'none', stroke: '#f0c45c', 'stroke-width': 20, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1, transform: `rotate(-90 ${cx} ${cy})`, filter: 'url(#fGlow)' }, donutSvg);
  const val = sv('text', { x: cx, y: cy + 12, 'text-anchor': 'middle', fill: '#f4efe6', 'font-family': 'Montserrat', 'font-weight': 800, 'font-size': 38 }, donutSvg);
  const lb = sv('text', { x: cx, y: dh - 14, 'text-anchor': 'middle', fill: '#c9b88f', 'font-family': 'JetBrains Mono', 'font-size': 18, 'letter-spacing': 3 }, donutSvg); lb.textContent = 'META MENSUAL';
  DONUT = { arc, val };
}
const cursor = dash.querySelector('.cursor'), segPill = dash.querySelector('.seg .pill'), SEG_SPANS = $$('.seg span', dash);
let CUR = { from: [860, 930], mes: [700, 58], after: [560, 470], pillDx: 120 };
function layoutDash() {
  const seg = dash.querySelector('.seg'), spans = $$('.seg span', dash);
  const segR = seg.offsetLeft, mes = spans[1];
  CUR.mes = [seg.offsetLeft + mes.offsetLeft + mes.offsetWidth / 2 - 8, seg.offsetTop + mes.offsetTop + mes.offsetHeight / 2 - 4];
  CUR.pillDx = mes.offsetLeft - spans[0].offsetLeft;
  void segR;
}

/* ------------------------------------------------------------------ 02 · agentes */
const net = $('#agents .net');
const AG = { cx: 470, cy: 405, r: 318, nr: 70 };
const ICON = {
  agente: '<circle cx="36" cy="36" r="9" fill="url(#gIcon)"/><g fill="none" stroke="url(#gIcon)" stroke-width="3" stroke-linecap="round"><path d="M36 14v9M36 49v9M14 36h9M49 36h9M20.5 20.5l6.4 6.4M45.1 45.1l6.4 6.4M20.5 51.5l6.4-6.4M45.1 26.9l6.4-6.4"/></g>',
  ventas: '<g fill="none" stroke="url(#gIcon)" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14h8l7 30h30l6-22H22"/><circle cx="29" cy="54" r="4"/><circle cx="51" cy="54" r="4"/></g>',
  atencion: '<g fill="none" stroke="url(#gIcon)" stroke-width="3.4" stroke-linejoin="round"><path d="M12 16h48v30H32l-12 10V46h-8z"/><path d="M22 28h28M22 36h18" stroke-linecap="round"/></g>',
  cobranza: '<g fill="none" stroke="url(#gIcon)" stroke-width="3.4" stroke-linecap="round"><circle cx="36" cy="36" r="24"/><path d="M44 27c-2-3-5-4-8-4-5 0-8 3-8 6 0 8 16 5 16 13 0 4-4 7-8 7-4 0-7-2-9-5M36 18v5M36 49v5"/></g>',
  agenda: '<g fill="none" stroke="url(#gIcon)" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><rect x="12" y="16" width="48" height="44" rx="6"/><path d="M12 29h48M24 10v12M48 10v12M27 44l6 6 12-12"/></g>',
  reportes: '<g fill="none" stroke="url(#gIcon)" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h26l12 12v40H18z"/><path d="M44 10v12h12M27 50V40M36 50V32M45 50V44"/></g>',
  inventario: '<g fill="none" stroke="url(#gIcon)" stroke-width="3.4" stroke-linejoin="round"><path d="M36 10l24 12v28L36 62 12 50V22z"/><path d="M12 22l24 12 24-12M36 34v28"/></g>',
};
const SATS = [['VENTAS', 'ventas'], ['ATENCIÓN', 'atencion'], ['COBRANZA', 'cobranza'], ['AGENDA', 'agenda'], ['REPORTES', 'reportes'], ['INVENTARIO', 'inventario']]
  .map(([label, icon], i) => {
    const a = (-90 + i * 60) * D2R, x = AG.cx + AG.r * Math.cos(a), y = AG.cy + AG.r * Math.sin(a);
    const dx = Math.cos(a), dy = Math.sin(a);
    const line = sv('line', { x1: AG.cx + dx * 116, y1: AG.cy + dy * 116, x2: x - dx * (AG.nr + 4), y2: y - dy * (AG.nr + 4), stroke: 'rgba(240,200,110,.55)', 'stroke-width': 2.4, pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 }, net);
    return { label, icon, a, x, y, line };
  });
const pulseG = sv('g', {}, net);
const PULSES = SATS.map(() => [sv('circle', { r: 6, fill: '#fff3cf', filter: 'url(#fGlow)' }, pulseG), sv('circle', { r: 4, fill: '#f2c862' }, pulseG)]);
SATS.forEach(s => {
  const g = sv('g', { transform: `translate(${s.x} ${s.y})` }, net);
  const inner = sv('g', {}, g);
  sv('circle', { r: AG.nr, fill: 'url(#gNode)', stroke: 'rgba(240,200,110,.85)', 'stroke-width': 2.4 }, inner);
  const ic = sv('g', { transform: 'translate(-28 -28) scale(.7778)' }, inner); ic.innerHTML = ICON[s.icon];
  const tx = sv('text', { y: AG.nr + 34, 'text-anchor': 'middle', fill: '#f4efe6', 'font-family': 'Montserrat', 'font-weight': 700, 'font-size': 27, 'letter-spacing': 1.5 }, inner);
  tx.textContent = s.label;
  s.g = inner;
});
const hub = sv('g', { transform: `translate(${AG.cx} ${AG.cy})` }, net);
const hubInner = sv('g', {}, hub);
const hubRing = sv('circle', { r: 126, fill: 'none', stroke: 'rgba(240,200,110,.45)', 'stroke-width': 2, 'stroke-dasharray': '6 10' }, hubInner);
sv('circle', { r: 108, fill: 'url(#gNode)', stroke: '#f0c45c', 'stroke-width': 3, filter: 'url(#fGlow)' }, hubInner);
const hubIc = sv('g', { transform: 'translate(-44 -64) scale(1.222)' }, hubInner); hubIc.innerHTML = ICON.agente;
const hubTx = sv('text', { y: 54, 'text-anchor': 'middle', fill: '#e2b54f', 'font-family': 'JetBrains Mono', 'font-weight': 700, 'font-size': 22, 'letter-spacing': 4 }, hubInner);
hubTx.textContent = 'AGENTE';
const CHECK = '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="#e2b54f"/><path d="M9 16.5l4.5 4.5L23 11.5" fill="none" stroke="#1b1307" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const TASKS = [['Cotización enviada', 24, 868], ['Cita agendada', 560, 868], ['Reporte listo', 300, 946]].map(([txt, x, y]) => {
  const el = mk('div', 'task', $('#agents'));
  el.innerHTML = CHECK + `<span>${txt}</span>`;
  el.style.left = x + 'px'; el.style.top = y + 'px';
  return el;
});

/* ------------------------------------------------------------------ 03 · análisis de datos */
const scv = $('#datos .scatter'), sc = scv.getContext('2d');
const PLOT = { x0: 120, x1: 880, y0: 150, y1: 760 };
const CLUSTERS = [
  { cx: .2, cy: .22, sd: .07, col: [176, 160, 128] },
  { cx: .5, cy: .5, sd: .08, col: [226, 181, 79] },
  { cx: .8, cy: .8, sd: .06, col: [255, 240, 196] },
];
const PTS = (() => {
  const r = rng(77), out = [];
  const gauss = () => { let u = 0, v = 0; while (!u) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
  for (let i = 0; i < 150; i++) {
    const k = i % 3 === 2 && r() < .55 ? 2 : r() < .5 ? 0 : 1, c = CLUSTERS[k];
    out.push({ k, sx: .05 + r() * .9, sy: .05 + r() * .9, tx: clamp(c.cx + gauss() * c.sd, .03, .97), ty: clamp(c.cy + gauss() * c.sd, .03, .97), h: r(), d: r() * .35, s: 4 + r() * 3 });
  }
  return out;
})();
const toPX = (u, v) => [lerp(PLOT.x0, PLOT.x1, u), lerp(PLOT.y1, PLOT.y0, v)];
function drawScatter(t) {
  const t0 = K.svc3, tau = t - t0;
  sc.clearRect(0, 0, 940, 970);
  const ax = P(tau, .05, .5);
  sc.globalAlpha = ax;
  sc.strokeStyle = 'rgba(226,184,90,.45)'; sc.lineWidth = 2;
  sc.beginPath(); sc.moveTo(PLOT.x0, PLOT.y0 - 20); sc.lineTo(PLOT.x0, PLOT.y1); sc.lineTo(PLOT.x1 + 20, PLOT.y1); sc.stroke();
  sc.strokeStyle = 'rgba(226,184,90,.1)'; sc.lineWidth = 1;
  for (let k = 1; k <= 4; k++) {
    const y = lerp(PLOT.y1, PLOT.y0, k / 4), x = lerp(PLOT.x0, PLOT.x1, k / 4);
    sc.beginPath(); sc.moveTo(PLOT.x0, y); sc.lineTo(PLOT.x1, y); sc.moveTo(x, PLOT.y0); sc.lineTo(x, PLOT.y1); sc.stroke();
  }
  sc.fillStyle = '#c9b88f'; sc.font = '500 16px "JetBrains Mono"'; sc.letterSpacing = '3px';
  sc.fillText('FRECUENCIA DE COMPRA  →', PLOT.x1 - 290, PLOT.y1 + 44);
  sc.save(); sc.translate(PLOT.x0 - 40, PLOT.y1 - 10); sc.rotate(-Math.PI / 2); sc.fillText('VALOR DEL CLIENTE  →', 0, 0); sc.restore();
  sc.fillStyle = '#e2b54f'; sc.font = '700 18px "JetBrains Mono"'; sc.letterSpacing = '4px';
  sc.fillText('SEGMENTACIÓN DE CLIENTES · DEMO', 40, 64);
  // escaneo de procesamiento
  const scanP = (tau - .85) / .55;
  if (scanP > 0 && scanP < 1) {
    const x = lerp(PLOT.x0, PLOT.x1, scanP);
    const g = sc.createLinearGradient(x - 80, 0, x, 0);
    g.addColorStop(0, 'rgba(240,190,90,0)'); g.addColorStop(1, 'rgba(240,190,90,.28)');
    sc.globalAlpha = 1; sc.fillStyle = g; sc.fillRect(x - 80, PLOT.y0 - 20, 80, PLOT.y1 - PLOT.y0 + 20);
    sc.fillStyle = 'rgba(255,240,200,.9)'; sc.fillRect(x - 1.5, PLOT.y0 - 20, 3, PLOT.y1 - PLOT.y0 + 20);
  }
  // puntos: aparecen al azar y luego se agrupan en segmentos
  sc.globalCompositeOperation = 'lighter';
  for (const p of PTS) {
    const ap = P(tau, .2 + p.h * .6, .25, E.outBack);
    if (ap <= 0) continue;
    const m = P(tau, 1.0 + p.d, .7, E.inOutCubic);
    const [x, y] = toPX(lerp(p.sx, p.tx, m), lerp(p.sy, p.ty, m));
    const c = CLUSTERS[p.k].col, base = [236, 226, 206];
    const col = base.map((b, j) => Math.round(lerp(b, c[j], m)));
    sc.globalAlpha = .9 * clamp(ap);
    sc.fillStyle = `rgb(${col.join(',')})`;
    sc.beginPath(); sc.arc(x, y, p.s * clamp(ap, 0, 1.3), 0, TAU); sc.fill();
  }
  sc.globalCompositeOperation = 'source-over';
  // tendencia
  const lp = P(tau, 1.55, .5, E.inOutCubic);
  if (lp > 0) {
    const [ax0, ay0] = toPX(.05, .08), [ax1, ay1] = toPX(.95, .92);
    sc.globalAlpha = 1; sc.strokeStyle = '#f2c862'; sc.lineWidth = 3.5; sc.setLineDash([14, 10]);
    sc.beginPath(); sc.moveTo(ax0, ay0); sc.lineTo(lerp(ax0, ax1, lp), lerp(ay0, ay1, lp)); sc.stroke(); sc.setLineDash([]);
  }
  // patrón detectado
  const hp = P(tau, 1.9, .45, E.outBack);
  if (hp > 0) {
    const [cx, cy] = toPX(.8, .8);
    sc.globalAlpha = clamp(hp);
    sc.save(); sc.translate(cx, cy); sc.rotate(tau * .8);
    sc.strokeStyle = '#ffe6a3'; sc.lineWidth = 3; sc.setLineDash([10, 8]);
    sc.beginPath(); sc.arc(0, 0, 92 * hp, 0, TAU); sc.stroke(); sc.setLineDash([]); sc.restore();
    const bx = 180, by = 190, lp2 = P(tau, 2.05, .35, E.outCubic);
    sc.strokeStyle = 'rgba(240,200,110,.9)'; sc.lineWidth = 2;
    sc.beginPath(); sc.moveTo(cx - 70, cy - 20); sc.lineTo(lerp(cx - 70, bx + 380, lp2), lerp(cy - 20, by + 40, lp2)); sc.stroke();
    sc.globalAlpha = P(tau, 2.15, .3);
    sc.fillStyle = 'rgba(20,16,10,.92)'; sc.strokeStyle = 'rgba(240,200,110,.85)'; sc.lineWidth = 1.5;
    roundRect(sc, bx, by, 400, 96, 14); sc.fill(); sc.stroke();
    sc.fillStyle = '#e2b54f'; sc.font = '700 20px "JetBrains Mono"'; sc.letterSpacing = '4px'; sc.fillText('PATRÓN DETECTADO', bx + 22, by + 36);
    sc.fillStyle = '#f4efe6'; sc.font = '700 29px Montserrat'; sc.letterSpacing = '0px'; sc.fillText('Segmento de mayor valor', bx + 22, by + 74);
  }
  sc.globalAlpha = P(tau, 2.2, .4);
  sc.fillStyle = '#e2b54f'; sc.font = '700 25px "JetBrains Mono"'; sc.letterSpacing = '5px';
  sc.textAlign = 'center'; sc.fillText('3 SEGMENTOS  ·  1 OPORTUNIDAD', 470, 900); sc.textAlign = 'left';
  sc.globalAlpha = 1; sc.letterSpacing = '0px';
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

/* ------------------------------------------------------------------ 04 · toma de decisiones */
const dec = $('#decide'), tree = $('#decide .tree');
const rootPill = mk('div', 'root-pill glass', dec);
rootPill.innerHTML = '<div class="a">ESCENARIOS EVALUADOS: 3</div><div class="b">¿QUÉ HACEMOS?</div>';
const OPTS = [['A', 64, .62, .55], ['B', 91, .88, .28], ['C', 47, .41, .72]].map(([id, score, ret, risk], i) => {
  const x = 22 + i * 306, el = mk('div', 'opt glass', dec);
  el.style.left = x + 'px';
  el.innerHTML = `<div class="o-t">ESCENARIO ${id}</div><div class="o-n">0</div><div class="o-u">PUNTAJE</div>
    <div class="bar"><div class="l">RETORNO</div><div class="t"><div class="f"></div></div></div>
    <div class="bar"><div class="l">RIESGO</div><div class="t"><div class="f"></div></div></div>`;
  const path = sv('path', { d: `M470 158 C470 270 ${x + 142} 290 ${x + 142} 400`, fill: 'none', stroke: 'rgba(240,200,110,.4)', 'stroke-width': 2.4, pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 }, tree);
  return { id, score, ret, risk, el, x, path, n: el.querySelector('.o-n'), fills: [...el.querySelectorAll('.f')] };
});
const winPath = sv('path', { d: OPTS[1].path.getAttribute('d'), fill: 'none', stroke: '#ffe6a3', 'stroke-width': 5, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1, filter: 'url(#fGlow)' }, tree);
const winPulse = sv('circle', { r: 8, fill: '#fff4d0', filter: 'url(#fGlow)' }, tree);
const badge = mk('div', 'badge', OPTS[1].el);
badge.innerHTML = '<div>' + CHECK.replace('fill="#e2b54f"', 'fill="#1b1307"').replace('stroke="#1b1307"', 'stroke="#f2c862"') + 'RECOMENDADO</div>';
badge.querySelector('svg').style.cssText = 'width:28px;height:28px';
const verdict = mk('div', 'verdict', dec, 'DECISIÓN BASADA EN EVIDENCIA');

/* ------------------------------------------------------------------ 05 · infraestructura cognitiva */
const stack = $('#s4 .stack');
const SLAB = { cx: 440, hw: 255, hh: 128, th: 30, ys: [1478, 1328, 1178, 1028] };
const SLABS = C.capas.map((name, i) => {
  const yc = SLAB.ys[i], { cx, hw, hh, th } = SLAB;
  const g = sv('g', {}, stack), inner = sv('g', {}, g);
  sv('polygon', { points: `${cx - hw},${yc} ${cx},${yc + hh} ${cx},${yc + hh + th} ${cx - hw},${yc + th}`, fill: 'url(#gSlabL)', stroke: 'rgba(240,200,110,.45)', 'stroke-width': 1.2 }, inner);
  sv('polygon', { points: `${cx},${yc + hh} ${cx + hw},${yc} ${cx + hw},${yc + th} ${cx},${yc + hh + th}`, fill: 'url(#gSlabR)', stroke: 'rgba(240,200,110,.45)', 'stroke-width': 1.2 }, inner);
  sv('polygon', { points: `${cx},${yc - hh} ${cx + hw},${yc} ${cx},${yc + hh} ${cx - hw},${yc}`, fill: 'url(#gSlabTop)', stroke: 'url(#gEdge)', 'stroke-width': 2.4 }, inner);
  const grid = sv('g', { stroke: 'rgba(240,200,110,.16)', 'stroke-width': 1 }, inner);
  for (let k = 1; k < 6; k++) {
    const f = k / 6;
    sv('line', { x1: lerp(cx - hw, cx, f), y1: lerp(yc, yc - hh, f), x2: lerp(cx, cx + hw, f), y2: lerp(yc + hh, yc, f) }, grid);
    sv('line', { x1: lerp(cx - hw, cx, f), y1: lerp(yc, yc + hh, f), x2: lerp(cx, cx + hw, f), y2: lerp(yc - hh, yc, f) }, grid);
  }
  const core = sv('polygon', { points: `${cx},${yc - hh * .34} ${cx + hw * .34},${yc} ${cx},${yc + hh * .34} ${cx - hw * .34},${yc}`, fill: 'rgba(242,200,98,.22)', stroke: '#f2c862', 'stroke-width': 1.6 }, inner);
  sv('line', { x1: cx + hw + 8, y1: yc + th / 2, x2: cx + hw + 40, y2: yc + th / 2, stroke: 'rgba(240,200,110,.8)', 'stroke-width': 2 }, inner);
  const lb = sv('text', { x: cx + hw + 44, y: yc + th / 2 - 6, fill: '#f4efe6', 'font-family': 'Montserrat', 'font-weight': 800, 'font-size': 29, 'letter-spacing': 1 }, inner);
  lb.textContent = name;
  const nb = sv('text', { x: cx + hw + 44, y: yc + th / 2 + 22, fill: '#e2b54f', 'font-family': 'JetBrains Mono', 'font-weight': 700, 'font-size': 17, 'letter-spacing': 4, 'data-layout-ignore': '' }, inner);
  nb.textContent = 'CAPA 0' + (i + 1);
  return { g, inner, core, yc };
});
const beams = sv('g', {}, stack);
const BEAMS = [-90, 0, 90].map(dx => sv('line', { x1: SLAB.cx + dx, y1: SLAB.ys[0] + 40, x2: SLAB.cx + dx, y2: SLAB.ys[3] - 40, stroke: '#ffe6a3', 'stroke-width': 3, 'stroke-dasharray': '18 26', 'stroke-linecap': 'round', filter: 'url(#fGlow)' }, beams));
beams.setAttribute('opacity', '.6');
const crown = sv('g', {}, stack);
const CROWN = { cx: SLAB.cx, cy: 868, rx: 226, ry: 56 };
const crownBack = sv('ellipse', { cx: CROWN.cx, cy: CROWN.cy, rx: CROWN.rx, ry: CROWN.ry, fill: 'none', stroke: 'url(#gEdge)', 'stroke-width': 9, pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1, filter: 'url(#fGlow)' }, crown);
const crownHi = sv('ellipse', { cx: CROWN.cx, cy: CROWN.cy - 2, rx: CROWN.rx - 2, ry: CROWN.ry - 2, fill: 'none', stroke: '#fff4d0', 'stroke-width': 2, 'stroke-dasharray': '.12 .88', pathLength: 1 }, crown);

/* ------------------------------------------------------------------ cierre */
const ctaRing = $('#cta-ring');
const CR = { cx: 540, cy: 520 };
const ctaR1 = sv('circle', { cx: CR.cx, cy: CR.cy, r: 330, fill: 'none', stroke: 'url(#gEdge)', 'stroke-width': 2, pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1, opacity: .7 }, ctaRing);
const ctaR2 = sv('circle', { cx: CR.cx, cy: CR.cy, r: 352, fill: 'none', stroke: '#d4a437', 'stroke-width': 1, 'stroke-dasharray': '.004 .012', pathLength: 1, opacity: 0 }, ctaRing);
ctaRing.style.webkitMaskImage = ctaRing.style.maskImage = 'linear-gradient(180deg, #000 0px, #000 560px, transparent 760px)';
const cNameBox = $('#c-name'), cName = mk('span', 'silver', cNameBox), cRole = $('#c-role'), cTel = $('#c-tel'), cWeb = $('#c-web'), cBtn = $('#c-btn'), cLema = $('#c-lema'), cFoot = $('#c-foot');
cRole.textContent = C.contacto.cargo;
const telSpan = cTel.querySelector('span'), webSpan = cWeb.querySelector('span');
const webCh = splitChars(webSpan, C.contacto.web);
cBtn.querySelector('span').textContent = C.contacto.cta;
const lemaL = [...cLema.children];
lemaL[0].textContent = C.lema[0]; lemaL[1].textContent = C.lema[1] || '';
cFoot.textContent = C.marca.sub1;

/* ------------------------------------------------------------------ globo (escena 2) */
const gcv = $('#globe'), g = gcv.getContext('2d');
const GL = { cx: 540, cy: 760, R0: 255 };
const DOTS = (() => {
  const a = window.GLOBE_DOTS || [], n = a.length / 2, r = rng(11), out = new Float32Array(n * 5);
  for (let i = 0; i < n; i++) {
    const la = a[2 * i] * D2R, lo = a[2 * i + 1] * D2R;
    out.set([la, lo, r(), Math.cos(la), Math.sin(la)], i * 5);
  }
  return out;
})();
const MKTS = C.mercados.map(m => ({ ...m, la: m.lat * D2R, lo: m.lon * D2R }));
function view(t) {
  const zoom = clamp((t - K.zoom) / (K.svc1 - K.zoom)), zE = E.inCubic(zoom);
  const R = GL.R0 * (.9 + .1 * P(t, K.s2, 1.0)) * Math.exp(4.4 * zE);
  return { lam: (-52 - (t - K.s2) * 3) * D2R, phi: 26 * D2R, R, zoom, zE };
}
function unit(la, lo) { return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)]; }
function projV(v3, vw, alt = 1) {
  // rota el vector (x,y,z) del mundo a la vista y proyecta (ortográfica)
  const [x0, y0, z0] = v3, c = Math.cos(-vw.lam), s = Math.sin(-vw.lam);
  const x = x0 * c + z0 * s, z = -x0 * s + z0 * c, y = y0;
  const sp = Math.sin(vw.phi), cp = Math.cos(vw.phi);
  const y2 = y * cp - z * sp, z2 = y * sp + z * cp;
  return [GL.cx + vw.R * alt * x, GL.cy - vw.R * alt * y2, z2];
}
function ringOf(t, vw) {
  const rx = vw.R * 1.5 * (1 + 2.6 * vw.zE);
  return { rx, ry: rx * .3, rot: -13 * D2R, a0: .62 * Math.PI, fade: 1 - clamp(vw.zoom / .5) };
}
function ringPt(s, a) {
  const x = s.rx * Math.cos(a), y = s.ry * Math.sin(a), c = Math.cos(s.rot), sn = Math.sin(s.rot);
  return [GL.cx + x * c - y * sn, GL.cy + x * sn + y * c];
}
function drawRing(s, t, half, alpha) {
  if (alpha <= 0 || s.fade <= 0) return;
  const segs = half === 'front' ? [[0, Math.PI]] : [[Math.PI, TAU]];
  const base = g.globalAlpha, dim = half === 'back' ? .5 : 1;
  g.save(); g.translate(GL.cx, GL.cy); g.rotate(s.rot);
  const gr = g.createLinearGradient(-s.rx, 0, s.rx, 0);
  gr.addColorStop(0, '#5e3d0c'); gr.addColorStop(.24, '#c99232'); gr.addColorStop(.5, '#fff1bf'); gr.addColorStop(.76, '#c99232'); gr.addColorStop(1, '#5e3d0c');
  g.lineCap = 'round';
  for (const [a, b] of segs) {
    g.globalAlpha = base * alpha * s.fade * .24 * dim; g.strokeStyle = '#f0b850'; g.lineWidth = Math.max(20, s.rx * .07); g.filter = 'blur(10px)';
    g.beginPath(); g.ellipse(0, 0, s.rx, s.ry, 0, a, b); g.stroke(); g.filter = 'none';
    g.globalAlpha = base * alpha * s.fade * dim; g.strokeStyle = gr; g.lineWidth = Math.max(9, s.rx * .028);
    g.beginPath(); g.ellipse(0, 0, s.rx, s.ry, 0, a, b); g.stroke();
    g.globalAlpha = base * alpha * s.fade * .85 * dim; g.strokeStyle = 'rgba(255,247,215,.9)'; g.lineWidth = Math.max(1.6, s.rx * .005);
    g.beginPath(); g.ellipse(0, -s.rx * .008, s.rx * .996, s.ry * .965, 0, a, b); g.stroke();
  }
  g.restore();
  const head = s.a0 + (t - K.ring) * 2.1;
  if ((half === 'front') === (Math.sin(head) > 0)) {
    const [x, y] = ringPt(s, head);
    g.globalAlpha = base * alpha * s.fade * dim; g.globalCompositeOperation = 'lighter';
    g.drawImage(SPR_DOT, x - 26, y - 26, 52, 52); g.globalCompositeOperation = 'source-over';
  }
  g.globalAlpha = base;
}
const BUCKETS = 10;
function drawGlobe(t) {
  g.clearRect(0, 0, W, H);
  const on = t >= K.s2 - .05 && t < K.svc1 + .02; vis(gcv, on); if (!on) return;
  const v = view(t), { cx, cy } = GL, R = v.R;
  g.globalAlpha = P(t, K.s2, .5) * (1 - P(t, K.svc1 - .14, .14, E.inQuad));
  if (R < 4000) {
    const at = g.createRadialGradient(cx, cy, R * .92, cx, cy, R * 1.3);
    at.addColorStop(0, 'rgba(232,180,80,.3)'); at.addColorStop(.35, 'rgba(232,180,80,.1)'); at.addColorStop(1, 'rgba(232,180,80,0)');
    g.fillStyle = at; g.beginPath(); g.arc(cx, cy, R * 1.3, 0, TAU); g.fill();
  }
  const s = ringOf(t, v), ra = P(t, K.ring + .05, .35);
  drawRing(s, t, 'back', ra);
  const sg = g.createRadialGradient(cx - R * .35, cy - R * .4, R * .05, cx, cy, R * 1.05);
  sg.addColorStop(0, '#231c11'); sg.addColorStop(.55, '#0c0a07'); sg.addColorStop(1, '#030303');
  g.fillStyle = sg; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(240,200,120,.38)'; g.lineWidth = 1.6; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke();
  const reveal = P(t, K.s2 + .1, .9, E.inOutQuad) * 1.2, zoomed = v.zE > .015;
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
    const a = ap * (.22 + .78 * Math.pow(z2, 1.3)), b = Math.min(BUCKETS - 1, (a * BUCKETS) | 0), rr = dr * (.55 + .45 * z2);
    if (zoomed) { const k = 1 - .32 * v.zE; paths[b].moveTo(cx + (X - cx) * k, cy + (Y - cy) * k); paths[b].lineTo(X, Y); }
    else { paths[b].moveTo(X + rr, Y); paths[b].arc(X, Y, rr, 0, TAU); }
  }
  for (let b = 0; b < BUCKETS; b++) {
    const a = (b + .5) / BUCKETS;
    if (zoomed) { g.strokeStyle = `rgba(255,226,160,${a})`; g.lineWidth = Math.min(dr * 1.1, 1.6 + 3.2 * v.zE); g.lineCap = 'round'; g.stroke(paths[b]); }
    else { g.fillStyle = `rgba(255,228,165,${a})`; g.fill(paths[b]); }
  }
  // arcos desde Guadalajara hacia USA y España, con pulsos de luz
  const base = g.globalAlpha, fadeZ = 1 - clamp(v.zoom * 2.5);
  const hq = unit(MKTS[0].la, MKTS[0].lo);
  MKTS.slice(1).forEach((m, j) => {
    const to = unit(m.la, m.lo), dp = P(t, K.arcs + j * .35, .8, E.inOutCubic);
    if (dp <= 0) return;
    const om = Math.acos(clamp(hq[0] * to[0] + hq[1] * to[1] + hq[2] * to[2], -1, 1)), N = 60, pts = [];
    for (let k = 0; k <= N; k++) {
      const s = k / N, a = Math.sin((1 - s) * om) / Math.sin(om), b = Math.sin(s * om) / Math.sin(om);
      const p3 = [a * hq[0] + b * to[0], a * hq[1] + b * to[1], a * hq[2] + b * to[2]];
      pts.push(projV(p3, v, 1 + (.12 + .1 * om) * Math.sin(Math.PI * s)));
    }
    const upto = Math.max(1, Math.round(N * dp));
    g.globalAlpha = base * fadeZ; g.lineWidth = 2.6; g.strokeStyle = 'rgba(255,214,120,.9)'; g.lineCap = 'round';
    g.beginPath();
    for (let k = 0; k <= upto; k++) { const [x, y, z] = pts[k]; k ? g.lineTo(x, y) : g.moveTo(x, y); void z; }
    g.stroke();
    if (dp >= 1) {
      const ph = frac((t - K.arcs - j * .35 - .8) * .9), idx = Math.min(N, Math.max(0, Math.floor(ph * N))), [x, y] = pts[idx];
      g.globalCompositeOperation = 'lighter'; g.drawImage(SPR_DOT, x - 22, y - 22, 44, 44); g.globalCompositeOperation = 'source-over';
    } else {
      const [x, y] = pts[upto];
      g.globalCompositeOperation = 'lighter'; g.drawImage(SPR_DOT, x - 30, y - 30, 60, 60); g.globalCompositeOperation = 'source-over';
    }
  });
  // marcadores de mercado
  MKTS.forEach((m, j) => {
    const a = P(t, K.arcs - .1 + j * .3, .3) * fadeZ;
    if (a <= 0) return;
    const [x, y, z] = projV(unit(m.la, m.lo), v);
    if (z <= 0) return;
    g.save(); g.globalAlpha = base * a;
    const ph = frac((t - K.arcs) * 1.4 + j * .3);
    g.strokeStyle = `rgba(255,214,120,${(1 - ph) * .85})`; g.lineWidth = 2.2;
    g.beginPath(); g.arc(x, y, 6 + ph * 34, 0, TAU); g.stroke();
    g.fillStyle = '#fff6dc'; g.beginPath(); g.arc(x, y, j ? 5 : 7, 0, TAU); g.fill();
    g.font = '700 26px "JetBrains Mono"'; g.letterSpacing = '4px'; g.shadowColor = 'rgba(0,0,0,.95)'; g.shadowBlur = 10;
    g.fillStyle = '#f6d88e'; g.textAlign = m.id === 'esp' ? 'right' : 'left';
    const lx = m.id === 'esp' ? x - 16 : x + 16, ly = m.id === 'usa' ? y - 14 : y + 30;
    g.fillText(m.label, lx, ly);
    g.restore();
  });
  drawRing(s, t, 'front', ra);
  g.globalAlpha = 1;
}

/* ------------------------------------------------------------------ partículas del gancho → anillo */
let MORPH = [];
function sampleHook() {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#fff';
  x.font = `900 ${HOOK.fs}px Archivo`;
  x.letterSpacing = (-.01 * HOOK.fs) + 'px';
  const m = x.measureText('Hg'), A = m.fontBoundingBoxAscent, D = m.fontBoundingBoxDescent;
  C.gancho.forEach((txt, i) => {
    const top = HOOK.top + i * HOOK.lh, base = top + (HOOK.lh - (A + D)) / 2 + A;
    x.fillText(txt, 90, base);
  });
  const id = x.getImageData(0, 0, W, H).data, pts = [], step = 6;
  for (let yy = 0; yy < H; yy += step) for (let xx = 0; xx < W; xx += step) if (id[(yy * W + xx) * 4 + 3] > 140) pts.push([xx, yy]);
  const r = rng(5), v = view(K.ring + .3), s = ringOf(K.ring + .3, v), goldTop = HOOK.top + 2 * HOOK.lh, goldBot = goldTop + HOOK.lh;
  MORPH = pts.map(([px, py]) => {
    let tx, ty;
    if (r() < .72) { const a = r() * TAU; [tx, ty] = ringPt(s, a); tx += (r() - .5) * 10; ty += (r() - .5) * 8; }
    else { const a = r() * TAU, rr = Math.sqrt(r()) * GL.R0 * .92; tx = GL.cx + Math.cos(a) * rr; ty = GL.cy + Math.sin(a) * rr; }
    const mx = (px + tx) / 2, my = (py + ty) / 2, ang = Math.atan2(py - GL.cy, px - GL.cx) + Math.PI / 2;
    const sw = 220 + r() * 260;
    return { px, py, tx, ty, cx: mx + Math.cos(ang) * sw, cy: my + Math.sin(ang) * sw, d: r() * .4, gold: py >= goldTop && py < goldBot, s: 1.6 + r() * 1.6 };
  });
}
function drawMorph(t) {
  const t0 = K.morph;
  if (t < t0 || t > K.ring + .6 || !MORPH.length) return;
  const fadeOut = 1 - P(t, K.ring + .1, .45);
  fc.globalCompositeOperation = 'lighter';
  for (const p of MORPH) {
    const e = E.inOutCubic(clamp((t - t0 - p.d) / .95));
    const u = 1 - e, x = u * u * p.px + 2 * u * e * p.cx + e * e * p.tx, y = u * u * p.py + 2 * u * e * p.cy + e * e * p.ty;
    const col = p.gold || e > .5 ? '255,214,120' : '244,239,230';
    fc.globalAlpha = fadeOut * (.75 + .25 * Math.sin(p.d * 40 + t * 9));
    fc.fillStyle = `rgb(${col})`;
    fc.fillRect(x - p.s / 2, y - p.s / 2, p.s, p.s);
  }
  fc.globalCompositeOperation = 'source-over'; fc.globalAlpha = 1;
}

/* ------------------------------------------------------------------ fondo: rejilla en perspectiva */
const gridCv = $('#grid'), gc = gridCv.getContext('2d');
const GRIDK = [[0, .35], [3.0, .35], [3.6, 0], [7.9, 0], [8.2, .85], [30, .85]];
function drawGrid(t) {
  gc.clearRect(0, 0, W, H);
  const [a] = kf(t, GRIDK);
  if (a < .01) return;
  const hy = 1180, vx = 540;
  gc.lineWidth = 1.2;
  for (let k = -24; k <= 24; k++) {
    const xb = vx + k * 120;
    const gr = gc.createLinearGradient(0, hy, 0, H);
    gr.addColorStop(0, 'rgba(226,181,79,0)'); gr.addColorStop(1, `rgba(226,181,79,${.22 * a})`);
    gc.strokeStyle = gr; gc.beginPath(); gc.moveTo(vx + k * 6, hy); gc.lineTo(xb * 1.6 - vx * .6, H); gc.stroke();
  }
  const off = (t * .55) % 1;
  for (let k = 0; k < 16; k++) {
    const z = 1 + (k - off) * .6;
    if (z <= .4) continue;
    const y = hy + (H - hy) * (1 / z) * .9;
    if (y > H || y < hy) continue;
    gc.strokeStyle = `rgba(226,181,79,${a * .2 * clamp((y - hy) / 260)})`;
    gc.beginPath(); gc.moveTo(0, y); gc.lineTo(W, y); gc.stroke();
  }
}

/* ------------------------------------------------------------------ efectos globales */
const fcv = $('#fx'), fc = fcv.getContext('2d');
const DUST = (() => { const r = rng(7); return Array.from({ length: 120 }, () => ({ x: r() * W, y: r() * H, vy: -(5 + r() * 24), vx: (r() - .5) * 8, s: .5 + r() * 1.5, f: .2 + r() * .9, ph: r() * TAU, a: .12 + r() * .45, wob: 5 + r() * 16 })); })();
const BOKEH = (() => { const r = rng(9); return Array.from({ length: 14 }, () => ({ x: r() * W, y: r() * H, R: 28 + r() * 70, vy: -(3 + r() * 8), vx: (r() - .5) * 6, a: .03 + r() * .06, ph: r() * TAU })); })();
const BURSTS = [
  { t: K.ring, x: 540, y: 760, w: 760, n: 90, sp: 520, life: 1.2, seed: 21 },
  { t: K.svc4 + 1.5, x: 70 + 328 + 142, y: 650 + 600, w: 260, n: 60, sp: 520, life: 1.0, seed: 22 },
  { t: K.crown, x: 440, y: 868, w: 450, n: 90, sp: 620, life: 1.2, seed: 23 },
  { t: K.boton, x: 540, y: 1130, w: 780, n: 70, sp: 560, life: 1.0, seed: 25 },
].map(b => {
  const r = rng(b.seed);
  b.parts = Array.from({ length: b.n }, () => ({ u: r(), v: r() - .5, a: r() * TAU, sp: b.sp * (.25 + .75 * r()), k: 2.2 + r() * 2.2, s: .8 + r() * 1.8, life: b.life * (.5 + .5 * r()) }));
  return b;
});
const SPARKS = [
  [K.ring + .02, 330, 840, 1.2], [K.logo + .9, 860, 1110, .9], [K.svc1 + 1.62, 760, 715, .8], [K.svc4 + 1.55, 680, 1060, 1],
  [K.crown + .1, 230, 860, 1.1], [K.crown + .3, 670, 850, .9], [K.boton + .15, 150, 1080, .9], [K.boton + .25, 930, 1180, .9], [28.2, 540, 1070, .8],
];
const FLASHES = [{ t: K.ring, a: .22, d: .45, pre: .04 }, { t: K.svc1, a: .8, d: .32, pre: .1 }, { t: K.infra, a: .3, d: .4, pre: .06 }, { t: K.cta + .05, a: .2, d: .45, pre: .1 }, { t: K.boton, a: .12, d: .4, pre: .03 }];
const SHAKES = [{ t: K.ring, a: 6, d: .35 }, { t: K.infra, a: 8, d: .4 }, ...C.capas.map((_, i) => ({ t: K.slab0 + i * K.slabGap + .3, a: 4, d: .25 })), { t: K.cta, a: 5, d: .3 }];
const PARTK = [[0, 0], [1, .5], [3.0, .5], [4.2, 1], [30, 1]];
function particles(t) {
  fc.clearRect(0, 0, W, H);
  fc.globalCompositeOperation = 'lighter';
  const [I] = kf(t, PARTK);
  for (const b of BOKEH) {
    const x = b.x + b.vx * t, y = ((b.y + b.vy * t) % (H + 200) + H + 200) % (H + 200) - 100;
    fc.globalAlpha = b.a * I * (.7 + .3 * Math.sin(t * .7 + b.ph));
    fc.drawImage(SPR_BOKEH, x - b.R, y - b.R, b.R * 2, b.R * 2);
  }
  for (const p of DUST) {
    const y = ((p.y + p.vy * t) % (H + 60) + H + 60) % (H + 60) - 30, x = p.x + p.vx * t + p.wob * Math.sin(.5 * t + p.ph), s = 9 * p.s;
    fc.globalAlpha = p.a * I * (.55 + .45 * Math.sin(p.f * t * TAU + p.ph));
    fc.drawImage(SPR_DOT, x - s, y - s, s * 2, s * 2);
  }
  fc.lineCap = 'round';
  for (const b of BURSTS) {
    const tau = t - b.t;
    if (tau <= 0 || tau > b.life) continue;
    for (const p of b.parts) {
      if (tau > p.life) continue;
      const ox = b.x + (p.u - .5) * b.w, oy = b.y + p.v * 50, dx = Math.cos(p.a), dy = Math.sin(p.a);
      const pos = tt => { const dd = p.sp * (1 - Math.exp(-p.k * tt)) / p.k; return [ox + dx * dd, oy + dy * dd + 90 * tt * tt]; };
      const [x0, y0] = pos(Math.max(0, tau - .035)), [x1, y1] = pos(tau), al = Math.pow(1 - tau / p.life, 1.5);
      fc.globalAlpha = al; fc.strokeStyle = '#ffe2a0'; fc.lineWidth = p.s;
      fc.beginPath(); fc.moveTo(x0, y0); fc.lineTo(x1, y1); fc.stroke();
      fc.globalAlpha = al * .6; fc.drawImage(SPR_DOT, x1 - 8 * p.s, y1 - 8 * p.s, 16 * p.s, 16 * p.s);
    }
  }
  for (const [t0, x, y, k] of SPARKS) {
    const q = (t - t0) / .5;
    if (q <= 0 || q >= 1) continue;
    const s = Math.sin(Math.PI * q) * k;
    fc.save(); fc.globalAlpha = Math.sin(Math.PI * q); fc.translate(x, y); fc.rotate(q * .8); fc.scale(s, s);
    fc.drawImage(SPR_STAR, -80, -80); fc.restore();
  }
  // anillo del iris (infraestructura → cierre)
  if (t > K.cta - .15 && t < K.cta + .6) {
    const r = irisR(t), a = 1 - P(t, K.cta + .3, .25);
    fc.globalAlpha = a * .3; fc.strokeStyle = '#f0b850'; fc.lineWidth = 26;
    fc.beginPath(); fc.ellipse(CROWN.cx, CROWN.cy, r, r, 0, 0, TAU); fc.stroke();
    fc.globalAlpha = a; fc.strokeStyle = '#ffe6a3'; fc.lineWidth = 5;
    fc.beginPath(); fc.ellipse(CROWN.cx, CROWN.cy, r, r, 0, 0, TAU); fc.stroke();
  }
  fc.globalCompositeOperation = 'source-over'; fc.globalAlpha = 1;
  drawMorph(t);
}
const irisR = t => lerp(0, 1500, E.inOutCubic(clamp((t - (K.cta - .15)) / .6)));

/* ------------------------------------------------------------------ escenas */
function scene1(t) {
  const on = t < K.morph + .02; vis(SC.s1, on); if (!on) return;
  const cues = [K.l1, K.l2, K.l3, K.l4, K.l5];
  HL.forEach((h, i) => {
    const p = P(t, cues[i], .55, E.outExpo);
    S(h.l, { y: HOOK.lh * (1 - p) });
  });
  HL[2].l.textContent = decode(C.gancho[2], t, K.l3 + .05, .07, .3);
  // glitch de "INTUICIÓN?"
  const gq = (t - K.glitch) / .4, on2 = gq > 0 && gq < 1;
  const fr = Math.floor(t * 30), r = rng(900 + fr);
  if (on2) {
    const amp = 18 * (1 - gq);
    S(HL[4].l, { x: (r() - .5) * amp, clip: `inset(${f2(r() * 30)}% 0 ${f2(r() * 30)}% 0)` });
    S(glitchA, { o: .8, x: -10 - r() * 12, clip: `inset(${f2(r() * 60)}% 0 ${f2(r() * 30)}% 0)` });
    S(glitchB, { o: .8, x: 10 + r() * 12, clip: `inset(${f2(r() * 30)}% 0 ${f2(r() * 60)}% 0)` });
  } else {
    if (t > K.l5) S(HL[4].l, { y: HOOK.lh * (1 - P(t, K.l5, .55, E.outExpo)), clip: 'none' });
    S(glitchA, { o: 0 }); S(glitchB, { o: 0 });
  }
  // barrido dorado y disolución en partículas
  const sp = clamp((t - K.scan) / (K.morph - K.scan));
  const scanY = HOOK.top + sp * HOOK.lh * 5.2;
  HL.forEach(h => { if (sp > 0) h.w.style.opacity = (t >= K.morph ? 0 : 1).toFixed(0); else h.w.style.opacity = 1; });
  hookEl.style.filter = sp > 0 ? `drop-shadow(0 0 ${f2(14 * sp)}px rgba(240,190,90,.8))` : '';
  scanLine(t, sp, scanY);
}
function scanLine(t, sp, y) {
  if (sp <= 0 || sp >= 1) return;
  fc.save(); fc.globalCompositeOperation = 'lighter';
  const gr = fc.createLinearGradient(0, y - 40, 0, y + 4);
  gr.addColorStop(0, 'rgba(240,190,90,0)'); gr.addColorStop(1, 'rgba(255,236,190,.55)');
  fc.fillStyle = gr; fc.fillRect(0, y - 40, W, 44);
  fc.fillStyle = 'rgba(255,248,225,.95)'; fc.fillRect(0, y, W, 3);
  fc.restore();
}
function scene2(t) {
  const on = t >= K.s2 && t < K.svc1 + .02; vis(SC.s2, on); if (!on) return;
  logoIn(L1, t, K.logo);
  const out = P(t, K.zoom - .15, .3, E.inCubic);
  S(L1.root, { o: 1 - out, y: 40 * out, blur: 8 * out });
  const p1 = P(t, K.sub, .9, E.outExpo), ls1 = lerp(.5, .14, p1);
  sub1.style.letterSpacing = ls1 + 'em'; sub1.style.paddingLeft = ls1 + 'em';
  S(sub1, { o: P(t, K.sub, .4) * (1 - out), y: 40 * out });
  const p2 = P(t, K.sub + .25, .6, E.outExpo);
  S(sub2, { o: P(t, K.sub + .25, .4) * (1 - out), y: 20 * (1 - p2) + 40 * out, blur: 5 * (1 - p2) });
}
function svcScene(i, t) {
  const sec = SC.svc[i], t0 = SVC_T[i], t1 = SVC_T[i + 1];
  const on = t >= t0 - .02 && t < t1 + .42; vis(sec, on); if (!on) return false;
  let x = 0, s = 1, o = 1, blur = 0;
  if (i > 0) { const pin = P(t, t0, .45, E.outCubic); x += 1100 * (1 - pin); blur += 10 * (1 - pin); }
  else { const pin = P(t, t0, .5, E.outCubic); s = lerp(.92, 1, pin); o = P(t, t0, .25); }
  if (i < 3) { const pout = P(t, t1 - .05, .4, E.inCubic); x -= 1100 * pout; blur += 10 * pout; }
  else { const pout = P(t, t1 - .15, .3, E.inCubic); s *= 1 + .25 * pout; o *= 1 - pout; blur += 8 * pout; }
  S(sec, { x, s, o, blur });
  headerAnim(HEAD[i], t, t0);
  return true;
}
function svc1(t) {
  if (!svcScene(0, t)) return;
  const tau = t - K.svc1;
  const pp = P(tau, .1, .5, E.outCubic);
  S(dash, { o: pp, y: 50 * (1 - pp), s: lerp(.96, 1, pp) });
  KPIS.forEach((k, i) => {
    const kp = P(tau, .3 + i * .1, .45);
    S(k.el, { o: kp, y: 20 * (1 - kp) });
    k.vEl.textContent = k.fmt(k.v * P(tau, .4 + i * .1, 1.0, E.outCubic));
    k.spark.style.strokeDashoffset = (1 - P(tau, .5 + i * .1, .8)).toFixed(4);
  });
  const m = P(tau, 1.62, .6, E.inOutCubic), vals = seriesAt(m), pts = chartPts(vals);
  const dpr = P(tau, .5, 1.0, E.inOutCubic);
  chClipRect.setAttribute('width', f2(CH.w * dpr + 12));
  const line = smoothPath(pts);
  chLine.setAttribute('d', line);
  chArea.setAttribute('d', `${line} L${f2(pts[pts.length - 1][0])} ${CH.top + CH.h} L${f2(pts[0][0])} ${CH.top + CH.h} Z`);
  const last = pts[pts.length - 1], tipOn = P(tau, 1.45, .25);
  chDot.setAttribute('cx', f2(last[0])); chDot.setAttribute('cy', f2(last[1])); chDot.style.opacity = tipOn;
  chTip.setAttribute('transform', `translate(${f2(last[0] - 40)} ${f2(last[1])})`); chTip.style.opacity = tipOn;
  chTipT.textContent = '$' + Math.round(lerp(184, 212, m)) + 'K';
  BAR_EL.forEach((b, k) => S(b, { sy: Math.max(.001, P(tau, .6 + k * .06, .5, E.outBack)) }));
  const dp = P(tau, .75, .9, E.outCubic);
  if (DONUT.arc) { DONUT.arc.style.strokeDashoffset = (1 - .72 * dp).toFixed(4); DONUT.val.textContent = Math.round(72 * dp) + '%'; }
  // cursor que hace clic en "MES"
  const c1 = P(tau, .95, .55, E.inOutCubic), c2 = P(tau, 1.75, .55, E.inOutCubic);
  const cx = lerp(lerp(CUR.from[0], CUR.mes[0], c1), CUR.after[0], c2), cy = lerp(lerp(CUR.from[1], CUR.mes[1], c1), CUR.after[1], c2);
  const click = Math.exp(-Math.pow((tau - 1.55) / .06, 2));
  S(cursor, { x: cx, y: cy, s: 1 - .18 * click, o: P(tau, .9, .2) });
  const pm = P(tau, 1.55, .3, E.outCubic);
  S(segPill, { x: CUR.pillDx * pm });
  SEG_SPANS[0].style.color = pm < .5 ? '#1b1307' : '#d8cdb6';
  SEG_SPANS[1].style.color = pm >= .5 ? '#1b1307' : '#d8cdb6';
}
function svc2(t) {
  if (!svcScene(1, t)) return;
  const tau = t - K.svc2;
  const hp = P(tau, .1, .5, E.outBack);
  hubInner.setAttribute('transform', `scale(${Math.max(.001, hp).toFixed(4)})`);
  hubRing.setAttribute('transform', `rotate(${f2(tau * 40)})`);
  SATS.forEach((s, i) => {
    s.line.style.strokeDashoffset = (1 - P(tau, .3 + i * .07, .45)).toFixed(4);
    const sp = P(tau, .45 + i * .07, .45, E.outBack);
    s.g.setAttribute('transform', `scale(${Math.max(.001, sp).toFixed(4)})`);
    const ph = frac((tau - .9) * 1.1 + i * .17), on = tau > .9;
    const px = lerp(+s.line.getAttribute('x1'), +s.line.getAttribute('x2'), ph), py = lerp(+s.line.getAttribute('y1'), +s.line.getAttribute('y2'), ph);
    PULSES[i].forEach(c => { c.setAttribute('cx', f2(px)); c.setAttribute('cy', f2(py)); c.style.opacity = on ? Math.sin(Math.PI * ph).toFixed(3) : 0; });
  });
  TASKS.forEach((el, k) => { const p = P(tau, 1.3 + k * .35, .45, E.outBack); S(el, { o: P(tau, 1.3 + k * .35, .15), s: lerp(.6, 1, p), y: 20 * (1 - p) }); });
}
function svc3(t) {
  if (!svcScene(2, t)) return;
  const tau = t - K.svc3, pp = P(tau, .05, .45);
  S($('#datos'), { o: pp, y: 40 * (1 - pp) });
  drawScatter(t);
}
function svc4(t) {
  if (!svcScene(3, t)) return;
  const tau = t - K.svc4;
  const rp = P(tau, .1, .45, E.outBack);
  S(rootPill, { o: P(tau, .1, .2), s: lerp(.7, 1, rp) });
  const win = P(tau, 1.5, .4, E.outCubic);
  OPTS.forEach((o, i) => {
    o.path.style.strokeDashoffset = (1 - P(tau, .35 + i * .08, .45)).toFixed(4);
    const cp = P(tau, .55 + i * .08, .5, E.outBack);
    const isWin = i === 1;
    S(o.el, { o: P(tau, .55 + i * .08, .2) * (isWin ? 1 : 1 - .55 * win), y: 40 * (1 - cp), s: isWin ? 1 + .05 * win : 1 - .03 * win });
    o.el.style.boxShadow = isWin && win > 0 ? `0 0 ${f2(50 * win)}px rgba(240,190,90,${(.55 * win).toFixed(3)}), inset 0 0 0 ${f2(2 * win)}px rgba(255,230,160,.9)` : '';
    o.n.textContent = Math.round(o.score * P(tau, .7 + i * .06, .7, E.outCubic));
    S(o.fills[0], { sx: Math.max(.001, o.ret * P(tau, .75 + i * .06, .6)) });
    S(o.fills[1], { sx: Math.max(.001, o.risk * P(tau, .85 + i * .06, .6)) });
  });
  winPath.style.strokeDashoffset = (1 - win).toFixed(4);
  const wp = clamp((tau - 1.9) / .7) % 1, pt = wp > 0 ? OPTS[1].path.getPointAtLength(OPTS[1].path.getTotalLength() * wp) : { x: 0, y: 0 };
  winPulse.setAttribute('cx', f2(pt.x)); winPulse.setAttribute('cy', f2(pt.y)); winPulse.style.opacity = wp > 0 && wp < 1 ? 1 : 0;
  const bp = P(tau, 1.6, .45, E.outBack);
  S(badge, { o: P(tau, 1.6, .15), s: lerp(.5, 1, bp) });
  badge.style.transform = `translateX(-50%) scale(${lerp(.5, 1, bp).toFixed(4)})`;
  S(verdict, { o: P(tau, 1.75, .4), y: 12 * (1 - P(tau, 1.75, .5)) });
}
function scene4(t) {
  const on = t >= K.infra - .02 && t < K.cta + .62; vis(SC.s4, on); if (!on) return;
  const pin = P(t, K.infra, .45, E.outCubic);
  S(SC.s4, { s: lerp(.86, 1, pin), o: P(t, K.infra, .3) });
  SC.s4.style.webkitMaskImage = SC.s4.style.maskImage = t > K.cta - .15
    ? `radial-gradient(circle at ${CROWN.cx}px ${CROWN.cy}px, transparent ${f2(irisR(t))}px, #000 ${f2(irisR(t) + 2)}px)` : 'none';
  headerAnim(HEAD[4], t, K.infra);
  SLABS.forEach((sl, i) => {
    const t0 = K.slab0 + i * K.slabGap, p = P(t, t0, .55, E.outBack);
    sl.g.style.opacity = P(t, t0, .2).toFixed(3);
    sl.g.setAttribute('transform', `translate(0 ${f2(-260 * (1 - p))})`);
    const glow = Math.exp(-Math.max(0, t - (t0 + .35)) * 3) * (t > t0 + .3 ? 1 : 0), act = t > K.crown ? .5 + .5 * Math.sin((t - K.crown) * 5 - i) : 0;
    sl.core.setAttribute('fill', `rgba(242,200,98,${(.18 + .5 * Math.max(glow, act * .6)).toFixed(3)})`);
  });
  const bo = P(t, K.crown - .3, .4);
  BEAMS.forEach((b, k) => { b.style.opacity = (bo * .85).toFixed(3); b.setAttribute('stroke-dashoffset', f2(-(t * 120 + k * 15))); });
  crownBack.style.strokeDashoffset = (1 - P(t, K.crown, .6, E.inOutCubic)).toFixed(4);
  crownHi.style.strokeDashoffset = f2(-(t - K.crown) * .45);
  crownHi.style.opacity = P(t, K.crown + .5, .3).toFixed(3);
}
function scene5(t) {
  const on = t >= K.cta - .15; vis(SC.s5, on); if (!on) return;
  SC.s5.style.clipPath = t < K.cta + .45 ? `circle(${f2(irisR(t))}px at ${CROWN.cx}px ${CROWN.cy}px)` : 'none';
  const t0 = K.cta;
  ctaR1.style.strokeDashoffset = (1 - P(t, t0 + .1, 1.4, E.inOutCubic)).toFixed(4);
  ctaR1.setAttribute('transform', `rotate(${f2(-90 + (t - t0) * 8)} ${CR.cx} ${CR.cy})`);
  ctaR2.setAttribute('transform', `rotate(${f2(-(t - t0) * 12)} ${CR.cx} ${CR.cy})`);
  ctaR2.style.opacity = (.5 * P(t, t0 + .6, .8)).toFixed(3);
  const lp = P(t, t0 + .15, .8);
  S(L2.root, { o: lp, y: -26 * (1 - lp) });
  logoIn(L2, t, t0 - .2);
  S($('#c-rule'), { sx: P(t, t0 + .45, .8, E.outExpo) });
  cName.textContent = decode(C.contacto.nombre, t, K.nombre, .04, .28);
  const rp = P(t, K.nombre + .55, .9, E.outExpo), rls = lerp(.8, .34, rp);
  cRole.style.letterSpacing = rls + 'em'; cRole.style.paddingLeft = rls + 'em';
  S(cRole, { o: P(t, K.nombre + .55, .4) });
  // teléfono: dígitos que ruedan hasta su valor
  const tel = C.contacto.tel;
  let telTxt = '';
  for (let i = 0; i < tel.length; i++) {
    const ch = tel[i], ts = K.tel + .05 + i * .035;
    if (!/\d/.test(ch) || t >= ts + .35) telTxt += ch;
    else telTxt += String((+ch + Math.floor(Math.max(0, ts + .35 - t) * 40)) % 10);
  }
  telSpan.textContent = telTxt;
  const tp = P(t, K.tel, .5, E.outBack);
  S(cTel, { o: P(t, K.tel, .2), s: lerp(.85, 1, tp) });
  S(cWeb.querySelector('svg'), { o: P(t, K.web, .3), s: lerp(.4, 1, P(t, K.web, .4, E.outBack)) });
  webCh.forEach((c, i) => { const p = P(t, K.web + .1 + i * .022, .3); S(c, { o: p, y: 8 * (1 - p) }); });
  const bp = P(t, K.boton, .7, E.outBack);
  S(cBtn, { o: P(t, K.boton, .14), s: lerp(.55, 1, bp) });
  const pulse = t > K.boton + .6 ? .5 + .5 * Math.sin((t - K.boton - .6) * TAU / 1.4 - Math.PI / 2) : 0;
  cBtn.style.setProperty('--ga', (.3 + .38 * pulse).toFixed(3));
  cBtn.style.setProperty('--gr', (34 + 34 * pulse).toFixed(1) + 'px');
  const sh = t > K.boton + .45 ? (frac((t - K.boton - .45) / 2) * 2) / .75 : 2;
  S(cBtn.querySelector('i'), { x: lerp(-170, 960, clamp(sh)), o: sh < 1 ? 1 : 0 });
  lemaL.forEach((l, i) => { const p = P(t, K.lema + i * .22, .8); S(l, { o: p, y: 16 * (1 - p), blur: 4 * (1 - p) }); });
  S(cFoot, { o: P(t, K.lema + .6, .6) * .9 });
}

/* ------------------------------------------------------------------ fondo, HUD, overlays */
const glowEl = $('#glow');
const GLOWK = [[0, 900, 0], [1.0, 900, .35], [3.0, 900, .45], [4.2, 760, .9], [7.9, 760, .9], [8.3, 1100, .5], [19.9, 1100, .5], [20.3, 1250, .75], [23.9, 1250, .8], [24.4, 760, .75], [30, 760, .75]];
const hudEls = { root: $('#hud'), br: $('#hud-br') };
const flashEl = $('#flash'), sweepEl = $('#sweep');
function overlays(t) {
  const [gy, go] = kf(t, GLOWK);
  glowEl.style.top = f2(gy) + 'px'; glowEl.style.opacity = go.toFixed(3);
  hudEls.root.style.opacity = (P(t, .2, .8) * .9).toFixed(3);
  const ss = Math.floor(t), cs = Math.floor((t - ss) * 100);
  hudEls.br.textContent = `T+00:${String(ss).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  // barrido de luz en los cambios de servicio
  let w = -1;
  for (const t0 of [K.svc2, K.svc3, K.svc4]) if (t > t0 - .1 && t < t0 + .45) w = t0;
  if (w >= 0) {
    const p = clamp((t - w + .05) / .45);
    sweepEl.style.opacity = Math.sin(Math.PI * p).toFixed(3);
    sweepEl.style.transform = `translateX(${f2(lerp(1300, -500, E.inOutCubic(p)))}px) rotate(12deg)`;
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
  t = clamp(t, 0, C.duration);
  drawGrid(t); drawGlobe(t);
  particles(t);
  scene1(t); scene2(t);
  svc1(t); svc2(t); svc3(t); svc4(t);
  scene4(t); scene5(t);
  overlays(t); grain(t);
}
window.seek = seek;
window.DURATION = C.duration;

function layout() {
  // tamaño del gancho: la línea más ancha mide 900 px
  HL.forEach(h => (h.l.style.fontSize = '100px'));
  const widest = Math.max(...HL.map(h => h.l.scrollWidth));
  const fs = Math.floor(100 * 900 / widest);
  HL.forEach(h => (h.l.style.fontSize = fs + 'px'));
  [glitchA, glitchB].forEach(e => (e.style.fontSize = fs + 'px'));
  hookEl.style.fontSize = fs + 'px';
  const lh = HL[0].w.offsetHeight;
  HOOK = { fs, lh, top: Math.round(900 - lh * 5 / 2) };
  hookEl.style.top = HOOK.top + 'px';
  HEAD.forEach(layoutHeader);
  buildDashBottom();
  layoutDash();
  const ct = cBtn.querySelector('span');
  let fsb = 42;
  while (ct.offsetWidth > 820 - 64 - 64 && fsb > 24) ct.style.fontSize = (--fsb) + 'px';
  let fsn = 70;
  cName.textContent = C.contacto.nombre;
  cName.style.display = 'inline-block';
  while (cName.offsetWidth > 980 && fsn > 30) cNameBox.style.fontSize = (--fsn) + 'px';
}

window.READY = (async () => {
  await document.fonts.ready;
  await Promise.all(['900 20px Archivo', '600 20px Montserrat', '800 20px Montserrat', '500 20px "JetBrains Mono"', '700 20px "JetBrains Mono"'].map(f => document.fonts.load(f)));
  layout();
  sampleHook();
  seek(0);
  return true;
})();
window.addEventListener('hf-seek', e => seek(e.detail.time));
})();
