import { useEffect, useRef, useState } from 'react';
import {
  disposicion,
  dibujarCapas,
  dibujarFondoEjemplo,
  dibujarMarcaAgua,
  dibujarSubtitulo,
  fuentesListas,
  subtituloEn,
  tramosSubtitulos,
} from '../lib/lienzo.js';
import { urlDe } from '../lib/videos.js';
import { hms } from '../util.js';

const W = 360;
const H = 640;

// Vista previa del clip vertical: dibuja el video con la misma composición que el MP4 final.
export default function VistaClip({ clip, archivo, marcaAgua }) {
  const lienzo = useRef(null);
  const video = useRef(null);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [tiempo, setTiempo] = useState(0);
  const [, setFuentes] = useState(0);
  const config = useRef(clip);
  config.current = { ...clip, marcaAgua };

  useEffect(() => {
    fuentesListas().then(() => setFuentes((n) => n + 1));
  }, []);

  function dibujar(t) {
    const c = config.current;
    const ctx = lienzo.current?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const v = video.current;
    let ySub = H * 0.72;
    if (archivo && v && v.videoWidth) {
      const disp = disposicion(c.formato, c.camara, v.videoWidth, v.videoHeight, W, H);
      dibujarCapas(ctx, v, disp, W);
      ySub = disp.ySubtitulo;
    } else {
      dibujarFondoEjemplo(
        ctx, W, H, t + c.inicio_seg, c.id,
        c.origen === 'archivo' ? ['Video no cargado', 'Elige el video arriba para ver tu clip'] : undefined,
      );
    }
    dibujarSubtitulo(ctx, subtituloEn(tramosSubtitulos(c.subtitulos, c.duracion_seg), t), c.estilo, W, ySub);
    if (c.marcaAgua) dibujarMarcaAgua(ctx, W, H);
  }

  // Bucle de dibujo mientras se reproduce.
  useEffect(() => {
    if (!reproduciendo) return undefined;
    let id;
    const inicioReloj = performance.now() - tiempo * 1000;
    const paso = () => {
      const c = config.current;
      let t;
      if (archivo && video.current) {
        t = video.current.currentTime - c.inicio_seg;
        if (t >= c.duracion_seg || t < -0.5) {
          video.current.currentTime = c.inicio_seg;
          t = 0;
        }
      } else {
        t = ((performance.now() - inicioReloj) / 1000) % c.duracion_seg;
      }
      setTiempo(Math.max(0, t));
      dibujar(Math.max(0, t));
      id = requestAnimationFrame(paso);
    };
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reproduciendo, archivo]);

  // Al cambiar el recorte, volver al inicio del clip.
  useEffect(() => {
    setTiempo(0);
    if (archivo && video.current) {
      video.current.currentTime = clip.inicio_seg;
    } else {
      dibujar(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip.inicio_seg, archivo]);

  // Redibujar en pausa cuando cambian los estilos.
  useEffect(() => {
    if (!reproduciendo) dibujar(tiempo);
  });

  function alternar() {
    const v = video.current;
    if (reproduciendo) {
      v?.pause();
      setReproduciendo(false);
      return;
    }
    if (archivo && v) {
      if (v.currentTime < clip.inicio_seg || v.currentTime >= clip.inicio_seg + clip.duracion_seg) v.currentTime = clip.inicio_seg;
      v.play().catch(() => setReproduciendo(false));
    }
    setReproduciendo(true);
  }

  return (
    <div className="vista-clip">
      <div className="vista-telefono">
        <canvas ref={lienzo} width={W} height={H} onClick={alternar} />
        {!reproduciendo && (
          <button type="button" className="vista-play" onClick={alternar} aria-label="Reproducir vista previa">
            ▶
          </button>
        )}
      </div>
      {archivo && (
        <video
          ref={video}
          src={urlDe(archivo)}
          preload="auto"
          playsInline
          hidden
          onLoadedMetadata={(e) => {
            e.currentTarget.currentTime = config.current.inicio_seg;
          }}
          onSeeked={() => !reproduciendo && dibujar(tiempo)}
        />
      )}
      <div className="vista-controles">
        <button type="button" className="boton boton-chico" onClick={alternar}>
          {reproduciendo ? '❚❚ Pausa' : '▶ Reproducir'}
        </button>
        <span className="vista-tiempo">
          {hms(tiempo)} / {hms(clip.duracion_seg)}
        </span>
      </div>
    </div>
  );
}
