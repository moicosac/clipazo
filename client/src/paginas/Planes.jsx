import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, registrarEvento } from '../api.js';
import { useSesion } from '../sesion.jsx';
import { CREDITOS, PLANES, formatearSoles } from '../../../shared/planes.js';

export default function Planes() {
  const { plan: actual } = useSesion();
  const navegar = useNavigate();
  const [eligiendo, setEligiendo] = useState(null);
  const [error, setError] = useState('');
  const registrado = useRef(false);

  useEffect(() => {
    if (registrado.current) return;
    registrado.current = true;
    registrarEvento('ver_planes', { plan_actual: actual.id });
  }, [actual.id]);

  async function comprar(producto) {
    setEligiendo(producto);
    setError('');
    try {
      const pago = await api('/pagos', { metodo: 'POST', cuerpo: { producto, metodo: 'yape' } });
      navegar(`/pago/${pago.id}`);
    } catch (e) {
      setError(e.message);
      setEligiendo(null);
    }
  }

  return (
    <div className="pagina">
      <header className="pagina-cabecera">
        <div>
          <h1>Planes</h1>
          <p className="subtitulo">Precios en soles. Paga con Yape o Plin, sin tarjeta de crédito.</p>
        </div>
      </header>

      <div className="grilla-planes">
        {Object.values(PLANES).map((p) => {
          const esActual = p.id === actual.id;
          const destacado = p.id === 'creador';
          return (
            <div key={p.id} className={`tarjeta plan ${destacado ? 'plan-destacado' : ''} ${esActual ? 'plan-actual' : ''}`}>
              {destacado && <span className="plan-cinta">Más elegido</span>}
              <h2>{p.nombre}</h2>
              <p className="plan-precio">
                {p.precio ? formatearSoles(p.precio) : 'S/ 0'}
                <small>{p.precio ? ' al mes' : ' para siempre'}</small>
              </p>
              <ul>
                {p.incluye.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              {esActual ? (
                <span className="boton boton-fantasma boton-ancho">Tu plan actual</span>
              ) : p.precio > actual.precio ? (
                <button type="button" className={`boton boton-ancho ${destacado ? 'boton-lima' : 'boton-primario'}`} disabled={eligiendo !== null} onClick={() => comprar(p.id)}>
                  {eligiendo === p.id ? 'Un momento…' : `Elegir ${p.nombre}`}
                </button>
              ) : (
                <span className="boton boton-fantasma boton-ancho">Incluido en tu plan</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="tarjeta creditos">
        <div>
          <h2>{CREDITOS.nombre}</h2>
          <p className="subtitulo">
            Paquete de {CREDITOS.clips} clips adicionales sin suscripción, para cuando se te acaba el cupo del mes.
          </p>
        </div>
        <div className="creditos-compra">
          <strong className="plan-precio">{formatearSoles(CREDITOS.precio)}</strong>
          <button type="button" className="boton boton-secundario" disabled={eligiendo !== null} onClick={() => comprar('creditos')}>
            {eligiendo === 'creditos' ? 'Un momento…' : 'Comprar créditos'}
          </button>
        </div>
      </div>

      {error && <p className="aviso aviso-error">{error}</p>}
      <p className="nota">
        Pago anual con descuento equivalente a dos meses y plan Equipos para agencias y clubes de esports: próximamente.
      </p>
    </div>
  );
}
