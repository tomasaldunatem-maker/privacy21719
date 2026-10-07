import { Router } from 'express';
import { z } from 'zod';
import { and, desc, eq, lt } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { parse } from '../lib/validate.js';
import { requireRole } from '../middleware/auth.js';

export const router = Router();

router.get('/', requireRole('DPO'), async (req, res) => {
  const q = parse(z.object({ entity: z.string().max(60).optional(), before: z.coerce.number().int().positive().optional(), limit: z.coerce.number().int().min(1).max(200).default(50) }), req.query);
  const conds = [eq(schema.auditLogs.organizationId, req.user!.organizationId)];
  if (q.entity) conds.push(eq(schema.auditLogs.entity, q.entity));
  if (q.before) conds.push(lt(schema.auditLogs.id, q.before));
  const rows = await db.select({
    id: schema.auditLogs.id, action: schema.auditLogs.action, entity: schema.auditLogs.entity, entityId: schema.auditLogs.entityId,
    userEmail: schema.auditLogs.userEmail, meta: schema.auditLogs.meta, createdAt: schema.auditLogs.createdAt,
  }).from(schema.auditLogs).where(and(...conds)).orderBy(desc(schema.auditLogs.id)).limit(q.limit);
  res.json({ items: rows, nextBefore: rows.length === q.limit ? rows[rows.length - 1].id : null });
});
