import crypto from 'node:crypto';
import { env } from '../config/env.js';

/** Cifrado AES-256-GCM para credenciales de integración guardadas por clínica. */
/**
 * Clave de 32 bytes: se usa tal cual si la variable es base64 de 32 bytes; si es otro secreto aleatorio
 * (por ejemplo, el que genera la plataforma de hosting) se deriva con SHA-256.
 */
function deriveKey(raw: string): Buffer | null {
  if (!raw) return null;
  const b = Buffer.from(raw, 'base64');
  if (b.length === 32 && /^[A-Za-z0-9+/=]+$/.test(raw)) return b;
  return raw.length >= 32 ? crypto.createHash('sha256').update(raw, 'utf8').digest() : null;
}
function key(): Buffer {
  const k = deriveKey(env.INTEGRATION_ENCRYPTION_KEY);
  if (!k) throw new Error('INTEGRATION_ENCRYPTION_KEY no está configurada');
  return k;
}

export const hasEncryptionKey = () => deriveKey(env.INTEGRATION_ENCRYPTION_KEY) !== null;

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), enc.toString('base64')].join(':');
}

export function decrypt(payload: string): string {
  const [v, iv, tag, data] = payload.split(':');
  if (v !== 'v1') throw new Error('Formato de cifrado desconocido');
  const d = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8');
}

export const sha256 = (s: string | Buffer) => crypto.createHash('sha256').update(s).digest('hex');
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
