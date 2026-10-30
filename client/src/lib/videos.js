// Los videos nunca salen de la computadora del usuario.
// El archivo original se guarda en memoria mientras la pestaña esté abierta;
// los clips generados (MP4) se guardan en IndexedDB para poder descargarlos después.

const archivos = new Map(); // transmisionId -> File
const chats = new Map(); // transmisionId -> texto del chat
const metadatos = new Map(); // File -> { duracion, ancho, alto }
const urls = new Map(); // File -> object URL

export function guardarArchivo(transmisionId, archivo) {
  archivos.set(Number(transmisionId), archivo);
}

export function obtenerArchivo(transmisionId) {
  return archivos.get(Number(transmisionId)) ?? null;
}

export function guardarChat(transmisionId, texto) {
  chats.set(Number(transmisionId), texto);
}

export function obtenerChat(transmisionId) {
  return chats.get(Number(transmisionId)) ?? null;
}

export function urlDe(archivo) {
  if (!urls.has(archivo)) urls.set(archivo, URL.createObjectURL(archivo));
  return urls.get(archivo);
}

export function leerMetadatos(archivo) {
  if (metadatos.has(archivo)) return Promise.resolve(metadatos.get(archivo));
  return new Promise((resolver, rechazar) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => {
      const datos = { duracion: video.duration, ancho: video.videoWidth, alto: video.videoHeight };
      if (!Number.isFinite(datos.duracion) || !datos.ancho) {
        rechazar(new Error('No pudimos leer este video. Prueba con un archivo MP4, MOV o WEBM.'));
        return;
      }
      metadatos.set(archivo, datos);
      resolver(datos);
    };
    video.onerror = () => rechazar(new Error('Tu navegador no puede abrir este video. Prueba con un archivo MP4 (H.264).'));
    video.src = urlDe(archivo);
  });
}

// ---------- IndexedDB para los MP4 generados ----------

function abrirBase() {
  return new Promise((resolver, rechazar) => {
    const pedido = indexedDB.open('clipazo', 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore('mp4');
    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => rechazar(pedido.error);
  });
}

export async function guardarMp4(clipId, firma, blob) {
  try {
    const db = await abrirBase();
    await new Promise((resolver, rechazar) => {
      const tx = db.transaction('mp4', 'readwrite');
      tx.objectStore('mp4').put({ firma, blob }, Number(clipId));
      tx.oncomplete = resolver;
      tx.onerror = () => rechazar(tx.error);
    });
  } catch {
    // Si el navegador no permite guardar, el MP4 igual se puede descargar en esta sesión.
  }
}

export async function obtenerMp4(clipId) {
  try {
    const db = await abrirBase();
    return await new Promise((resolver, rechazar) => {
      const pedido = db.transaction('mp4').objectStore('mp4').get(Number(clipId));
      pedido.onsuccess = () => resolver(pedido.result ?? null);
      pedido.onerror = () => rechazar(pedido.error);
    });
  } catch {
    return null;
  }
}

export function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function nombreArchivoClip(clip) {
  const base = clip.titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `clipazo-${base || clip.id}.mp4`;
}
