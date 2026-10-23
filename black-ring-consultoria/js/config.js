// Textos, datos de contacto y tiempos del video. Edita aquí y vuelve a renderizar (ver README.md).
// Regla de marca: en copy para cliente se dice "Inteligencia Aplicada", nunca "IA"/"AI".
window.CONFIG = {
  fps: 30,
  duration: 30.0, // segundos

  gancho: ['¿TU EMPRESA', 'DECIDE CON', 'DATOS…', 'O CON', 'INTUICIÓN?'],

  marca: {
    sub1: 'CONSULTORÍA EN INTELIGENCIA APLICADA',
    sub2: 'PARA NEGOCIOS',
  },

  // Sede en Guadalajara y mercados donde opera Black Ring Business
  mercados: [
    { id: 'gdl', label: 'GDL · MX', lat: 20.6597, lon: -103.3496 },
    { id: 'usa', label: 'USA', lat: 39.5, lon: -98.35 },
    { id: 'esp', label: 'ESPAÑA', lat: 40.4168, lon: -3.7038 },
  ],

  servicios: [
    { t1: 'DASHBOARD', t2: 'INTERACTIVO', desc: 'Tu negocio completo en una sola pantalla.' },
    { t1: 'CREACIÓN', t2: 'DE AGENTES', desc: 'Agentes inteligentes que ejecutan tareas por ti.' },
    { t1: 'ANÁLISIS', t2: 'DE DATOS', desc: 'Patrones que no se ven a simple vista.' },
    { t1: 'TOMA DE', t2: 'DECISIONES', desc: 'Decide con evidencia, no con intuición.' },
    { t1: 'INFRAESTRUCTURA', t2: 'COGNITIVA', t3: 'EMPRESARIAL', desc: 'Datos, modelos y agentes como un solo sistema.' },
  ],

  capas: ['DATOS', 'MODELOS', 'AGENTES', 'DECISIONES'],

  contacto: {
    nombre: 'DR. RAMÓN MALDONADO',
    cargo: 'CEO & FUNDADOR',
    tel: '33 2215 0456',
    web: 'blackringbusiness.com',
    cta: 'AGENDA TU CONSULTORÍA',
  },
  lema: ['NO SEGUIMOS EL FUTURO,', 'LO CONSTRUIMOS.'],

  // Momentos clave en segundos (120 BPM: un tiempo = 0.5 s). render/soundtrack.py lee estos mismos valores.
  cues: {
    l1: 0.3, l2: 0.55, l3: 0.85, l4: 1.75, l5: 2.0, glitch: 2.3, scan: 2.8, morph: 3.0,
    s2: 4.0, ring: 4.3, arcs: 4.7, logo: 4.9, sub: 5.5, zoom: 7.55,
    svc1: 8.0, svc2: 11.0, svc3: 14.0, svc4: 17.0,
    infra: 20.0, slab0: 20.5, slabGap: 0.5, crown: 22.4,
    cta: 24.0, nombre: 24.6, tel: 25.2, web: 25.5, boton: 26.0, lema: 26.5,
    end: 30.0,
  },
};
