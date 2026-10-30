import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, registrarEvento } from '../api.js';
import { useSesion } from '../sesion.jsx';
import VistaClip from '../componentes/VistaClip.jsx';
import SelectorArchivo from '../componentes/SelectorArchivo.jsx';
import { CAMARAS, ESTILOS, FORMATOS } from '../lib/lienzo.js';
import { firmaClip, generarClip } from '../lib/ffmpeg.js';
import { descargar, guardarMp4, leerMetadatos, nombreArchivoClip, obtenerArchivo, obtenerMp4 } from '../lib/videos.js';
import { ESTADOS_CLIP, REDES, hms } from '../util.js';

const CAMPOS = ['titulo', 'inicio_seg', 'duracion_seg', 'subtitulos', 'estilo', 'formato', 'camara'];

function mananaALas7() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(19, 0, 0, 0);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export default function Editor() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { plan } = useSesion();
  const [original, setOriginal] = useState(null);
  const [clip, setClip] = useState(null);
  const [textoSubs, setTextoSubs] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [mp4, setMp4] = useState(null); // { firma, blob }
  const [generando, setGenerando] = useState(null); // progreso 0–1
  const [redes, setRedes] = useState(['tiktok']);
  const [cuando, setCuando] = useState(mananaALas7);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  useEffect(() => {
    api(`/clips/${id}`)
      .then((c) => {
        setOriginal(c);
        setClip(c);
        setTextoSubs(c.subtitulos.join('\n'));
        setArchivo(obtenerArchivo(c.transmision_id));
        if (c.publicaciones.length) setRedes(c.publicaciones.map((p) => p.red));
      })
      .catch((e) => setMensaje({ tipo: 'error', texto: e.message }));
    obtenerMp4(id).then(setMp4);
  }, [id]);

  if (!clip) return <div className="cargando-pagina">{mensaje?.texto || 'Cargando…'}</div>;

  const cambiar = (campo, valor) => setClip((c) => ({ ...c, [campo]: valor }));
  const sinGuardar = CAMPOS.some((k) => JSON.stringify(clip[k]) !== JSON.stringify(original[k]));
  const firma = firmaClip(clip, plan.resolucion, plan.marcaAgua);
  const mp4Vigente = mp4 && mp4.firma === firma;
  const total = clip.transmision_duracion;
  const minInicio = Math.max(0, Math.floor(original.inicio_seg - 120));
  const maxInicio = Math.max(minInicio, Math.min(total - clip.duracion_seg, original.inicio_seg + 120));
  const esEjemplo = clip.origen === 'ejemplo';

  async function guardar(extra = {}) {
    setGuardando(true);
    try {
      const cuerpo = Object.fromEntries(CAMPOS.map((k) => [k, clip[k]]));
      const actualizado = await api(`/clips/${clip.id}`, { metodo: 'PATCH', cuerpo: { ...cuerpo, ...extra } });
      setOriginal(actualizado);
      setClip(actualizado);
      setTextoSubs(actualizado.subtitulos.join('\n'));
      return actualizado;
    } finally {
      setGuardando(false);
    }
  }

  async function generar() {
    setMensaje(null);
    setGenerando(0);
    try {
      const guardado = sinGuardar ? await guardar() : clip;
      const meta = await leerMetadatos(archivo);
      const blob = await generarClip({ archivo, meta, clip: guardado, resolucion: plan.resolucion, marcaAgua: plan.marcaAgua }, setGenerando);
      const nuevo = { firma: firmaClip(guardado, plan.resolucion, plan.marcaAgua), blob };
      await guardarMp4(clip.id, nuevo.firma, blob);
      setMp4(nuevo);
      api(`/clips/${clip.id}`, { metodo: 'PATCH', cuerpo: { generado: true } }).catch(() => {});
      registrarEvento('clip_generado', { clip: clip.id, segundos: guardado.duracion_seg });
      setMensaje({ tipo: 'exito', texto: `MP4 listo (${(blob.size / 1048576).toFixed(1).replace('.', ',')} MB).` });
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message });
    } finally {
      setGenerando(null);
    }
  }

  function bajar() {
    descargar(mp4.blob, nombreArchivoClip(clip));
    registrarEvento('clip_descargado', { clip: clip.id });
  }

  async function programar() {
    setMensaje(null);
    try {
      if (sinGuardar) await guardar();
      await api(`/clips/${clip.id}/publicaciones`, { metodo: 'POST', cuerpo: { redes, fecha: new Date(cuando).toISOString() } });
      navegar(`/clips/${clip.id}/programado`);
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message });
    }
  }

  async function descartar() {
    await guardar({ estado: 'descartado' });
    navegar('/clips');
  }

  return (
    <div className="pagina">
      <header className="pagina-cabecera">
        <div>
          <p className="miga">
            <Link to="/clips">Mis clips</Link> / <Link to={`/transmisiones/${clip.transmision_id}`}>{clip.transmision_titulo}</Link>
          </p>
          <h1>Editar clip</h1>
        </div>
        <span className={`etiqueta etiqueta-${clip.estado}`}>{ESTADOS_CLIP[clip.estado]}</span>
      </header>

      {!esEjemplo && !archivo && <SelectorArchivo transmision={{ id: clip.transmision_id, archivo_nombre: clip.archivo_nombre, archivo_tamano: clip.archivo_tamano }} onListo={setArchivo} />}

      <div className="editor">
        <div className="editor-vista">
          <VistaClip clip={clip} archivo={archivo} marcaAgua={plan.marcaAgua} />
          {plan.marcaAgua && (
            <p className="nota centrado">
              Plan Gratis: 720p con marca de agua. <Link to="/planes">Quitarla</Link>
            </p>
          )}
        </div>

        <div className="editor-panel">
          <section className="tarjeta">
            <label className="campo">
              <span>Título</span>
              <input value={clip.titulo} maxLength={100} onChange={(e) => cambiar('titulo', e.target.value)} />
            </label>
          </section>

          <section className="tarjeta">
            <h2 className="tarjeta-titulo">Recorte</h2>
            <label className="campo">
              <span>
                Inicio <b>{hms(clip.inicio_seg)}</b>
                <small> (del {hms(clip.inicio_seg)} al {hms(clip.inicio_seg + clip.duracion_seg)})</small>
              </span>
              <div className="fila-control">
                <button type="button" className="boton boton-chico boton-fantasma" onClick={() => cambiar('inicio_seg', Math.max(minInicio, clip.inicio_seg - 5))}>
                  −5 s
                </button>
                <input
                  type="range"
                  min={minInicio}
                  max={maxInicio}
                  step="0.5"
                  value={Math.min(maxInicio, clip.inicio_seg)}
                  onChange={(e) => cambiar('inicio_seg', Number(e.target.value))}
                />
                <button type="button" className="boton boton-chico boton-fantasma" onClick={() => cambiar('inicio_seg', Math.min(maxInicio, clip.inicio_seg + 5))}>
                  +5 s
                </button>
              </div>
            </label>
            <label className="campo">
              <span>
                Duración <b>{Math.round(clip.duracion_seg)} s</b>
              </span>
              <input
                type="range"
                min="15"
                max={Math.min(60, Math.floor(total))}
                step="1"
                value={clip.duracion_seg}
                onChange={(e) => {
                  const d = Number(e.target.value);
                  setClip((c) => ({ ...c, duracion_seg: d, inicio_seg: Math.min(c.inicio_seg, Math.max(0, total - d)) }));
                }}
              />
            </label>
          </section>

          <section className="tarjeta">
            <h2 className="tarjeta-titulo">Formato vertical</h2>
            <div className="opciones">
              {Object.entries(FORMATOS).map(([clave, f]) => (
                <button key={clave} type="button" className={`opcion ${clip.formato === clave ? 'opcion-activa' : ''}`} onClick={() => cambiar('formato', clave)}>
                  <span className={`icono-formato formato-${clave}`} aria-hidden="true">
                    <i />
                    <i />
                  </span>
                  <strong>{f.nombre}</strong>
                  <small>{f.detalle}</small>
                </button>
              ))}
            </div>
            {clip.formato === 'camara' && (
              <label className="campo">
                <span>¿Dónde está tu cámara en el stream?</span>
                <select value={clip.camara} onChange={(e) => cambiar('camara', e.target.value)}>
                  {Object.entries(CAMARAS).map(([clave, texto]) => (
                    <option key={clave} value={clave}>
                      {texto}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </section>

          <section className="tarjeta">
            <h2 className="tarjeta-titulo">Subtítulos</h2>
            <label className="campo">
              <span>Una línea por bloque; se reparten a lo largo del clip</span>
              <textarea
                rows={4}
                value={textoSubs}
                placeholder={'NO PUEDE SER\nME HICIERON UN ACE 😱'}
                onChange={(e) => {
                  setTextoSubs(e.target.value);
                  cambiar('subtitulos', e.target.value.split('\n').map((s) => s.trim()).filter(Boolean));
                }}
              />
            </label>
            <small className="ayuda">La transcripción automática de tu voz (Whisper) llegará en la siguiente versión; por ahora escribe o pega el texto.</small>
            <div className="chips">
              {Object.entries(ESTILOS).map(([clave, e]) => (
                <button key={clave} type="button" className={`chip estilo-${clave} ${clip.estilo === clave ? 'chip-activo' : ''}`} onClick={() => cambiar('estilo', clave)}>
                  {e.nombre}
                </button>
              ))}
            </div>
          </section>

          <div className="barra-guardar">
            <button type="button" className="boton boton-secundario" disabled={!sinGuardar || guardando} onClick={() => guardar()}>
              {guardando ? 'Guardando…' : sinGuardar ? 'Guardar cambios' : 'Cambios guardados ✓'}
            </button>
          </div>

          <section className="tarjeta">
            <h2 className="tarjeta-titulo">Exportar</h2>
            {esEjemplo ? (
              <p className="nota">Las transmisiones de ejemplo no tienen video. Sube tu propio video para generar el MP4.</p>
            ) : generando !== null ? (
              <div>
                <p>Generando el clip en tu navegador… {Math.round(generando * 100)} %</p>
                <div className="barra">
                  <div className="barra-relleno" style={{ width: `${Math.round(generando * 100)}%` }} />
                </div>
              </div>
            ) : (
              <div className="fila-botones">
                <button type="button" className="boton boton-primario" disabled={!archivo} onClick={generar}>
                  {mp4Vigente ? 'Volver a generar' : `Generar MP4 ${plan.resolucion}p`}
                </button>
                {mp4Vigente && (
                  <button type="button" className="boton boton-lima" onClick={bajar}>
                    ⬇ Descargar MP4
                  </button>
                )}
              </div>
            )}
          </section>

          <section className="tarjeta">
            <h2 className="tarjeta-titulo">Aprobar y programar</h2>
            <div className="chips">
              {Object.entries(REDES).map(([clave, r]) => (
                <label key={clave} className={`chip chip-check ${redes.includes(clave) ? 'chip-activo' : ''}`}>
                  <input
                    type="checkbox"
                    checked={redes.includes(clave)}
                    onChange={(e) => setRedes((lista) => (e.target.checked ? [...lista, clave] : lista.filter((x) => x !== clave)))}
                  />
                  <i style={{ background: r.color }} /> {r.nombre}
                </label>
              ))}
            </div>
            <label className="campo">
              <span>Fecha y hora de publicación</span>
              <input type="datetime-local" value={cuando} onChange={(e) => setCuando(e.target.value)} />
            </label>
            <div className="fila-botones">
              <button type="button" className="boton boton-exito" disabled={!redes.length || !cuando} onClick={programar}>
                ✓ Aprobar y programar
              </button>
              <button type="button" className="boton boton-fantasma" onClick={descartar}>
                ✕ Descartar clip
              </button>
            </div>
            <small className="ayuda">En el PMV la programación queda registrada; la publicación automática se activará al conectar las API de TikTok y YouTube.</small>
          </section>

          {mensaje && <p className={`aviso aviso-${mensaje.tipo}`}>{mensaje.texto}</p>}
        </div>
      </div>
    </div>
  );
}
