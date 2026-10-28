// Animación determinista: seek(t) dibuja exactamente el instante t. Sin timers ni azar sin semilla.
(() => {
const C = CFG.cues, DUR = CFG.duration;
const FMT = new URLSearchParams(location.search).get('fmt') || '9x16';
const [W, H] = FMT === '16x9' ? [1920, 1080] : FMT === '1x1' ? [1080, 1080] : [1080, 1920];
const L = FMT === '16x9' ? 1.0 : FMT === '1x1' ? 0.66 : 0.62;     // escala del logo
const CX = W / 2, CY = FMT === '9x16' ? 900 : H / 2 + 10;         // centro del logo en pantalla
const OX = 768, OY = 290;                                           // centro del logo en sus coordenadas

const $ = id => document.getElementById(id);
const stage = $('stage');
stage.style.width = W + 'px'; stage.style.height = H + 'px';
document.body.style.width = W + 'px'; document.body.style.height = H + 'px';

// ---------- utilidades ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const P = (t, t0, d) => clamp((t - t0) / d);
const lerp = (a, b, p) => a + (b - a) * p;
const eOutC = p => 1 - Math.pow(1 - p, 3);
const eInC = p => p * p * p;
const eInOutC = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
const eOutBack = (p, k = 1.7) => 1 + (k + 1) * Math.pow(p - 1, 3) + k * Math.pow(p - 1, 2);
const spring = (dt, amp, f, dec) => dt < 0 ? 0 : amp * Math.exp(-dec * dt) * Math.cos(f * dt);
function rng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------- logo por piezas ----------
const logo = $('logo');
const parts = {};
const order = ['V', 'E', 'N', 'D', 'N2', 'G', 'arc', 'machine', 'coin', 't_T', 't_O', 't_D', 't_coin', 't_E', 't_N', 'url'];
const byName = Object.fromEntries(PARTS.parts.map(p => [p.name, p]));
const loads = [];
for (const n of order) {
  const p = byName[n], img = new Image();
  img.src = `assets/parts/${n}.png`;
  Object.assign(img.style, { left: p.x + 'px', top: p.y + 'px', width: p.w + 'px', height: p.h + 'px' });
  loads.push(img.decode());
  logo.appendChild(img);
  parts[n] = { ...p, el: img, cx: p.x + p.w / 2, cy: p.y + p.h / 2 };
}
const urlbar = document.createElement('div'); urlbar.id = 'urlbar'; logo.appendChild(urlbar);
const sheen = document.createElement('canvas');
sheen.width = 1536 * 2; sheen.height = 513 * 2;
Object.assign(sheen.style, { left: 0, top: 0, width: '1536px', height: '513px' });
logo.appendChild(sheen);
const sctx = sheen.getContext('2d');
const full = new Image(); full.src = 'assets/logo-original.png'; loads.push(full.decode());
const coinImg = new Image(); coinImg.src = 'assets/parts/coin.png'; loads.push(coinImg.decode());

function T(name, { x = 0, y = 0, r = 0, sx = 1, sy = 1, o = 1, origin = '50% 50%', filter = '' } = {}) {
  const s = parts[name].el.style;
  s.transformOrigin = origin;
  s.transform = `translate(${x}px,${y}px) rotate(${r}deg) scale(${sx},${sy})`;
  s.opacity = o;
  s.filter = filter ? filter + ' drop-shadow(0 10px 9px rgba(0,0,0,.16))' : '';
}

// ---------- capas de fondo ----------
const canv = id => { const c = $(id); c.width = W; c.height = H; return c.getContext('2d'); };
const back = canv('back'), front = canv('front');
const rays = $('rays'); rays.style.left = CX + 'px'; rays.style.top = CY + 'px';
const floor = $('floor');
let FX = OX, FY = OY;                                                // punto que mira la cámara
const toScreen = (lx, ly, s) => [CX + (lx - FX) * s, CY + (ly - FY) * s];

// monedas que salen disparadas en el "cha-ching"
const R = rng(7);
const coins = Array.from({ length: 34 }, (_, i) => ({
  vx: (R() * 2 - 1) * (FMT === '16x9' ? 1300 : 820), vy: -(900 + R() * 1500), size: 34 + R() * 70,
  spin: 6 + R() * 10, ph: R() * 6.28, rot: (R() * 2 - 1) * 40, delay: R() * .12,
  depth: i % 9 === 0 ? 2 : (i % 2 ? 1 : 0),   // 0 atrás desenfocada, 1 atrás nítida, 2 al frente desenfocada
}));
coins.forEach(c => { if (c.depth === 0) c.size *= .6; if (c.depth === 2) { c.size *= 1.5; c.vx = Math.sign(c.vx || 1) * 1100; c.vy = -1700; } });

function drawCoin(ctx, x, y, size, flip, rot, blur) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot * Math.PI / 180); ctx.scale(Math.max(.08, Math.abs(flip)), 1);
  if (blur) ctx.filter = `blur(${blur}px)`;
  if (flip < 0) ctx.filter = (blur ? `blur(${blur}px) ` : '') + 'brightness(.8)';
  ctx.drawImage(coinImg, -size / 2, -size / 2, size, size);
  ctx.restore();
}

function star(ctx, x, y, r, a, rot) {
  if (a <= 0 || r <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = a;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,240,170,.9)'); g.addColorStop(1, 'rgba(255,210,60,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 ? r * .16 : r, an = i * Math.PI / 4;
    ctx.lineTo(Math.sin(an) * rr, -Math.cos(an) * rr);
  }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
const pulse = (t, t0, d) => { const p = P(t, t0, d); return p <= 0 || p >= 1 ? 0 : Math.sin(Math.PI * p); };

// ---------- escena ----------
function seek(t) {
  // cámara: acercamiento leve continuo + golpe en el cha-ching
  const dtC = t - C.chaching;
  const cam = 1 + .03 * eInOutC(P(t, .8, 3.2)) + .03 * eInOutC(P(t, C.chaching, DUR - C.chaching))
            + (dtC >= 0 ? .045 * Math.exp(-7 * dtC) * Math.cos(14 * dtC) : 0);
  // al inicio la cámara está cerca de la máquina y se aleja mientras salen las letras
  const pull = eInOutC(P(t, 1.4, 1.6));
  FX = lerp(962, OX, pull); FY = lerp(270, OY, pull);
  const s = L * cam * lerp(2.9, 1, pull);
  logo.style.transformOrigin = '0 0';
  logo.style.transform = `translate(${CX}px,${CY}px) scale(${s}) translate(${-FX}px,${-FY}px)`;

  // cortinillas de entrada (rojo, negro, amarillo)
  ['w1', 'w2', 'w3'].forEach((id, i) => {
    const p = eInC(P(t, i * .07, .42));
    const el = $(id);
    el.style.width = '3400px'; el.style.height = '2800px'; el.style.margin = '-1400px 0 0 -1700px';
    el.style.transform = `rotate(-16deg) translateY(${-p * 3300}px)`;
    el.style.display = p >= 1 ? 'none' : 'block';
  });

  // rayos y puntos
  rays.style.opacity = .5 * eOutC(P(t, .5, 1)) + .5 * eOutC(P(t, C.chaching, .6));
  rays.style.transform = `rotate(${t * 5}deg) scale(${1 + .15 * eOutC(P(t, C.chaching, 1))})`;
  $('dots').style.transform = `translateY(${-t * 12}px)`;

  // franjas diagonales que enmarcan (entran con la URL)
  const bands = [['bandA', -1, 230, 20, 0], ['bandB', -1, 262, 8, .06], ['bandC', 1, H - 250, 20, .03], ['bandD', 1, H - 282, 8, .09]];
  for (const [id, side, y, th, d] of bands) {
    const p = eOutC(P(t, C.url - .1 + d, .6)), el = $(id);
    el.style.height = th + 'px'; el.style.top = y + 'px';
    if (side < 0) { el.style.left = '-200px'; el.style.transformOrigin = '0 50%'; el.style.transform = `rotate(-9deg) scaleX(${p * .62})`; }
    else { el.style.left = (W - 1600) + 'px'; el.style.transformOrigin = '100% 50%'; el.style.transform = `rotate(-9deg) scaleX(${p * .62})`; }
  }

  // sombra en el piso
  const [fx, fy] = toScreen(768, 528, s);
  floor.style.left = fx + 'px'; floor.style.top = fy + 'px';
  floor.style.transform = `scale(${s / L * (FMT === '16x9' ? 1.5 : 1.05)}, 1)`;
  floor.style.opacity = eOutC(P(t, 2.2, 1.2));

  // máquina: sube desde abajo, se estira y rebota al aterrizar
  {
    const p = P(t, C.machine - .4, .4), e = eOutC(p), dt = t - C.machine;
    const sq = spring(dt, .14, 24, 8);
    T('machine', { y: (1 - e) * 1100, sx: dt < 0 ? 1 - .1 * (1 - e) : 1 + sq * .8, sy: dt < 0 ? 1 + .18 * (1 - e) : 1 - sq,
      o: t >= C.machine - .4 ? 1 : 0, origin: '50% 100%' });
  }

  // moneda dorada: cae girando, rebota; en el cha-ching da una vuelta
  {
    const p = P(t, C.coinLand - .6, .6), dt = t - C.coinLand;
    const fall = -1700 * (1 - p * p);
    const bounce = dt > 0 ? -55 * Math.exp(-4.5 * dt) * Math.abs(Math.sin(Math.PI * dt / (C.coinBounce - C.coinLand))) : 0;
    let ang = (1 - eOutC(p)) * 5 * Math.PI;
    ang += 2 * Math.PI * eInOutC(P(t, C.chaching - .05, .55));
    const fl = Math.cos(ang);
    T('coin', { y: fall + bounce, sx: Math.max(.06, Math.abs(fl)), r: (1 - p) * 30, o: t >= C.coinLand - .6 ? 1 : 0,
      filter: fl < 0 ? 'brightness(.78)' : '' });
  }

  // arco rojo alrededor de la moneda: se dibuja en sentido horario
  {
    const deg = 210 * eOutC(P(t, C.arc, .45));
    const m = `conic-gradient(from 0deg at 21.5px 78.5px, #000 0deg ${deg}deg, transparent ${deg + .5}deg)`;
    parts.arc.el.style.webkitMaskImage = m; parts.arc.el.style.maskImage = m;
    T('arc', { o: deg > 0 ? 1 : 0 });
  }

  // VEND y NG salen disparadas desde la máquina
  const out = ['D', 'N', 'E', 'V', 'N2', 'G'];
  out.forEach((n, i) => {
    const pt = parts[n], t0 = C.lettersR[i], p = P(t, t0, .5);
    const e = eOutBack(p, 1.5), side = n === 'N2' || n === 'G' ? 1 : -1;
    const dx = 965 - pt.cx, dy = 330 - pt.cy;
    T(n, { x: dx * (1 - e), y: dy * (1 - e) - 60 * Math.sin(Math.PI * clamp(p * 1.2)), r: (1 - eOutC(p)) * side * 28,
      sx: lerp(.15, 1, eOutBack(p, 2.2)), sy: lerp(.15, 1, eOutBack(p, 2.2)), o: clamp(p * 6),
      filter: p < .35 ? `blur(${(1 - p / .35) * 4}px)` : '' });
  });

  // moneda roja "O": rueda desde la izquierda
  {
    const pt = parts.t_coin, p = P(t, C.roll, C.redCoin - C.roll), e = eOutC(p);
    const dist = -(pt.x + pt.w + 900) * (1 - e);
    const wob = spring(t - C.redCoin, 9, 18, 6);
    T('t_coin', { x: dist, r: dist / 62 * 180 / Math.PI + wob, o: t >= C.roll ? 1 : 0 });
  }

  // TODO EN: caen desde arriba con aplastamiento
  ['t_T', 't_O', 't_D', 't_E', 't_N'].forEach((n, i) => {
    const t0 = C.drops[i], p = P(t, t0 - .3, .3), sq = spring(t - t0, .16, 26, 9);
    T(n, { y: -900 * (1 - p * p), sx: t < t0 ? .92 : 1 + sq * .7, sy: t < t0 ? 1.12 : 1 - sq, o: t >= t0 - .3 ? 1 : 0, origin: '50% 100%' });
  });

  // URL: se revela con una barra roja
  {
    const pt = parts.url, p = eInOutC(P(t, C.url, .55));
    const c = `inset(0 ${(1 - p) * 100}% 0 0)`;
    pt.el.style.clipPath = c;
    T('url', { o: p > 0 ? 1 : 0 });
    Object.assign(urlbar.style, { left: (pt.x + pt.w * p - 4) + 'px', top: (pt.y - 4) + 'px', height: (pt.h + 8) + 'px',
      opacity: p > 0 && p < 1 ? 1 : clamp(1 - (t - C.url - .55) * 6) * (p > 0 ? 1 : 0) });
  }

  // destello y brillo metálico sobre el logo
  $('flash').style.opacity = dtC >= 0 ? .85 * Math.exp(-7 * dtC) : 0;
  sctx.setTransform(2, 0, 0, 2, 0, 0); sctx.clearRect(0, 0, 1536, 513);
  const sweeps = [[C.chaching, .75, .7], [C.sparkle, .9, .45]];
  for (const [t0, d, a] of sweeps) {
    const p = P(t, t0, d); if (p <= 0 || p >= 1) continue;
    sctx.globalCompositeOperation = 'source-over'; sctx.globalAlpha = 1;
    sctx.drawImage(full, 0, 0, 1536, 513);
    sctx.globalCompositeOperation = 'source-in';
    const x = lerp(-400, 1936, eInOutC(p));
    const g = sctx.createLinearGradient(x - 160, 0, x + 160, 140);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    sctx.fillStyle = g; sctx.fillRect(0, 0, 1536, 513);
  }
  sctx.globalCompositeOperation = 'source-over';

  // partículas: monedas
  back.clearRect(0, 0, W, H); front.clearRect(0, 0, W, H);
  const [ox, oy] = toScreen(960, 200, s);
  for (const c of coins) {
    const dt = t - C.chaching - c.delay; if (dt <= 0) continue;
    const x = ox + c.vx * dt, y = oy + c.vy * dt + 1500 * dt * dt;
    if (y > H + 200) continue;
    const ctx = c.depth === 2 ? front : back;
    drawCoin(ctx, x, y, c.size * clamp(dt * 8), Math.cos(c.ph + c.spin * dt), c.rot * dt, c.depth === 0 ? 2.5 : c.depth === 2 ? 5 : 0);
  }

  // destellos (estrellas)
  const [gx, gy] = toScreen(960, 162, s), cr = 62 * s;
  const stars = [
    [C.coinLand, gx - cr * .6, gy - cr * .55, 60], [C.redCoin, ...toScreen(470, 110, s), 46],
    [C.chaching + .05, gx + cr * .7, gy - cr * .7, 90], [C.chaching + .15, gx - cr * .9, gy + cr * .2, 60],
    [C.chaching + .25, ...toScreen(1440, 250, s), 70], [C.chaching + .3, ...toScreen(120, 260, s), 55],
    [C.sparkle, gx + cr * .5, gy - cr * .65, 70], [C.sparkle + .2, ...toScreen(1000, 300, s), 50],
  ];
  for (const [t0, x, y, r] of stars) {
    const a = pulse(t, t0, .5);
    star(front, x, y, r * s / L * a, a, (t - t0) * 2);
  }
  // chispa en la punta del arco mientras se dibuja
  {
    const p = P(t, C.arc, .45);
    if (p > 0 && p < 1) {
      const th = 210 * eOutC(p) * Math.PI / 180, [ax, ay] = toScreen(960.5 + Math.sin(th) * 75, 162.5 - Math.cos(th) * 75, s);
      star(front, ax, ay, 40, 1 - p * .5, t * 6);
    }
  }
}

window.DURATION = DUR;
window.seek = seek;
window.READY = Promise.all(loads).then(() => { seek(0); });

// vista previa interactiva: reproducir en tiempo real si no es render
if (!new URLSearchParams(location.search).has('render')) {
  window.READY.then(() => {
    const t0 = performance.now();
    const loop = () => { seek(((performance.now() - t0) / 1000) % DUR); requestAnimationFrame(loop); };
    loop();
  });
}
})();
