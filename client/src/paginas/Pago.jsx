import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { api } from '../api.js';
import { useSesion } from '../sesion.jsx';
import { CREDITOS, PLANES, formatearSoles } from '../../../shared/planes.js';

const METODOS = {
  yape: { nombre: 'Yape', color: '#742284' },
  plin: { nombre: 'Plin', color: '#00a6a6' },
};

export default function Pago() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { refrescar } = useSesion();
  const [pago, setPago] = useState(null);
  const [metodo, setMetodo] = useState('yape');
  const [qr, setQr] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/pagos/${id}`)
      .then((p) => {
        setPago(p);
        setMetodo(p.metodo);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (!pago) return;
    QRCode.toDataURL(`CLIPAZO-DEMO|pago:${pago.id}|${metodo}|S/${pago.monto.toFixed(2)}|NO ES UN PAGO REAL`, {
      width: 260,
      margin: 1,
      color: { dark: '#1a1025', light: '#ffffff' },
    }).then(setQr);
  }, [pago, metodo]);

  if (error) return <div className="pagina"><p className="aviso aviso-error">{error}</p></div>;
  if (!pago) return <div className="cargando-pagina">Cargando…</div>;
  if (pago.estado === 'pagado') return <Navigate to={`/pago/${pago.id}/exito`} replace />;

  const producto = pago.producto === 'creditos' ? CREDITOS.nombre : `Plan ${PLANES[pago.producto].nombre} (mensual)`;

  async function confirmar() {
    setConfirmando(true);
    try {
      await api(`/pagos/${pago.id}/confirmar`, { metodo: 'POST', cuerpo: { metodo } });
      await refrescar();
      navegar(`/pago/${pago.id}/exito`, { replace: true });
    } catch (e) {
      setError(e.message);
      setConfirmando(false);
    }
  }

  return (
    <div className="pagina pagina-angosta">
      <p className="miga">
        <Link to="/planes">Planes</Link> / Pago
      </p>
      <div className="tarjeta pago">
        <div className="aviso aviso-info">Pago de demostración: no se realiza ningún cobro.</div>
        <div className="pago-resumen">
          <span>{producto}</span>
          <strong>{formatearSoles(pago.monto)}</strong>
        </div>
        <div className="pestanas pestanas-pago">
          {Object.entries(METODOS).map(([clave, m]) => (
            <button
              key={clave}
              type="button"
              className={metodo === clave ? 'activa' : ''}
              style={metodo === clave ? { background: m.color, borderColor: m.color, color: '#fff' } : undefined}
              onClick={() => setMetodo(clave)}
            >
              {m.nombre}
            </button>
          ))}
        </div>
        <div className="pago-qr" style={{ borderColor: METODOS[metodo].color }}>
          {qr && <img src={qr} alt={`Código QR de demostración para pagar con ${METODOS[metodo].nombre}`} />}
          <span className="pago-qr-sello">DEMO</span>
        </div>
        <ol className="pago-pasos">
          <li>Abre {METODOS[metodo].nombre} en tu celular.</li>
          <li>Escanea el código QR.</li>
          <li>Confirma el pago de {formatearSoles(pago.monto)} a nombre de Clipazo.</li>
        </ol>
        <button type="button" className="boton boton-primario boton-ancho" disabled={confirmando} onClick={confirmar}>
          {confirmando ? 'Confirmando…' : 'Ya pagué (simular confirmación)'}
        </button>
        <Link to="/planes" className="boton-texto">
          Cancelar
        </Link>
      </div>
    </div>
  );
}
