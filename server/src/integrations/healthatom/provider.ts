import { HealthAtomClient } from './client.js';
import type { HealthAtomEndpoints } from './endpoints.js';
import { mapAppointment, mapBranch, mapPatient, mapProfessional } from './mappers.js';
import { IntegrationError, type ClinicSoftwareProvider, type NormalizedAppointment, type ProviderId } from '../types.js';

/** Implementación real para Dentalink o Medilink. Solo se usa en el backend. */
export class HealthAtomProvider implements ClinicSoftwareProvider {
  readonly isMock = false;
  private client: HealthAtomClient;

  constructor(
    readonly id: Exclude<ProviderId, 'mock'>,
    readonly label: string,
    private ep: HealthAtomEndpoints,
    opts: { baseUrl: string; token: string; timeoutMs: number; maxPages: number; fetchImpl?: typeof fetch },
  ) {
    if (!opts.token) throw new IntegrationError('config', `Falta el token de API de ${label}`);
    this.client = new HealthAtomClient({
      baseUrl: opts.baseUrl, authHeader: ep.authHeader(opts.token), timeoutMs: opts.timeoutMs,
      maxPages: opts.maxPages, fetchImpl: opts.fetchImpl,
    });
  }

  async testConnection() {
    try {
      await this.client.get(this.ep.healthCheckPath);
      return { ok: true, message: `Conexión con ${this.label} correcta${this.ep.verified ? '' : ' (rutas de API pendientes de verificar)'}` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Error desconocido' };
    }
  }

  async listPatients() { return (await this.client.getAll(this.ep.paths.patients)).map(mapPatient); }
  async listProfessionals() { return (await this.client.getAll(this.ep.paths.professionals)).map(mapProfessional); }
  async listBranches() { return (await this.client.getAll(this.ep.paths.branches)).map(mapBranch); }

  async listAppointments({ from, to }: { from: string; to: string }) {
    let raw;
    try {
      raw = await this.client.getAll(this.ep.paths.appointments, this.ep.appointmentsQuery(from, to));
    } catch (e) {
      // Si el filtro no es aceptado por la API, se lee sin filtro (acotado por maxPages) y se filtra aquí.
      if (e instanceof IntegrationError && e.status === 400) raw = await this.client.getAll(this.ep.paths.appointments);
      else throw e;
    }
    return raw.map(mapAppointment).filter((a): a is NormalizedAppointment => !!a && a.date >= from && a.date <= to);
  }

  async getPatient(externalId: string) {
    try {
      const items = HealthAtomClient.items(await this.client.get(this.ep.paths.patient(externalId)));
      return items[0] ? mapPatient(items[0]) : null;
    } catch (e) {
      if (e instanceof IntegrationError && e.kind === 'not_found') return null;
      throw e;
    }
  }

  async listPatientAppointments(externalId: string) {
    const raw = await this.client.getAll(this.ep.paths.patientAppointments(externalId));
    return raw.map(mapAppointment).filter((a): a is NormalizedAppointment => !!a);
  }
}
