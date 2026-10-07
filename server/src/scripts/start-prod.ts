/**
 * Arranque en producción: migraciones → catálogo → (opcional) demo → servidor.
 * Todos los pasos previos son idempotentes; se pueden ejecutar en cada despliegue.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url)); // dist/src/scripts
const run = (rel: string, args: string[] = []) => {
  const r = spawnSync(process.execPath, [path.join(dir, rel), ...args], { stdio: 'inherit', env: process.env });
  if (r.status !== 0) { console.error(`Falló ${rel}`); process.exit(r.status ?? 1); }
};

run('../db/migrate.js');
run('../db/seed/catalog.js');
if (process.env.SEED_DEMO === 'true') run('../db/seed/demo.js', ['--if-missing']);
await import('../index.js');
