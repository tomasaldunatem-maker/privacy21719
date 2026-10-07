import { Router } from 'express';
import { z } from 'zod';
import { and, asc, eq, isNotNull } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { parse } from '../lib/validate.js';
import { notFound } from '../lib/errors.js';
import { audit } from '../lib/audit.js';
import { addDaysISO, todayISO } from '../lib/dates.js';
import { canManage } from '../middleware/auth.js';
import { criticalGaps, priorities, riskLevel, score, suggestedDays, timeframe, type Answer, type Question } from '../domain/diagnostic.js';

export const router = Router();

export async function loadDiagnostic(orgId: string) {
  const questions = (await db.select().from(schema.diagnosticQuestions)
    .where(eq(schema.diagnosticQuestions.active, true)).orderBy(asc(schema.diagnosticQuestions.sortOrder))) as Question[];
  const rows = await db.select().from(schema.diagnosticAnswers).where(eq(schema.diagnosticAnswers.organizationId, orgId));
  const answers: Record<string, Answer> = {};
  const notes: Record<string, string | null> = {};
  for (const r of rows) { answers[r.questionId] = r.answer; notes[r.questionId] = r.notes; }
  const pct = score(questions, answers);
  const crit = criticalGaps(questions, answers);
  return {
    questions: questions.map((q) => ({ ...q, timeframe: timeframe(q) })),
    answers, notes,
    score: pct,
    answered: Object.keys(answers).length,
    criticalGaps: crit.length,
    riskLevel: riskLevel(pct, crit.length),
    priorities: priorities(questions, answers),
  };
}

router.get('/', async (req, res) => res.json(await loadDiagnostic(req.user!.organizationId)));

router.put('/answers/:questionId', canManage, async (req, res) => {
  const b = parse(z.object({ answer: z.enum(['si', 'parcial', 'no']), notes: z.string().max(2000).optional() }), req.body);
  const qid = String(req.params.questionId);
  const [q] = await db.select({ id: schema.diagnosticQuestions.id }).from(schema.diagnosticQuestions).where(eq(schema.diagnosticQuestions.id, qid));
  if (!q) throw notFound('Pregunta no encontrada');
  const orgId = req.user!.organizationId;
  await db.insert(schema.diagnosticAnswers).values({ organizationId: orgId, questionId: qid, answer: b.answer, notes: b.notes ?? null, answeredBy: req.user!.id })
    .onConflictDoUpdate({ target: [schema.diagnosticAnswers.organizationId, schema.diagnosticAnswers.questionId], set: { answer: b.answer, notes: b.notes ?? null, answeredBy: req.user!.id, updatedAt: new Date() } });
  await audit(req, 'answer', 'diagnostic', qid, { answer: b.answer });
  res.json(await loadDiagnostic(orgId));
});

/** Crea una tarea por cada brecha que aún no tenga una tarea originada en esa pregunta. */
router.post('/generate-plan', canManage, async (req, res) => {
  const orgId = req.user!.organizationId;
  const d = await loadDiagnostic(orgId);
  const existing = await db.select({ q: schema.tasks.sourceQuestionId }).from(schema.tasks)
    .where(and(eq(schema.tasks.organizationId, orgId), isNotNull(schema.tasks.sourceQuestionId)));
  const have = new Set(existing.map((e) => e.q));
  const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId));
  const today = todayISO();
  const toCreate = d.priorities.filter((p) => !have.has(p.questionId)).map((p) => {
    const q = d.questions.find((x) => x.id === p.questionId)!;
    return {
      organizationId: orgId, obligation: q.article, risk: q.taskRisk, control: q.taskControl,
      owner: org.privacyOfficer || req.user!.name, dueDate: addDaysISO(today, suggestedDays(q)),
      sourceQuestionId: q.id, createdBy: req.user!.id,
    };
  });
  if (toCreate.length) await db.insert(schema.tasks).values(toCreate);
  await audit(req, 'generate_plan', 'task', null, { created: toCreate.length });
  res.json({ created: toCreate.length });
});
