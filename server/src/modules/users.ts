import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { and, asc, eq, ne } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { parse } from '../lib/validate.js';
import { badRequest, notFound } from '../lib/errors.js';
import { audit } from '../lib/audit.js';
import { randomToken } from '../lib/crypto.js';
import { requireRole } from '../middleware/auth.js';

export const router = Router();
const role = z.enum(['ADMIN', 'DPO', 'STAFF', 'VIEWER']);
const pub = {
  id: schema.users.id, email: schema.users.email, name: schema.users.name, role: schema.users.role,
  active: schema.users.active, lastLoginAt: schema.users.lastLoginAt, mustChangePassword: schema.users.mustChangePassword, createdAt: schema.users.createdAt,
};
/** Contraseña temporal legible; el usuario debe cambiarla en el primer ingreso. */
const tempPassword = () => `Tmp-${randomToken(9)}1a`;

router.get('/', requireRole('DPO'), async (req, res) => {
  res.json(await db.select(pub).from(schema.users).where(eq(schema.users.organizationId, req.user!.organizationId)).orderBy(asc(schema.users.name)));
});

router.post('/', requireRole(), async (req, res) => {
  const b = parse(z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().toLowerCase().email().max(200), role }), req.body);
  const pwd = tempPassword();
  const [u] = await db.insert(schema.users).values({
    organizationId: req.user!.organizationId, name: b.name, email: b.email, role: b.role,
    passwordHash: await bcrypt.hash(pwd, 12), mustChangePassword: true,
  }).returning(pub);
  await audit(req, 'create', 'user', u.id, { role: b.role });
  res.status(201).json({ user: u, temporaryPassword: pwd });
});

async function adminCount(orgId: string, excludeId: string) {
  const rows = await db.select({ id: schema.users.id }).from(schema.users)
    .where(and(eq(schema.users.organizationId, orgId), eq(schema.users.role, 'ADMIN'), eq(schema.users.active, true), ne(schema.users.id, excludeId)));
  return rows.length;
}

router.patch('/:id', requireRole(), async (req, res) => {
  const b = parse(z.object({ name: z.string().trim().min(2).max(120).optional(), role: role.optional(), active: z.boolean().optional() }), req.body);
  const orgId = req.user!.organizationId;
  const [target] = await db.select().from(schema.users).where(and(eq(schema.users.id, String(req.params.id)), eq(schema.users.organizationId, orgId)));
  if (!target) throw notFound('Usuario no encontrado');
  const losingAdmin = target.role === 'ADMIN' && ((b.role && b.role !== 'ADMIN') || b.active === false);
  if (losingAdmin && (await adminCount(orgId, target.id)) === 0) throw badRequest('Debe quedar al menos un administrador activo');
  if (target.id === req.user!.id && b.active === false) throw badRequest('No puede desactivar su propia cuenta');
  const [u] = await db.update(schema.users).set({ ...b, updatedAt: new Date() }).where(eq(schema.users.id, target.id)).returning(pub);
  if (b.active === false) await db.delete(schema.sessions).where(eq(schema.sessions.userId, target.id));
  await audit(req, 'update', 'user', target.id, b);
  res.json(u);
});

router.post('/:id/reset-password', requireRole(), async (req, res) => {
  const orgId = req.user!.organizationId;
  const pwd = tempPassword();
  const [u] = await db.update(schema.users).set({ passwordHash: await bcrypt.hash(pwd, 12), mustChangePassword: true, failedLogins: 0, lockedUntil: null, updatedAt: new Date() })
    .where(and(eq(schema.users.id, String(req.params.id)), eq(schema.users.organizationId, orgId))).returning({ id: schema.users.id });
  if (!u) throw notFound('Usuario no encontrado');
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, u.id));
  await audit(req, 'reset_password', 'user', u.id);
  res.json({ temporaryPassword: pwd });
});
