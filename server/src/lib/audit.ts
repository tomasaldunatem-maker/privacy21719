import type { Request } from 'express';
import { db, schema } from '../db/index.js';

/** Registra una acción relevante. Nunca guarde aquí datos de salud ni tokens. */
export async function audit(
  req: Request | null,
  action: string,
  entity: string,
  entityId?: string | null,
  meta?: Record<string, unknown>,
  orgId?: string,
) {
  const u = req?.user;
  try {
    await db.insert(schema.auditLogs).values({
      organizationId: orgId ?? u?.organizationId ?? null,
      userId: u?.id ?? null,
      userEmail: u?.email ?? null,
      action,
      entity,
      entityId: entityId ?? null,
      meta: meta ?? null,
      ip: req?.ip ?? null,
    });
  } catch (e) {
    console.error('No se pudo escribir la auditoría', e);
  }
}
