import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errorText } from '../lib/api';
import { useData } from '../lib/useData';
import { usePerms } from '../lib/auth';
import { Disclaimer, ErrorBox, Loading, PageHead, useToast } from '../components/ui';

export interface Priority { questionId: string; area: string; article: string; critical: boolean; answer: 'no' | 'parcial'; action: string; recommendation: string; timeframe: string }
interface Question { id: string; area: string; text: string; article: string; critical: boolean; recNo: string; recPartial: string; timeframe: string }
interface Diag { questions: Question[]; answers: Record<string, 'si' | 'parcial' | 'no'>; score: number; answered: number; criticalGaps: number; priorities: Priority[] }

export function Priorities({ items, total, compact }: { items: Priority[]; total?: number; compact?: boolean }) {
  return (
    <div className="panel prio">
      <div className="spread"><h2>Lo más importante por hacer</h2>{!compact && <span className="small muted">{total ?? items.length} brechas · ordenadas por gravedad e impacto</span>}</div>
      {items.length ? (
        <ol>{items.map((p) => (
          <li key={p.questionId}>
            <div className="spread"><b>{p.action}</b><span className={`pill ${p.critical ? 'bad' : 'warn'}`}>{p.timeframe}</span></div>
            <div className="small muted"><span className="art">{p.article}</span> · {p.recommendation}</div>
          </li>
        ))}</ol>
      ) : <p className="muted">No quedan brechas. Mantenga la evidencia al día y repita el diagnóstico cada año.</p>}
    </div>
  );
}

const LBL = { si: 'Sí', parcial: 'Parcial', no: 'No' } as const;

export default function Diagnostic() {
  const perms = usePerms();
  const toast = useToast();
  const nav = useNavigate();
  const { data: d, error, loading, reload, setData } = useData(() => api<Diag>('/diagnostic'));
  const [saving, setSaving] = useState<string | null>(null);

  async function answer(qid: string, a: 'si' | 'parcial' | 'no') {
    setSaving(qid);
    try { setData(await api<Diag>(`/diagnostic/answers/${qid}`, { method: 'PUT', body: { answer: a } })); }
    catch (e) { toast(errorText(e), true); } finally { setSaving(null); }
  }
  async function generate() {
    try {
      const r = await api<{ created: number }>('/diagnostic/generate-plan', { method: 'POST' });
      toast(r.created ? `${r.created} tareas agregadas al plan de acción` : 'El plan ya incluye todas las brechas');
      nav('/plan');
    } catch (e) { toast(errorText(e), true); }
  }

  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (loading || !d) return <Loading />;
  return (
    <>
      <PageHead eyebrow="Módulo 1" title="Diagnóstico de brechas"
        lede='Responda pensando en cómo opera hoy la clínica. Cada respuesta "No" o "Parcial" genera una recomendación y puede convertirse en una tarea del plan de acción.'
        right={<div className="row"><span className="countdown">Avance {d.score}%</span>{perms.canManage && <button className="btn" onClick={generate}>Generar plan de acción</button>}</div>} />
      <Priorities items={d.priorities.slice(0, 5)} total={d.priorities.length} />
      <div className="panel mt">
        {d.questions.map((q) => {
          const a = d.answers[q.id];
          return (
            <div className="q" key={q.id}>
              <div>
                <div className="eyebrow">{q.area} · <span className="art">{q.article}</span>{q.critical && <span className="crit">Crítica</span>}</div>
                <div style={{ marginTop: 3 }}>{q.text}</div>
              </div>
              <div className="seg" role="group" aria-label="Respuesta">
                {(['si', 'parcial', 'no'] as const).map((x) => (
                  <button key={x} type="button" className={`${x} ${a === x ? 'on' : ''}`} aria-pressed={a === x}
                    disabled={!perms.canManage || saving === q.id} onClick={() => answer(q.id, x)}>{LBL[x]}</button>
                ))}
              </div>
              {a && (
                <div className={`rec ${a}`}>
                  {a === 'si'
                    ? <><b>Bien.</b> Guarde la evidencia (documento, captura o acta) en el plan de acción para poder demostrarlo ante la Agencia.</>
                    : <><b>Recomendación · {q.timeframe}</b>{a === 'no' ? q.recNo : q.recPartial}</>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <Disclaimer />
    </>
  );
}
