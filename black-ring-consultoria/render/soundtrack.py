#!/usr/bin/env python3
"""Banda sonora original del video (síntesis pura con numpy: sin samples ni música con derechos).

Uso:  python3 render/soundtrack.py assets/audio/banda-sonora.wav

Lee duración y tiempos clave de js/config.js para que cada sonido caiga con su acción en
pantalla. Tempo 120 BPM, Re menor con resolución a Re mayor en el cierre.
"""
import math
import os
import re
import sys
import wave

import numpy as np

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rng = np.random.default_rng(3322150456)


def load_config():
    src = open(os.path.join(ROOT, 'js', 'config.js'), encoding='utf-8').read()
    body = re.search(r'cues:\s*\{([^}]*)\}', src).group(1)
    cues = {k: float(v) for k, v in re.findall(r'(\w+):\s*([\d.]+)', body)}
    return cues, float(re.search(r'duration:\s*([\d.]+)', src).group(1))


K, DUR = load_config()
N = int(round(DUR * SR))
TAU = 2 * math.pi


# ---------------------------------------------------------------- utilidades
def hz(name):
    m = re.fullmatch(r'([A-G])([#b]?)(-?\d)', name)
    semis = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}[m.group(1)] + {'#': 1, 'b': -1, '': 0}[m.group(2)]
    return 440.0 * 2 ** ((12 * (int(m.group(3)) + 1) + semis - 69) / 12)


def tt(n):
    return np.arange(n) / SR


def ffilt(x, gain_fn):
    n = x.shape[-1]
    size = 1 << (n + 4096 - 1).bit_length()
    f = np.fft.rfftfreq(size, 1 / SR)
    return np.fft.irfft(np.fft.rfft(x, size) * gain_fn(np.maximum(f, 1e-3)), size)[..., :n]


def lp(fc, order=2):
    return lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * order))


def hp(fc, order=2):
    return lambda f: 1 / np.sqrt(1 + (fc / f) ** (2 * order))


def bp(lo, hi, order=2):
    return lambda f: lp(hi, order)(f) * hp(lo, order)(f)


def fade(x, a=0.003, r=0.015):
    n = x.shape[-1]
    e = np.ones(n)
    na, nr = min(n, int(a * SR)), min(n, int(r * SR))
    if na:
        e[:na] = np.sin(np.linspace(0, math.pi / 2, na)) ** 2
    if nr:
        e[n - nr:] *= np.cos(np.linspace(0, math.pi / 2, nr)) ** 2
    return x * e


def stereo(x, pan=0.0):
    if x.ndim == 2:
        return x
    a = (pan + 1) * math.pi / 4
    return np.stack([x * math.cos(a), x * math.sin(a)])


DRY = np.zeros((2, N))
SEND = np.zeros((2, N))
BASS = np.zeros((2, N))
PADB = np.zeros((2, N))


def add(sig, t0, gain=1.0, pan=0.0, send=0.0, bus=None):
    s = stereo(fade(sig), pan) * gain
    i0 = int(round(t0 * SR))
    if i0 >= N or i0 + s.shape[1] <= 0:
        return
    a, b = max(0, i0), min(N, i0 + s.shape[1])
    seg = s[:, a - i0:b - i0]
    (DRY if bus is None else bus)[:, a:b] += seg
    if send:
        SEND[:, a:b] += seg * send


# ---------------------------------------------------------------- instrumentos
def pad_chord(notes, dur, attack=0.6, release=1.2, bright=1.0):
    n = int((dur + release) * SR)
    t = tt(n)
    out = np.zeros((2, n))
    for name in notes:
        f0 = hz(name)
        for ch, cents in ((0, (-8, 3)), (1, (-3, 8))):
            for c in cents:
                f = f0 * 2 ** (c / 1200)
                vib = 0.0012 * np.sin(TAU * rng.uniform(.15, .3) * t + rng.uniform(0, TAU))
                for k in range(1, 10):
                    if f * k > 7000:
                        break
                    out[ch] += (1 / k) * math.exp(-k / (3.2 * bright)) * np.sin(TAU * f * k * t * (1 + vib) + rng.uniform(0, TAU))
    x = np.clip(t / attack, 0, 1)
    env = x * x * (3 - 2 * x)
    rel = t > dur
    env[rel] *= np.exp(-(t[rel] - dur) / (release / 4))
    return out * env / (len(notes) * 4)


def bass_note(f, dur=0.24):
    t = tt(int(dur * SR))
    ph = TAU * f * t
    s = np.sin(ph) + .45 * np.sin(2 * ph) + .2 * np.sin(3 * ph)
    return np.tanh(1.4 * s * (1 - np.exp(-t / .004)) * np.exp(-t / .16))


def kick():
    n = int(.5 * SR)
    t = tt(n)
    f = 54 + 110 * np.exp(-t * 30) + 24 * np.exp(-t * 7)
    body = np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t * 8)
    click = ffilt(rng.standard_normal(n) * np.exp(-t / .0025), hp(2500))
    return np.tanh(2.2 * (body + .3 * click)) * .8


def clap():
    n = int(.4 * SR)
    t = tt(n)
    e = sum((t >= d) * np.exp(-np.maximum(t - d, 0) / .006) for d in (0, .011, .023))
    e = e + .55 * (t >= .03) * np.exp(-np.maximum(t - .03, 0) / .1)
    return ffilt(rng.standard_normal(n) * e, bp(1000, 2800)) * 1.6


def hat(open_=False):
    n = int((.3 if open_ else .07) * SR)
    t = tt(n)
    return ffilt(rng.standard_normal(n) * np.exp(-t / (.11 if open_ else .016)), hp(7200, 3)) * 1.4


def impact(size=1.0):
    n = int(2.6 * SR)
    t = tt(n)
    f = 40 + 46 * np.exp(-t * 3.2)
    boom = .7 * np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / .6) * (1 - np.exp(-t / .003))
    tf = 95 + 80 * np.exp(-t * 12)
    punch = np.sin(TAU * np.cumsum(tf) / SR) * np.exp(-t / .22)
    crack = ffilt(rng.standard_normal(n) * np.exp(-t / .06), bp(700, 5000))
    return np.tanh(1.5 * (boom + .8 * punch + .6 * crack * size)) * size


def stab(notes, dur=1.4):
    t = tt(int(dur * SR))
    out = np.zeros(len(t))
    for name in notes:
        f = hz(name)
        for k in range(1, 14):
            if f * k > 9000:
                break
            out += (1 / k) * np.exp(-t * (1.8 + .9 * k)) * np.sin(TAU * f * k * t + rng.uniform(0, TAU))
    return np.tanh(1.2 * out / len(notes)) * (1 - np.exp(-t / .005))


def noise_band(dur, fc_fn, width=.35, voices=56):
    n = int(dur * SR)
    fc = fc_fn(np.linspace(0, 1, n))
    out = np.zeros((2, n))
    for v in range(voices):
        out[v % 2] += np.sin(TAU * np.cumsum(fc * 2 ** rng.uniform(-width, width)) / SR + rng.uniform(0, TAU))
    return out / math.sqrt(voices / 2)


def riser(dur, f0=300, f1=7000, curve=1.7):
    p = np.linspace(0, 1, int(dur * SR))
    s = noise_band(dur, lambda q: f0 * (f1 / f0) ** (q ** curve))
    return (s + np.sin(TAU * np.cumsum(220 * 4 ** (p ** 1.3)) / SR) * .25) * p ** 2.2


def whoosh(dur=.7, peak=2600, pan_from=-.8, pan_to=.8):
    n = int(dur * SR)
    p = np.linspace(0, 1, n)
    s = noise_band(dur, lambda q: 250 + peak * np.sin(math.pi * q) ** 2, width=.5).sum(0) * np.sin(math.pi * p) ** 1.6
    a = (pan_from + (pan_to - pan_from) * p + 1) * math.pi / 4
    return np.stack([s * np.cos(a), s * np.sin(a)])


def reverse_cymbal(dur=.9):
    t = tt(int(dur * SR))
    return ffilt(rng.standard_normal(len(t)), hp(4500)) * np.exp((t - dur) / (dur / 4.5))


def bell(f, decay=.7):
    t = tt(int(decay * 4 * SR))
    return (np.sin(TAU * f * t) + .35 * np.sin(TAU * f * 2.76 * t) * np.exp(-t / (decay * .35))) * np.exp(-t / decay)


def shimmer(t0, count=14, scale=('D6', 'E6', 'G6', 'A6', 'C7', 'D7'), spread=.55, gain=.1, send=.7):
    for _ in range(count):
        add(bell(hz(scale[rng.integers(len(scale))]), rng.uniform(.25, .7)), t0 + rng.uniform(0, spread),
            gain * rng.uniform(.5, 1), pan=rng.uniform(-.8, .8), send=send)


def pluck(f, decay=.8):
    t = tt(int(decay * 3 * SR))
    out = sum((1 / k) * np.exp(-t * (1.2 + k * .8)) * np.sin(TAU * f * k * t) for k in range(1, 7))
    return out * (1 - np.exp(-t / .002))


def blip(f, dur=.07):
    """Sonido de interfaz: senoidal corta con leve caída de tono."""
    t = tt(int(dur * SR))
    return np.sin(TAU * np.cumsum(f * (1 + .25 * np.exp(-t * 60))) / SR) * np.exp(-t / (dur / 4))


def click():
    t = tt(int(.03 * SR))
    return ffilt(rng.standard_normal(len(t)) * np.exp(-t / .002), bp(1500, 7000)) + .6 * np.sin(TAU * 1800 * t) * np.exp(-t / .004)


def zip_(f0, f1, dur=.35):
    t = tt(int(dur * SR))
    f = f0 * (f1 / f0) ** (t / dur)
    return np.sin(TAU * np.cumsum(f) / SR) * np.sin(math.pi * t / dur) ** .8


def stutter(dur=.4):
    """Ruido "digital": muestreo-retención a 1.6 kHz con cortes rítmicos."""
    n = int(dur * SR)
    hold = SR // 1600
    s = np.repeat(rng.uniform(-1, 1, n // hold + 1), hold)[:n]
    gate = (np.floor(tt(n) / .028) % 3 != 1).astype(float)
    return ffilt(s * gate, bp(300, 6000)) * np.linspace(1, .4, n)


def thud():
    t = tt(int(.6 * SR))
    f = 48 + 90 * np.exp(-t * 18)
    body = np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / .16)
    knock = ffilt(rng.standard_normal(len(t)) * np.exp(-t / .012), bp(200, 1800))
    return np.tanh(1.8 * (body + .5 * knock))


def ding(f):
    t = tt(int(1.2 * SR))
    return (np.sin(TAU * f * t) * np.exp(-t / .35) + .5 * np.sin(TAU * f * 2 * t) * np.exp(-t / .18)
            + .25 * np.sin(TAU * f * 3.01 * t) * np.exp(-t / .1))


def sub_drop(dur=1.2):
    t = tt(int(dur * SR))
    f = 34 + 55 * np.exp(-t * 4)
    return np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / .45) * (1 - np.exp(-t / .004))


# ---------------------------------------------------------------- armonía
CHORDS = [  # (inicio, fin, colchón, raíz del bajo)
    (0.0, 4.0, ['D3', 'F3', 'A3', 'E4'], 'D2'),
    (4.0, 6.0, ['Bb2', 'D3', 'F3', 'A3'], 'Bb1'),
    (6.0, K['svc1'], ['F3', 'A3', 'C4', 'G4'], 'F2'),
    (K['svc1'], 10.0, ['D3', 'F3', 'A3', 'C4', 'E4'], 'D2'),
    (10.0, 12.0, ['Bb2', 'D3', 'F3', 'A3'], 'Bb1'),
    (12.0, 14.0, ['F3', 'A3', 'C4', 'E4'], 'F2'),
    (14.0, 16.0, ['C3', 'E3', 'G3', 'D4'], 'C2'),
    (16.0, 18.0, ['D3', 'F3', 'A3', 'C4', 'E4'], 'D2'),
    (18.0, K['infra'], ['Bb2', 'D3', 'F3', 'A3'], 'Bb1'),
    (K['infra'], 22.0, ['G2', 'Bb2', 'D3', 'F3', 'A3'], 'G1'),
    (22.0, K['cta'], ['A2', 'C#3', 'E3', 'G3'], 'A1'),
    (K['cta'], DUR, ['D3', 'F#3', 'A3', 'E4'], 'D2'),
]
for a, b, notes, _ in CHORDS:
    add(pad_chord(notes, b - a + .15, attack=1.6 if a == 0 else .45, release=1.4), a, bus=PADB)


def chord_at(t):
    for a, b, notes, root in CHORDS:
        if a <= t < b:
            return notes, root
    return CHORDS[-1][2], CHORDS[-1][3]


GROOVE = [(K['svc1'], K['infra']), (K['cta'], 28.0)]
KICKS = []
for a, b in GROOVE:
    t = a
    while t < b - 1e-6:
        add(bass_note(hz(chord_at(t)[1])), t, gain=.95 if (t - a) % .5 < 1e-6 else .7, bus=BASS)
        t += .25
# bajo a medio tiempo en la infraestructura
for j in range(int((K['cta'] - K['infra']) / .5)):
    t = K['infra'] + j * .5
    add(bass_note(hz(chord_at(t)[1]), .45), t, gain=.9, bus=BASS)
add(np.sin(TAU * hz('D2') * tt(int(4.2 * SR))) * np.clip(tt(int(4.2 * SR)) / 2.5, 0, 1), 0, gain=.12, bus=BASS)


def up12(name):
    m = re.fullmatch(r'([A-G][#b]?)(-?\d)', name)
    return m.group(1) + str(int(m.group(2)) + 1)


ARP = [0, 1, 2, 3, 2, 1, 2, 3]
for a, b in ((K['svc2'], K['infra']), (K['cta'] + .5, 28.0)):
    t, i = a, 0
    while t < b - 1e-6:
        notes = [up12(n) for n in chord_at(t)[0]]
        add(pluck(hz(notes[ARP[i % 8] % len(notes)]), .4), t, gain=.065 if i % 2 == 0 else .045, pan=(-.35, .35)[i % 2], send=.35)
        t += .25
        i += 1


def groove(a, b, clap_on=True, kick_steps=(0, 8, 11)):
    t, i = a, 0
    while t < b - 1e-6:
        s = i % 16
        if s in kick_steps:
            add(kick(), t, gain=.5)
            KICKS.append(t)
        if clap_on and s in (4, 12):
            add(clap(), t, gain=.22, send=.35, pan=.05)
        if s % 2 == 0:
            add(hat(open_=(s == 14 and (i // 16) % 2 == 1)), t, gain=.06 if s % 4 == 0 else .1, pan=.3)
        t += .125
        i += 1


groove(K['svc1'], K['infra'])
groove(K['infra'], K['crown'], clap_on=False, kick_steps=(0, 8))
groove(K['cta'], 28.0)
for j in range(16):  # redoble hacia el cierre
    add(clap(), K['cta'] - 1.0 + j * .0625, gain=.05 + .012 * j, send=.3)

# ---------------------------------------------------------------- diseño sonoro sincronizado
# 1 · gancho
add(ffilt(rng.standard_normal(int(4.2 * SR)), bp(400, 2500)) * np.clip(tt(int(4.2 * SR)) / 2, 0, 1), 0, gain=.02, send=.2)
for k in ('l1', 'l2', 'l3', 'l4', 'l5'):
    add(thud(), K[k], gain=.32)
    add(click(), K[k], gain=.18, send=.2)
for j in range(16):  # DATOS: decodificación
    add(blip(hz(['D6', 'F6', 'A6', 'C7', 'E7'][j % 5]) * rng.uniform(.98, 1.02), .05), K['l3'] + .05 + j * .045, gain=.05, pan=rng.uniform(-.6, .6), send=.25)
add(stutter(.42), K['glitch'], gain=.16, send=.2)
add(riser(K['morph'] - 2.3, 500, 7000), 2.3, gain=.1, send=.3)
add(whoosh(1.3, 2200, -.7, .7), K['morph'], gain=.16, send=.45)
add(noise_band(1.3, lambda q: 900 + 2600 * q).sum(0) * np.sin(np.linspace(0, math.pi, int(1.3 * SR))) ** 2, K['morph'], gain=.04, send=.5)
# 2 · marca
add(impact(.7), K['ring'], gain=.5, send=.4)
shimmer(K['ring'], count=18, gain=.09)
for j in range(2):
    add(zip_(500, 1600, .55), K['arcs'] + j * .35, gain=.06, pan=(-.3, .4)[j], send=.4)
for j in range(3):
    add(bell(hz('E6'), .4), K['arcs'] - .1 + j * .3, gain=.07, pan=(-.4, 0, .5)[j], send=.4)
for i, n in enumerate(['A5', 'C6', 'D6', 'E6', 'G6', 'A6', 'C7', 'D7', 'E7', 'G7']):
    add(bell(hz(n), .3), K['logo'] + i * .045, gain=.03, pan=-.6 + i * .13, send=.5)
add(blip(hz('A5'), .08), K['sub'], gain=.08, send=.3)
add(riser(K['svc1'] - 7.0, 300, 9000, curve=1.3), 7.0, gain=.15, send=.3)
add(whoosh(.5, 3000), K['zoom'], gain=.16, send=.3)
add(sub_drop(), K['svc1'], gain=.3)
add(impact(.8), K['svc1'], gain=.55, send=.35)
# 3 · servicios
for k in (K['svc2'], K['svc3'], K['svc4']):
    add(riser(.5, 600, 6000), k - .5, gain=.07, send=.3)
    add(whoosh(.55, 3400, .7, -.7), k - .05, gain=.2, send=.35)
s1 = K['svc1']
for i in range(3):
    add(blip(hz('E6') * (1 + i * .12), .06), s1 + .3 + i * .1, gain=.07, pan=-.4 + i * .4, send=.2)
for j in range(20):
    add(click(), s1 + .45 + j * .05, gain=.025 * (1 - j / 24), pan=rng.uniform(-.3, .3))
add(zip_(300, 1200, .9), s1 + .5, gain=.035, send=.3)
add(click(), s1 + 1.55, gain=.45, send=.15)
add(whoosh(.5, 4000, -.2, .3), s1 + 1.6, gain=.06, send=.3)
s2 = K['svc2']
add(blip(hz('A4'), .12), s2 + .1, gain=.14, send=.3)
for i in range(6):
    add(blip(hz(['D6', 'E6', 'G6', 'A6', 'C7', 'D7'][i]), .05), s2 + .45 + i * .07, gain=.06, pan=-.6 + i * .24, send=.3)
for k in range(3):
    add(ding(hz(['A5', 'C6', 'E6'][k])), s2 + 1.3 + k * .35, gain=.08, pan=(-.4, .4, 0)[k], send=.4)
s3 = K['svc3']
for j in range(30):
    add(blip(hz(['D6', 'F6', 'A6', 'C7', 'E7'][j % 5]), .035), s3 + .2 + rng.uniform(0, .6), gain=.03, pan=rng.uniform(-.7, .7), send=.25)
add(whoosh(.6, 5000, -.6, .6), s3 + .85, gain=.07, send=.4)
add(whoosh(.8, 1800, .4, -.4), s3 + 1.0, gain=.05, send=.4)
add(ding(hz('D6')), s3 + 1.95, gain=.09, send=.45)
s4 = K['svc4']
for j in range(14):
    add(click(), s4 + .7 + j * .05, gain=.03, pan=rng.uniform(-.4, .4))
add(impact(.35), s4 + 1.5, gain=.3, send=.4)
add(ding(hz('A5')), s4 + 1.5, gain=.1, send=.45)
shimmer(s4 + 1.55, count=10, gain=.05)
# 4 · infraestructura
add(impact(.9), K['infra'], gain=.6, send=.35)
add(whoosh(.6, 3000, -.5, .5), K['infra'] - .2, gain=.14, send=.35)
for i in range(4):
    add(thud(), K['slab0'] + i * K['slabGap'] + .3, gain=.42, send=.25)
    add(bell(hz(['D5', 'F5', 'A5', 'D6'][i]), .5), K['slab0'] + i * K['slabGap'] + .3, gain=.05, send=.5)
shimmer(K['crown'], count=20, gain=.09)
add(stab(['A2', 'E3', 'A3', 'C#4']), K['crown'], gain=.18, send=.5)
add(riser(K['cta'] - 22.9, 300, 9000), 22.9, gain=.14, send=.3)
add(reverse_cymbal(.7), K['cta'] - .7, gain=.1)
# 5 · cierre
add(impact(.9), K['cta'], gain=.6, send=.35)
add(stab(['D3', 'F#3', 'A3', 'D4']), K['cta'], gain=.24, send=.45)
for j in range(19):
    add(blip(hz(['D6', 'E6', 'F#6', 'A6', 'B6'][j % 5]), .04), K['nombre'] + j * .04, gain=.03, pan=-.5 + j * .05, send=.3)
for j in range(10):
    add(click(), K['tel'] + .05 + j * .035, gain=.05, pan=-.3 + j * .06)
add(blip(hz('A5'), .08), K['web'], gain=.07, send=.3)
add(impact(.55), K['boton'], gain=.45, send=.35)
add(ding(hz('D6')), K['boton'], gain=.1, send=.5)
shimmer(K['boton'], count=20, scale=('D6', 'E6', 'F#6', 'A6', 'B6', 'D7'), gain=.08)
shimmer(28.2, count=14, scale=('D6', 'E6', 'F#6', 'A6', 'B6', 'D7'), spread=.8, gain=.06)

# ---------------------------------------------------------------- mezcla
duck = np.ones(N)
for k in KICKS:
    i0 = int(k * SR)
    seg = np.arange(min(N - i0, int(.3 * SR))) / SR
    duck[i0:i0 + len(seg)] = np.minimum(duck[i0:i0 + len(seg)], 1 - .55 * np.exp(-seg / .09))
BASS = ffilt(BASS, lambda f: lp(900)(f) * hp(45)(f)) * duck * .33
PADB = ffilt(PADB, lambda f: lp(2600)(f) * hp(130)(f)) * (.65 + .35 * duck) * .8
SEND += PADB * .5


def reverb(x, rt60=2.4, pre=.025):
    n = int(rt60 * SR)
    t = tt(n)
    ir = np.zeros((2, n))
    for ch in range(2):
        ir[ch] = ffilt(rng.standard_normal(n), lp(3200)) * np.exp(-6.91 * t / rt60) + .4 * ffilt(rng.standard_normal(n), hp(2500)) * np.exp(-6.91 * t / (rt60 * .4))
    ir *= (1 - np.exp(-t / .01))
    ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
    ir = np.concatenate([np.zeros((2, int(pre * SR))), ir], axis=1)
    size = 1 << (N + ir.shape[1]).bit_length()
    return np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[:, :N]


mix = DRY + BASS + PADB + .55 * reverb(ffilt(SEND, hp(200)))
mix = ffilt(mix, lambda f: hp(35, 3)(f) * (1 - .55 / (1 + (f / 65) ** 4)))  # sin sub-graves que el celular no reproduce
mix /= np.abs(mix).max()
mix = np.tanh(1.3 * mix) / math.tanh(1.3)
tail = int(1.4 * SR)
mix[:, -tail:] *= np.cos(np.linspace(0, math.pi / 2, tail)) ** 2
mix[:, :int(.01 * SR)] *= np.linspace(0, 1, int(.01 * SR))
mix *= 10 ** (-1 / 20) / np.abs(mix).max()

out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'assets', 'audio', 'banda-sonora.wav')
pcm = np.clip(mix.T * 32767 + rng.uniform(-.5, .5, mix.T.shape) + rng.uniform(-.5, .5, mix.T.shape), -32768, 32767).astype('<i2')
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f'{out}: {DUR:.2f} s, pico {20 * math.log10(np.abs(mix).max()):.1f} dBFS')
