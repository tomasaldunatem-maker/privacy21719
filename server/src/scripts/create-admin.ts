/**
 * Crea una clínica real y su primer administrador.
 * Uso:
 *   npm run create-admin --workspace server -- --clinic "Clínica Dental X" --slug clinica-x --email admin@clinicax.cl --name "Nombre Apellido"
 * Imprime una contraseña temporal que debe cambiarse en el primer ingreso.
 */
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db, pool, schema } from '../db/index.js';
import { seedCatalog } from '../db/seed/catalog.js';
import { randomToken } from '../lib/crypto.js';

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const input = z.object({
  clinic: z.string().min(2), slug: z.string().regex(/^[a-z0-9-]{3,40}$/, 'slug: minúsculas, números y guiones (3-40)'),
  email: z.string().email(), name: z.string().min(2),
}).safeParse({ clinic: arg('clinic'), slug: arg('slug'), email: arg('email')?.toLowerCase(), name: arg('name') });

if (!input.success) {
  console.error('Parámetros inválidos:', input.error.flatten().fieldErrors);
  process.exit(1);
}
const v = input.data;
try {
  await seedCatalog();
  const [org] = await db.insert(schema.organizations).values({ name: v.clinic, slug: v.slug }).returning();
  const pwd = `Tmp-${randomToken(9)}1a`;
  await db.insert(schema.users).values({ organizationId: org.id, email: v.email, name: v.name, role: 'ADMIN', passwordHash: await bcrypt.hash(pwd, 12), mustChangePassword: true });
  console.log(`Clínica creada: ${org.name} (/p/${org.slug})`);
  console.log(`Administrador: ${v.email}`);
  console.log(`Contraseña temporal (cámbiela al ingresar): ${pwd}`);
} catch (e) {
  console.error((e as { code?: string }).code === '23505' ? 'Ya existe una clínica con ese slug o un usuario con ese correo.' : e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
