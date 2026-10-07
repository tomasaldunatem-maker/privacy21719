import type { Request, Response, NextFunction } from 'express';
import { and, eq, gt } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { env, isProd } from '../config/env.js';
import { sha256, randomToken } from '../lib/crypto.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import type { Role } from '../types.js';

export const SESSION_COOKIE = isProd ? '__Host-p21719' : 'p21719';

export async function createSession(res: Response, req: Request, userId: string) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 3600_000);
  await db.insert(schema.sessions).values({
    id: sha256(token), userId, expiresAt, ip: req.ip ?? null, userAgent: (req.get('user-agent') ?? '').slice(0, 300),
  });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true, secure: isProd, sameSite: 'strict', path: '/', expires: expiresAt,
  });
}

export async function destroySession(req: Request, res: Response) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.id, sha256(token)));
  res.clearCookie(SESSION_COOKIE, { path: '/', httpOnly: true, secure: isProd, sameSite: 'strict' });
}

/** Carga el usuario de la sesión si existe (no exige login). */
export async function loadSession(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token || typeof token !== 'string') return next();
  const sid = sha256(token);
  const rows = await db
    .select({ u: schema.users, s: schema.sessions })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, sid), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (row && row.u.active) {
    req.user = {
      id: row.u.id, organizationId: row.u.organizationId, email: row.u.email, name: row.u.name,
      role: row.u.role, mustChangePassword: row.u.mustChangePassword, sessionId: sid,
    };
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  if (req.user.mustChangePassword && !req.originalUrl.startsWith('/api/auth/')) {
    return next(forbidden('Debe cambiar su contraseña antes de continuar'));
  }
  next();
}

/** Permisos por rol. ADMIN siempre tiene acceso. */
export const requireRole = (...roles: Role[]) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) return next(unauthorized());
  if (req.user.role === 'ADMIN' || roles.includes(req.user.role)) return next();
  next(forbidden());
};

/** Roles con permiso de edición del programa de cumplimiento. */
export const canManage = requireRole('DPO');
/** Recepción también puede registrar solicitudes e incidentes. */
export const canOperate = requireRole('DPO', 'STAFF');

/**
 * Protección CSRF: las peticiones que modifican datos deben venir del mismo origen
 * y ser JSON o multipart con la cabecera X-Requested-With. Junto a la cookie SameSite=Strict
 * evita que otro sitio actúe en nombre del usuario.
 */
export function originGuard(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  const allowed = new Set([env.APP_ORIGIN, `http://localhost:${env.PORT}`, `http://127.0.0.1:${env.PORT}`]);
  if (isProd) { allowed.clear(); allowed.add(env.APP_ORIGIN); }
  if (origin && !allowed.has(origin)) return next(forbidden('Origen no permitido'));
  if (req.get('x-requested-with') !== 'privacy21719') return next(forbidden('Petición no válida'));
  next();
}
