import { useState } from 'react';
import { guardarArchivo } from '../lib/videos.js';
import { bytes } from '../util.js';

// Cuando se recarga la página, el video ya no está en memoria: se pide volver a elegirlo.
export default function SelectorArchivo({ transmision, onListo }) {
  const [aviso, setAviso] = useState('');

  function elegir(e) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    const coincide = archivo.name === transmision.archivo_nombre && (!transmision.archivo_tamano || archivo.size === transmision.archivo_tamano);
    if (!coincide) {
      setAviso(`Ojo: elegiste “${archivo.name}”, pero esta transmisión se analizó con “${transmision.archivo_nombre}”. Los clips pueden no coincidir.`);
    }
    guardarArchivo(transmision.id, archivo);
    onListo?.(archivo);
  }

  return (
    <div className="aviso aviso-info selector-archivo">
      <div>
        <strong>Vuelve a elegir el video de esta transmisión</strong>
        <p>
          Por privacidad, tus videos nunca se suben a internet: se quedan en tu computadora. Al recargar la página hay que volver a
          elegir <em>{transmision.archivo_nombre}</em> {transmision.archivo_tamano ? `(${bytes(transmision.archivo_tamano)})` : ''}.
        </p>
        {aviso && <p className="texto-alerta">{aviso}</p>}
      </div>
      <label className="boton boton-secundario">
        Elegir video
        <input type="file" accept="video/*" hidden onChange={elegir} />
      </label>
    </div>
  );
}
