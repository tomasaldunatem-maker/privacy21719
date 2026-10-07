import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { and, asc, desc, eq, ilike, like, or, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { parse } from '../lib/validate.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { audit } from '../lib/audit.js';
import { requestDueDate, todayISO } from '../lib/dates.js';
import { isValidRut, formatRut } from '../lib/rut.js';
import { canManage, canOperate } from '../middleware/auth.js';
import { providerFor } from '../integrations/registry.js';
import { IntegrationError } from '../integrations/types.js';

export const router = Router();
export const publicRouter = Router();

const TYPES = ['ACCESO', 'RECTIFICACION', 'SUPRESION', 'OPOSICION', 'PORTABILIDAD', 'BLOQUEO'] as const;
const STATUSES = ['RECIBIDA', 'VERIFICANDO_IDENTIDAD', 'EN_ANALISIS', 'RESPONDIDA', 'RECHAZADA'] as const;
const CLOSED = ['RESPONDIDA', 'RECHAZADA'];
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida');
const rut = z.string().trim().max(20).refine((v) => !v || isValidRut(v), 'RUT inválido');

async function nextFolio(orgId: string, year: string) {
  const prefix = `SOL-${year}-`;
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.dataRequests)
    .where(and(eq(schema.dataRequests.organizationId, orgId), like(schema.dataRequests.folio, `${prefix}%`)));
  return (n: number) => `${prefix}${String((r?.n ?? 0) + 1 + n).padStart(4, '0')}`;
}

/** Inserta con folio correlativo; reintenta si dos solicitudes llegan al mismo tiempo. */
export async function createRequest(orgId: string, v: {
  requesterName: string; requesterRut?: string | null; requesterEmail?: string | null; type: (typeof TYPES)[number];
  details?: string | null; channel: string; receivedAt: string;
}, userId: string | null) {
  const folioFor = await nextFolio(orgId, v.receivedAt.slice(0, 4));
  for (let i = 0; i < 5; i++) {
    try {
      const [r] = await db.insert(schema.dataRequests).values({
        organizationId: orgId, folio: folioFor(i), ...v,
        requesterRut: v.requesterRut ? formatRut(v.requesterRut) : null,
        dueAt: requestDueDate(v.receivedAt),
      }).returning();
      await db.insert(schema.requestEvents).values({ requestId: r.id, userId, action: 'Recibida', note: `Canal: ${v.channel}` });
      return r;
    } catch (e) {
      if ((e as { code?: string }).code !== '23505') throw e;
    }
  }
  throw new Error('No se pudo asignar folio');
}

router.get('/', async (req, res) => {
  const q = parse(z.object({
    q: z.string().max(100).optional(), status: z.enum(STATUSES).optional(), type: z.enum(TYPES).optional(), open: z.enum(['true', 'false']).optional(),
  }), req.query);
  const conds = [eq(schema.dataRequests.organizationId, req.user!.organizationId)];
  if (q.q) conds.push(or(ilike(schema.dataRequests.requesterName, `%${q.q}%`), ilike(schema.dataRequests.folio, `%${q.q}%`), ilike(schema.dataRequests.requesterRut, `%${q.q}%`))!);
  if (q.status) conds.push(eq(schema.dataRequests.status, q.status));
  if (q.type) conds.push(eq(schema.dataRequests.type, q.type));
  if (q.open === 'true') conds.push(sql`${schema.dataRequests.status} not in ('RESPONDIDA','RECHAZADA')`);
  res.json(await db.select().from(schema.dataRequests).where(and(...conds)).orderBy(asc(schema.dataRequests.dueAt)));
});

router.get('/:id', async (req, res) => {
  const orgId = req.user!.organizationId;
  const [r] = await db.select().from(schema.dataRequests).where(and(eq(schema.dataRequests.id, String(req.params.id)), eq(schema.dataRequests.organizationId, orgId)));
  if (!r) throw notFound('Solicitud no encontrada');
  const events = await db.select({ e: schema.requestEvents, userName: schema.users.name }).from(schema.requestEvents)
    .leftJoin(schema.users, eq(schema.users.id, schema.requestEvents.userId))
    .where(eq(schema.requestEvents.requestId, r.id)).orderBy(desc(schema.requestEvents.createdAt));
  const patient = r.patientId ? (await db.select().from(schema.patients).where(and(eq(schema.patients.id, r.patientId), eq(schema.patients.organizationId, orgId))))[0] ?? null : null;
  // Sugerencias de paciente por RUT o correo para vincular la solicitud
  let suggestions: (typeof schema.patients.$inferSelect)[] = [];
  if (!patient && (r.requesterRut || r.requesterEmail)) {
    const c = [];
    if (r.requesterRut) c.push(eq(schema.patients.rut, r.requesterRut));
    if (r.requesterEmail) c.push(ilike(schema.patients.email, r.requesterEmail));
    suggestions = await db.select().from(schema.patients).where(and(eq(schema.patients.organizationId, orgId), or(...c))).limit(5);
  }
  res.json({ ...r, events: events.map((x) => ({ ...x.e, userName: x.userName })), patient, suggestions });
});

router.post('/', canOperate, async (req, res) => {
  const b = parse(z.object({
    requesterName: z.string().trim().min(2).max(160), requesterRut: rut.optional(), requesterEmail: z.string().trim().email().max(200).or(z.literal('')).optional(),
    type: z.enum(TYPES), details: z.string().trim().max(2000).optional(), channel: z.enum(['Portal web', 'Correo', 'Presencial en recepción', 'Teléfono']).default('Presencial en recepción'),
    receivedAt: isoDate.refine((d) => d <= todayISO(), 'La fecha no puede ser futura'),
  }), req.body);
  const r = await createRequest(req.user!.organizationId, { ...b, requesterEmail: b.requesterEmail || null, requesterRut: b.requesterRut || null }, req.user!.id);
  await audit(req, 'create', 'data_request', r.id, { folio: r.folio, type: r.type });
  res.status(201).json(r);
});

router.patch('/:id', canOperate, async (req, res) => {
  const b = parse(z.object({
    status: z.enum(STATUSES).optional(), identityVerified: z.boolean().optional(),
    patientId: z.string().uuid().nullable().optional(), responseSummary: z.string().trim().max(4000).optional(), note: z.string().trim().max(1000).optional(),
  }), req.body);
  const orgId = req.user!.organizationId;
  const [cur] = await db.select().from(schema.dataRequests).where(and(eq(schema.dataRequests.id, String(req.params.id)), eq(schema.dataRequests.organizationId, orgId)));
  if (!cur) throw notFound('Solicitud no encontrada');
  if (req.user!.role === 'STAFF' && (b.status && CLOSED.includes(b.status))) throw forbidden('Solo el responsable de privacidad puede cerrar solicitudes');
  if (b.status && CLOSED.includes(b.status) && !(b.responseSummary || cur.responseSummary)) throw badRequest('Antes de cerrar, registre un resumen de la respuesta enviada al paciente');
  if (b.patientId) {
    const [p] = await db.select({ id: schema.patients.id }).from(schema.patients).where(and(eq(schema.patients.id, b.patientId), eq(schema.patients.organizationId, orgId)));
    if (!p) throw badRequest('Paciente no válido');
  }
  const { note, ...set } = b;
  const closedAt = b.status ? (CLOSED.includes(b.status) ? new Date() : null) : undefined;
  const [r] = await db.update(schema.dataRequests).set({ ...set, ...(closedAt !== undefined ? { closedAt } : {}), updatedAt: new Date() }).where(eq(schema.dataRequests.id, cur.id)).returning();
  const evs: string[] = [];
  if (b.status && b.status !== cur.status) evs.push(`Estado: ${b.status.replace(/_/g, ' ').toLowerCase()}`);
  if (b.identityVerified !== undefined && b.identityVerified !== cur.identityVerified) evs.push(b.identityVerified ? 'Identidad verificada' : 'Verificación de identidad anulada');
  if (b.patientId !== undefined && b.patientId !== cur.patientId) evs.push(b.patientId ? 'Vinculada a paciente del software clínico' : 'Desvinculada del paciente');
  if (b.responseSummary && b.responseSummary !== cur.responseSummary) evs.push('Respuesta registrada');
  if (note) evs.push('Nota');
  for (const a of evs) await db.insert(schema.requestEvents).values({ requestId: r.id, userId: req.user!.id, action: a, note: a === 'Nota' ? note : null });
  await audit(req, 'update', 'data_request', r.id, { status: b.status, identityVerified: b.identityVerified });
  res.json(r);
});

router.post('/:id/extend', canManage, async (req, res) => {
  const b = parse(z.object({ reason: z.string().trim().min(10, 'Indique el motivo (mínimo 10 caracteres)').max(1000) }), req.body);
  const [cur] = await db.select().from(schema.dataRequests).where(and(eq(schema.dataRequests.id, String(req.params.id)), eq(schema.dataRequests.organizationId, req.user!.organizationId)));
  if (!cur) throw notFound('Solicitud no encontrada');
  if (cur.extended) throw badRequest('El plazo ya fue prorrogado una vez');
  if (cur.dueAt < todayISO()) throw badRequest('La prórroga debe informarse antes de que venza el plazo original');
  const [r] = await db.update(schema.dataRequests).set({ extended: true, extensionReason: b.reason, dueAt: requestDueDate(cur.receivedAt, true), updatedAt: new Date() }).where(eq(schema.dataRequests.id, cur.id)).returning();
  await db.insert(schema.requestEvents).values({ requestId: r.id, userId: req.user!.id, action: 'Plazo prorrogado 30 días', note: b.reason });
  await audit(req, 'extend', 'data_request', r.id);
  res.json(r);
});

/**
 * Obtiene bajo demanda los datos del paciente desde el software clínico para responder
 * una solicitud de acceso o portabilidad. No se guardan: se devuelven y queda registro en auditoría.
 */
router.get('/:id/clinical-data', canManage, async (req, res) => {
  const orgId = req.user!.organizationId;
  const [r] = await db.select().from(schema.dataRequests).where(and(eq(schema.dataRequests.id, String(req.params.id)), eq(schema.dataRequests.organizationId, orgId)));
  if (!r) throw notFound('Solicitud no encontrada');
  if (!['ACCESO', 'PORTABILIDAD'].includes(r.type)) throw badRequest('Solo aplica a solicitudes de acceso o portabilidad');
  if (!r.identityVerified) throw badRequest('Primero verifique la identidad del solicitante');
  if (!r.patientId) throw badRequest('Vincule la solicitud a un paciente del software clínico');
  const [p] = await db.select().from(schema.patients).where(and(eq(schema.patients.id, r.patientId), eq(schema.patients.organizationId, orgId)));
  if (!p || p.source === 'manual') throw badRequest('El paciente vinculado no proviene del software clínico');
  const { provider } = await providerFor(orgId);
  if (provider.id !== p.source) throw badRequest('El paciente fue sincronizado desde otro proveedor distinto al configurado actualmente');
  try {
    const [patient, appts] = await Promise.all([provider.getPatient(p.externalId), provider.listPatientAppointments(p.externalId)]);
    await audit(req, 'export_clinical_data', 'data_request', r.id, { provider: provider.id, appointments: appts.length });
    await db.insert(schema.requestEvents).values({ requestId: r.id, userId: req.user!.id, action: `Datos obtenidos desde ${provider.label}` });
    res.json({
      generatedAt: new Date().toISOString(), folio: r.folio, source: provider.label, isMock: provider.isMock,
      patient, appointments: appts,
      note: 'Este MVP obtiene identificación y citas. La ficha clínica, odontograma e imágenes deben exportarse desde el software clínico.',
    });
  } catch (e) {
    if (e instanceof IntegrationError) throw badRequest(e.message);
    throw e;
  }
});

/* ───────── Formulario público para pacientes (sin login) ───────── */
const publicLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Demasiadas solicitudes desde esta conexión. Intente más tarde.' } });

publicRouter.get('/clinics/:slug', async (req, res) => {
  const [o] = await db.select({ name: schema.organizations.name, privacyEmail: schema.organizations.privacyEmail })
    .from(schema.organizations).where(eq(schema.organizations.slug, String(req.params.slug)));
  if (!o) throw notFound('Clínica no encontrada');
  res.json(o);
});

publicRouter.post('/clinics/:slug/requests', publicLimiter, async (req, res) => {
  const b = parse(z.object({
    requesterName: z.string().trim().min(3).max(160), requesterRut: rut.refine((v) => !!v, 'Ingrese su RUT'),
    requesterEmail: z.string().trim().email('Correo inválido').max(200), type: z.enum(TYPES),
    details: z.string().trim().max(2000).optional(), website: z.string().max(0).optional(), // trampa anti-bots
    consent: z.literal(true, { errorMap: () => ({ message: 'Debe aceptar el uso de sus datos para tramitar la solicitud' }) }),
  }), req.body);
  const [o] = await db.select({ id: schema.organizations.id }).from(schema.organizations).where(eq(schema.organizations.slug, String(req.params.slug)));
  if (!o) throw notFound('Clínica no encontrada');
  const r = await createRequest(o.id, {
    requesterName: b.requesterName, requesterRut: b.requesterRut, requesterEmail: b.requesterEmail, type: b.type, details: b.details ?? null,
    channel: 'Portal web', receivedAt: todayISO(),
  }, null);
  await audit(req, 'create_public', 'data_request', r.id, { folio: r.folio }, o.id);
  // Solo se devuelve lo que el paciente necesita como comprobante
  res.status(201).json({ folio: r.folio, receivedAt: r.receivedAt, dueAt: r.dueAt });
});

