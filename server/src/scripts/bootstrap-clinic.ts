/**
 * Crea una clínica real y su primer administrador a partir de variables de entorno.
 * Pensado para plataformas sin consola (p. ej. Render gratuito). Es idempotente: si la clínica
 * o el correo ya existen, no hace nada. El administrador debe cambiar la contraseña al primer ingreso.
 *
 *   BOOTSTRAP_CLINIC_NAME     Nombre de la clínica
 *   BOOTSTRAP_CLINIC_SLUG     Identificador para el formulario público (/p/<slug>)
 *   BOOTSTRAP_ADMIN_NAME      Nombre del administrador
 *   BOOTSTRAP_ADMIN_EMAIL     Correo del administrador
 *   BOOTSTRAP_ADMIN_PASSWORD  Contraseña temporal (mín. 12 caracteres, letras y números)
 */
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, pool, schema } from '../db/index.js';

const input = z.object({
  name: z.string().trim().min(2),
  slug: z.string().trim().regex(/^[a-z0-9-]{3,40}$/, 'BOOTSTRAP_CLINIC_SLUG: minúsculas, números y guiones (3-40)'),
  adminName: z.string().trim().min(2),
  adminEmail: z.string().trim().toLowerCase().email(),
  adminPassword: z.string().min(12, 'BOOTSTRAP_ADMIN_PASSWORD: mínimo 12 caracteres').regex(/[a-zA-Z]/).regex(/[0-9]/),
});

export async function bootstrapClinic() {
  const e = process.env;
  if (!e.BOOTSTRAP_CLINIC_NAME && !e.BOOTSTRAP_ADMIN_EMAIL) return;
  const r = input.safeParse({
    name: e.BOOTSTRAP_CLINIC_NAME, slug: e.BOOTSTRAP_CLINIC_SLUG, adminName: e.BOOTSTRAP_ADMIN_NAME || 'Administrador',
    adminEmail: e.BOOTSTRAP_ADMIN_EMAIL, adminPassword: e.BOOTSTRAP_ADMIN_PASSWORD,
  });
  if (!r.success) {
    console.error('Clínica inicial no creada; revise las variables BOOTSTRAP_*:', r.error.flatten().fieldErrors);
    return;
  }
  const v = r.data;
  const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.slug, v.slug));
  const [user] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, v.adminEmail));
  if (org || user) {
    console.log(`Clínica inicial "${v.slug}" ya existe; no se modifica. Puede borrar BOOTSTRAP_ADMIN_PASSWORD.`);
    return;
  }
  await db.transaction(async (tx) => {
    const [o] = await tx.insert(schema.organizations).values({ name: v.name, slug: v.slug, privacyEmail: v.adminEmail, privacyOfficer: v.adminName }).returning();
    const [u] = await tx.insert(schema.users).values({
      organizationId: o.id, email: v.adminEmail, name: v.adminName, role: 'ADMIN',
      passwordHash: await bcrypt.hash(v.adminPassword, 12), mustChangePassword: true,
    }).returning({ id: schema.users.id });
    await tx.insert(schema.auditLogs).values({ organizationId: o.id, userId: u.id, userEmail: v.adminEmail, action: 'bootstrap', entity: 'organization', entityId: o.id });
  });
  console.log(`Clínica creada: ${v.name} (/p/${v.slug}). Administrador: ${v.adminEmail} (debe cambiar la contraseña al ingresar).`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { await bootstrapClinic(); } finally { await pool.end(); }
}
