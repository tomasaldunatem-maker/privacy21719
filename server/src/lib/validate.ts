import type { z, ZodTypeAny } from 'zod';
import { badRequest } from './errors.js';

/** Valida y devuelve datos tipados, o lanza 400 con los campos con error. */
export function parse<T extends ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) throw badRequest('Datos inválidos', r.error.flatten().fieldErrors);
  return r.data;
}
