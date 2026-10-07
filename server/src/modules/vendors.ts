import { Router } from 'express';
import { z } from 'zod';
import { and, asc, eq, ilike, or } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { parse } from '../lib/validate.js';
import { notFound } from '../lib/errors.js';
import { audit } from '../lib/audit.js';
import { canManage } from '../middleware/auth.js';
import { vendorRisk } from '../domain/vendors.js';

export const router = Router();
const contract = z.enum(['FIRMADO', 'PENDIENTE', 'SIN_CONTRATO']);
const body = z.object({
  name: z.string().trim().min(2).max(160), service: z.string().trim().max(240).optional().nullable(),
  sensitive: z.boolean().default(false), contractStatus: contract.default('SIN_CONTRATO'),
  outsideChile: z.enum(['SI', 'NO', 'NO_SE_SABE']).default('NO_SE_SABE'),
  lastReview: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

router.get('/', async (req, res) => {
  const q = parse(z.object({ q: z.string().max(100).optional(), contract: contract.optional() }), req.query);
  const conds = [eq(schema.vendors.organizationId, req.user!.organizationId)];
  if (q.q) conds.push(or(ilike(schema.vendors.name, `%${q.q}%`), ilike(schema.vendors.service, `%${q.q}%`))!);
  if (q.contract) conds.push(eq(schema.vendors.contractStatus, q.contract));
  res.json(await db.select().from(schema.vendors).where(and(...conds)).orderBy(asc(schema.vendors.name)));
});

router.post('/', canManage, async (req, res) => {
  const b = parse(body, req.body);
  const [v] = await db.insert(schema.vendors).values({ ...b, organizationId: req.user!.organizationId, risk: vendorRisk(b) }).returning();
  await audit(req, 'create', 'vendor', v.id, { name: v.name });
  res.status(201).json(v);
});

router.patch('/:id', canManage, async (req, res) => {
  const b = parse(body.partial(), req.body);
  const orgId = req.user!.organizationId;
  const [cur] = await db.select().from(schema.vendors).where(and(eq(schema.vendors.id, String(req.params.id)), eq(schema.vendors.organizationId, orgId)));
  if (!cur) throw notFound('Proveedor no encontrado');
  const next = { ...cur, ...b };
  const [v] = await db.update(schema.vendors).set({ ...b, risk: vendorRisk(next), updatedAt: new Date() }).where(eq(schema.vendors.id, cur.id)).returning();
  await audit(req, 'update', 'vendor', v.id, b);
  res.json(v);
});

router.delete('/:id', canManage, async (req, res) => {
  const [v] = await db.delete(schema.vendors).where(and(eq(schema.vendors.id, String(req.params.id)), eq(schema.vendors.organizationId, req.user!.organizationId))).returning();
  if (!v) throw notFound('Proveedor no encontrado');
  await audit(req, 'delete', 'vendor', v.id, { name: v.name });
  res.json({ ok: true });
});
