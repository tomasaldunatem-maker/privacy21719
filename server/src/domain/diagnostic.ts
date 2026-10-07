/** Lógica del diagnóstico: puntaje, brechas, prioridades y nivel de riesgo. Sin acceso a BD (testeable). */
export type Answer = 'si' | 'parcial' | 'no';
export interface Question {
  id: string; area: string; text: string; article: string; critical: boolean; impact: number;
  taskControl: string; taskRisk: string; recNo: string; recPartial: string;
}

export function score(questions: Question[], answers: Record<string, Answer | undefined>): number {
  if (!questions.length) return 0;
  const sum = questions.reduce((s, q) => s + (answers[q.id] === 'si' ? 1 : answers[q.id] === 'parcial' ? 0.5 : 0), 0);
  return Math.round((sum / questions.length) * 100);
}

export const isGap = (a?: Answer) => a === 'no' || a === 'parcial';

export function criticalGaps(questions: Question[], answers: Record<string, Answer | undefined>) {
  return questions.filter((q) => q.critical && answers[q.id] !== 'si');
}

export function timeframe(q: Pick<Question, 'critical' | 'impact'>): string {
  if (q.critical) return 'Antes del 1 dic 2026';
  return q.impact <= 2 ? 'Próximos 60 días' : 'Próximos 90 días';
}

/** Días sugeridos para la fecha límite de la tarea generada. */
export const suggestedDays = (q: Pick<Question, 'critical' | 'impact'>) => (q.critical ? 14 : q.impact <= 2 ? 60 : 90);

/** Orden: críticas primero, luego "No" antes que "Parcial", luego por impacto. */
export function priorities(questions: Question[], answers: Record<string, Answer | undefined>) {
  return questions
    .filter((q) => isGap(answers[q.id]))
    .map((q) => {
      const a = answers[q.id] as Answer;
      return {
        questionId: q.id, area: q.area, article: q.article, critical: q.critical, answer: a,
        action: q.taskControl,
        recommendation: a === 'no' ? q.recNo : q.recPartial,
        timeframe: timeframe(q),
        rank: (q.critical ? 0 : 10) + (a === 'no' ? 0 : 5) + q.impact,
      };
    })
    .sort((x, y) => x.rank - y.rank);
}

export function riskLevel(pct: number, critical: number): 'ALTO' | 'MEDIO' | 'BAJO' {
  if (critical >= 3 || pct < 50) return 'ALTO';
  if (critical >= 1 || pct < 80) return 'MEDIO';
  return 'BAJO';
}
