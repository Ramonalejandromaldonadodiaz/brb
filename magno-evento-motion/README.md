# Invitación animada — Magno Evento Empresarial

Motion graphic vertical (9:16) para invitar al **Magno Evento Empresarial** de Black Ring Business Network
(13 de noviembre, 3:00–8:00 PM, Hotel Presidente InterContinental Guadalajara). Cierra con el QR de compra de boletos
(`assets/qr-evento.png`, imagen original; abre https://blackringbusiness.com/evento-13-noviembre/).

## Entregables (`out/`)

| Archivo | Uso |
|---|---|
| `magno-evento-invitacion-9x16.mp4` | Versión maestra 1080×1920, 30 fps, 31 s, con banda sonora y QR de boletos al final. Historias y Reels de Instagram/Facebook, TikTok, Shorts, LinkedIn. |
| `magno-evento-invitacion-9x16-sin-audio.mp4` | Igual, sin audio: para poner música de la biblioteca de Instagram/TikTok. |
| `magno-evento-invitacion-whatsapp.mp4` | 720×1280 ligera para enviar por WhatsApp o subir a Estados. |
| `portada.png` | Último cuadro (cierre con todos los datos) para portada de Reels o envío como imagen. |
| `banda-sonora.m4a` | Música original sintetizada (sin samples ni derechos de terceros), normalizada a -14 LUFS. |

## Guion (31 s, 120 BPM)

1. **0–3.5 s** — Globo de puntos dorado con el anillo de Black Ring; aparece el logotipo; el globo gira hasta Guadalajara y la cámara entra.
2. **3.5–8 s** — "te invita al" **MAGNO EVENTO EMPRESARIAL** (metal dorado/plateado con impacto), fecha y los anfitriones.
3. **8–13 s** — Lo que vivirás: networking de alto nivel, brunch y networking, expansión de negocios, negocios con Inteligencia Aplicada y más.
4. **13–17 s** — Patrocinadores (9 logotipos).
5. **17–21 s** — 13 de noviembre · 3:00–8:00 PM · Hotel Presidente InterContinental.
6. **21–26 s** — Cierre con todos los datos, botón "Compra tu boleto", sitio web y lema.
7. **26–31 s** — "COMPRA TU BOLETO" con el QR de compra quieto y sin efectos encima (para que escanee), URL y datos.

## Voz en off

Guion por frases y tiempos en `VOZ.md`. Pon los archivos en `assets/voz/01..08` y corre `python3 render/mix_voz.py`.

Los textos importantes quedan entre y = 230 y y = 1620 px, fuera de la zona que tapan los controles de Historias y Reels.

## Cómo editar

- **Textos, horario, patrocinadores y tiempos:** `js/config.js`.
- **Logotipos:** `assets/sponsors/` (PNG con fondo transparente). Hoy son recortes del flyer; para la versión final conviene
  reemplazarlos por los archivos originales de cada patrocinador **con el mismo nombre**.
- **Vista previa interactiva:** abre `index.html` en Chrome (botón ▶, barra para adelantar, barra espaciadora).
  Si existe `out/banda-sonora.m4a`, suena sincronizada.

## Cómo volver a generar el video

Requisitos: Node 18+, Playwright con Chromium, ffmpeg (libx264 + aac) y Python 3 con numpy.

```bash
npm install            # instala Playwright (o usa uno global)
bash render/build.sh   # anima, sintetiza la música, normaliza y genera los MP4 en out/
```

- `node render/render.mjs --scale 0.5 --frames 4,7.5,12 --dir out/cuadros` guarda cuadros sueltos para revisar diseño.
- `render/render.mjs` usa varios procesos de Chromium en paralelo (`--workers`) y codifica H.264 BT.709 con `--crf 17`.
- La animación es determinista: `seek(t)` en `js/motion.js` dibuja el instante exacto, por eso el render no depende de la velocidad de la máquina.

## Notas de producción

- Regla de marca: en copy para cliente se usa "Inteligencia Aplicada", nunca "IA"/"AI".
- El logo de BREADR en el flyer decía "AGEEƎE DE SEGUROS"; en el video se corrigió a "AGENTE DE SEGUROS S.A. DE C.V.".
  Confirmar con el patrocinador y, de preferencia, usar su archivo original.
- Anfitriones y sede son recortes del flyer (resolución baja de origen); con fotos originales el resultado mejora.
- Tipografías: Archivo, Montserrat y Cormorant Garamond (SIL Open Font License, licencias en `assets/fonts/`).
- Mapa del globo: Natural Earth vía `world-atlas` (dominio público).
