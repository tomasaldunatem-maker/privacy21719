import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { parse } from '../lib/validate.js';
import { audit } from '../lib/audit.js';
import { isValidRut, formatRut } from '../lib/rut.js';
import { canManage } from '../middleware/auth.js';

export const router = Router();

router.get('/', async (req, res) => {
  const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, req.user!.organizationId));
  res.json(org);
});

router.patch('/', canManage, async (req, res) => {
  const b = parse(z.object({
    name: z.string().trim().min(2).max(160).optional(),
    rut: z.string().trim().max(20).refine((v) => !v || isValidRut(v), 'RUT inválido').optional(),
    address: z.string().trim().max(240).optional(),
    privacyEmail: z.string().trim().email().max(200).or(z.literal('')).optional(),
    privacyOfficer: z.string().trim().max(160).optional(),
  }), req.body);
  if (b.rut) b.rut = formatRut(b.rut);
  const [org] = await db.update(schema.organizations).set({ ...b, updatedAt: new Date() }).where(eq(schema.organizations.id, req.user!.organizationId)).returning();
  await audit(req, 'update', 'organization', org.id, Object.keys(b).reduce((m, k) => ({ ...m, [k]: true }), {}));
  res.json(org);
});
