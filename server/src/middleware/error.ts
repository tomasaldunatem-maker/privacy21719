import type { Request, Response, NextFunction } from 'express';
import { HttpError } from '../lib/errors.js';
import { isProd } from '../config/env.js';

export function notFoundApi(_req: Request, res: Response) {
  res.status(404).json({ error: 'Ruta no encontrada' });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  const e = err as { code?: string; type?: string; status?: number; message?: string };
  if (e?.type === 'entity.too.large') return res.status(413).json({ error: 'La petición es demasiado grande' });
  if (e?.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  if (e?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'El archivo supera el tamaño máximo permitido' });
  if (e?.code === '23505') return res.status(409).json({ error: 'Ya existe un registro con esos datos' });
  console.error(`[${req.method} ${req.originalUrl}]`, err);
  res.status(500).json({ error: 'Error interno del servidor', ...(isProd ? {} : { debug: e?.message }) });
}
