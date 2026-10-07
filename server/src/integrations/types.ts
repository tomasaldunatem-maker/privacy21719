/**
 * Contrato común para cualquier software clínico (Dentalink, Medilink, mock u otro futuro).
 * El resto de la aplicación SOLO usa estos tipos normalizados; nunca la respuesta cruda del proveedor.
 *
 * Minimización de datos (Ley 21.719, art. 3): se sincronizan solo datos de identificación y agenda.
 * Las fichas clínicas NO se copian; se consultan bajo demanda cuando una solicitud lo requiere.
 */
export type ProviderId = 'mock' | 'dentalink' | 'medilink';

export interface NormalizedPatient {
  externalId: string;
  firstName: string;
  lastName?: string | null;
  rut?: string | null;
  email?: string | null;
  phone?: string | null;
}
export interface NormalizedProfessional {
  externalId: string;
  name: string;
  specialty?: string | null;
  active: boolean;
}
export interface NormalizedBranch {
  externalId: string;
  name: string;
  address?: string | null;
}
export interface NormalizedAppointment {
  externalId: string;
  patientExternalId?: string | null;
  professionalExternalId?: string | null;
  branchExternalId?: string | null;
  date: string; // YYYY-MM-DD
  time?: string | null;
  durationMin?: number | null;
  status?: string | null;
}

export interface ConnectionResult { ok: boolean; message: string }

export interface ClinicSoftwareProvider {
  readonly id: ProviderId;
  readonly label: string;
  /** true si los datos vienen del proveedor de prueba */
  readonly isMock: boolean;
  testConnection(): Promise<ConnectionResult>;
  listPatients(): Promise<NormalizedPatient[]>;
  listProfessionals(): Promise<NormalizedProfessional[]>;
  listBranches(): Promise<NormalizedBranch[]>;
  listAppointments(range: { from: string; to: string }): Promise<NormalizedAppointment[]>;
  getPatient(externalId: string): Promise<NormalizedPatient | null>;
  listPatientAppointments(externalId: string): Promise<NormalizedAppointment[]>;
}

export class IntegrationError extends Error {
  constructor(public kind: 'auth' | 'not_found' | 'rate_limit' | 'network' | 'upstream' | 'config' | 'bad_response', message: string, public status?: number) {
    super(message);
  }
}
