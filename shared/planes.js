// Planes y precios preliminares (Tabla 10 del informe).
// transmisionesMes: null significa ilimitado (con uso razonable).
export const PLANES = {
  gratis: {
    id: 'gratis',
    nombre: 'Gratis',
    precio: 0,
    transmisionesMes: 2,
    clipsPorTransmision: 5,
    clipsMes: 10,
    resolucion: 720,
    marcaAgua: true,
    incluye: [
      'Hasta 2 transmisiones al mes',
      '5 clips por transmisión en 720p',
      'Subtítulos en español',
      'Marca de agua “Hecho con Clipazo”',
    ],
  },
  creador: {
    id: 'creador',
    nombre: 'Creador',
    precio: 19.9,
    transmisionesMes: 10,
    clipsPorTransmision: 10,
    clipsMes: 60,
    resolucion: 1080,
    marcaAgua: false,
    incluye: [
      'Hasta 10 transmisiones al mes',
      '60 clips al mes en 1080p',
      'Sin marca de agua',
      'Subtítulos y estilos personalizables',
    ],
  },
  pro: {
    id: 'pro',
    nombre: 'Pro',
    precio: 39.9,
    transmisionesMes: null,
    clipsPorTransmision: 15,
    clipsMes: 200,
    resolucion: 1080,
    marcaAgua: false,
    incluye: [
      'Transmisiones ilimitadas (uso razonable)',
      '200 clips al mes en 1080p',
      'Publicación programada en redes',
      'Estadísticas de tus clips',
    ],
  },
};

export const CREDITOS = {
  id: 'creditos',
  nombre: 'Créditos extra',
  precio: 9.9,
  clips: 20,
};

export function formatearSoles(monto) {
  return 'S/ ' + monto.toFixed(2).replace('.', ',');
}
