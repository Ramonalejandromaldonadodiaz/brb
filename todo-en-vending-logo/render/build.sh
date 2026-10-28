#!/usr/bin/env bash
# Genera todo: video (Chromium cuadro por cuadro), música, normalización a -14 LUFS y entregables en out/.
set -euo pipefail
cd "$(dirname "$0")/.."
FMT=${1:-9x16}
node render/render.mjs --fmt "$FMT" --out out/_video.mp4
python3 render/soundtrack.py
# loudnorm en dos pasadas: -14 LUFS, pico -1.5 dBTP
M=$(ffmpeg -hide_banner -nostats -i out/banda-sonora.wav -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
g() { echo "$M" | python3 -c "import json,sys; print(json.load(sys.stdin)['$1'])"; }
AF="loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true"
OUT=out/todo-en-vending-logo-$FMT.mp4
ffmpeg -y -v error -i out/_video.mp4 -i out/banda-sonora.wav -map 0:v -map 1:a -c:v copy -af "$AF" -ar 48000 \
  -c:a aac -b:a 256k -shortest -movflags +faststart "$OUT"
cp out/_video.mp4 "out/todo-en-vending-logo-$FMT-sin-audio.mp4"
if [ "$FMT" = 9x16 ]; then
  ffmpeg -y -v error -i "$OUT" -vf scale=720:1280:flags=lanczos -c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p \
    -c:a aac -b:a 160k -movflags +faststart out/todo-en-vending-logo-whatsapp.mp4
fi
ffmpeg -y -v error -sseof -0.05 -i out/_video.mp4 -frames:v 1 -update 1 "out/portada-$FMT.png"
rm -f out/_video.mp4
echo "listo: $OUT"
