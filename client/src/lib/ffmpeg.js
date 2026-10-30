// Procesamiento de video en el navegador con FFmpeg compilado a WebAssembly.
// El archivo se monta con WORKERFS: FFmpeg lo lee directamente del disco del usuario, sin copiarlo a memoria.
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import {
  dimensiones,
  disposicion,
  dibujarMarcaAgua,
  dibujarSubtitulo,
  fuentesListas,
  imagenSuperpuesta,
  tramosSubtitulos,
} from './lienzo.js';

let instancia = null;
let cargando = null;
let cola = Promise.resolve();

export function cargarFFmpeg() {
  if (instancia) return Promise.resolve(instancia);
  if (!cargando) {
    cargando = (async () => {
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: await toBlobURL('/ffmpeg/ffmpeg-core.js', 'text/javascript'),
        wasmURL: await toBlobURL('/ffmpeg/ffmpeg-core.wasm', 'application/wasm'),
      });
      instancia = ffmpeg;
      return ffmpeg;
    })().catch((e) => {
      cargando = null;
      throw new Error('No se pudo cargar el motor de video. Revisa tu conexión y vuelve a intentarlo.', { cause: e });
    });
  }
  return cargando;
}

// FFmpeg procesa un trabajo a la vez: los pedidos se encolan.
function enCola(trabajo) {
  const resultado = cola.then(trabajo, trabajo);
  cola = resultado.catch(() => {});
  return resultado;
}

const RE_TIEMPO = /time=\s*(\d+):(\d+):(\d+(?:\.\d+)?)/;

async function ejecutar(ffmpeg, args, duracion, alProgreso) {
  const ultimas = [];
  const alLog = ({ message }) => {
    ultimas.push(message);
    if (ultimas.length > 30) ultimas.shift();
    const m = message.match(RE_TIEMPO);
    if (m && duracion > 0 && alProgreso) {
      const t = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
      alProgreso(Math.min(1, t / duracion));
    }
  };
  ffmpeg.on('log', alLog);
  try {
    const codigo = await ffmpeg.exec(args);
    return { codigo, log: ultimas.join('\n') };
  } finally {
    ffmpeg.off('log', alLog);
  }
}

async function montar(ffmpeg, archivo) {
  const carpeta = `/entrada${Date.now()}`;
  await ffmpeg.createDir(carpeta);
  await ffmpeg.mount('WORKERFS', { files: [archivo] }, carpeta);
  return {
    ruta: `${carpeta}/${archivo.name}`,
    desmontar: async () => {
      await ffmpeg.unmount(carpeta).catch(() => {});
      await ffmpeg.deleteDir(carpeta).catch(() => {});
    },
  };
}

// Mide el volumen de la voz segundo a segundo (RMS en dB) y lo devuelve en escala 0–1.
export function analizarAudio(archivo, duracion, alProgreso) {
  return enCola(async () => {
    const ffmpeg = await cargarFFmpeg();
    const { ruta, desmontar } = await montar(ffmpeg, archivo);
    try {
      const filtro =
        'aresample=8000,asetnsamples=n=8000:p=0,astats=metadata=1:reset=1,' +
        'ametadata=mode=print:key=lavfi.astats.Overall.RMS_level:file=/volumen.txt';
      const { codigo, log } = await ejecutar(ffmpeg, ['-i', ruta, '-vn', '-sn', '-dn', '-af', filtro, '-f', 'null', '-'], duracion, alProgreso);
      let texto = '';
      try {
        texto = await ffmpeg.readFile('/volumen.txt', 'utf8');
        await ffmpeg.deleteFile('/volumen.txt');
      } catch {
        // Sin archivo de salida: el video no tiene audio.
      }
      const valores = [];
      for (const linea of texto.split('\n')) {
        const m = linea.match(/RMS_level=(-?[\d.]+|-?inf)/);
        if (!m) continue;
        const db = m[1].includes('inf') ? -90 : Number(m[1]);
        valores.push(Math.min(1, Math.max(0, (db + 60) / 60)));
      }
      if (!valores.length) {
        if (codigo !== 0 && !/does not contain any stream|Output file .* does not contain/i.test(log)) {
          throw new Error('No pudimos leer el audio de este video.');
        }
        return null;
      }
      return valores;
    } finally {
      await desmontar();
    }
  });
}

const r = (n) => Math.round(n);
const par = (n) => Math.max(2, Math.round(n / 2) * 2);

function grafoVideo(disp, W, H) {
  const [a, b] = disp.capas;
  const recorte = (c) => `crop=${par(c.sw)}:${par(c.sh)}:${r(c.sx)}:${r(c.sy)}`;
  if (disp.capas.length === 1) {
    return `[0:v]${recorte(a)},scale=${W}:${H},setsar=1[base]`;
  }
  if (a.desenfoque) {
    return (
      `[0:v]split=2[f][v];` +
      `[f]${recorte(a)},scale=${par(W / 8)}:${par(H / 8)},boxblur=6:2,scale=${W}:${H},` +
      `colorchannelmixer=rr=0.7:gg=0.7:bb=0.7,setsar=1[fondo];` +
      `[v]scale=${W}:${par(b.dh)},setsar=1[frente];` +
      `[fondo][frente]overlay=0:${r(b.dy)}[base]`
    );
  }
  return (
    `[0:v]split=2[c][j];` +
    `[c]${recorte(a)},scale=${W}:${par(a.dh)},setsar=1[cam];` +
    `[j]${recorte(b)},scale=${W}:${par(b.dh)},setsar=1[juego];` +
    `[cam][juego]vstack=inputs=2[base]`
  );
}

// Genera el MP4 vertical con subtítulos (y marca de agua en el plan gratuito).
export function generarClip({ archivo, meta, clip, resolucion, marcaAgua }, alProgreso) {
  return enCola(async () => {
    const ffmpeg = await cargarFFmpeg();
    await fuentesListas();
    const { W, H } = dimensiones(resolucion);
    const disp = disposicion(clip.formato, clip.camara, meta.ancho, meta.alto, W, H);
    const duracion = clip.duracion_seg;

    const capas = [];
    for (const [i, tramo] of tramosSubtitulos(clip.subtitulos, duracion).entries()) {
      const nombre = `/sub${i}.png`;
      await ffmpeg.writeFile(nombre, await imagenSuperpuesta(W, H, (ctx) => dibujarSubtitulo(ctx, tramo.texto, clip.estilo, W, disp.ySubtitulo)));
      capas.push({ nombre, desde: tramo.desde, hasta: tramo.hasta });
    }
    if (marcaAgua) {
      await ffmpeg.writeFile('/marca.png', await imagenSuperpuesta(W, H, (ctx) => dibujarMarcaAgua(ctx, W, H)));
      capas.push({ nombre: '/marca.png' });
    }

    let grafo = grafoVideo(disp, W, H);
    let anterior = 'base';
    capas.forEach((capa, i) => {
      const siguiente = `v${i}`;
      const activo = capa.desde !== undefined ? `:enable='between(t,${capa.desde.toFixed(2)},${capa.hasta.toFixed(2)})'` : '';
      grafo += `;[${anterior}][${i + 1}:v]overlay=0:0${activo}[${siguiente}]`;
      anterior = siguiente;
    });

    const { ruta, desmontar } = await montar(ffmpeg, archivo);
    try {
      const args = [
        '-ss', clip.inicio_seg.toFixed(2),
        '-t', duracion.toFixed(2),
        '-i', ruta,
        ...capas.flatMap((c) => ['-i', c.nombre]),
        '-filter_complex', grafo,
        '-map', `[${anterior}]`,
        '-map', '0:a?',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '26', '-pix_fmt', 'yuv420p', '-r', '30',
        '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart',
        '/salida.mp4',
      ];
      const { codigo, log } = await ejecutar(ffmpeg, args, duracion, alProgreso);
      if (codigo !== 0) {
        console.error(log);
        throw new Error('No se pudo generar el clip. Revisa que el video se pueda reproducir y vuelve a intentarlo.');
      }
      const datos = await ffmpeg.readFile('/salida.mp4');
      await ffmpeg.deleteFile('/salida.mp4');
      return new Blob([datos], { type: 'video/mp4' });
    } finally {
      await desmontar();
      for (const c of capas) await ffmpeg.deleteFile(c.nombre).catch(() => {});
    }
  });
}

// Huella de la configuración del clip: si cambia, hay que volver a generar el MP4.
export function firmaClip(clip, resolucion, marcaAgua) {
  return JSON.stringify([clip.inicio_seg, clip.duracion_seg, clip.subtitulos, clip.estilo, clip.formato, clip.camara, resolucion, marcaAgua]);
}
