import { eq } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { env } from '../config/env.js';
import { decrypt, hasEncryptionKey } from '../lib/crypto.js';
import { HealthAtomProvider } from './healthatom/provider.js';
import { DENTALINK_ENDPOINTS, MEDILINK_ENDPOINTS } from './healthatom/endpoints.js';
import { MockProvider } from './mock/provider.js';
import { IntegrationError, type ClinicSoftwareProvider, type ProviderId } from './types.js';

export const PROVIDERS: Record<ProviderId, { label: string; defaultBaseUrl: string | null }> = {
  mock: { label: 'Datos de prueba', defaultBaseUrl: null },
  dentalink: { label: 'Dentalink', defaultBaseUrl: env.DENTALINK_API_BASE_URL },
  medilink: { label: 'Medilink', defaultBaseUrl: env.MEDILINK_API_BASE_URL },
};

export interface ResolvedConfig {
  provider: ProviderId;
  baseUrl: string | null;
  token: string | null;
  credentialSource: 'database' | 'environment' | 'none';
}

/**
 * Decide qué proveedor y credenciales usa una clínica:
 * 1. Credenciales guardadas (cifradas) para la clínica en la base de datos.
 * 2. Variables de entorno, solo si la clínica coincide con INTEGRATION_ENV_ORG_SLUG.
 * 3. Proveedor de prueba (mock).
 */
export async function resolveConfig(orgId: string): Promise<ResolvedConfig> {
  const [s] = await db.select().from(schema.integrationSettings).where(eq(schema.integrationSettings.organizationId, orgId));
  if (s && s.provider !== 'mock' && s.tokenCiphertext) {
    if (!hasEncryptionKey()) throw new IntegrationError('config', 'Falta INTEGRATION_ENCRYPTION_KEY para leer las credenciales guardadas');
    const p = s.provider as ProviderId;
    return { provider: p, baseUrl: s.baseUrl || PROVIDERS[p].defaultBaseUrl, token: decrypt(s.tokenCiphertext), credentialSource: 'database' };
  }
  if (env.INTEGRATION_ENV_ORG_SLUG && env.CLINIC_SOFTWARE_PROVIDER !== 'mock') {
    const [org] = await db.select({ slug: schema.organizations.slug }).from(schema.organizations).where(eq(schema.organizations.id, orgId));
    if (org?.slug === env.INTEGRATION_ENV_ORG_SLUG) {
      const p = env.CLINIC_SOFTWARE_PROVIDER;
      const token = p === 'dentalink' ? env.DENTALINK_API_TOKEN : env.MEDILINK_API_TOKEN;
      if (token) return { provider: p, baseUrl: PROVIDERS[p].defaultBaseUrl, token, credentialSource: 'environment' };
    }
  }
  return { provider: 'mock', baseUrl: null, token: null, credentialSource: 'none' };
}

export function buildProvider(cfg: ResolvedConfig, fetchImpl?: typeof fetch): ClinicSoftwareProvider {
  if (cfg.provider === 'mock' || !cfg.token || !cfg.baseUrl) return new MockProvider();
  const ep = cfg.provider === 'dentalink' ? DENTALINK_ENDPOINTS : MEDILINK_ENDPOINTS;
  return new HealthAtomProvider(cfg.provider, PROVIDERS[cfg.provider].label, ep, {
    baseUrl: cfg.baseUrl, token: cfg.token, timeoutMs: env.INTEGRATION_TIMEOUT_MS, maxPages: env.INTEGRATION_MAX_PAGES, fetchImpl,
  });
}

export async function providerFor(orgId: string) {
  const cfg = await resolveConfig(orgId);
  return { cfg, provider: buildProvider(cfg) };
}
