import { Router } from 'express';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { parse } from '../lib/validate.js';
import { badRequest, notFound } from '../lib/errors.js';
import { audit } from '../lib/audit.js';
import { todayISO } from '../lib/dates.js';
import { canManage, canOperate } from '../middleware/auth.js';

export const router = Router();
export const STEPS = ['contener', 'evaluar', 'agencia', 'titulares', 'registro'] as const;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Pasos obligatorios para cerrar: con datos sensibles se exige notificar a la Agencia y a los titulares. */
export function requiredSteps(sensitive: boolean) {
  return sensitive ? [...STEPS] : ['contener', 'evaluar', 'registro'];
}

router.get('/', async (req, res) => {
  const rows = await db.select().from(schema.incidents).where(eq(schema.incidents.organizationId, req.user!.organizationId)).orderBy(desc(schema.incidents.detectedAt));
  res.json(rows.map((r) => ({ ...r, requiredSteps: requiredSteps(r.sensitive) })));
});

router.post('/', canOperate, async (req, res) => {
  const b = parse(z.object({
    title: z.string().trim().min(5).max(200), detectedAt: isoDate.refine((d) => d <= todayISO(), 'La fecha no puede ser futura'),
    type: z.enum(['Acceso no autorizado', 'Divulgación accidental', 'Pérdida o robo de equipo', 'Ransomware', 'Otro']),
    affected: z.string().trim().max(100).optional(), sensitive: z.boolean().default(true), notes: z.string().trim().max(4000).optional(),
  }), req.body);
  const [r] = await db.insert(schema.incidents).values({ ...b, organizationId: req.user!.organizationId, createdBy: req.user!.id, steps: Object.fromEntries(STEPS.map((s) => [s, false])) }).returning();
  await audit(req, 'create', 'incident', r.id, { type: b.type, sensitive: b.sensitive });
  res.status(201).json({ ...r, requiredSteps: requiredSteps(r.sensitive) });
});

router.patch('/:id', canManage, async (req, res) => {
  const b = parse(z.object({
    steps: z.object(Object.fromEntries(STEPS.map((s) => [s, z.boolean().optional()]))).optional(),
    affected: z.string().trim().max(100).optional(), notes: z.string().trim().max(4000).optional(), sensitive: z.boolean().optional(),
  }), req.body);
  const [cur] = await db.select().from(schema.incidents).where(and(eq(schema.incidents.id, String(req.params.id)), eq(schema.incidents.organizationId, req.user!.organizationId)));
  if (!cur) throw notFound('Incidente no encontrado');
  const steps = { ...cur.steps, ...(b.steps ?? {}) } as Record<string, boolean>;
  const set: Partial<typeof schema.incidents.$inferInsert> = { affected: b.affected ?? cur.affected, notes: b.notes ?? cur.notes, sensitive: b.sensitive ?? cur.sensitive, steps, updatedAt: new Date() };
  if (steps.agencia && !cur.agencyNotifiedAt) set.agencyNotifiedAt = new Date();
  if (!steps.agencia) set.agencyNotifiedAt = null;
  if (steps.titulares && !cur.subjectsNotifiedAt) set.subjectsNotifiedAt = new Date();
  if (!steps.titulares) set.subjectsNotifiedAt = null;
  // Si se desmarca un paso obligatorio en un incidente cerrado, se reabre
  if (cur.status === 'CERRADO' && requiredSteps(set.sensitive!).some((s) => !steps[s])) { set.status = 'EN_EVALUACION'; set.closedAt = null; }
  const [r] = await db.update(schema.incidents).set(set).where(eq(schema.incidents.id, cur.id)).returning();
  await audit(req, 'update', 'incident', r.id, { steps: b.steps });
  res.json({ ...r, requiredSteps: requiredSteps(r.sensitive) });
});

router.post('/:id/close', canManage, async (req, res) => {
  const [cur] = await db.select().from(schema.incidents).where(and(eq(schema.incidents.id, String(req.params.id)), eq(schema.incidents.organizationId, req.user!.organizationId)));
  if (!cur) throw notFound('Incidente no encontrado');
  const missing = requiredSteps(cur.sensitive).filter((s) => !cur.steps[s]);
  if (missing.length) throw badRequest(`Faltan pasos obligatorios: ${missing.join(', ')}`);
  const [r] = await db.update(schema.incidents).set({ status: 'CERRADO', closedAt: new Date(), updatedAt: new Date() }).where(eq(schema.incidents.id, cur.id)).returning();
  await audit(req, 'close', 'incident', r.id);
  res.json({ ...r, requiredSteps: requiredSteps(r.sensitive) });
});
