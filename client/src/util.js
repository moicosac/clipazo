export function hms(segundos) {
  const s = Math.max(0, Math.floor(segundos));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

export function duracionLarga(segundos) {
  const h = Math.floor(segundos / 3600);
  const m = Math.round((segundos % 3600) / 60);
  if (h && m) return `${h} h ${m} min`;
  if (h) return `${h} h`;
  if (m) return `${m} min`;
  return `${Math.round(segundos)} s`;
}

export function bytes(n) {
  if (!n) return '';
  const unidades = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (n >= 1024 && i < unidades.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i > 1 ? 1 : 0).replace('.', ',')} ${unidades[i]}`;
}

export function fecha(valor, conHora = false) {
  return new Date(valor).toLocaleString('es-PE', {
    day: 'numeric',
    month: 'short',
    year: conHora ? undefined : 'numeric',
    ...(conHora ? { weekday: 'short', hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function porcentaje(a, b) {
  if (!b) return '—';
  return `${Math.round((a / b) * 100)} %`;
}

export const REDES = {
  tiktok: { nombre: 'TikTok', color: '#25f4ee' },
  youtube: { nombre: 'YouTube Shorts', color: '#ff0033' },
  instagram: { nombre: 'Instagram Reels', color: '#e1306c' },
};

export const PLATAFORMAS = {
  kick: { nombre: 'Kick', color: '#53fc18' },
  twitch: { nombre: 'Twitch', color: '#9146ff' },
  youtube: { nombre: 'YouTube', color: '#ff0033' },
  archivo: { nombre: 'mi computadora', color: '#8b5cf6' },
};

export const ESTADOS_CLIP = {
  pendiente: 'Por revisar',
  aprobado: 'Aprobado',
  descartado: 'Descartado',
};
