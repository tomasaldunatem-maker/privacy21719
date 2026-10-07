import type { NormalizedAppointment, NormalizedBranch, NormalizedPatient, NormalizedProfessional } from '../types.js';

/**
 * Traducción de la respuesta cruda de HealthAtom a los tipos normalizados.
 * ⚠️ Los nombres de campo son candidatos POR VERIFICAR con la documentación oficial.
 * Se prueban varias claves posibles y se toma la primera presente; los campos clínicos se ignoran a propósito.
 */
type Raw = Record<string, unknown>;

const str = (r: Raw, ...keys: string[]): string | null => {
  for (const k of keys) {
    const v = r[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return null;
};
const num = (r: Raw, ...keys: string[]): number | null => {
  const s = str(r, ...keys);
  const n = s === null ? NaN : Number(s);
  return Number.isFinite(n) ? n : null;
};
const bool = (r: Raw, ...keys: string[]): boolean | null => {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === 'boolean') return v;
    if (v === 1 || v === '1' || v === 'true') return true;
    if (v === 0 || v === '0' || v === 'false') return false;
  }
  return null;
};
const requireId = (r: Raw, what: string) => {
  const id = str(r, 'id');
  if (!id) throw new Error(`${what} sin id en la respuesta del proveedor`);
  return id;
};

export function mapPatient(r: Raw): NormalizedPatient {
  return {
    externalId: requireId(r, 'Paciente'),
    firstName: str(r, 'nombre', 'nombres', 'first_name') ?? 'Sin nombre',
    lastName: str(r, 'apellidos', 'apellido', 'last_name'),
    rut: str(r, 'rut', 'run', 'documento'),
    email: str(r, 'email', 'correo'),
    phone: str(r, 'celular', 'telefono', 'fono'),
  };
}

export function mapProfessional(r: Raw): NormalizedProfessional {
  const name = [str(r, 'nombre', 'nombres'), str(r, 'apellidos', 'apellido')].filter(Boolean).join(' ');
  return {
    externalId: requireId(r, 'Profesional'),
    name: name || 'Sin nombre',
    specialty: str(r, 'especialidad', 'nombre_especialidad'),
    active: bool(r, 'habilitado', 'activo', 'estado') ?? true,
  };
}

export function mapBranch(r: Raw): NormalizedBranch {
  return {
    externalId: requireId(r, 'Sucursal'),
    name: str(r, 'nombre') ?? 'Sucursal',
    address: str(r, 'direccion'),
  };
}

export function mapAppointment(r: Raw): NormalizedAppointment | null {
  const date = str(r, 'fecha');
  if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) return null; // se descarta si no trae fecha válida
  return {
    externalId: requireId(r, 'Cita'),
    patientExternalId: str(r, 'id_paciente'),
    professionalExternalId: str(r, 'id_dentista', 'id_profesional'),
    branchExternalId: str(r, 'id_sucursal'),
    date: date.slice(0, 10),
    time: str(r, 'hora_inicio', 'hora'),
    durationMin: num(r, 'duracion'),
    status: str(r, 'estado_cita', 'nombre_estado', 'estado'),
  };
}
