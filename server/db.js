// Acceso a la base de datos.
// Con DATABASE_URL se conecta a PostgreSQL (Neon en producción).
// Sin DATABASE_URL usa PGlite: el mismo PostgreSQL, embebido y guardado en server/data/.
import fs from 'node:fs';
import path from 'node:path';

let motor = null;

export async function iniciarDB() {
  const esquema = fs.readFileSync(path.join(import.meta.dirname, 'schema.sql'), 'utf8');

  if (process.env.DATABASE_URL) {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
    motor = {
      nombre: 'PostgreSQL (Neon)',
      query: (texto, params) => pool.query(texto, params),
      exec: (texto) => pool.query(texto),
    };
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    const carpeta = path.join(import.meta.dirname, 'data', 'pglite');
    fs.mkdirSync(carpeta, { recursive: true });
    const db = new PGlite(carpeta);
    await db.waitReady;
    motor = {
      nombre: 'PostgreSQL local (PGlite)',
      query: (texto, params) => db.query(texto, params),
      exec: (texto) => db.exec(texto),
    };
  }

  await motor.exec(esquema);
  return motor.nombre;
}

export async function consultar(texto, params = []) {
  const { rows } = await motor.query(texto, params);
  return rows;
}

export async function uno(texto, params = []) {
  const filas = await consultar(texto, params);
  return filas[0] ?? null;
}
