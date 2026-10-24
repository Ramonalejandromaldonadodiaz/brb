# Voz en off — Magno Evento Empresarial (31 s)

Una frase = un archivo. Guárdalos en `assets/voz/` con estos nombres (MP3, WAV o M4A).
Cada frase debe caber en su ventana; el mezclador avisa si alguna se pasa.

| Archivo | Entra en | Ventana | Texto |
|---|---|---|---|
| `01` | 0.4 s | 2.9 s | Black Ring Business Network te invita… |
| `02` | 3.5 s | 2.0 s | …al Magno Evento Empresarial. |
| `03` | 5.7 s | 2.2 s | Una tarde con empresarios que construyen. |
| `04` | 8.6 s | 4.3 s | Networking de alto nivel, expansión de negocios e Inteligencia Aplicada. |
| `05` | 13.4 s | 3.4 s | Con el respaldo de nuestros patrocinadores. |
| `06` | 17.5 s | 3.7 s | Trece de noviembre. Hotel Presidente InterContinental, Guadalajara. |
| `07` | 21.6 s | 4.0 s | No seguimos el futuro… lo construimos. |
| `08` | 26.3 s | 4.4 s | Compra tu boleto ya: escanea el código en pantalla. |

Tono: seguro, cálido, ritmo de anuncio premium (no locutor de radio). Pausa natural en los puntos suspensivos.

**ElevenLabs:** con tu voz clonada, modelo multilingüe, Stability ~45 %, Similarity ~80 %, Style bajo.
Genera cada frase por separado y descárgala con el número de archivo.

**Grabado en celular:** cuarto pequeño con cortinas o ropa, celular a 20 cm, sin música de fondo.
Graba cada frase dos veces y quédate con la mejor.

Mezcla: `python3 render/mix_voz.py` (baja la música bajo tu voz, normaliza a -14 LUFS y genera los MP4 con voz).
