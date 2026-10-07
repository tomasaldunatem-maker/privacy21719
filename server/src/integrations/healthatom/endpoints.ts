/**
 * ⚠️ CONFIGURACIÓN POR VERIFICAR CONTRA LA DOCUMENTACIÓN OFICIAL
 *
 * Dentalink y Medilink (HealthAtom) ofrecen una API REST para clientes autenticada con token.
 * Al construir este MVP NO fue posible abrir la documentación oficial para confirmar rutas,
 * formato de autenticación, filtros y paginación. Todo lo que depende de esos detalles está
 * concentrado en ESTE archivo para que se ajuste en un solo lugar.
 *
 * Documentación a revisar:
 *   https://api.dentalink.healthatom.com/docs/
 *   https://api.medilink.healthatom.com/docs/
 *
 * Checklist de verificación (marque verified: true cuando confirme cada punto):
 *   [ ] URL base y versión (DENTALINK_API_BASE_URL / MEDILINK_API_BASE_URL)
 *   [ ] Formato de la cabecera Authorization
 *   [ ] Ruta de cada recurso
 *   [ ] Forma de filtrar por fecha (parámetro q u otro)
 *   [ ] Formato de paginación (links.next u otro)
 *   [ ] Nombres de los campos (ver mappers.ts)
 */
export interface HealthAtomEndpoints {
  verified: boolean;
  /** Cabecera Authorization a partir del token */
  authHeader: (token: string) => string;
  paths: {
    patients: string;
    patient: (id: string) => string;
    patientAppointments: (id: string) => string;
    professionals: string;
    branches: string;
    appointments: string;
  };
  /** Parámetros de consulta para limitar citas a un rango de fechas */
  appointmentsQuery: (from: string, to: string) => Record<string, string>;
  /** Ruta liviana para probar la conexión */
  healthCheckPath: string;
}

const enc = encodeURIComponent;

export const DENTALINK_ENDPOINTS: HealthAtomEndpoints = {
  verified: false,
  authHeader: (t) => `Token ${t}`,
  paths: {
    patients: '/pacientes',
    patient: (id) => `/pacientes/${enc(id)}`,
    patientAppointments: (id) => `/pacientes/${enc(id)}/citas`,
    professionals: '/dentistas',
    branches: '/sucursales',
    appointments: '/citas',
  },
  appointmentsQuery: (from, to) => ({ q: JSON.stringify({ fecha: { gte: from, lte: to } }) }),
  healthCheckPath: '/sucursales',
};

export const MEDILINK_ENDPOINTS: HealthAtomEndpoints = {
  verified: false,
  authHeader: (t) => `Token ${t}`,
  paths: {
    patients: '/pacientes',
    patient: (id) => `/pacientes/${enc(id)}`,
    patientAppointments: (id) => `/pacientes/${enc(id)}/citas`,
    professionals: '/profesionales',
    branches: '/sucursales',
    appointments: '/citas',
  },
  appointmentsQuery: (from, to) => ({ q: JSON.stringify({ fecha: { gte: from, lte: to } }) }),
  healthCheckPath: '/sucursales',
};
