#!/usr/bin/env python3
"""Banda sonora original de la invitación (síntesis pura con numpy: sin samples ni música con derechos).

Uso:  python3 render/soundtrack.py out/banda-sonora.wav

Lee duración y tiempos clave de js/config.js para que cada golpe caiga exactamente
con la animación. Tempo 120 BPM (un tiempo = 0.5 s), tonalidad Re menor que resuelve
a Re mayor en el llamado a la acción.
"""
import math
import os
import re
import sys
import wave

import numpy as np

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rng = np.random.default_rng(20261113)


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
    """'A4' -> 440 Hz; admite sostenidos y bemoles ('F#3', 'Bb2')."""
    m = re.fullmatch(r'([A-G])([#b]?)(-?\d)', name)
    semis = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}[m.group(1)]
    semis += {'#': 1, 'b': -1, '': 0}[m.group(2)]
    midi = 12 * (int(m.group(3)) + 1) + semis
    return 440.0 * 2 ** ((midi - 69) / 12)


def tt(n):
    return np.arange(n) / SR


def ffilt(x, gain_fn):
    """Filtro de fase cero en frecuencia (x: mono o estéreo [2, n])."""
    n = x.shape[-1]
    size = 1 << (n + 4096 - 1).bit_length()
    f = np.fft.rfftfreq(size, 1 / SR)
    g = gain_fn(np.maximum(f, 1e-3))
    return np.fft.irfft(np.fft.rfft(x, size) * g, size)[..., :n]


def lp(fc, order=2):
    return lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * order))


def hp(fc, order=2):
    return lambda f: 1 / np.sqrt(1 + (fc / f) ** (2 * order))


def bp(lo, hi, order=2):
    return lambda f: lp(hi, order)(f) * hp(lo, order)(f)


def fade(x, a=0.004, r=0.02):
    """Rampa de entrada/salida para evitar clics."""
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
SEND = np.zeros((2, N))   # bus de reverberación
BASS = np.zeros((2, N))   # bus de bajo (se comprime con el bombo)
PADB = np.zeros((2, N))   # bus de colchón armónico


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
def pad_chord(notes, dur, attack=0.7, release=1.2, bright=1.0):
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
                    amp = (1 / k) * math.exp(-k / (3.2 * bright))
                    out[ch] += amp * np.sin(TAU * f * k * t * (1 + vib) + rng.uniform(0, TAU))
    env = np.clip(t / attack, 0, 1) ** 2 * (3 - 2 * np.clip(t / attack, 0, 1))
    rel = t > dur
    env[rel] *= np.exp(-(t[rel] - dur) / (release / 4))
    return out * env / (len(notes) * 4)


def bass_note(f, dur=0.24):
    n = int(dur * SR)
    t = tt(n)
    ph = TAU * f * t
    s = np.sin(ph) + .45 * np.sin(2 * ph) + .2 * np.sin(3 * ph)
    env = (1 - np.exp(-t / .004)) * np.exp(-t / .16)
    return np.tanh(1.4 * s * env)


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
    s = rng.standard_normal(n) * np.exp(-t / (.11 if open_ else .016))
    return ffilt(s, hp(7200, 3)) * 1.4


def impact(size=1.0):
    n = int(2.8 * SR)
    t = tt(n)
    f = 40 + 46 * np.exp(-t * 3.2)
    boom = .7 * np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / .6) * (1 - np.exp(-t / .003))
    tf = 95 + 80 * np.exp(-t * 12)
    punch = np.sin(TAU * np.cumsum(tf) / SR) * np.exp(-t / .22)
    crack = ffilt(rng.standard_normal(n) * np.exp(-t / .06), bp(700, 5000))
    s = np.tanh(1.5 * (boom + .8 * punch + .6 * crack * size))
    return s * size


def stab(notes, dur=1.4):
    n = int(dur * SR)
    t = tt(n)
    out = np.zeros(n)
    for name in notes:
        f = hz(name)
        for k in range(1, 14):
            if f * k > 9000:
                break
            out += (1 / k) * np.exp(-t * (1.8 + .9 * k)) * np.sin(TAU * f * k * t + rng.uniform(0, TAU))
    return np.tanh(1.2 * out / len(notes)) * (1 - np.exp(-t / .005))


def noise_band(dur, fc_fn, width=.35, voices=56):
    """Banda de ruido hecha con muchas senoidales cuya frecuencia central se mueve."""
    n = int(dur * SR)
    p = np.linspace(0, 1, n)
    fc = fc_fn(p)
    out = np.zeros((2, n))
    for v in range(voices):
        ratio = 2 ** rng.uniform(-width, width)
        out[v % 2] += np.sin(TAU * np.cumsum(fc * ratio) / SR + rng.uniform(0, TAU))
    return out / math.sqrt(voices / 2)


def riser(dur, f0=300, f1=7000, curve=1.7):
    p = np.linspace(0, 1, int(dur * SR))
    s = noise_band(dur, lambda q: f0 * (f1 / f0) ** (q ** curve))
    tone = np.sin(TAU * np.cumsum(220 * 4 ** (p ** 1.3)) / SR) * .25
    return (s + tone) * p ** 2.2


def whoosh(dur=.7, peak=2600, pan_from=-.8, pan_to=.8):
    n = int(dur * SR)
    p = np.linspace(0, 1, n)
    s = noise_band(dur, lambda q: 250 + peak * np.sin(math.pi * q) ** 2, width=.5).sum(0)
    s *= np.sin(math.pi * p) ** 1.6
    a = (pan_from + (pan_to - pan_from) * p + 1) * math.pi / 4
    return np.stack([s * np.cos(a), s * np.sin(a)])


def reverse_cymbal(dur=.9):
    n = int(dur * SR)
    t = tt(n)
    s = ffilt(rng.standard_normal(n), hp(4500)) * np.exp((t - dur) / (dur / 4.5))
    return s


def bell(f, decay=.7):
    n = int(decay * 4 * SR)
    t = tt(n)
    return (np.sin(TAU * f * t) + .35 * np.sin(TAU * f * 2.76 * t) * np.exp(-t / (decay * .35))) * np.exp(-t / decay)


def shimmer(t0, count=14, scale=('D6', 'E6', 'G6', 'A6', 'C7', 'D7'), spread=.55, gain=.1, send=.7):
    for _ in range(count):
        add(bell(hz(scale[rng.integers(len(scale))]), rng.uniform(.25, .7)), t0 + rng.uniform(0, spread),
            gain * rng.uniform(.5, 1), pan=rng.uniform(-.8, .8), send=send)


def mallet(f):
    n = int(1.2 * SR)
    t = tt(n)
    return (np.sin(TAU * f * t) * np.exp(-t / .35) + .3 * np.sin(TAU * f * 3.9 * t) * np.exp(-t / .06)
            + .5 * np.sin(TAU * f * 2 * t) * np.exp(-t / .15))


def pluck(f, decay=.8):
    n = int(decay * 3 * SR)
    t = tt(n)
    out = sum((1 / k) * np.exp(-t * (1.2 + k * .8)) * np.sin(TAU * f * k * t) for k in range(1, 7))
    return out * (1 - np.exp(-t / .002))


def tick():
    n = int(.04 * SR)
    t = tt(n)
    return ffilt(rng.standard_normal(n) * np.exp(-t / .004), bp(2500, 6000))


def bloop():
    n = int(.25 * SR)
    t = tt(n)
    f = 420 + 800 * np.exp(-t * 30)
    return np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / .08)


def thud():
    n = int(.25 * SR)
    t = tt(n)
    f = 60 + 60 * np.exp(-t * 25)
    return np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / .06)


def sub_drop(dur=1.2):
    t = tt(int(dur * SR))
    f = 30 + 55 * np.exp(-t * 4)
    return np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / .45) * (1 - np.exp(-t / .004))


# ---------------------------------------------------------------- armonía
CHORDS = [  # (inicio, fin, notas del colchón, raíz del bajo)
    (0.0, 4.0, ['D3', 'F3', 'A3', 'E4'], 'D2'),
    (4.0, 6.0, ['Bb2', 'D3', 'F3', 'A3'], 'Bb1'),
    (6.0, 8.0, ['F3', 'A3', 'C4', 'E4'], 'F2'),
    (8.0, 10.0, ['C3', 'E3', 'G3', 'D4'], 'C2'),
    (10.0, 12.0, ['D3', 'F3', 'A3', 'C4', 'E4'], 'D2'),
    (12.0, 14.0, ['Bb2', 'D3', 'F3', 'A3'], 'Bb1'),
    (14.0, 16.0, ['F3', 'A3', 'C4', 'E4'], 'F2'),
    (16.0, K['iris'], ['C3', 'E3', 'G3', 'D4'], 'C2'),
    (K['iris'], K['dia'], ['A2', 'D3', 'E3', 'G3'], 'A1'),
    (K['dia'], 20.0, ['D3', 'F3', 'A3', 'C4', 'E4'], 'D2'),
    (20.0, K['s5b'], ['Bb2', 'D3', 'F3', 'A3'], 'Bb1'),
    (K['s5b'], K['cta'], ['A2', 'C#3', 'E3', 'G3'], 'A1'),
    (K['cta'], DUR, ['D3', 'F#3', 'A3', 'E4'], 'D2'),
]
for a, b, notes, _ in CHORDS:
    first = a == 0.0
    add(pad_chord(notes, b - a + .15, attack=1.8 if first else .5, release=1.4), a, gain=1.0, bus=PADB)

# Bajo en corcheas durante el ritmo
GROOVE = [(6.0, K['iris']), (K['dia'], K['out5']), (K['cta'], 25.0)]
def chord_root(t):
    for a, b, _, root in CHORDS:
        if a <= t < b:
            return root
    return 'D2'
for a, b in GROOVE:
    t = a
    while t < b - 1e-6:
        add(bass_note(hz(chord_root(t))), t, gain=.95 if (t - a) % .5 < 1e-6 else .7, bus=BASS)
        t += .25
add(np.sin(TAU * hz('D2') * tt(int(3.6 * SR))) * np.clip(tt(int(3.6 * SR)) / 2.5, 0, 1), 0, gain=.12, bus=BASS)  # drone de entrada

# Arpegio en corcheas (acordes una octava arriba)
def up12(name):
    m = re.fullmatch(r'([A-G][#b]?)(-?\d)', name)
    return m.group(1) + str(int(m.group(2)) + 1)
def chord_notes(t):
    for a, b, notes, _ in CHORDS:
        if a <= t < b:
            return [up12(n) for n in notes]
    return ['D4', 'F4', 'A4', 'E5']
ARP = [0, 1, 2, 3, 2, 1, 2, 3]
for a, b in ((K['wipe1'], 16.5), (K['dia'], K['out5']), (K['cta'], 25.0)):
    t, i = a, 0
    while t < b - 1e-6:
        notes = chord_notes(t)
        add(pluck(hz(notes[ARP[i % 8] % len(notes)]), .45), t, gain=.07 if i % 2 == 0 else .05, pan=(-.35, .35)[i % 2], send=.35)
        t += .25
        i += 1

# Batería (patrón de 16 pasos por compás de 2 s)
KICKS = []
def groove(a, b, clap_on=True, kick_steps=(0, 8, 11)):
    step = .125
    t, i = a, 0
    while t < b - 1e-6:
        s = i % 16
        if s in kick_steps:
            add(kick(), t, gain=.5); KICKS.append(t)
        if clap_on and s in (4, 12):
            add(clap(), t, gain=.22, send=.35, pan=.05)
        if s % 2 == 0:
            add(hat(open_=(s == 14 and (i // 16) % 2 == 1)), t, gain=.06 if s % 4 == 0 else .1, pan=.3)
        t += step
        i += 1

groove(6.0, 8.0, clap_on=False)
groove(8.0, 16.5)
for j in range(8):  # redoble hacia el iris
    add(clap(), 16.5 + j * .0625, gain=.08 + .03 * j, send=.3)
groove(16.5, K['iris'], clap_on=False)
groove(K['dia'], K['out5'])
groove(K['cta'], 25.0)

# ---------------------------------------------------------------- diseño sonoro sincronizado
add(ffilt(rng.standard_normal(int(3.6 * SR)), bp(400, 2500)) * np.clip(tt(int(3.6 * SR)) / 2, 0, 1), 0, gain=.025, send=.2)  # aire
add(riser(K['ringClose'] - K['ringStart'], 500, 4200), K['ringStart'], gain=.07, send=.3)
add(impact(.5), K['ringClose'], gain=.35, send=.4)
shimmer(K['ringClose'], count=16, gain=.09)
for i, n in enumerate(['A5', 'C6', 'D6', 'E6', 'G6', 'A6', 'C7', 'D7', 'E7', 'G7']):
    add(bell(hz(n), .3), K['logoIn'] + i * .045, gain=.035, pan=-.6 + i * .13, send=.5)
for j in range(4):  # "ping" de Guadalajara con ecos
    add(bell(hz('E6'), .45), K['marker'] + .05 + j * .19, gain=.13 * .5 ** j, pan=(-.5, .5)[j % 2], send=.4)
add(riser(K['s2'] - K['zoom'] + .25, 300, 9000, curve=1.3), K['zoom'] - .25, gain=.16, send=.3)
add(sub_drop(), K['s2'], gain=.28)
add(whoosh(.5, 3000), K['s2'] - .2, gain=.18, send=.3)
for i, n in enumerate(['D4', 'F4', 'A4', 'C5', 'E5', 'F5', 'A5', 'C6', 'D6', 'E6', 'F6', 'A6']):
    add(pluck(hz(n)), K['invita'] + i * .028, gain=.05, pan=-.5 + i * .09, send=.45)
for key, size, notes in (('magno', 1.0, ['D3', 'A3', 'D4', 'F4']), ('evento', .78, ['Bb2', 'F3', 'Bb3', 'D4'])):
    add(reverse_cymbal(.45), K[key] - .45, gain=.1 * size)
    add(impact(size), K[key], gain=.85, send=.3)
    add(stab(notes), K[key], gain=.3 * size, send=.4)
shimmer(K['box'], count=18, spread=.4, gain=.08)
add(whoosh(.6, 5000, -.2, .2), K['box'] - .05, gain=.05, send=.4)
add(tick(), K['fecha'], gain=.25, send=.3)
add(whoosh(1.0, 1800, -.4, .4), K['hosts'] - .1, gain=.06, send=.5)
for key in ('glint', 'sweep3', 'sweep4', 'glint5'):
    add(whoosh(.9, 7000, -.7, .7), K[key], gain=.035, send=.6)
    shimmer(K[key] + .15, count=8, spread=.6, gain=.05)
for key, lead in (('wipe1', .5), ('wipe2', .5)):
    add(riser(lead, 600, 6000), K[key] - lead, gain=.08, send=.3)
    add(whoosh(.6, 3200), K[key] - .05, gain=.2, send=.35)
for i, n in enumerate(['E5', 'G5', 'A5', 'C6', 'E6']):
    add(mallet(hz(n)), K['row0'] + i * K['rowGap'], gain=.17, pan=-.3 + i * .15, send=.35)
shimmer(K['header4'], count=8, spread=.4, gain=.05)
for d in range(5):  # tarjetas que giran (una diagonal a la vez)
    add(ffilt(rng.standard_normal(int(.05 * SR)) * np.exp(-tt(int(.05 * SR)) / .01), bp(1800, 6000)),
        K['cards'] + d * .09 + .12, gain=.12, pan=-.6 + d * .3, send=.3)
add(riser(1.0, 400, 8000), K['iris'] - 1.0, gain=.12, send=.3)
add(whoosh(.8, 2600, .6, -.6), K['iris'] - .1, gain=.22, send=.4)
add(reverse_cymbal(.9), K['dia'] - .9, gain=.12)
add(impact(1.05), K['dia'], gain=.85, send=.3)
add(stab(['D3', 'A3', 'D4', 'F4']), K['dia'], gain=.3, send=.4)
for i in range(9):
    add(bell(hz(['D6', 'E6', 'F6', 'G6', 'A6', 'C7', 'D7', 'E7', 'F7'][i]), .25), K['mes'] + i * .04, gain=.025, pan=-.5 + i * .12, send=.5)
for j in range(10):  # reloj
    add(tick(), K['hora'] + j * .1, gain=.16 * (1 - j * .07), pan=(-.2, .2)[j % 2], send=.2)
add(bloop(), K['sede'], gain=.16, send=.3)
add(thud(), K['sede'] + .75 / 2.75, gain=.3)
add(riser(.5, 600, 7000), K['out5'] - .5, gain=.09, send=.3)
add(whoosh(.7, 3000, -.6, .6), K['out5'], gain=.16, send=.4)
add(impact(.4), K['s5b'], gain=.4, send=.5)
shimmer(K['s5b'], count=12, gain=.06)
add(reverse_cymbal(.6), K['cta'] - .6, gain=.11)
add(impact(.7), K['cta'], gain=.6, send=.35)
add(stab(['D3', 'F#3', 'A3', 'D4']), K['cta'], gain=.28, send=.45)
shimmer(K['cta'], count=20, scale=('D6', 'E6', 'F#6', 'A6', 'B6', 'D7'), gain=.08)
shimmer(25.0, count=14, scale=('D6', 'E6', 'F#6', 'A6', 'B6', 'D7'), spread=.8, gain=.06)

# ---------------------------------------------------------------- mezcla
duck = np.ones(N)
for k in KICKS:  # el bajo y el colchón respiran con el bombo
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
        dark = ffilt(rng.standard_normal(n), lp(3200)) * np.exp(-6.91 * t / rt60)
        bright = ffilt(rng.standard_normal(n), hp(2500)) * np.exp(-6.91 * t / (rt60 * .4))
        ir[ch] = dark + .4 * bright
    ir *= (1 - np.exp(-t / .01))
    ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
    ir = np.concatenate([np.zeros((2, int(pre * SR))), ir], axis=1)
    size = 1 << (N + ir.shape[1]).bit_length()
    return np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[:, :N]


mix = DRY + BASS + PADB + .55 * reverb(ffilt(SEND, hp(200)))
mix = ffilt(mix, lambda f: hp(35, 3)(f) * (1 - .55 / (1 + (f / 65) ** 4)))  # sin sub-graves que el celular no reproduce
mix /= np.abs(mix).max()
mix = np.tanh(1.3 * mix) / math.tanh(1.3)
tail = int(.9 * SR)  # cierre suave al final del video
mix[:, -tail:] *= np.cos(np.linspace(0, math.pi / 2, tail)) ** 2
mix[:, :int(.01 * SR)] *= np.linspace(0, 1, int(.01 * SR))
mix *= 10 ** (-1 / 20) / np.abs(mix).max()

out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'out', 'banda-sonora.wav')
pcm = np.clip(mix.T * 32767 + rng.uniform(-.5, .5, mix.T.shape) + rng.uniform(-.5, .5, mix.T.shape), -32768, 32767).astype('<i2')
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f'{out}: {DUR:.2f} s, pico {20 * math.log10(np.abs(mix).max()):.1f} dBFS')
