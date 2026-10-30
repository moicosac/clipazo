import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useSesion } from '../sesion.jsx';
import { TRANSMISIONES_EJEMPLO } from '../../../shared/simulacion.js';
import { PLATAFORMAS, duracionLarga, fecha } from '../util.js';

function Medidor({ titulo, usado, limite, detalle }) {
  const infinito = limite === null;
  const fraccion = infinito ? 0.15 : Math.min(1, usado / Math.max(1, limite));
  return (
    <div className="tarjeta medidor">
      <span className="medidor-titulo">{titulo}</span>
      <strong className="medidor-valor">
        {usado}
        <small> / {infinito ? '∞' : limite}</small>
      </strong>
      <div className="barra">
        <div className={`barra-relleno ${fraccion >= 1 ? 'barra-llena' : ''}`} style={{ width: `${fraccion * 100}%` }} />
      </div>
      {detalle && <span className="medidor-detalle">{detalle}</span>}
    </div>
  );
}

export default function Inicio() {
  const { usuario, plan, uso, refrescar } = useSesion();
  const navegar = useNavigate();
  const [transmisiones, setTransmisiones] = useState(null);
  const [error, setError] = useState('');
  const [creando, setCreando] = useState(null);

  useEffect(() => {
    refrescar();
    api('/transmisiones').then(setTransmisiones).catch((e) => setError(e.message));
  }, [refrescar]);

  async function analizarEjemplo(ej) {
    setCreando(ej.clave);
    setError('');
    try {
      const t = await api('/transmisiones', {
        metodo: 'POST',
        cuerpo: { titulo: ej.titulo, origen: 'ejemplo', archivo_nombre: ej.clave, duracion_seg: ej.duracionSeg },
      });
      navegar(`/transmisiones/${t.id}/analizando`);
    } catch (e) {
      setError(e.message);
      setCreando(null);
    }
  }

  const plataforma = PLATAFORMAS[usuario.plataforma];
  const conCanal = usuario.plataforma !== 'archivo';

  return (
    <div className="pagina">
      <header className="pagina-cabecera">
        <div>
          <h1>Hola, {usuario.nombre} 👋</h1>
          <p className="subtitulo">¿Qué transmisión convertimos en clips hoy?</p>
        </div>
        <Link to="/subir" className="boton boton-primario">
          ⇪ Subir transmisión
        </Link>
      </header>

      <section className="resumen">
        <Medidor titulo="Transmisiones este mes" usado={uso.transmisiones} limite={plan.transmisionesMes} />
        <Medidor
          titulo="Clips este mes"
          usado={uso.clips}
          limite={plan.clipsMes}
          detalle={usuario.creditos ? `+ ${usuario.creditos} créditos extra` : `${plan.clipsPorTransmision} clips por transmisión`}
        />
        <div className="tarjeta medidor medidor-plan">
          <span className="medidor-titulo">Tu plan</span>
          <strong className="medidor-valor">{plan.nombre}</strong>
          <span className="medidor-detalle">
            {plan.resolucion}p · {plan.marcaAgua ? 'con marca de agua' : 'sin marca de agua'}
          </span>
          {plan.id !== 'pro' && (
            <Link to="/planes" className="boton boton-chico boton-lima">
              Mejorar plan
            </Link>
          )}
        </div>
      </section>

      {error && (
        <p className="aviso aviso-error">
          {error} {/plan/i.test(error) && <Link to="/planes">Ver planes</Link>}
        </p>
      )}

      <section className="seccion">
        <h2>Tus transmisiones analizadas</h2>
        {transmisiones === null ? (
          <p className="vacio">Cargando…</p>
        ) : transmisiones.length === 0 ? (
          <div className="vacio">
            <p>Todavía no analizas ninguna transmisión.</p>
            <p>Sube el video de tu último stream o prueba con una de ejemplo.</p>
          </div>
        ) : (
          <ul className="lista-transmisiones">
            {transmisiones.map((t) => (
              <li key={t.id}>
                <Link to={t.estado === 'listo' ? `/transmisiones/${t.id}` : `/transmisiones/${t.id}/analizando`}>
                  <span className={`icono-origen origen-${t.origen}`}>{t.origen === 'ejemplo' ? '◎' : '▶'}</span>
                  <span className="lt-info">
                    <strong>{t.titulo}</strong>
                    <span>
                      {fecha(t.creado_en)} · {duracionLarga(t.duracion_seg)} · {t.origen === 'ejemplo' ? 'datos de ejemplo' : t.archivo_nombre}
                    </span>
                  </span>
                  <span className="lt-clips">
                    {t.estado === 'listo' ? (
                      <>
                        <strong>{t.clips}</strong> clips · {t.aprobados} aprobados
                      </>
                    ) : (
                      <span className="etiqueta etiqueta-pendiente">Sin analizar</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="seccion">
        <h2>{conCanal ? `Transmisiones recientes de tu canal en ${plataforma.nombre}` : '¿No tienes un video a la mano?'}</h2>
        <p className="subtitulo">
          {conCanal
            ? 'Datos de ejemplo: la descarga real de tus transmisiones y del chat se conectará con la API de cada plataforma.'
            : 'Prueba Clipazo con una transmisión de ejemplo (datos simulados de chat y voz).'}
        </p>
        <div className="grilla-ejemplos">
          {TRANSMISIONES_EJEMPLO.map((ej) => (
            <div key={ej.clave} className="tarjeta ejemplo">
              <span className="ejemplo-juego">{ej.juego}</span>
              <strong>{ej.titulo}</strong>
              <span className="ejemplo-meta">
                Hace {ej.haceDias} {ej.haceDias === 1 ? 'día' : 'días'} · {duracionLarga(ej.duracionSeg)}
              </span>
              <button type="button" className="boton boton-secundario" disabled={creando !== null} onClick={() => analizarEjemplo(ej)}>
                {creando === ej.clave ? 'Preparando…' : 'Analizar'}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
