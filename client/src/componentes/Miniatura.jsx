import { useEffect, useState } from 'react';
import { miniatura } from '../lib/miniaturas.js';
import { obtenerArchivo } from '../lib/videos.js';
import { hms } from '../util.js';

export default function Miniatura({ clip }) {
  const archivo = obtenerArchivo(clip.transmision_id);
  const [imagen, setImagen] = useState(null);

  useEffect(() => {
    let vigente = true;
    setImagen(null);
    if (archivo) {
      miniatura(archivo, clip.inicio_seg + clip.duracion_seg * 0.6, clip.formato, clip.camara)
        .then((url) => vigente && setImagen(url))
        .catch(() => {});
    }
    return () => {
      vigente = false;
    };
  }, [archivo, clip.inicio_seg, clip.duracion_seg, clip.formato, clip.camara]);

  return (
    <div className="miniatura">
      {imagen ? (
        <img src={imagen} alt="" />
      ) : (
        <div className="miniatura-vacia">
          <span>{clip.origen === 'ejemplo' ? 'Ejemplo' : archivo ? 'Cargando…' : 'Video no cargado'}</span>
        </div>
      )}
      <span className="miniatura-duracion">{Math.round(clip.duracion_seg)} s</span>
      <span className="miniatura-tiempo">{hms(clip.inicio_seg)}</span>
    </div>
  );
}
