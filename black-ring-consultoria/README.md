# Video promocional — Black Ring Business · Consultoría en Inteligencia Aplicada

Motion graphic vertical (9:16, 1080×1920, 30 fps, 30 s) hecho con [HyperFrames](https://hyperframes.heygen.com)
(HTML renderizado a video cuadro por cuadro) y música original sintetizada.

## Guion

| Tiempo | Escena |
|---|---|
| 0–4 s | Gancho: "¿Tu empresa decide con datos… o con intuición?" (la palabra DATOS se decodifica; INTUICIÓN hace glitch y se disuelve en partículas). |
| 4–8 s | Las partículas forman el anillo dorado alrededor del globo; arcos desde Guadalajara hacia USA y España; logo y "Consultoría en Inteligencia Aplicada para negocios". |
| 8–11 s | 01 · Dashboard interactivo: KPIs, gráfica que cambia al hacer clic, barras y meta. |
| 11–14 s | 02 · Creación de agentes: un agente conectado a ventas, atención, cobranza, agenda, reportes e inventario. |
| 14–17 s | 03 · Análisis de datos: los clientes se agrupan en segmentos y aparece el patrón de mayor valor. |
| 17–20 s | 04 · Toma de decisiones: tres escenarios evaluados, uno recomendado. |
| 20–24 s | 05 · Infraestructura cognitiva empresarial: capas de datos, modelos, agentes y decisiones con el anillo encima. |
| 24–30 s | Cierre: Dr. Ramón Maldonado, teléfono, web, botón "Agenda tu consultoría" y lema. |

Los números del dashboard, la segmentación y los escenarios son ilustrativos (marcados "DEMO").

## Archivos

- `out/black-ring-consultoria-9x16.mp4` — video final con audio.
- `out/black-ring-consultoria-whatsapp.mp4` — versión ligera 720×1280 para WhatsApp.
- `out/portada.png` — último cuadro (contacto completo), sirve de portada.
- `index.html` + `js/motion.js` — la composición; `js/config.js` — textos, teléfono, servicios y tiempos.
- `render/soundtrack.py` — genera la música (numpy); `assets/audio/banda-sonora.mp3` es la versión normalizada a -14 LUFS.

## Editar y volver a renderizar

```bash
# 1) Cambia textos o datos en js/config.js
# 2) (si cambiaste tiempos) regenera la música y normalízala
python3 render/soundtrack.py out/banda-sonora.wav
ffmpeg -y -i out/banda-sonora.wav -af loudnorm=I=-14:TP=-1.5 -c:a libmp3lame -b:a 320k assets/audio/banda-sonora.mp3
# 3) Vista previa en el navegador o render final
npx hyperframes@0.8.186 preview
npx hyperframes@0.8.186 render -o out/black-ring-consultoria-9x16.mp4 --quality delivery
```

HyperFrames necesita Chrome headless: `npx hyperframes browser ensure` lo descarga, o apunta
`PRODUCER_HEADLESS_SHELL_PATH` a uno ya instalado. `npx hyperframes check` valida la composición.

## Notas

- Regla de marca: en copy para cliente se usa "Inteligencia Aplicada", nunca "IA"/"AI".
- La animación es determinista: el runtime de HyperFrames emite `hf-seek` en cada cuadro y `seek(t)` dibuja ese instante.
- Tipografías Archivo, Montserrat y JetBrains Mono (SIL OFL, licencias en `assets/fonts/`); GSAP en `assets/vendor/`;
  mapa del globo de Natural Earth (dominio público).
