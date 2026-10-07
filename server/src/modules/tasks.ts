import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { and, asc, desc, eq, ilike, inArray, or } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { env } from '../config/env.js';
import { parse } from '../lib/validate.js';
import { badRequest, notFound } from '../lib/errors.js';
import { audit } from '../lib/audit.js';
import { canManage } from '../middleware/auth.js';

export const router = Router();
const status = z.enum(['PENDIENTE', 'EN_CURSO', 'COMPLETADA']);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida');
const taskBody = z.object({
  obligation: z.string().trim().min(2).max(120),
  risk: z.string().trim().max(400).optional().nullable(),
  control: z.string().trim().min(3).max(400),
  owner: z.string().trim().min(2).max(120),
  dueDate: isoDate,
  status: status.optional(),
});

// Compatibilidad con evidencias antiguas guardadas en disco
const uploadDir = path.resolve(env.UPLOAD_DIR);
const ALLOWED = new Map([
  ['application/pdf', '.pdf'], ['image/png', '.png'], ['image/jpeg', '.jpg'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.xlsx'], ['text/plain', '.txt'],
]);
const upload = multer({
  // En memoria y luego a PostgreSQL: no depende del disco del servidor (efímero en la mayoría de plataformas)
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => (ALLOWED.has(file.mimetype) ? cb(null, true) : cb(badRequest('Tipo de archivo no permitido. Use PDF, imagen, Word, Excel o texto.'))),
});

router.get('/', async (req, res) => {
  const q = parse(z.object({ status: status.optional(), q: z.string().max(100).optional() }), req.query);
  const orgId = req.user!.organizationId;
  const conds = [eq(schema.tasks.organizationId, orgId)];
  if (q.status) conds.push(eq(schema.tasks.status, q.status));
  if (q.q) conds.push(or(ilike(schema.tasks.control, `%${q.q}%`), ilike(schema.tasks.owner, `%${q.q}%`), ilike(schema.tasks.obligation, `%${q.q}%`))!);
  const rows = await db.select().from(schema.tasks).where(and(...conds)).orderBy(asc(schema.tasks.dueDate));
  const ev = rows.length ? await db.select({
    id: schema.evidence.id, taskId: schema.evidence.taskId, originalName: schema.evidence.originalName,
    sizeBytes: schema.evidence.sizeBytes, sha256: schema.evidence.sha256, createdAt: schema.evidence.createdAt,
  }).from(schema.evidence).where(inArray(schema.evidence.taskId, rows.map((r) => r.id))).orderBy(desc(schema.evidence.createdAt)) : [];
  res.json(rows.map((r) => ({ ...r, evidence: ev.filter((e) => e.taskId === r.id) })));
});

router.post('/', canManage, async (req, res) => {
  const b = parse(taskBody, req.body);
  const [t] = await db.insert(schema.tasks).values({ ...b, organizationId: req.user!.organizationId, createdBy: req.user!.id }).returning();
  await audit(req, 'create', 'task', t.id);
  res.status(201).json(t);
});

router.patch('/:id', canManage, async (req, res) => {
  const b = parse(taskBody.partial(), req.body);
  const extra = b.status ? { completedAt: b.status === 'COMPLETADA' ? new Date() : null } : {};
  const [t] = await db.update(schema.tasks).set({ ...b, ...extra, updatedAt: new Date() })
    .where(and(eq(schema.tasks.id, String(req.params.id)), eq(schema.tasks.organizationId, req.user!.organizationId))).returning();
  if (!t) throw notFound('Tarea no encontrada');
  await audit(req, 'update', 'task', t.id, b);
  res.json(t);
});

router.delete('/:id', canManage, async (req, res) => {
  const orgId = req.user!.organizationId;
  const ev = await db.select({ id: schema.evidence.id }).from(schema.evidence).where(and(eq(schema.evidence.taskId, String(req.params.id)), eq(schema.evidence.organizationId, orgId)));
  if (ev.length) throw badRequest('La tarea tiene evidencia adjunta y no se puede eliminar. Márquela como completada.');
  const [t] = await db.delete(schema.tasks).where(and(eq(schema.tasks.id, String(req.params.id)), eq(schema.tasks.organizationId, orgId))).returning();
  if (!t) throw notFound('Tarea no encontrada');
  await audit(req, 'delete', 'task', t.id, { control: t.control });
  res.json({ ok: true });
});

router.post('/:id/evidence', canManage, upload.single('file'), async (req, res) => {
  const orgId = req.user!.organizationId;
  const f = req.file;
  if (!f) throw badRequest('Adjunte un archivo');
  const [t] = await db.select().from(schema.tasks).where(and(eq(schema.tasks.id, String(req.params.id)), eq(schema.tasks.organizationId, orgId)));
  if (!t) throw notFound('Tarea no encontrada');
  const hash = crypto.createHash('sha256').update(f.buffer).digest('hex');
  const name = path.basename(Buffer.from(f.originalname, 'latin1').toString('utf8')).slice(0, 200);
  const [e] = await db.insert(schema.evidence).values({
    organizationId: orgId, taskId: t.id, originalName: name, storedName: `db:${crypto.randomUUID()}`, mimeType: f.mimetype, content: f.buffer,
    sizeBytes: f.size, sha256: hash, uploadedBy: req.user!.id,
  }).returning();
  if (t.status === 'PENDIENTE') await db.update(schema.tasks).set({ status: 'EN_CURSO', updatedAt: new Date() }).where(eq(schema.tasks.id, t.id));
  await audit(req, 'upload', 'evidence', e.id, { taskId: t.id, sha256: hash });
  res.status(201).json({ id: e.id, originalName: e.originalName, sha256: e.sha256, sizeBytes: e.sizeBytes });
});

router.get('/evidence/:evidenceId/download', async (req, res) => {
  const [e] = await db.select().from(schema.evidence)
    .where(and(eq(schema.evidence.id, String(req.params.evidenceId)), eq(schema.evidence.organizationId, req.user!.organizationId)));
  if (!e) throw notFound('Evidencia no encontrada');
  await audit(req, 'download', 'evidence', e.id);
  res.setHeader('Content-Type', e.mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(e.originalName)}`);
  if (e.content) return res.end(e.content);
  const file = path.join(uploadDir, path.basename(e.storedName));
  fs.createReadStream(file).on('error', () => res.status(404).end()).pipe(res);
});
