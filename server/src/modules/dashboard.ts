import { Router } from 'express';
import { and, asc, count, eq, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { LAW_EFFECTIVE_DATE, addDaysISO, daysBetween, todayISO } from '../lib/dates.js';
import { loadDiagnostic } from './diagnostic.js';
import { activeSource, sourceFilter } from './integration-sync.js';
import { resolveConfig, PROVIDERS } from '../integrations/registry.js';

export const router = Router();

/** Todos los indicadores se calculan desde la base de datos en cada consulta. */
router.get('/', async (req, res) => {
  const orgId = req.user!.organizationId;
  const today = todayISO();
  const n = (rows: { c: number }[]) => Number(rows[0]?.c ?? 0);

  const [diag, acts, sensActs, dpiaPending, vendorsAll, vendorsNoContract, openReqs, openInc, tasksAll, tasksOpen, tasksWithEv, tasksOverdue] = await Promise.all([
    loadDiagnostic(orgId),
    db.select({ c: count() }).from(schema.processingActivities).where(eq(schema.processingActivities.organizationId, orgId)),
    db.select({ c: count() }).from(schema.processingActivities).where(and(eq(schema.processingActivities.organizationId, orgId), eq(schema.processingActivities.sensitive, true))),
    db.select({ c: count() }).from(schema.processingActivities).where(and(eq(schema.processingActivities.organizationId, orgId), sql`${schema.processingActivities.dpiaStatus} in ('PENDIENTE','EN_CURSO')`)),
    db.select({ c: count() }).from(schema.vendors).where(eq(schema.vendors.organizationId, orgId)),
    db.select({ c: count() }).from(schema.vendors).where(and(eq(schema.vendors.organizationId, orgId), sql`${schema.vendors.contractStatus} <> 'FIRMADO'`)),
    db.select().from(schema.dataRequests).where(and(eq(schema.dataRequests.organizationId, orgId), sql`${schema.dataRequests.status} not in ('RESPONDIDA','RECHAZADA')`)).orderBy(asc(schema.dataRequests.dueAt)),
    db.select({ c: count() }).from(schema.incidents).where(and(eq(schema.incidents.organizationId, orgId), eq(schema.incidents.status, 'EN_EVALUACION'))),
    db.select({ c: count() }).from(schema.tasks).where(eq(schema.tasks.organizationId, orgId)),
    db.select().from(schema.tasks).where(and(eq(schema.tasks.organizationId, orgId), sql`${schema.tasks.status} <> 'COMPLETADA'`)).orderBy(asc(schema.tasks.dueDate)),
    db.select({ c: sql<number>`count(distinct ${schema.evidence.taskId})::int` }).from(schema.evidence).where(eq(schema.evidence.organizationId, orgId)),
    db.select({ c: count() }).from(schema.tasks).where(and(eq(schema.tasks.organizationId, orgId), sql`${schema.tasks.status} <> 'COMPLETADA'`, sql`${schema.tasks.dueDate} < ${today}`)),
  ]);

  const src = await activeSource(orgId);
  const cfg = await resolveConfig(orgId);
  const [pats, pros, apptsNext7] = await Promise.all([
    db.select({ c: count() }).from(schema.patients).where(sourceFilter(schema.patients, orgId, src)),
    db.select({ c: count() }).from(schema.professionals).where(and(sourceFilter(schema.professionals, orgId, src), eq(schema.professionals.active, true))),
    db.select({ c: count() }).from(schema.appointments).where(and(sourceFilter(schema.appointments, orgId, src), sql`${schema.appointments.date} between ${today} and ${addDaysISO(today, 7)}`)),
  ]);
  const [integ] = await db.select().from(schema.integrationSettings).where(eq(schema.integrationSettings.organizationId, orgId));

  res.json({
    today,
    daysToLaw: daysBetween(today, LAW_EFFECTIVE_DATE),
    compliance: { score: diag.score, answered: diag.answered, totalQuestions: diag.questions.length, riskLevel: diag.riskLevel, criticalGaps: diag.criticalGaps },
    priorities: diag.priorities.slice(0, 3),
    processing: { total: n(acts), sensitive: n(sensActs), dpiaPending: n(dpiaPending) },
    vendors: { total: n(vendorsAll), withoutContract: n(vendorsNoContract) },
    requests: {
      open: openReqs.length,
      overdue: openReqs.filter((r) => r.dueAt < today).length,
      dueSoon: openReqs.filter((r) => r.dueAt >= today && daysBetween(today, r.dueAt) <= 5).length,
      upcoming: openReqs.slice(0, 5).map((r) => ({ id: r.id, folio: r.folio, type: r.type, requesterName: r.requesterName, details: r.details, dueAt: r.dueAt, daysLeft: daysBetween(today, r.dueAt) })),
    },
    incidents: { open: n(openInc) },
    tasks: {
      total: n(tasksAll), open: tasksOpen.length, overdue: n(tasksOverdue), withEvidence: n(tasksWithEv),
      upcoming: tasksOpen.slice(0, 5).map((t) => ({ id: t.id, control: t.control, obligation: t.obligation, owner: t.owner, dueDate: t.dueDate, daysLeft: daysBetween(today, t.dueDate) })),
    },
    clinicSoftware: {
      provider: cfg.provider, label: PROVIDERS[cfg.provider].label, isMock: cfg.provider === 'mock',
      patients: n(pats), professionals: n(pros), appointmentsNext7: n(apptsNext7), lastSyncAt: integ?.lastSyncAt ?? null, lastSyncStatus: integ?.lastSyncStatus ?? null,
    },
  });
});
