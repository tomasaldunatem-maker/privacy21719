import { useState, type FormEvent } from 'react';
import { api, errorText, qs, ApiError } from '../lib/api';
import { useData, useDebounced } from '../lib/useData';
import { useAuth, usePerms } from '../lib/auth';
import { TASK_LABEL, bytes, daysUntil, fmtDate, todayLocal } from '../lib/format';
import { ConfirmButton, Disclaimer, Empty, ErrorBox, FieldErrors, Loading, PageHead, Pill, useToast } from '../components/ui';

interface Evidence { id: string; originalName: string; sizeBytes: number; sha256: string; createdAt: string }
interface Task { id: string; obligation: string; risk: string | null; control: string; owner: string; dueDate: string; status: 'PENDIENTE' | 'EN_CURSO' | 'COMPLETADA'; evidence: Evidence[] }

const plus = (d: number) => { const t = new Date(`${todayLocal()}T12:00:00`); t.setDate(t.getDate() + d); return t.toISOString().slice(0, 10); };

export default function Tasks() {
  const perms = usePerms();
  const { me } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useData(() => api<Task[]>(`/tasks${qs({ status, q: dq })}`), [status, dq]);
  const [showNew, setShowNew] = useState(false);
  const [errs, setErrs] = useState<Record<string, string[]>>();
  const [uploading, setUploading] = useState<string | null>(null);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await api('/tasks', { body: Object.fromEntries(f) });
      toast('Tarea agregada'); setShowNew(false); setErrs(undefined); reload();
    } catch (err) { if (err instanceof ApiError) setErrs(err.details); toast(errorText(err), true); }
  }
  async function setTaskStatus(t: Task, s: string) {
    try { await api(`/tasks/${t.id}`, { method: 'PATCH', body: { status: s } }); toast(`Tarea: ${TASK_LABEL[s]}`); reload(); } catch (err) { toast(errorText(err), true); }
  }
  async function upload(t: Task, file: File) {
    const form = new FormData(); form.append('file', file);
    setUploading(t.id);
    try { await api(`/tasks/${t.id}/evidence`, { form }); toast('Evidencia guardada'); reload(); } catch (err) { toast(errorText(err), true); } finally { setUploading(null); }
  }
  async function remove(t: Task) {
    try { await api(`/tasks/${t.id}`, { method: 'DELETE' }); toast('Tarea eliminada'); reload(); } catch (err) { toast(errorText(err), true); }
  }

  return (
    <>
      <PageHead eyebrow="Obligación → riesgo → control → responsable → tarea → evidencia" title="Plan de acción"
        lede="Cada tarea queda vinculada a la obligación legal que la origina. Adjunte la evidencia al avanzar para poder demostrar el cumplimiento."
        right={perms.canManage && <button className="btn" onClick={() => setShowNew(!showNew)}>Nueva tarea</button>} />
      {showNew && (
        <div className="dlg"><h2>Nueva tarea</h2>
          <form className="f" onSubmit={create}>
            <label htmlFor="t_ob">Obligación (artículo)<input id="t_ob" name="obligation" required placeholder="Art. 14 quinquies" /><FieldErrors errors={errs} name="obligation" /></label>
            <label htmlFor="t_ow">Responsable<input id="t_ow" name="owner" required defaultValue={me?.organization.privacyOfficer ?? me?.user.name} /><FieldErrors errors={errs} name="owner" /></label>
            <label className="full" htmlFor="t_co">Control o acción<input id="t_co" name="control" required placeholder="Ej.: Bloqueo automático de pantalla en computadores de box" /><FieldErrors errors={errs} name="control" /></label>
            <label htmlFor="t_ri">Riesgo que mitiga<input id="t_ri" name="risk" /></label>
            <label htmlFor="t_du">Fecha límite<input id="t_du" name="dueDate" type="date" required defaultValue={plus(14)} /><FieldErrors errors={errs} name="dueDate" /></label>
            <div className="full row"><button className="btn" type="submit">Guardar tarea</button><button className="btn ghost" type="button" onClick={() => setShowNew(false)}>Cancelar</button></div>
          </form>
        </div>
      )}
      <div className="filters">
        <input type="search" placeholder="Buscar por control, responsable o artículo" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar tareas" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filtrar por estado">
          <option value="">Todos los estados</option>{Object.entries(TASK_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {error ? <ErrorBox error={error} onRetry={reload} /> : loading && !data ? <Loading /> : !data?.length ? <Empty>No hay tareas con esos filtros.</Empty> : (
        <div className="tablewrap"><table>
          <thead><tr><th>Obligación</th><th>Control / tarea</th><th>Responsable</th><th>Vence</th><th>Estado</th><th>Evidencia</th></tr></thead>
          <tbody>{data.map((t) => {
            const d = daysUntil(t.dueDate);
            return (
              <tr key={t.id}>
                <td><span className="art">{t.obligation}</span></td>
                <td><div>{t.control}</div>{t.risk && <div className="sub">Riesgo: {t.risk}</div>}</td>
                <td>{t.owner}</td>
                <td className="num">{fmtDate(t.dueDate)}{t.status !== 'COMPLETADA' && d < 0 && <div><Pill tone="bad">Atrasada</Pill></div>}</td>
                <td>
                  {perms.canManage ? (
                    <select id={`ts_${t.id}`} value={t.status} onChange={(e) => setTaskStatus(t, e.target.value)} aria-label="Estado">
                      {Object.entries(TASK_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  ) : <Pill tone={t.status === 'COMPLETADA' ? 'ok' : 'neu'}>{TASK_LABEL[t.status]}</Pill>}
                </td>
                <td>
                  <div className="list">
                    {t.evidence.map((e) => (
                      <a key={e.id} className="small" href={`/api/tasks/evidence/${e.id}/download`} title={`SHA-256 ${e.sha256}`}>{e.originalName} <span className="muted">({bytes(e.sizeBytes)})</span></a>
                    ))}
                  </div>
                  {perms.canManage && (
                    <div className="row mt-s">
                      <label className="btn ghost sm" style={{ flexDirection: 'row' }}>
                        {uploading === t.id ? 'Subiendo…' : 'Adjuntar'}
                        <input type="file" hidden accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(t, f); e.target.value = ''; }} />
                      </label>
                      {!t.evidence.length && <ConfirmButton onConfirm={() => remove(t)} confirmText="¿Eliminar?">Eliminar</ConfirmButton>}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
      <p className="small muted mt">La evidencia se guarda en el servidor con fecha, autor y huella SHA-256 para demostrar que no fue alterada. Formatos: PDF, imagen, Word, Excel o texto.</p>
      <Disclaimer />
    </>
  );
}
