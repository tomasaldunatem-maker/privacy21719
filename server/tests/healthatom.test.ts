import { describe, expect, it } from 'vitest';
import { HealthAtomClient } from '../src/integrations/healthatom/client.js';
import { HealthAtomProvider } from '../src/integrations/healthatom/provider.js';
import { DENTALINK_ENDPOINTS } from '../src/integrations/healthatom/endpoints.js';
import { mapAppointment, mapPatient } from '../src/integrations/healthatom/mappers.js';
import { IntegrationError } from '../src/integrations/types.js';

/** Respuestas simuladas con forma { data, links } (forma por verificar con la documentación oficial). */
function fakeFetch(routes: Record<string, { status?: number; body?: unknown; headers?: Record<string, string> }[]>) {
  const calls: { url: string; auth: string | null }[] = [];
  const f = (async (input: URL | string, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, auth: new Headers(init?.headers).get('authorization') });
    const key = Object.keys(routes).find((k) => url.includes(k));
    const r = key ? routes[key].shift() : undefined;
    if (!r) return new Response('not found', { status: 404 });
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200, headers: { 'content-type': 'application/json', ...(r.headers ?? {}) } });
  }) as typeof fetch;
  return { f, calls };
}
const BASE = 'https://api.example-clinic.test/api/v1';
const opts = (fetchImpl: typeof fetch) => ({ baseUrl: BASE, token: 'secret-token', timeoutMs: 2000, maxPages: 5, fetchImpl });

describe('cliente HealthAtom', () => {
  it('sigue la paginación y envía el token solo en la cabecera', async () => {
    const { f, calls } = fakeFetch({
      '/pacientes?page=2': [{ body: { data: [{ id: 2, nombre: 'B' }], links: {} } }],
      '/pacientes': [{ body: { data: [{ id: 1, nombre: 'A', apellidos: 'X', rut: '11.111.111-1' }], links: { next: `${BASE}/pacientes?page=2` } } }],
    });
    const p = new HealthAtomProvider('dentalink', 'Dentalink', DENTALINK_ENDPOINTS, opts(f));
    const pats = await p.listPatients();
    expect(pats.map((x) => x.externalId)).toEqual(['1', '2']);
    expect(calls[0].auth).toBe('Token secret-token');
    expect(calls.every((c) => !c.url.includes('secret-token'))).toBe(true);
  });

  it('no sigue enlaces a otro dominio (SSRF)', async () => {
    const { f } = fakeFetch({ '/pacientes': [{ body: { data: [], links: { next: 'https://evil.test/steal' } } }] });
    const p = new HealthAtomProvider('dentalink', 'Dentalink', DENTALINK_ENDPOINTS, opts(f));
    await expect(p.listPatients()).rejects.toThrow(/otro dominio/);
  });

  it('traduce 401 a error de credenciales sin exponer el token', async () => {
    const { f } = fakeFetch({ '/sucursales': [{ status: 401 }] });
    const p = new HealthAtomProvider('dentalink', 'Dentalink', DENTALINK_ENDPOINTS, opts(f));
    const r = await p.testConnection();
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/credenciales/);
    expect(r.message).not.toMatch(/secret-token/);
  });

  it('reintenta ante 429', async () => {
    const { f } = fakeFetch({ '/dentistas': [{ status: 429, headers: { 'retry-after': '0' } }, { body: { data: [{ id: 7, nombre: 'Ana', apellidos: 'Paz' }] } }] });
    const p = new HealthAtomProvider('dentalink', 'Dentalink', DENTALINK_ENDPOINTS, opts(f));
    expect((await p.listProfessionals())[0].name).toBe('Ana Paz');
  });

  it('si el filtro de fechas es rechazado (400), filtra localmente', async () => {
    const { f } = fakeFetch({ '/citas': [
      { status: 400 },
      { body: { data: [{ id: 1, fecha: '2026-10-01' }, { id: 2, fecha: '2026-12-31' }] } },
    ] });
    const p = new HealthAtomProvider('dentalink', 'Dentalink', DENTALINK_ENDPOINTS, opts(f));
    const a = await p.listAppointments({ from: '2026-09-01', to: '2026-10-31' });
    expect(a.map((x) => x.externalId)).toEqual(['1']);
  });

  it('exige https y token', () => {
    expect(() => new HealthAtomClient({ baseUrl: 'http://x.test', authHeader: 'a', timeoutMs: 1, maxPages: 1 })).toThrow(IntegrationError);
    expect(() => new HealthAtomProvider('dentalink', 'Dentalink', DENTALINK_ENDPOINTS, { ...opts(fetch), token: '' })).toThrow(/token/);
  });
});

describe('mapeo de campos', () => {
  it('ignora campos clínicos y normaliza', () => {
    const p = mapPatient({ id: 5, nombre: 'Ana', apellidos: 'Soto', celular: '+569', diagnostico: 'NO DEBE COPIARSE' });
    expect(p).toEqual({ externalId: '5', firstName: 'Ana', lastName: 'Soto', rut: null, email: null, phone: '+569' });
  });
  it('descarta citas sin fecha válida', () => {
    expect(mapAppointment({ id: 1, fecha: 'mañana' })).toBeNull();
    expect(mapAppointment({ id: 1, fecha: '2026-10-07 10:00:00', id_paciente: 3, id_dentista: 4, hora_inicio: '10:00' })?.date).toBe('2026-10-07');
  });
});
