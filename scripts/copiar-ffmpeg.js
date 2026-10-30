// Copia el núcleo de ffmpeg.wasm a client/public/ffmpeg para servirlo desde nuestro propio dominio.
import fs from 'node:fs';
import path from 'node:path';

const raiz = path.resolve(import.meta.dirname, '..');
const origen = path.join(raiz, 'node_modules/@ffmpeg/core/dist/esm');
const destino = path.join(raiz, 'client/public/ffmpeg');

fs.mkdirSync(destino, { recursive: true });
for (const archivo of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) {
  const a = path.join(origen, archivo);
  const b = path.join(destino, archivo);
  if (!fs.existsSync(b) || fs.statSync(a).size !== fs.statSync(b).size) fs.copyFileSync(a, b);
}
console.log('ffmpeg.wasm listo en client/public/ffmpeg');
