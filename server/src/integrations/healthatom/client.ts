import { IntegrationError } from '../types.js';

export interface ClientOptions {
  baseUrl: string;
  authHeader: string; // valor completo de Authorization; nunca se registra en logs
  timeoutMs: number;
  maxPages: number;
  fetchImpl?: typeof fetch;
}

type Json = Record<string, unknown>;

/**
 * Cliente HTTP para APIs HealthAtom (Dentalink / Medilink).
 * - Reintenta ante 429 (respetando Retry-After) y errores 5xx.
 * - Sigue la paginación solo dentro del mismo host (evita SSRF por enlaces manipulados).
 * - Nunca incluye el token en mensajes de error.
 */
export class HealthAtomClient {
  private origin: string;
  private basePath: string;
  constructor(private o: ClientOptions) {
    const u = new URL(o.baseUrl);
    if (u.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(u.hostname)) {
      throw new IntegrationError('config', 'La URL de la API debe usar https');
    }
    this.origin = u.origin;
    this.basePath = u.pathname.replace(/\/$/, '');
  }

  private url(pathOrUrl: string, query?: Record<string, string>): URL {
    const u = /^https?:\/\//.test(pathOrUrl) ? new URL(pathOrUrl) : new URL(this.origin + this.basePath + pathOrUrl);
    if (u.origin !== this.origin) throw new IntegrationError('bad_response', 'La API devolvió un enlace a otro dominio');
    for (const [k, v] of Object.entries(query ?? {})) u.searchParams.set(k, v);
    return u;
  }

  async get(pathOrUrl: string, query?: Record<string, string>, attempt = 0): Promise<unknown> {
    const f = this.o.fetchImpl ?? fetch;
    let res: Response;
    try {
      res = await f(this.url(pathOrUrl, query), {
        headers: { Authorization: this.o.authHeader, Accept: 'application/json' },
        signal: AbortSignal.timeout(this.o.timeoutMs),
      });
    } catch (e) {
      if (e instanceof IntegrationError) throw e;
      if (attempt < 1) return this.get(pathOrUrl, query, attempt + 1);
      throw new IntegrationError('network', 'No se pudo conectar con el software clínico (tiempo de espera o red)');
    }
    if (res.status === 401 || res.status === 403) throw new IntegrationError('auth', 'El software clínico rechazó las credenciales (token inválido o sin permisos)', res.status);
    if (res.status === 404) throw new IntegrationError('not_found', 'Recurso no encontrado en el software clínico', 404);
    if (res.status === 429) {
      if (attempt >= 2) throw new IntegrationError('rate_limit', 'Se alcanzó el límite de peticiones del software clínico. Intente más tarde.', 429);
      const wait = Math.min(Number(res.headers.get('retry-after')) || 2 ** attempt, 10) * 1000;
      await new Promise((r) => setTimeout(r, wait));
      return this.get(pathOrUrl, query, attempt + 1);
    }
    if (res.status >= 500) {
      if (attempt < 1) return this.get(pathOrUrl, query, attempt + 1);
      throw new IntegrationError('upstream', `El software clínico respondió con error ${res.status}`, res.status);
    }
    if (!res.ok) throw new IntegrationError('upstream', `Respuesta inesperada del software clínico (${res.status})`, res.status);
    try {
      return await res.json();
    } catch {
      throw new IntegrationError('bad_response', 'La respuesta del software clínico no es JSON válido');
    }
  }

  /** Extrae la lista de elementos de una respuesta, soportando { data: [...] } o un arreglo directo. */
  static items(body: unknown): Json[] {
    if (Array.isArray(body)) return body as Json[];
    const b = body as Json | null;
    if (b && Array.isArray(b.data)) return b.data as Json[];
    if (b && b.data && typeof b.data === 'object') return [b.data as Json];
    throw new IntegrationError('bad_response', 'Formato de respuesta no reconocido (se esperaba una lista)');
  }

  static nextLink(body: unknown): string | null {
    const b = body as { links?: { next?: unknown } } | null;
    const n = b?.links?.next;
    return typeof n === 'string' && n.length > 0 ? n : null;
  }

  /** Recorre todas las páginas hasta maxPages. */
  async getAll(path: string, query?: Record<string, string>): Promise<Json[]> {
    const out: Json[] = [];
    let body = await this.get(path, query);
    out.push(...HealthAtomClient.items(body));
    let pages = 1;
    let next = HealthAtomClient.nextLink(body);
    while (next && pages < this.o.maxPages) {
      body = await this.get(next);
      out.push(...HealthAtomClient.items(body));
      next = HealthAtomClient.nextLink(body);
      pages++;
    }
    return out;
  }
}
