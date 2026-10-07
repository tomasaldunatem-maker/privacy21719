import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addDaysISO, todayISO } from '../../lib/dates.js';
import type { ClinicSoftwareProvider, NormalizedAppointment, NormalizedBranch, NormalizedPatient, NormalizedProfessional } from '../types.js';

/**
 * Proveedor de PRUEBA. Lee datos ficticios desde server/mock-data/clinic-software.
 * Se usa como respaldo cuando la clínica no tiene credenciales de Dentalink/Medilink.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(here, here.includes(`${path.sep}dist${path.sep}`) ? '../../../../mock-data/clinic-software' : '../../../mock-data/clinic-software');

async function read<T>(file: string): Promise<T> {
  return JSON.parse(await fs.readFile(path.join(DIR, file), 'utf8')) as T;
}

export class MockProvider implements ClinicSoftwareProvider {
  readonly id = 'mock' as const;
  readonly label = 'Datos de prueba';
  readonly isMock = true;

  async testConnection() { return { ok: true, message: 'Usando datos de prueba (sin conexión real)' }; }
  listPatients() { return read<NormalizedPatient[]>('patients.json'); }
  listProfessionals() { return read<NormalizedProfessional[]>('professionals.json'); }
  listBranches() { return read<NormalizedBranch[]>('branches.json'); }

  private async allAppointments(): Promise<NormalizedAppointment[]> {
    const raw = await read<Array<Omit<NormalizedAppointment, 'date'> & { dayOffset: number }>>('appointments.json');
    const today = todayISO();
    return raw.map(({ dayOffset, ...a }) => ({ ...a, date: addDaysISO(today, dayOffset) }));
  }
  async listAppointments({ from, to }: { from: string; to: string }) {
    return (await this.allAppointments()).filter((a) => a.date >= from && a.date <= to);
  }
  async getPatient(id: string) { return (await this.listPatients()).find((p) => p.externalId === id) ?? null; }
  async listPatientAppointments(id: string) { return (await this.allAppointments()).filter((a) => a.patientExternalId === id); }
}
