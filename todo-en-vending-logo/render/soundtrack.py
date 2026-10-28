#!/usr/bin/env python3
"""Banda sonora original (sintetizada, sin samples de terceros) sincronizada con js/config.js.

Uso: python3 render/soundtrack.py  ->  out/banda-sonora.wav (48 kHz, estéreo, sin normalizar)
"""
import json
import os
import re
import wave

import numpy as np
from scipy import signal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cfg = json.loads(re.search(r'window\.CFG = (\{.*\});', open(os.path.join(ROOT, 'js', 'config.js')).read()).group(1))
K, DUR = cfg['cues'], cfg['duration']
SR = 48000
N = int(DUR * SR) + SR // 2
L = np.zeros(N); R = np.zeros(N)
FX = np.zeros((2, N))          # bus con reverberación
rng = np.random.default_rng(11)


def tt(d):
    return np.arange(int(d * SR)) / SR


def add(x, t0, pan=0.0, gain=1.0, rev=0.0):
    i = int(t0 * SR)
    if i >= N:
        return
    x = x[:N - i] * gain
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    L[i:i + len(x)] += x * gl * 1.41
    R[i:i + len(x)] += x * gr * 1.41
    if rev:
        FX[0, i:i + len(x)] += x * gl * rev
        FX[1, i:i + len(x)] += x * gr * rev


def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, hi], 'bandpass', fs=SR, output='sos'), x)


def hp(x, f):
    return signal.sosfilt(signal.butter(2, f, 'highpass', fs=SR, output='sos'), x)


def lp(x, f):
    return signal.sosfilt(signal.butter(2, f, 'lowpass', fs=SR, output='sos'), x)


def sweep_noise(d, f0, f1, q=1.2):
    """Ruido con filtro pasa-banda que se desplaza de f0 a f1 (por bloques, con estado continuo)."""
    n = int(d * SR); x = rng.standard_normal(n); out = np.zeros(n); blk = 256; zi = None
    for k in range(0, n, blk):
        f = f0 * (f1 / f0) ** (k / n)
        sos = signal.butter(2, [f / (1 + .5 / q), min(f * (1 + .5 / q), SR / 2 - 100)], 'bandpass', fs=SR, output='sos')
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        out[k:k + blk], zi = signal.sosfilt(sos, x[k:k + blk], zi=zi)
    return out


# ---------- instrumentos ----------
def kick(gain=1.0):
    t = tt(.4); f = 58 + 140 * np.exp(-t * 30)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5)
    x[:240] += rng.standard_normal(240) * np.linspace(.5, 0, 240)
    return x * gain


def clap():
    t = tt(.25); x = bp(rng.standard_normal(len(t)), 900, 5000) * np.exp(-t * 22)
    for d in (.0, .011, .022):
        x[int(d * SR):] += bp(rng.standard_normal(len(t) - int(d * SR)), 1000, 4000) * np.exp(-t[:len(t) - int(d * SR)] * 120) * .6
    return x * .5


def hat(d=.06):
    t = tt(d); return hp(rng.standard_normal(len(t)), 7000) * np.exp(-t * 70) * .25


def clink(f0=2600, d=.7, amp=1.0):
    """Moneda: parciales inarmónicos que decaen rápido."""
    t = tt(d); x = np.zeros(len(t))
    for r, a, dec in ((1, 1, 6), (2.76, .7, 9), (5.40, .45, 14), (8.93, .3, 20), (13.3, .18, 28)):
        x += a * np.sin(2 * np.pi * f0 * r * (1 + rng.uniform(-.004, .004)) * t + rng.uniform(0, 6.28)) * np.exp(-t * dec)
    x[:96] += rng.standard_normal(96) * np.linspace(.8, 0, 96)
    return hp(x, 1200) * amp * .35


def thud(f=85, amp=1.0):
    t = tt(.22); fr = f * (1 + 1.5 * np.exp(-t * 40))
    x = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 18)
    x[:200] += bp(rng.standard_normal(200), 1500, 6000) * .6
    return x * amp


def pop(f=600):
    t = tt(.12); fr = f * (1 + 2.5 * np.exp(-t * 60))
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 35) * .5


def saw(f, t):
    ph = (f * t) % 1.0
    return 2 * ph - 1


def supersaw(f, d, cutoff=3500):
    t = tt(d); x = sum(saw(f * (1 + dv), t + rng.uniform(0, 1)) for dv in (-.012, -.006, 0, .006, .012)) / 5
    return lp(x, cutoff)


def bell(f, d=2.2, amp=1.0):
    t = tt(d); x = np.zeros(len(t))
    for r, a, dec in ((1, 1, 2.2), (2.0, .5, 3), (3.0, .35, 4.5), (4.16, .25, 6), (5.43, .15, 9)):
        x += a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * dec)
    return x * amp * .3


def nf(m):
    return 440 * 2 ** ((m - 69) / 12)


# ---------- efectos sincronizados ----------
# cortinillas de entrada: tres barridos
for i in range(3):
    add(sweep_noise(.45, 300 + 200 * i, 6000) * np.hanning(int(.45 * SR)) * .5, K['wipe'] + i * .07, pan=[-.5, .5, 0][i])
add(kick(.9), 0.0)

# máquina: sube (barrido) y golpe
add(sweep_noise(.4, 200, 1500) * np.linspace(0, 1, int(.4 * SR)) ** 2 * .7, K['machine'] - .4)
add(kick(1.0), K['machine']); add(thud(70, .8), K['machine']); add(clap() * .5, K['machine'])

# moneda: silbido de caída, golpe y rebote
d = K['coinLand'] - .9
add(sweep_noise(d, 3000, 900, q=3) * np.linspace(0, 1, int(d * SR)) * .18, .9, pan=.2)
add(clink(2700, .9, 1.0), K['coinLand'], pan=.15, rev=.5)
add(clink(2700, .5, .4), K['coinBounce'], pan=.15, rev=.4)
# arco: barrido rápido
add(sweep_noise(.4, 800, 7000, q=2) * np.hanning(int(.4 * SR)) * .3, K['arc'], pan=.4)

# letras disparadas
for i, t0 in enumerate(K['lettersR']):
    add(pop(500 + 70 * i), t0, pan=-.6 + .25 * i if i < 4 else .6, gain=.8)
    add(sweep_noise(.18, 1500, 5000) * np.hanning(int(.18 * SR)) * .12, t0, pan=-.4 if i < 4 else .4)

# moneda roja rodando: un clic por cada media vuelta, desacelerando
r0, r1 = K['roll'], K['redCoin']
ts = np.linspace(0, 1, 2000)
dist = (559 + 900) * (1 - (1 - (1 - ts) ** 3))   # distancia restante (ver motion.js)
ang = (dist[0] - dist) / 62
for k in range(1, int(ang[-1] / np.pi) + 1):
    t_hit = r0 + (r1 - r0) * ts[np.searchsorted(ang, k * np.pi)]
    add(clink(3400 + 200 * (k % 3), .12, .18), t_hit, pan=-.8 + 1.0 * (t_hit - r0) / (r1 - r0))
add(lp(rng.standard_normal(int((r1 - r0) * SR)), 300) * np.linspace(.2, 0, int((r1 - r0) * SR)) * .4, r0, pan=-.4)
add(clink(2300, .9, .9), r1, pan=-.2, rev=.5)

# TODO EN: caídas
for i, t0 in enumerate(K['drops']):
    add(thud(110 + 8 * i, .55), t0, pan=-.5 + .2 * i)

# URL: barrido
add(sweep_noise(.55, 1200, 9000, q=2) * np.hanning(int(.55 * SR)) * .25, K['url'], pan=0)

# ---------- música: 120 BPM, A menor -> F -> G -> C mayor en el cha-ching ----------
beat = .5
bass_prog = [(K['machine'], 57), (1.85, 53), (2.85, 55)]       # A2, F2, G2
for j, (t0, m) in enumerate(bass_prog):
    t_end = bass_prog[j + 1][0] if j + 1 < len(bass_prog) else K['chaching']
    t = t0
    while t < t_end - .01:
        x = supersaw(nf(m), .24, 900) * np.exp(-tt(.24) * 9) * .5 + np.sin(2 * np.pi * nf(m) * tt(.24)) * np.exp(-tt(.24) * 6) * .5
        add(x, t, gain=.75)
        t += beat / 2
k = 1.0
while k < K['chaching'] - .01:
    add(kick(.8), k)
    if abs((k / beat) % 2 - 1) < .01:
        add(clap(), k, gain=.8, rev=.2)
    add(hat(), k + .25, pan=.3)
    k += beat
# redoble y subida al cha-ching
t = 3.0; step = .125
while t < K['chaching'] - .02:
    add(clap() * .35 * (1 + (t - 3.0)), t, rev=.15)
    step = max(.04, step * .86); t += step
d = K['chaching'] - 3.0
add(sweep_noise(d, 400, 9000) * np.linspace(0, 1, int(d * SR)) ** 2 * .35, 3.0)

# ---------- CHA-CHING ----------
c = K['chaching']
add(sweep_noise(.07, 2000, 6000) * .8, c - .06)                     # "cha" mecánico
add(kick(1.3), c); add(thud(55, 1.0), c)
sub = np.sin(2 * np.pi * 41 * tt(1.6)) * np.exp(-tt(1.6) * 2.2)
add(sub, c, gain=.7)
for f, pan in ((nf(96), -.2), (nf(100), .2)):                          # campana C7 + E7: "ching"
    add(bell(f, 2.4, .9), c + .02, pan=pan, rev=.6)
for m, pan in ((48, 0), (60, -.4), (64, .4), (67, -.2), (71, .2), (74, 0)):   # acorde Cmaj9
    x = supersaw(nf(m), 3.0, 4200) * np.exp(-tt(3.0) * 1.1)
    x[:int(.01 * SR)] *= np.linspace(0, 1, int(.01 * SR))
    add(x, c, pan=pan, gain=.13, rev=.4)
# lluvia de monedas
for i in range(46):
    t0 = c + .05 + rng.exponential(.45)
    if t0 > DUR - .3:
        continue
    add(clink(rng.uniform(2200, 4200), .5, rng.uniform(.15, .5) * np.exp(-(t0 - c) * .9)), t0, pan=rng.uniform(-.9, .9), rev=.3)
# destello final
s0 = K['sparkle']
for i, m in enumerate((88, 91, 95, 100)):
    add(bell(nf(m), 1.2, .35), s0 + i * .06, pan=-.5 + i * .33, rev=.7)

# ---------- reverberación, mezcla y salida ----------
ir_t = tt(1.6)
irL = rng.standard_normal(len(ir_t)) * np.exp(-ir_t * 3.2); irR = rng.standard_normal(len(ir_t)) * np.exp(-ir_t * 3.2)
irL, irR = lp(irL, 6000), lp(irR, 6000)
L += signal.fftconvolve(FX[0], irL)[:N] * .08
R += signal.fftconvolve(FX[1], irR)[:N] * .08
mix = np.stack([L, R])
mix = hp(mix, 28)
fade = np.ones(N); i0 = int((DUR - .35) * SR); fade[i0:] = np.clip(np.linspace(1, 0, N - i0) * 1.2, 0, 1)
mix *= fade
mix = mix[:, :int(DUR * SR)]
mix = np.tanh(mix / np.abs(mix).max() * 1.6) / np.tanh(1.6) * .9
os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
out = os.path.join(ROOT, 'out', 'banda-sonora.wav')
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(mix.T, -1, 1) * 32767).astype('<i2').tobytes())
print('listo:', out)
