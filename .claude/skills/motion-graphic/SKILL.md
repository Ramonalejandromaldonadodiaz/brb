---
name: motion-graphic
description: Crear motion graphics / videos promocionales en MP4 (vertical 9:16 u otros) para Black Ring Business con HTML animado + HyperFrames y música original sintetizada. Úsalo cuando pidan un video, invitación animada, reel, motion graphic o "hyperframes".
---

# Método Black Ring para motion graphics

Dos proyectos de referencia en este repo, úsalos como plantilla (copia la carpeta y adapta):
- `black-ring-consultoria/` — HyperFrames, 30 s, servicios + contacto. **Plantilla principal.**
- `magno-evento-motion/` — invitación a evento, render propio con Playwright (`render/render.mjs`).

## Reglas de negocio (no negociables)
- Copy para cliente: "Inteligencia Aplicada" o "tecnología inteligente". Nunca "IA"/"AI". Si el usuario lo pide con "IA", usa la regla y avísale.
- No inventar datos: cifras de dashboards/escenarios son ilustrativas y se marcan "DEMO". Nada de "+X% de ventas", "gratis", "cupo limitado" sin confirmación.
- Señalar lo que requiere verificación: títulos (Dr./Mtro.), ®, si el teléfono es WhatsApp, canal de confirmación/registro, errores en logos de patrocinadores (revisa a zoom: el flyer del Magno Evento traía "AGEEƎE" en BREADR).
- Si el video no tiene llamado a la acción con canal concreto (WhatsApp, liga), dilo: sin eso genera vistas, no clientes.

## Arquitectura (la clave de la calidad)
1. **Todo es función del tiempo.** `seek(t)` deja la escena exacta en el segundo `t`. Nada de `requestAnimationFrame`, timers ni `Math.random()` sin semilla (usar `rng(seed)` mulberry32).
2. HTML 1080×1920 con capas: fondo → rejilla/globo (canvas) → escenas (DOM/SVG) → partículas (canvas) → HUD → flash/viñeta/grano.
3. Escenas con visibilidad por ventana de tiempo; helpers `P(t,t0,dur,ease)`, `kf()` para keyframes, `S(el,{x,y,s,o,blur,clip})`.
4. **HyperFrames:** `index.html` con `#root[data-composition-id="main" data-duration]`, `<audio id class="clip" data-start data-duration src>`, y un script inline que registra `window.__timelines["main"] = gsap.timeline({paused:true})` *después* de `window.READY` (fuentes cargadas). `window.addEventListener('hf-seek', e => seek(e.detail.time))`.
5. Tiempos clave en `js/config.js` (`cues`), compartidos con la música: el audio cae exactamente en cada impacto.

## Flujo de trabajo
1. **Brief:** formato (9:16 por defecto), duración (25–30 s), textos exactos, datos de contacto, logos/fotos. Revisa assets a zoom.
2. **Guion en rejilla de 120 BPM** (tiempo = 0.5 s, compás = 2 s): gancho 0–4 s (pregunta o golpe visual en el primer segundo), marca, 3–5 bloques de 3 s, cierre de 5–6 s con datos legibles.
3. **Assets:** recortes con PIL (Lanczos 2×), logos con fondo transparente por luma-key, fuentes OFL desde npm (`@fontsource*`), GSAP desde npm a `assets/vendor/` (los CDN pueden estar bloqueados por el proxy; npm sí funciona).
4. **Construir** copiando `black-ring-consultoria/` y cambiando `config.js` + escenas.
5. **Revisar cuadros, no suponer:** renderiza PNGs en tiempos clave (incluye transiciones) a 0.5× y arma hojas de contacto; luego cortes a resolución completa. Itera hasta que se vea bien.
6. **Música:** `render/soundtrack.py` (numpy, sin samples con derechos): pad + bajo + batería a 120 BPM + efectos sincronizados a `cues`. No se puede escuchar: valida con espectrograma, bandas y `ffmpeg ebur128`. Normaliza a -14 LUFS / -1.5 dBTP (loudnorm en dos pasadas) y exporta MP3 para la composición.
7. **Validar:** `npx hyperframes check .` — corrige errores reales (detectó un módulo negativo que rompía un cuadro); marca capas decorativas con `data-layout-ignore` y la viñeta con `data-layout-allow-occlusion`.
8. **Render:** `npx hyperframes render -o out/video-9x16.mp4 --quality delivery --fps 30 --workers 4` (~2.5 min para 30 s).
9. **QA del MP4:** extrae cuadros con ffmpeg y míralos; confirma 1080×1920, 30 fps, duración, audio -14 LUFS.
10. **Entregables:** MP4 principal, versión WhatsApp (`scale=720:1280`, CRF 22, < 16 MB), portada PNG (último cuadro). Commit + push; enviar archivos y links raw de GitHub.

## Entorno (contenedor en la nube)
- Chromium ya instalado: `export PRODUCER_HEADLESS_SHELL_PATH=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell` (no descargar Chrome). Playwright global sirve para cuadros de revisión.
- `npx hyperframes telemetry disable` antes de usarlo. `HYPERFRAMES_SKIP_SKILLS=1` en `init`.
- Chromium headless no reproduce AAC: el audio de la composición va en MP3/WAV.

## Diseño Black Ring
- Negro cálido + oro (#e2b54f, degradados metálicos), acento carmesí mínimo. Archivo 900 (títulos, `font-stretch` 100–125%), Montserrat (texto), JetBrains Mono (etiquetas técnicas), Cormorant itálica (acentos elegantes).
- Logo tipográfico "BLΛCK RING®" con la Λ dorada; anillo dorado y globo de puntos como motivo; lema "No seguimos el futuro, lo construimos."
- Texto de lectura ≥ 28 px; información clave entre y=230 y y=1620 (zonas que tapan Historias/Reels).
- Errores típicos: `background-clip:text` en un contenedor (mide el `span`, no el bloque), medir anchos con `offsetWidth` de elementos inline-block, usar `frac(x)` en vez de `x % 1` con valores que pueden ser negativos.
