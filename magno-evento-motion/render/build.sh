#!/usr/bin/env bash
# Pipeline completo: animación (Chromium) + banda sonora (numpy) → MP4 listos para redes.
# Requisitos: Node 18+, Playwright con Chromium, ffmpeg (libx264 + aac), Python 3 con numpy.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out

node render/render.mjs --out out/_video.mp4 "$@"
python3 render/soundtrack.py out/banda-sonora.wav

# Volumen estándar de redes: -14 LUFS integrados, pico real -1.5 dBTP (dos pasadas, modo lineal)
M=$(ffmpeg -hide_banner -nostats -i out/banda-sonora.wav -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { echo "$M" | sed -n "s/.*\"$1\" : \"\([^\"]*\)\".*/\1/p"; }
ffmpeg -y -loglevel error -i out/banda-sonora.wav \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true" \
  -ar 48000 -c:a aac -b:a 256k out/banda-sonora.m4a

ffmpeg -y -loglevel error -i out/_video.mp4 -i out/banda-sonora.m4a -map 0:v -map 1:a -c copy -shortest -movflags +faststart \
  out/magno-evento-invitacion-9x16.mp4
ffmpeg -y -loglevel error -i out/_video.mp4 -map 0:v -c copy -movflags +faststart out/magno-evento-invitacion-9x16-sin-audio.mp4
# Versión ligera para WhatsApp (720×1280, < 16 MB)
ffmpeg -y -loglevel error -i out/magno-evento-invitacion-9x16.mp4 -vf "scale=720:1280:flags=lanczos" \
  -c:v libx264 -preset slow -crf 22 -profile:v high -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a aac -b:a 160k -movflags +faststart out/magno-evento-invitacion-whatsapp.mp4
# Portada (último cuadro, sin compresión de video)
node render/render.mjs --frames 30.9 --dir out/.portada && mv out/.portada/f_30.90.png out/portada.png && rmdir out/.portada
rm -f out/_video.mp4
ls -lh out/*.mp4 out/portada.png
