import { and, eq, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { db, schema } from '../db/index.js';
import { addDaysISO, todayISO } from '../lib/dates.js';
import { providerFor } from '../integrations/registry.js';
import { IntegrationError } from '../integrations/types.js';

/** Ventana de citas que se sincroniza (solo agenda, sin notas clínicas). */
export const APPOINTMENT_WINDOW = { pastDays: 90, futureDays: 60 };

/**
 * Sincroniza el espejo mínimo (pacientes, profesionales, sucursales, citas) desde el software clínico.
 * Usa upsert por (clínica, origen, id externo), por lo que es seguro ejecutarla varias veces.
 */
export async function syncOrganization(orgId: string) {
  const { cfg, provider } = await providerFor(orgId);
  const source = provider.id;
  const now = new Date();
  const today = todayISO();
  try {
    const [pats, pros, brs, apps] = await Promise.all([
      provider.listPatients(),
      provider.listProfessionals(),
      provider.listBranches(),
      provider.listAppointments({ from: addDaysISO(today, -APPOINTMENT_WINDOW.pastDays), to: addDaysISO(today, APPOINTMENT_WINDOW.futureDays) }),
    ]);

    await db.transaction(async (tx) => {
      for (const p of pats) {
        await tx.insert(schema.patients).values({ organizationId: orgId, source, ...p, lastName: p.lastName ?? null, syncedAt: now })
          .onConflictDoUpdate({
            target: [schema.patients.organizationId, schema.patients.source, schema.patients.externalId],
            set: { firstName: p.firstName, lastName: p.lastName ?? null, rut: p.rut ?? null, email: p.email ?? null, phone: p.phone ?? null, syncedAt: now, updatedAt: now },
          });
      }
      for (const p of pros) {
        await tx.insert(schema.professionals).values({ organizationId: orgId, source, ...p, syncedAt: now })
          .onConflictDoUpdate({
            target: [schema.professionals.organizationId, schema.professionals.source, schema.professionals.externalId],
            set: { name: p.name, specialty: p.specialty ?? null, active: p.active, syncedAt: now },
          });
      }
      for (const b of brs) {
        await tx.insert(schema.branches).values({ organizationId: orgId, source, ...b, syncedAt: now })
          .onConflictDoUpdate({
            target: [schema.branches.organizationId, schema.branches.source, schema.branches.externalId],
            set: { name: b.name, address: b.address ?? null, syncedAt: now },
          });
      }
      for (const a of apps) {
        const v = { patientExternalId: a.patientExternalId ?? null, professionalExternalId: a.professionalExternalId ?? null, branchExternalId: a.branchExternalId ?? null, date: a.date, time: a.time ?? null, durationMin: a.durationMin ?? null, status: a.status ?? null, syncedAt: now };
        await tx.insert(schema.appointments).values({ organizationId: orgId, source, externalId: a.externalId, ...v })
          .onConflictDoUpdate({ target: [schema.appointments.organizationId, schema.appointments.source, schema.appointments.externalId], set: v });
      }
    });

    const counts = { patients: pats.length, professionals: pros.length, branches: brs.length, appointments: apps.length };
    await upsertStatus(orgId, cfg.provider, { lastSyncAt: now, lastSyncStatus: 'OK', lastSyncError: null, lastSyncCounts: counts });
    return { ok: true as const, provider: source, isMock: provider.isMock, counts };
  } catch (e) {
    const msg = e instanceof IntegrationError || e instanceof Error ? e.message : 'Error desconocido';
    await upsertStatus(orgId, cfg.provider, { lastSyncAt: now, lastSyncStatus: 'ERROR', lastSyncError: msg.slice(0, 500) });
    return { ok: false as const, provider: source, isMock: provider.isMock, error: msg };
  }
}

async function upsertStatus(orgId: string, provider: string, set: Partial<typeof schema.integrationSettings.$inferInsert>) {
  await db.insert(schema.integrationSettings).values({ organizationId: orgId, provider, ...set })
    .onConflictDoUpdate({ target: schema.integrationSettings.organizationId, set: { ...set, updatedAt: new Date() } });
}

/** Origen de datos activo para la clínica (para no mezclar datos mock con datos reales). */
export async function activeSource(orgId: string): Promise<'dentalink' | 'medilink' | 'mock'> {
  const { provider } = await providerFor(orgId);
  return provider.id;
}

export const sourceFilter = (table: { organizationId: AnyPgColumn; source: AnyPgColumn }, orgId: string, src: string) =>
  and(eq(table.organizationId, orgId), sql`${table.source} in (${src}, 'manual')`);
