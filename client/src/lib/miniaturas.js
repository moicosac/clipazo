// Miniaturas de los clips: se toma un cuadro del video original y se compone en vertical.
import { disposicion, dibujarCapas } from './lienzo.js';
import { leerMetadatos, urlDe } from './videos.js';

const cache = new Map();
let cola = Promise.resolve();

function capturar(archivo, tiempo, formato, camara) {
  return new Promise((resolver, rechazar) => {
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'auto';
    video.src = urlDe(archivo);
    const fallo = () => rechazar(new Error('miniatura'));
    video.onerror = fallo;
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(tiempo, Math.max(0, video.duration - 0.1));
    };
    video.onseeked = () => {
      const W = 216;
      const H = 384;
      const lienzo = document.createElement('canvas');
      lienzo.width = W;
      lienzo.height = H;
      const ctx = lienzo.getContext('2d');
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      dibujarCapas(ctx, video, disposicion(formato, camara, video.videoWidth, video.videoHeight, W, H), W);
      resolver(lienzo.toDataURL('image/jpeg', 0.75));
      video.removeAttribute('src');
      video.load();
    };
    setTimeout(fallo, 15000);
  });
}

export function miniatura(archivo, tiempo, formato, camara) {
  const clave = `${archivo.name}:${archivo.size}:${tiempo}:${formato}:${camara}`;
  if (!cache.has(clave)) {
    const trabajo = cola.then(async () => {
      await leerMetadatos(archivo);
      return capturar(archivo, tiempo, formato, camara);
    });
    cola = trabajo.catch(() => {});
    cache.set(clave, trabajo);
    trabajo.catch(() => cache.delete(clave));
  }
  return cache.get(clave);
}
