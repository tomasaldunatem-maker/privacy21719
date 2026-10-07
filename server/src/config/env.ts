import { z } from 'zod';

/**
 * Configuración validada al arrancar. Si falta algo obligatorio el servidor no inicia,
 * así nunca corre en producción con valores por defecto inseguros.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  APP_ORIGIN: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  SESSION_TTL_HOURS: z.coerce.number().positive().max(72).default(12),
  INTEGRATION_ENCRYPTION_KEY: z.string().optional().default(''),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_UPLOAD_MB: z.coerce.number().positive().max(50).default(10),
  INTEGRATION_ENV_ORG_SLUG: z.string().optional().default(''),
  CLINIC_SOFTWARE_PROVIDER: z.enum(['mock', 'dentalink', 'medilink']).default('mock'),
  DENTALINK_API_BASE_URL: z.string().url().default('https://api.dentalink.healthatom.com/api/v1'),
  DENTALINK_API_TOKEN: z.string().optional().default(''),
  MEDILINK_API_BASE_URL: z.string().url().default('https://api.medilink.healthatom.com/api/v1'),
  MEDILINK_API_TOKEN: z.string().optional().default(''),
  INTEGRATION_MAX_PAGES: z.coerce.number().int().positive().max(1000).default(50),
  INTEGRATION_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  /** Saltos de proxy de confianza para obtener la IP real (número) o "true" */
  TRUST_PROXY: z.string().default('1'),
  /** Crea la clínica de demostración al iniciar si no existe (solo para ambientes de demostración) */
  SEED_DEMO: z.enum(['true', 'false']).default('false'),
  DEMO_PASSWORD: z.string().optional().default(''),
});

// En Render, la URL pública llega en RENDER_EXTERNAL_URL; se usa como origen si no se definió APP_ORIGIN
const raw = { ...process.env };
if (!raw.APP_ORIGIN && raw.RENDER_EXTERNAL_URL) raw.APP_ORIGIN = raw.RENDER_EXTERNAL_URL;
const parsed = schema.safeParse(raw);
if (!parsed.success) {
  console.error('Configuración inválida:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';

if (isProd) {
  if (env.INTEGRATION_ENCRYPTION_KEY.length < 32) {
    console.error('En producción INTEGRATION_ENCRYPTION_KEY es obligatoria (32 bytes en base64, o un secreto aleatorio de 32+ caracteres).');
    process.exit(1);
  }
  if (!env.APP_ORIGIN.startsWith('https://')) {
    console.error('En producción APP_ORIGIN debe usar https://');
    process.exit(1);
  }
}
