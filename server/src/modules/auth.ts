import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { and, eq, ne } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { parse } from '../lib/validate.js';
import { badRequest, unauthorized } from '../lib/errors.js';
import { audit } from '../lib/audit.js';
import { createSession, destroySession, requireAuth } from '../middleware/auth.js';

export const router = Router();

const MAX_FAILS = 5;
const LOCK_MIN = 15;
// Hash ficticio para comparar en tiempo constante cuando el usuario no existe
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 12);

export const passwordSchema = z.string()
  .min(10, 'Mínimo 10 caracteres')
  .max(128)
  .regex(/[a-zA-Z]/, 'Debe incluir letras')
  .regex(/[0-9]/, 'Debe incluir números');

const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Demasiados intentos. Espere unos minutos.' } });

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = parse(z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) }), req.body);
  const [u] = await db.select().from(schema.users).where(eq(schema.users.email, email.toLowerCase().trim()));
  const ok = await bcrypt.compare(password, u?.passwordHash ?? DUMMY_HASH);
  const generic = unauthorized('Correo o contraseña incorrectos');
  if (!u || !u.active) throw generic;
  if (u.lockedUntil && u.lockedUntil > new Date()) throw unauthorized(`Cuenta bloqueada temporalmente por intentos fallidos. Intente en ${LOCK_MIN} minutos.`);
  if (!ok) {
    const fails = u.failedLogins + 1;
    await db.update(schema.users).set({ failedLogins: fails, lockedUntil: fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MIN * 60_000) : null }).where(eq(schema.users.id, u.id));
    await audit(req, 'login_failed', 'user', u.id, { fails }, u.organizationId);
    throw generic;
  }
  await db.update(schema.users).set({ failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(schema.users.id, u.id));
  await createSession(res, req, u.id);
  await audit(req, 'login', 'user', u.id, undefined, u.organizationId);
  res.json({ ok: true, mustChangePassword: u.mustChangePassword });
});

router.post('/logout', async (req, res) => {
  if (req.user) await audit(req, 'logout', 'user', req.user.id);
  await destroySession(req, res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, req.user!.organizationId));
  const { sessionId: _s, ...user } = req.user!;
  res.json({ user, organization: org });
});

router.post('/change-password', requireAuth, async (req, res) => {
  const body = parse(z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema }), req.body);
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, req.user!.id));
  if (!(await bcrypt.compare(body.currentPassword, u.passwordHash))) throw badRequest('La contraseña actual no es correcta');
  if (body.currentPassword === body.newPassword) throw badRequest('La nueva contraseña debe ser distinta');
  await db.update(schema.users).set({ passwordHash: await bcrypt.hash(body.newPassword, 12), mustChangePassword: false, updatedAt: new Date() }).where(eq(schema.users.id, u.id));
  // Cierra las demás sesiones abiertas del usuario
  await db.delete(schema.sessions).where(and(eq(schema.sessions.userId, u.id), ne(schema.sessions.id, req.user!.sessionId)));
  await audit(req, 'password_changed', 'user', u.id);
  res.json({ ok: true });
});
