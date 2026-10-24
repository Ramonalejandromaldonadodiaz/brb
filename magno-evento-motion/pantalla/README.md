# Pantalla 640×1120 — Magno Evento Empresarial

Pieza para pantalla vertical (formato 7×4, 640×1120 px): logo, sede, MAGNO EVENTO EMPRESARIAL, fecha, "Compra tu boleto",
el QR original de compra (`../assets/qr-evento.png`, abre https://blackringbusiness.com/evento-13-noviembre/),
URL y teléfono de informes.

## Entregables (`out/`)

| Archivo | Uso |
|---|---|
| `magno-pantalla-640x1120.png` | Imagen exacta 640×1120 (sin pérdida). |
| `magno-pantalla-640x1120.jpg` | La misma en JPG calidad 95, para plataformas que solo aceptan JPG. |
| `magno-pantalla-1280x2240-hd.png` | Doble resolución, para impresión o pantallas de alta densidad. |
| `magno-pantalla-640x1120-30fps.mp4` | Video en bucle de 10 s a 30 fps, H.264, sin audio. El QR queda quieto todo el tiempo. |

El QR se verificó decodificándolo desde la PNG, la JPG y cuadros del MP4.

## Cómo regenerar

`index.html` se dibuja con fuentes y fotos de `../assets/`. `seek(t)` fija la animación en el segundo `t` (bucle de 10 s);
las imágenes fijas se toman con el navegador a 640×1120 y escala 2×, reducidas con Lanczos a 640×1120.
