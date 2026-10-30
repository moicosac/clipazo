// Composición del clip vertical (9:16). La misma geometría se usa para la vista previa
// en <canvas> y para el filtro de FFmpeg que genera el MP4, así lo que ves es lo que se exporta.

export const FORMATOS = {
  desenfocado: { nombre: 'Fondo desenfocado', detalle: 'El video completo al centro, con fondo difuminado' },
  centrado: { nombre: 'Recorte al centro', detalle: 'Acerca la imagen y llena toda la pantalla' },
  camara: { nombre: 'Cámara + juego', detalle: 'Tu cámara arriba y el juego abajo' },
};

export const CAMARAS = {
  'sup-izq': 'Arriba a la izquierda',
  'sup-der': 'Arriba a la derecha',
  'inf-izq': 'Abajo a la izquierda',
  'inf-der': 'Abajo a la derecha',
};

export const ESTILOS = {
  clasico: { nombre: 'Clásico' },
  amarillo: { nombre: 'Amarillo' },
  caja: { nombre: 'Caja' },
};

export const TAMANO_CAMARA = 0.3; // fracción del ancho y alto del video que ocupa la cámara del streamer

export function dimensiones(resolucion) {
  return resolucion >= 1080 ? { W: 1080, H: 1920 } : { W: 720, H: 1280 };
}

const par = (n) => Math.max(2, Math.round(n / 2) * 2);

// Devuelve las capas a dibujar (recorte de origen → destino) y la altura donde van los subtítulos.
export function disposicion(formato, camara, vw, vh, W, H) {
  if (formato === 'centrado') {
    const sw = Math.min(vw, (vh * W) / H);
    return {
      capas: [{ sx: (vw - sw) / 2, sy: 0, sw, sh: vh, dx: 0, dy: 0, dw: W, dh: H }],
      ySubtitulo: H * 0.7,
    };
  }
  if (formato === 'camara') {
    const cw = vw * TAMANO_CAMARA;
    const ch = vh * TAMANO_CAMARA;
    const cx = camara?.endsWith('izq') ? 0 : vw - cw;
    const cy = camara?.startsWith('inf') ? vh - ch : 0;
    const hc = par((W * ch) / cw);
    const hj = H - hc;
    const jw = Math.min(vw, (vh * W) / hj);
    return {
      capas: [
        { sx: cx, sy: cy, sw: cw, sh: ch, dx: 0, dy: 0, dw: W, dh: hc },
        { sx: (vw - jw) / 2, sy: 0, sw: jw, sh: vh, dx: 0, dy: hc, dw: W, dh: hj },
      ],
      ySubtitulo: hc + H * 0.05,
    };
  }
  // desenfocado
  const sw = Math.min(vw, (vh * W) / H);
  const dh = par((W * vh) / vw);
  return {
    capas: [
      { sx: (vw - sw) / 2, sy: 0, sw, sh: vh, dx: 0, dy: 0, dw: W, dh: H, desenfoque: true },
      { sx: 0, sy: 0, sw: vw, sh: vh, dx: 0, dy: (H - dh) / 2, dw: W, dh },
    ],
    ySubtitulo: Math.min(H * 0.8, (H + dh) / 2 + H * 0.07),
  };
}

export function dibujarCapas(ctx, fuente, disp, W) {
  for (const c of disp.capas) {
    if (c.desenfoque) {
      ctx.save();
      ctx.filter = `blur(${Math.round(W / 40)}px) brightness(0.7)`;
      ctx.drawImage(fuente, c.sx, c.sy, c.sw, c.sh, c.dx - W * 0.05, c.dy - W * 0.05, c.dw + W * 0.1, c.dh + W * 0.1);
      ctx.restore();
    } else {
      ctx.drawImage(fuente, c.sx, c.sy, c.sw, c.sh, c.dx, c.dy, c.dw, c.dh);
    }
  }
}

function partirEnLineas(ctx, texto, anchoMax) {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const lineas = [];
  let actual = '';
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (ctx.measureText(prueba).width > anchoMax && actual) {
      lineas.push(actual);
      actual = p;
    } else {
      actual = prueba;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

export function dibujarSubtitulo(ctx, texto, estilo, W, y) {
  if (!texto?.trim()) return;
  const tamano = Math.round(W * 0.078);
  ctx.save();
  ctx.font = `${tamano}px Anton, Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const lineas = partirEnLineas(ctx, texto.toUpperCase(), W * 0.84);
  const alto = tamano * 1.18;
  const inicio = y - ((lineas.length - 1) * alto) / 2;
  lineas.forEach((linea, i) => {
    const ly = inicio + i * alto;
    if (estilo === 'caja') {
      const ancho = ctx.measureText(linea).width + tamano * 0.6;
      ctx.fillStyle = 'rgba(0,0,0,0.78)';
      const r = tamano * 0.18;
      ctx.beginPath();
      ctx.roundRect(W / 2 - ancho / 2, ly - alto / 2, ancho, alto, r);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(linea, W / 2, ly);
    } else {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = tamano * 0.16;
      ctx.strokeText(linea, W / 2, ly);
      ctx.fillStyle = estilo === 'amarillo' ? '#ffe14d' : '#ffffff';
      ctx.fillText(linea, W / 2, ly);
    }
  });
  ctx.restore();
}

export function dibujarMarcaAgua(ctx, W, H) {
  const tamano = Math.round(W * 0.034);
  ctx.save();
  ctx.font = `600 ${tamano}px Inter, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = tamano * 0.4;
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.fillText('▶ Hecho con Clipazo', W / 2, H - tamano * 2.2);
  ctx.restore();
}

// Reparte las líneas de subtítulo en partes iguales a lo largo del clip.
export function tramosSubtitulos(subtitulos, duracion) {
  const lineas = (subtitulos || []).filter((s) => s.trim());
  return lineas.map((texto, i) => ({
    texto,
    desde: (i * duracion) / lineas.length,
    hasta: ((i + 1) * duracion) / lineas.length,
  }));
}

export function subtituloEn(tramos, t) {
  return tramos.find((s) => t >= s.desde && t < s.hasta)?.texto ?? tramos.at(-1)?.texto ?? '';
}

// Para el plan gratuito y los videos sin imagen (transmisiones de ejemplo) se dibuja un fondo de muestra.
export function dibujarFondoEjemplo(ctx, W, H, t, semilla = 1, textos = ['Transmisión de ejemplo', 'Sube tu propio video para ver tu clip aquí']) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#24123f');
  g.addColorStop(1, '#0c2a3a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  for (let i = 0; i < 7; i++) {
    const x = ((Math.sin(t * 0.6 + i * 1.7 + semilla) + 1) / 2) * W;
    const y = ((Math.cos(t * 0.4 + i * 2.3 + semilla) + 1) / 2) * H;
    ctx.fillStyle = i % 2 ? 'rgba(139,92,246,0.25)' : 'rgba(196,244,66,0.18)';
    ctx.beginPath();
    ctx.arc(x, y, W * (0.08 + (i % 3) * 0.05), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `600 ${Math.round(W * 0.04)}px Inter, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(textos[0], W / 2, H * 0.12);
  ctx.font = `${Math.round(W * 0.032)}px Inter, Arial, sans-serif`;
  ctx.fillText(textos[1], W / 2, H * 0.12 + W * 0.06);
  ctx.restore();
}

export async function fuentesListas() {
  try {
    await Promise.all([document.fonts.load('64px Anton'), document.fonts.load('600 32px Inter')]);
  } catch {
    // Si las fuentes no cargan se usan las del sistema.
  }
}

// Imagen PNG transparente del tamaño del clip con un texto (subtítulo o marca de agua).
export async function imagenSuperpuesta(W, H, dibujar) {
  const lienzo = document.createElement('canvas');
  lienzo.width = W;
  lienzo.height = H;
  dibujar(lienzo.getContext('2d'));
  const blob = await new Promise((r) => lienzo.toBlob(r, 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}
