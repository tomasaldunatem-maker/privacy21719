import { Router } from 'express';
import { z } from 'zod';
import { and, asc, eq, ilike, or } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { parse } from '../lib/validate.js';
import { notFound } from '../lib/errors.js';
import { audit } from '../lib/audit.js';
import { canManage } from '../middleware/auth.js';
import { analyze, suggestRisk } from '../domain/copilot.js';

export const router = Router();
const t = (n: number) => z.string().trim().max(n).optional().nullable();
const body = z.object({
  name: z.string().trim().min(2).max(160),
  purpose: t(400), dataCategories: t(600), system: t(200), processors: t(300),
  legalBasis: z.string().trim().max(120).optional(),
  retention: z.string().trim().max(160).optional(),
  sensitive: z.boolean().default(false),
  risk: z.enum(['ALTO', 'MEDIO', 'BAJO']).optional(),
  dpiaStatus: z.enum(['NO_REQUERIDA', 'PENDIENTE', 'EN_CURSO', 'APROBADA']).optional(),
});

router.get('/', async (req, res) => {
  const q = parse(z.object({ q: z.string().max(100).optional(), sensitive: z.enum(['true', 'false']).optional(), risk: z.enum(['ALTO', 'MEDIO', 'BAJO']).optional() }), req.query);
  const conds = [eq(schema.processingActivities.organizationId, req.user!.organizationId)];
  if (q.q) conds.push(or(ilike(schema.processingActivities.name, `%${q.q}%`), ilike(schema.processingActivities.purpose, `%${q.q}%`), ilike(schema.processingActivities.system, `%${q.q}%`))!);
  if (q.sensitive) conds.push(eq(schema.processingActivities.sensitive, q.sensitive === 'true'));
  if (q.risk) conds.push(eq(schema.processingActivities.risk, q.risk));
  const rows = await db.select().from(schema.processingActivities).where(and(...conds)).orderBy(asc(schema.processingActivities.name));
  res.json(rows.map((r) => ({ ...r, findings: analyze(r) })));
});

/** Vista previa del copiloto mientras se completa el formulario. */
router.post('/copilot', async (req, res) => {
  const b = parse(body.partial({ name: true }), req.body);
  res.json(suggestRisk(b));
});

router.post('/', canManage, async (req, res) => {
  const b = parse(body, req.body);
  const s = suggestRisk(b);
  const [r] = await db.insert(schema.processingActivities).values({
    ...b, organizationId: req.user!.organizationId,
    legalBasis: b.legalBasis || 'Sin definir', retention: b.retention || 'Sin definir',
    processors: b.processors || 'Ninguno', risk: b.risk ?? s.risk, dpiaStatus: b.dpiaStatus ?? s.dpiaStatus,
  }).returning();
  await audit(req, 'create', 'processing_activity', r.id, { name: r.name });
  res.status(201).json({ ...r, findings: s.findings });
});

router.patch('/:id', canManage, async (req, res) => {
  const b = parse(body.partial(), req.body);
  const [r] = await db.update(schema.processingActivities).set({ ...b, updatedAt: new Date() })
    .where(and(eq(schema.processingActivities.id, String(req.params.id)), eq(schema.processingActivities.organizationId, req.user!.organizationId))).returning();
  if (!r) throw notFound('Tratamiento no encontrado');
  await audit(req, 'update', 'processing_activity', r.id, Object.fromEntries(Object.keys(b).map((k) => [k, true])));
  res.json({ ...r, findings: analyze(r) });
});

router.delete('/:id', canManage, async (req, res) => {
  const [r] = await db.delete(schema.processingActivities)
    .where(and(eq(schema.processingActivities.id, String(req.params.id)), eq(schema.processingActivities.organizationId, req.user!.organizationId))).returning();
  if (!r) throw notFound('Tratamiento no encontrado');
  await audit(req, 'delete', 'processing_activity', r.id, { name: r.name });
  res.json({ ok: true });
});
