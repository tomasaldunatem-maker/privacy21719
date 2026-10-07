/** Cliente HTTP del frontend. Solo habla con nuestro backend (/api); nunca con Dentalink directamente. */
export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: Record<string, string[]>) { super(message); }
}

type Opts = { method?: string; body?: unknown; form?: FormData };

export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  const headers: Record<string, string> = { 'X-Requested-With': 'privacy21719' };
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.body); }
  const res = await fetch(`/api${path}`, { method: opts.method ?? (body ? 'POST' : 'GET'), headers, body, credentials: 'same-origin' });
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null;
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/public')) window.dispatchEvent(new Event('p21719:unauthorized'));
    throw new ApiError(res.status, data?.error ?? `Error ${res.status}`, data?.details);
  }
  return data as T;
}

export const qs = (o: Record<string, string | number | boolean | undefined | null>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

/** Mensaje legible de un error, incluyendo errores de validación por campo. */
export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    const d = e.details && Object.entries(e.details).map(([k, v]) => `${k}: ${v.join(', ')}`).join(' · ');
    return d ? `${e.message} (${d})` : e.message;
  }
  return e instanceof Error ? e.message : 'Error inesperado';
}
