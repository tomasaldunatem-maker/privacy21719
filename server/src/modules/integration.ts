import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { and, asc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { parse } from '../lib/validate.js';
import { badRequest } from '../lib/errors.js';
import { audit } from '../lib/audit.js';
import { encrypt, hasEncryptionKey } from '../lib/crypto.js';
import { addDaysISO, todayISO } from '../lib/dates.js';
import { isValidRut, formatRut } from '../lib/rut.js';
import { canManage, canOperate, requireRole } from '../middleware/auth.js';
import { PROVIDERS, buildProvider, resolveConfig } from '../integrations/registry.js';
import { DENTALINK_ENDPOINTS, MEDILINK_ENDPOINTS } from '../integrations/healthatom/endpoints.js';
import { activeSource, sourceFilter, syncOrganization } from './integration-sync.js';
import type { Role } from '../types.js';

export const router = Router();
const syncLimiter = rateLimit({ windowMs: 60_000, limit: 3, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Espere un minuto antes de volver a sincronizar' } });

/** Los usuarios de solo lectura ven datos de contacto parcialmente ocultos. */
const mask = (v: string | null, role: Role) => (!v || role !== 'VIEWER' ? v : v.length <= 4 ? '••••' : `${v.slice(0, 2)}••••${v.slice(-2)}`);

router.get('/', async (req, res) => {
  const orgId = req.user!.organizationId;
  const cfg = await resolveConfig(orgId);
  const [s] = await db.select().from(schema.integrationSettings).where(eq(schema.integrationSettings.organizationId, orgId));
  const ep = cfg.provider === 'dentalink' ? DENTALINK_ENDPOINTS : cfg.provider === 'medilink' ? MEDILINK_ENDPOINTS : null;
  res.json({
    provider: cfg.provider, label: PROVIDERS[cfg.provider].label, isMock: cfg.provider === 'mock',
    credentialSource: cfg.credentialSource, baseUrl: cfg.baseUrl,
    savedProvider: s?.provider ?? 'mock', tokenLast4: s?.tokenLast4 ?? null,
    endpointsVerified: ep ? ep.verified : null,
    encryptionKeyConfigured: hasEncryptionKey(),
    lastSyncAt: s?.lastSyncAt ?? null, lastSyncStatus: s?.lastSyncStatus ?? null, lastSyncError: s?.lastSyncError ?? null, lastSyncCounts: s?.lastSyncCounts ?? null,
    providers: Object.entries(PROVIDERS).map(([id, p]) => ({ id, label: p.label, defaultBaseUrl: p.defaultBaseUrl })),
  });
});

/** Guarda proveedor y credenciales de la clínica. El token se cifra y nunca vuelve al navegador. */
router.put('/', requireRole(), async (req, res) => {
  const b = parse(z.object({
    provider: z.enum(['mock', 'dentalink', 'medilink']),
    baseUrl: z.string().trim().url().refine((u) => u.startsWith('https://'), 'Debe usar https').optional().or(z.literal('')),
    token: z.string().trim().min(8, 'Token demasiado corto').max(500).optional().or(z.literal('')),
  }), req.body);
  const orgId = req.user!.organizationId;
  const [cur] = await db.select().from(schema.integrationSettings).where(eq(schema.integrationSettings.organizationId, orgId));
  const set: Partial<typeof schema.integrationSettings.$inferInsert> = { provider: b.provider, baseUrl: b.baseUrl || null, updatedAt: new Date() };
  if (b.provider === 'mock') { set.tokenCiphertext = null; set.tokenLast4 = null; }
  else if (b.token) {
    if (!hasEncryptionKey()) throw badRequest('El servidor no tiene configurada INTEGRATION_ENCRYPTION_KEY; no se pueden guardar credenciales');
    set.tokenCiphertext = encrypt(b.token); set.tokenLast4 = b.token.slice(-4);
  } else if (!cur?.tokenCiphertext || cur.provider !== b.provider) {
    throw badRequest('Ingrese el token de API del proveedor');
  }
  await db.insert(schema.integrationSettings).values({ organizationId: orgId, ...set })
    .onConflictDoUpdate({ target: schema.integrationSettings.organizationId, set });
  await audit(req, 'configure', 'integration', null, { provider: b.provider, tokenChanged: !!b.token });
  res.json({ ok: true });
});

router.post('/test', canManage, async (req, res) => {
  const cfg = await resolveConfig(req.user!.organizationId);
  try {
    const result = await buildProvider(cfg).testConnection();
    await audit(req, 'test', 'integration', null, { provider: cfg.provider, ok: result.ok });
    res.json(result);
  } catch (e) {
    res.json({ ok: false, message: e instanceof Error ? e.message : 'Error' });
  }
});

router.post('/sync', canManage, syncLimiter, async (req, res) => {
  const r = await syncOrganization(req.user!.organizationId);
  await audit(req, 'sync', 'integration', null, { ok: r.ok, provider: r.provider, ...(r.ok ? r.counts : {}) });
  res.status(r.ok ? 200 : 502).json(r.ok ? r : { error: r.error, provider: r.provider });
});

router.get('/patients', async (req, res) => {
  const q = parse(z.object({ q: z.string().trim().max(100).optional(), limit: z.coerce.number().int().min(1).max(200).default(50) }), req.query);
  const orgId = req.user!.organizationId;
  const src = await activeSource(orgId);
  const conds = [sourceFilter(schema.patients, orgId, src)!];
  if (q.q) {
    const like = `%${q.q}%`;
    conds.push(or(ilike(schema.patients.firstName, like), ilike(schema.patients.lastName, like), ilike(schema.patients.rut, like), ilike(schema.patients.email, like),
      ilike(sql`${schema.patients.firstName} || ' ' || coalesce(${schema.patients.lastName}, '')`, like))!);
  }
  const rows = await db.select().from(schema.patients).where(and(...conds)).orderBy(asc(schema.patients.lastName), asc(schema.patients.firstName)).limit(q.limit);
  const role = req.user!.role;
  res.json(rows.map((p) => ({ ...p, rut: mask(p.rut, role), email: mask(p.email, role), phone: mask(p.phone, role) })));
});

/** Registro manual de paciente (clínicas sin software integrado o titulares que no están en él). */
router.post('/patients', canOperate, async (req, res) => {
  const b = parse(z.object({
    firstName: z.string().trim().min(2).max(100), lastName: z.string().trim().max(120).optional(),
    rut: z.string().trim().max(20).refine((v) => !v || isValidRut(v), 'RUT inválido').optional(),
    email: z.string().trim().email().max(200).or(z.literal('')).optional(), phone: z.string().trim().max(40).optional(),
  }), req.body);
  const orgId = req.user!.organizationId;
  const rut = b.rut ? formatRut(b.rut) : null;
  if (rut) {
    const [dup] = await db.select({ id: schema.patients.id }).from(schema.patients).where(and(eq(schema.patients.organizationId, orgId), eq(schema.patients.rut, rut), eq(schema.patients.source, 'manual')));
    if (dup) throw badRequest('Ya existe un paciente manual con ese RUT');
  }
  const [p] = await db.insert(schema.patients).values({
    organizationId: orgId, source: 'manual', externalId: `MAN-${crypto.randomUUID()}`, firstName: b.firstName, lastName: b.lastName || null,
    rut, email: b.email || null, phone: b.phone || null,
  }).returning();
  await audit(req, 'create', 'patient', p.id, { source: 'manual' });
  res.status(201).json(p);
});

router.get('/professionals', async (req, res) => {
  const orgId = req.user!.organizationId;
  const src = await activeSource(orgId);
  res.json(await db.select().from(schema.professionals).where(sourceFilter(schema.professionals, orgId, src)).orderBy(asc(schema.professionals.name)));
});

router.get('/branches', async (req, res) => {
  const orgId = req.user!.organizationId;
  const src = await activeSource(orgId);
  res.json(await db.select().from(schema.branches).where(sourceFilter(schema.branches, orgId, src)).orderBy(asc(schema.branches.name)));
});

router.get('/appointments', async (req, res) => {
  const today = todayISO();
  const q = parse(z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(addDaysISO(today, -7)),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(addDaysISO(today, 14)),
    professional: z.string().max(100).optional(),
  }), req.query);
  if (q.from > q.to) throw badRequest('El rango de fechas no es válido');
  const orgId = req.user!.organizationId;
  const src = await activeSource(orgId);
  const conds = [sourceFilter(schema.appointments, orgId, src)!, gte(schema.appointments.date, q.from), lte(schema.appointments.date, q.to)];
  if (q.professional) conds.push(eq(schema.appointments.professionalExternalId, q.professional));
  const rows = await db.select({
    a: schema.appointments,
    patientName: sql<string | null>`(select p.first_name || ' ' || coalesce(p.last_name,'') from patients p where p.organization_id = ${orgId} and p.source = ${schema.appointments.source} and p.external_id = ${schema.appointments.patientExternalId} limit 1)`,
    professionalName: sql<string | null>`(select d.name from professionals d where d.organization_id = ${orgId} and d.source = ${schema.appointments.source} and d.external_id = ${schema.appointments.professionalExternalId} limit 1)`,
    branchName: sql<string | null>`(select b.name from branches b where b.organization_id = ${orgId} and b.source = ${schema.appointments.source} and b.external_id = ${schema.appointments.branchExternalId} limit 1)`,
  }).from(schema.appointments).where(and(...conds)).orderBy(asc(schema.appointments.date), asc(schema.appointments.time));
  res.json(rows.map((r) => ({ ...r.a, patientName: r.patientName, professionalName: r.professionalName, branchName: r.branchName })));
});
