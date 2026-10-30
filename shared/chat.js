// Lectura de registros de chat exportados.
// Acepta:
//  - JSON de TwitchDownloader / Kick (comments[].content_offset_seconds u objetos con offset/segundos)
//  - Texto con marcas de tiempo por línea: "[01:23:45] usuario: mensaje", "1:23:45 usuario: ...", "[12:05] ..."
// Devuelve los segundos (desde el inicio de la transmisión) de cada mensaje.

const CLAVES_OFFSET = ['content_offset_seconds', 'offset_seconds', 'offset', 'segundos', 'seconds', 'tiempo', 'time'];

function desdeJSON(datos) {
  const lista = Array.isArray(datos) ? datos : datos.comments || datos.messages || datos.mensajes || [];
  const tiempos = [];
  for (const m of lista) {
    if (typeof m === 'number') {
      tiempos.push(m);
      continue;
    }
    for (const clave of CLAVES_OFFSET) {
      const v = m?.[clave];
      if (typeof v === 'number') {
        tiempos.push(v);
        break;
      }
      if (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v)) {
        tiempos.push(Number(v));
        break;
      }
    }
  }
  return tiempos;
}

const HMS = /(?:^|[\[\s(])(\d{1,2}):(\d{2}):(\d{2})(?:[.,]\d+)?/;
const MS = /^\s*\[?(\d{1,3}):(\d{2})\]?\s/;

function desdeTexto(texto) {
  const tiempos = [];
  for (const linea of texto.split(/\r?\n/)) {
    let m = linea.match(HMS);
    if (m) {
      tiempos.push(Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]));
      continue;
    }
    m = linea.match(MS);
    if (m) tiempos.push(Number(m[1]) * 60 + Number(m[2]));
  }
  if (tiempos.length === 0) return tiempos;
  // Si son horas del reloj (por ejemplo 21:03:15), se cuentan desde el primer mensaje.
  const primero = Math.min(...tiempos);
  if (primero > 3600) return tiempos.map((t) => (t < primero ? t + 86400 : t) - primero);
  return tiempos;
}

export function leerChat(texto) {
  const limpio = texto.trim();
  if (limpio.startsWith('{') || limpio.startsWith('[')) {
    try {
      const tiempos = desdeJSON(JSON.parse(limpio));
      if (tiempos.length) return tiempos;
    } catch {
      // No era JSON válido: se intenta como texto.
    }
  }
  return desdeTexto(limpio);
}
