import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api, guardarToken, leerToken } from './api.js';

const ContextoSesion = createContext(null);

export function ProveedorSesion({ children }) {
  const [datos, setDatos] = useState(null); // { usuario, plan, uso }
  const [cargando, setCargando] = useState(Boolean(leerToken()));

  const refrescar = useCallback(async () => {
    if (!leerToken()) {
      setDatos(null);
      setCargando(false);
      return null;
    }
    try {
      const yo = await api('/yo');
      setDatos(yo);
      return yo;
    } catch {
      setDatos(null);
      return null;
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    refrescar();
  }, [refrescar]);

  const entrar = useCallback(
    async (token) => {
      guardarToken(token);
      setCargando(true);
      return refrescar();
    },
    [refrescar],
  );

  const salir = useCallback(() => {
    guardarToken(null);
    setDatos(null);
  }, []);

  return <ContextoSesion.Provider value={{ ...datos, sesion: datos, cargando, entrar, salir, refrescar }}>{children}</ContextoSesion.Provider>;
}

export function useSesion() {
  return useContext(ContextoSesion);
}

export function RequiereSesion({ children }) {
  const { sesion, cargando } = useSesion();
  const ubicacion = useLocation();
  if (cargando) return <div className="cargando-pagina">Cargando…</div>;
  if (!sesion) return <Navigate to="/" replace state={{ desde: ubicacion.pathname }} />;
  return children;
}
