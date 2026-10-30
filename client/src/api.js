const CLAVE_TOKEN = 'clipazo_token';

export function leerToken() {
  try {
    return localStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
}

export function guardarToken(token) {
  try {
    if (token) localStorage.setItem(CLAVE_TOKEN, token);
    else localStorage.removeItem(CLAVE_TOKEN);
  } catch {
    // Sin almacenamiento disponible: la sesión dura lo que dure la pestaña.
  }
}

export async function api(ruta, { metodo = 'GET', cuerpo } = {}) {
  const token = leerToken();
  const respuesta = await fetch(`/api${ruta}`, {
    method: metodo,
    headers: {
      ...(cuerpo !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });
  if (respuesta.status === 204) return null;
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    if (respuesta.status === 401) guardarToken(null);
    const error = new Error(datos.error || 'No pudimos conectar con el servidor.');
    error.estado = respuesta.status;
    error.datos = datos;
    throw error;
  }
  return datos;
}

export function registrarEvento(tipo, datos) {
  api('/eventos', { metodo: 'POST', cuerpo: { tipo, datos } }).catch(() => {});
}
