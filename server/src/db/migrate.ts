import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, pool } from './index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// Funciona tanto desde src/ (tsx) como desde dist/src/ (compilado)
const folder = path.resolve(here, here.includes(`${path.sep}dist${path.sep}`) ? '../../../drizzle' : '../../drizzle');

await migrate(db, { migrationsFolder: folder });
console.log('Migraciones aplicadas.');
await pool.end();
