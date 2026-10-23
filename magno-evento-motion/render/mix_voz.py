#!/usr/bin/env python3
"""Mezcla la voz en off (assets/voz/01..08.*) con la banda sonora y genera los MP4 con voz.

Uso:  python3 render/mix_voz.py

Requiere out/banda-sonora.wav (render/soundtrack.py) y out/magno-evento-invitacion-9x16-sin-audio.mp4.
Coloca cada frase en su tiempo (ver VOZ.md), baja la música ~9 dB mientras hablas,
normaliza a -14 LUFS y escribe out/magno-evento-invitacion-9x16-voz.mp4 y la versión WhatsApp.
"""
import glob
import os
import subprocess
import sys
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
# (archivo, inicio en s, duración máxima en s) — igual que VOZ.md
SLOTS = [('01', .4, 2.9), ('02', 3.5, 2.0), ('03', 5.7, 2.2), ('04', 8.6, 4.3),
         ('05', 13.4, 3.4), ('06', 17.5, 3.7), ('07', 21.6, 4.0), ('08', 26.3, 4.4)]


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, '<i2').astype(np.float32) / 32768


def trim(x, thr=.01):
    idx = np.nonzero(np.abs(x) > thr)[0]
    if not len(idx):
        return x
    a, b = max(0, idx[0] - int(.03 * SR)), min(len(x), idx[-1] + int(.12 * SR))
    return x[a:b]


def run(*args):
    subprocess.run(args, check=True)


music_path = os.path.join(ROOT, 'out', 'banda-sonora.wav')
with wave.open(music_path) as w:
    music = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float32).reshape(-1, 2).T / 32768
N = music.shape[1]
voice = np.zeros(N, np.float32)
found = 0
for name, t0, dur in SLOTS:
    files = sorted(glob.glob(os.path.join(ROOT, 'assets', 'voz', name + '.*')))
    if not files:
        print(f'falta assets/voz/{name}.*  (se omite)')
        continue
    x = trim(decode(files[0]))
    if len(x) / SR > dur + .25:
        print(f'aviso: {name} dura {len(x) / SR:.1f} s y su ventana es {dur:.1f} s; acórtala o di la frase más rápido')
    x = x / (np.sqrt(np.mean(x ** 2)) + 1e-9) * .1  # nivelar frases entre sí
    i0 = int(t0 * SR)
    x = x[:N - i0]
    voice[i0:i0 + len(x)] += x
    found += 1
if not found:
    sys.exit('no hay archivos de voz en assets/voz/')

# limpieza de la voz: quitar retumbe < 80 Hz y dar presencia suave
size = 1 << (N - 1).bit_length()
f = np.fft.rfftfreq(size, 1 / SR)
g = 1 / np.sqrt(1 + (80 / np.maximum(f, 1)) ** 4) * (1 + .25 * np.exp(-((f - 3500) / 1800) ** 2))
voice = np.fft.irfft(np.fft.rfft(voice, size) * g, size)[:N]

# la música se hace a un lado (-9 dB) cuando hay voz, con ataque/relevo suaves
env = np.convolve(np.abs(voice), np.ones(int(.05 * SR)) / int(.05 * SR), 'same')
active = (env > .01).astype(np.float32)
k = int(.25 * SR)
active = np.convolve(active, np.ones(k) / k, 'same')
duck = 1 - (1 - 10 ** (-9 / 20)) * np.clip(active * 1.5, 0, 1)
mix = music * duck + np.stack([voice, voice]) * 1.0
mix /= max(1e-9, np.abs(mix).max() / .89)

tmp = os.path.join(ROOT, 'out', '_mezcla-voz.wav')
pcm = (np.clip(mix.T, -1, 1) * 32767).astype('<i2')
with wave.open(tmp, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())

video = os.path.join(ROOT, 'out', 'magno-evento-invitacion-9x16-sin-audio.mp4')
out = os.path.join(ROOT, 'out', 'magno-evento-invitacion-9x16-voz.mp4')
run('ffmpeg', '-y', '-v', 'error', '-i', video, '-i', tmp, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
    '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', out)
run('ffmpeg', '-y', '-v', 'error', '-i', out, '-vf', 'scale=720:1280:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-crf', '22',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart',
    os.path.join(ROOT, 'out', 'magno-evento-invitacion-whatsapp-voz.mp4'))
os.remove(tmp)
print('listo:', out)
