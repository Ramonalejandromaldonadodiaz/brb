// Textos, patrocinadores y tiempos de la invitación animada.
// Para cambiar un dato: edítalo aquí y vuelve a renderizar (ver README.md).
window.CONFIG = {
  fps: 30,
  duration: 31.0, // segundos

  evento: {
    invita: 'te invita al',
    titulo1: 'MAGNO',
    titulo2: 'EVENTO',
    titulo3: 'EMPRESARIAL',
    fechaLinea: '13 DE NOVIEMBRE',
    ciudad: 'GUADALAJARA',
    dia: '13',
    mes: 'NOVIEMBRE',
    horario: '3:00 PM – 8:00 PM',
    sede: 'HOTEL PRESIDENTE INTERCONTINENTAL',
    sedeCiudad: 'GUADALAJARA',
  },

  // Regla de marca: en copy para cliente se usa "Inteligencia Aplicada", nunca "IA"/"AI".
  pilares: [
    { l1: 'NETWORKING', l2: 'DE ALTO NIVEL', icono: 'red' },
    { l1: 'BRUNCH Y', l2: 'NETWORKING', icono: 'cafe' },
    { l1: 'EXPANSIÓN', l2: 'DE NEGOCIOS', icono: 'crecimiento' },
    { l1: 'NEGOCIOS CON', l2: 'INTELIGENCIA APLICADA', icono: 'chip' },
    { l1: 'Y MÁS', l2: '', icono: 'mas' },
  ],

  // Logos recortados del flyer. Para la versión final, reemplazar por los
  // archivos originales de cada patrocinador (mismo nombre de archivo).
  patrocinadores: [
    { nombre: 'Black Ring Business', logo: 'assets/sponsors/01-black-ring-business.png' },
    { nombre: 'Todo en Vending', logo: 'assets/sponsors/02-todo-en-vending.png' },
    { nombre: 'hola Fer', logo: 'assets/sponsors/03-hola-fer.png' },
    { nombre: 'Espíritu Millonario', logo: 'assets/sponsors/04-espiritu-millonario.png' },
    { nombre: 'BREADR Agente de Seguros', logo: 'assets/sponsors/05-breadr.png' },
    { nombre: 'Bistro La Bastille', logo: 'assets/sponsors/06-bistro-la-bastille.png' },
    { nombre: 'Global AJR', logo: 'assets/sponsors/07-global-ajr.png' },
    { nombre: 'Siete Impactos', logo: 'assets/sponsors/08-siete-impactos.png' },
    { nombre: 'ACH de México', logo: 'assets/sponsors/09-ach-de-mexico.png' },
  ],

  cta: 'COMPRA TU BOLETO',

  // Pantalla final con el QR de compra (la imagen es el QR original; no regenerarlo)
  boletos: {
    titulo1: 'COMPRA',
    titulo2: 'TU BOLETO',
    sub: 'Escanea el código o entra a',
    url: 'blackringbusiness.com/evento-13-noviembre',
    qr: 'assets/qr-evento.png',
    info: '13 NOV · 3:00–8:00 PM · PRESIDENTE INTERCONTINENTAL GDL',
  },
  web: 'blackringbusiness.com',
  lema: ['NO SEGUIMOS EL FUTURO,', 'LO CONSTRUIMOS.'],

  // Momentos clave (segundos). La banda sonora (render/soundtrack.py) lee estos mismos valores.
  cues: {
    ringStart: 0.3, ringClose: 1.5, logoIn: 1.4, logoOut: 2.7, marker: 2.45, zoom: 3.1,
    s2: 3.5, invita: 3.55, magno: 4.0, evento: 4.5, box: 5.0, fecha: 5.5, hosts: 6.0, glint: 6.6,
    wipe1: 8.0, header3: 8.35, row0: 9.0, rowGap: 0.5, sweep3: 12.0,
    wipe2: 13.0, header4: 13.35, cards: 13.75, sweep4: 15.6,
    iris: 17.0, photo5: 16.9, dia: 18.0, mes: 18.3, hora: 19.0, sede: 19.5,
    out5: 21.0, s5b: 21.3, cta: 22.5, web: 22.9, lema: 23.3, glint5: 24.0,
    qr: 26.0, qrCard: 26.35, qrUrl: 27.0,
    end: 31.0,
  },
};
