import { Router } from 'express';
import { z } from 'zod';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { parse } from '../lib/validate.js';
import { badRequest, notFound } from '../lib/errors.js';
import { audit } from '../lib/audit.js';
import { todayISO } from '../lib/dates.js';
import { canManage } from '../middleware/auth.js';
import { orgVars, renderTemplate } from '../domain/templates.js';

export const router = Router();

async function org(orgId: string) {
  const [o] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId));
  return o;
}

/** Plantillas con el estado del último documento guardado de cada una. */
router.get('/templates', async (req, res) => {
  const orgId = req.user!.organizationId;
  const tpls = await db.select({ id: schema.documentTemplates.id, title: schema.documentTemplates.title, reference: schema.documentTemplates.reference })
    .from(schema.documentTemplates).orderBy(asc(schema.documentTemplates.sortOrder));
  const latest = await db.execute<{ template_id: string; version: number; status: string; approved_at: string | null }>(sql`
    select distinct on (template_id) template_id, version, status, approved_at
    from documents where organization_id = ${orgId} order by template_id, version desc`);
  const m = new Map(latest.rows.map((r) => [r.template_id, r]));
  res.json(tpls.map((t) => ({ ...t, latest: m.get(t.id) ?? null })));
});

/** Borrador generado con los datos actuales de la clínica (no se guarda). */
router.get('/templates/:id/preview', async (req, res) => {
  const [t] = await db.select().from(schema.documentTemplates).where(eq(schema.documentTemplates.id, String(req.params.id)));
  if (!t) throw notFound('Plantilla no encontrada');
  const o = await org(req.user!.organizationId);
  res.json({ templateId: t.id, title: t.title, reference: t.reference, body: renderTemplate(t.body, orgVars(o, todayISO())) });
});

/** Historial de versiones guardadas de una plantilla. */
router.get('/', async (req, res) => {
  const q = parse(z.object({ templateId: z.string().max(60).optional() }), req.query);
  const conds = [eq(schema.documents.organizationId, req.user!.organizationId)];
  if (q.templateId) conds.push(eq(schema.documents.templateId, q.templateId));
  res.json(await db.select().from(schema.documents).where(and(...conds)).orderBy(desc(schema.documents.createdAt)));
});

router.get('/:id', async (req, res) => {
  const [d] = await db.select().from(schema.documents).where(and(eq(schema.documents.id, String(req.params.id)), eq(schema.documents.organizationId, req.user!.organizationId)));
  if (!d) throw notFound('Documento no encontrado');
  res.json(d);
});

/** Guarda una nueva versión (borrador). Si no se envía texto, usa la plantilla con los datos de la clínica. */
router.post('/', canManage, async (req, res) => {
  const b = parse(z.object({ templateId: z.string().min(1).max(60), body: z.string().max(50_000).optional() }), req.body);
  const orgId = req.user!.organizationId;
  const [t] = await db.select().from(schema.documentTemplates).where(eq(schema.documentTemplates.id, b.templateId));
  if (!t) throw notFound('Plantilla no encontrada');
  const o = await org(orgId);
  const text = b.body?.trim() ? b.body : renderTemplate(t.body, orgVars(o, todayISO()));
  const [last] = await db.select({ v: schema.documents.version }).from(schema.documents)
    .where(and(eq(schema.documents.organizationId, orgId), eq(schema.documents.templateId, t.id))).orderBy(desc(schema.documents.version)).limit(1);
  const [d] = await db.insert(schema.documents).values({ organizationId: orgId, templateId: t.id, title: t.title, body: text, version: (last?.v ?? 0) + 1, createdBy: req.user!.id }).returning();
  await audit(req, 'create', 'document', d.id, { templateId: t.id, version: d.version });
  res.status(201).json(d);
});

/** Aprobación humana obligatoria antes de usar un documento. */
router.post('/:id/approve', canManage, async (req, res) => {
  const orgId = req.user!.organizationId;
  const [d] = await db.select().from(schema.documents).where(and(eq(schema.documents.id, String(req.params.id)), eq(schema.documents.organizationId, orgId)));
  if (!d) throw notFound('Documento no encontrado');
  if (d.status === 'APROBADO') throw badRequest('El documento ya está aprobado');
  if (/\[clinica\.[a-z]+\]/.test(d.body)) throw badRequest('Complete los datos de la clínica que faltan (aparecen entre corchetes) antes de aprobar');
  const [r] = await db.update(schema.documents).set({ status: 'APROBADO', approvedBy: req.user!.id, approvedAt: new Date() }).where(eq(schema.documents.id, d.id)).returning();
  await audit(req, 'approve', 'document', d.id, { version: d.version });
  res.json(r);
});
