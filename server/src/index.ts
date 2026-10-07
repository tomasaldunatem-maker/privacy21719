import { env } from './config/env.js';
import { createApp } from './app.js';
import { pool } from './db/index.js';

const app = createApp();
const server = app.listen(env.PORT, () => {
  console.log(`PRIVACY 21719 escuchando en http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

// Limpieza periódica de sesiones vencidas
const timer = setInterval(() => {
  pool.query('delete from sessions where expires_at < now()').catch((e) => console.error('Limpieza de sesiones', e));
}, 60 * 60_000);

function shutdown() {
  clearInterval(timer);
  server.close(() => pool.end().then(() => process.exit(0)));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
