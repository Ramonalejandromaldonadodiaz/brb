# Animación de logo — Todo en Vending

Animación vertical 9:16 (1080×1920, 30 fps, 7 s) del logo de Todo en Vending con música original sintetizada.

## Entregables (`out/`)

| Archivo | Uso |
|---|---|
| `todo-en-vending-logo-9x16.mp4` | Versión maestra con audio (-14 LUFS). Reels, Historias, TikTok, Shorts, intro/cierre de videos. |
| `todo-en-vending-logo-9x16-sin-audio.mp4` | Igual, sin audio. |
| `todo-en-vending-logo-whatsapp.mp4` | 720×1280 ligera para WhatsApp. |
| `portada-9x16.png` | Último cuadro, el logo completo. |
| `banda-sonora.wav` | Audio original sin normalizar. |

## Guion (120 BPM)

1. **0–0.6 s** — Cortinillas rojo, negro y amarillo.
2. **0.4–0.9 s** — La máquina sube y rebota (cámara cerca).
3. **0.9–1.9 s** — La moneda dorada cae girando, rebota y el arco rojo la rodea.
4. **1.5–2.3 s** — VEND y NG salen disparadas de la máquina mientras la cámara se aleja.
5. **2.3–3.3 s** — La moneda roja entra rodando; TODO EN cae letra por letra.
6. **3.4–3.9 s** — Se revela la URL; entran las franjas diagonales.
7. **4.0 s** — "Cha-ching": destello, brillo metálico, la moneda gira y salen monedas disparadas.
8. **4.5–7 s** — Logo completo en pantalla.

## Cómo regenerar

Requisitos: Node 18+ con Playwright (Chromium), ffmpeg, Python 3 con numpy y scipy.

```bash
bash render/build.sh          # 9:16 (también: 16x9 o 1x1)
node render/render.mjs --scale 0.5 --frames 1,2.5,4.2 --dir out/cuadros   # cuadros sueltos para revisar
```

- El logo se separó en piezas (`assets/parts/`, posiciones en `parts.json`) a partir de `assets/logo-original.png`; recompuestas son idénticas al original.
- `seek(t)` en `js/motion.js` dibuja el instante exacto; los tiempos clave están en `js/config.js` y los usa también `render/soundtrack.py`.
- Vista previa: abrir `index.html` en Chrome (se reproduce en bucle; `?fmt=16x9` para horizontal).
