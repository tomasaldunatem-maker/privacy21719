import { Fragment, useEffect, useState, type FormEvent } from 'react';
import { api, errorText, qs, ApiError } from '../lib/api';
import { useData, useDebounced } from '../lib/useData';
import { usePerms } from '../lib/auth';
import { DPIA_LABEL, RISK_LABEL, riskTone } from '../lib/format';
import { ConfirmButton, Disclaimer, Empty, ErrorBox, FieldErrors, Loading, PageHead, Pill, useToast } from '../components/ui';

interface Finding { article: string; message: string; severity: string }
interface Activity { id: string; name: string; purpose: string | null; dataCategories: string | null; sensitive: boolean; legalBasis: string; system: string | null; processors: string | null; retention: string; risk: string; dpiaStatus: string; findings: Finding[] }
const BASES = ['Sin definir', 'Consentimiento', 'Prestación de salud (Ley 20.584)', 'Ejecución del servicio solicitado', 'Obligación legal', 'Interés legítimo'];
const EMPTY = { name: '', purpose: '', dataCategories: '', legalBasis: 'Sin definir', system: '', processors: '', retention: '', sensitive: false };

export default function Processing() {
  const perms = usePerms();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [risk, setRisk] = useState('');
  const [sens, setSens] = useState('');
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useData(() => api<Activity[]>(`/processing${qs({ q: dq, risk, sensitive: sens })}`), [dq, risk, sens]);
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [errs, setErrs] = useState<Record<string, string[]>>();
  const [preview, setPreview] = useState<{ findings: Finding[]; risk: string; dpiaStatus: string } | null>(null);
  const dform = useDebounced(form, 400);
  const [open, setOpen] = useState<string | null>(null);

  // Copiloto: consulta las reglas del servidor mientras se completa el formulario
  useEffect(() => {
    if (!dform || !(dform.name || dform.purpose || dform.dataCategories)) { setPreview(null); return; }
    api<{ findings: Finding[]; risk: string; dpiaStatus: string }>('/processing/copilot', { body: dform }).then(setPreview).catch(() => {});
  }, [dform]);

  const set = (k: keyof typeof EMPTY, v: string | boolean) => setForm((f) => (f ? { ...f, [k]: v } : f));
  function startEdit(a: Activity) {
    setEditId(a.id);
    setForm({ name: a.name, purpose: a.purpose ?? '', dataCategories: a.dataCategories ?? '', legalBasis: a.legalBasis, system: a.system ?? '', processors: a.processors ?? '', retention: a.retention, sensitive: a.sensitive });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      if (editId) await api(`/processing/${editId}`, { method: 'PATCH', body: form });
      else await api('/processing', { body: form });
      toast(editId ? 'Tratamiento actualizado' : 'Tratamiento agregado al inventario');
      setForm(null); setEditId(null); setErrs(undefined); reload();
    } catch (err) { if (err instanceof ApiError) setErrs(err.details); toast(errorText(err), true); }
  }
  async function setDpia(a: Activity, v: string) {
    try { await api(`/processing/${a.id}`, { method: 'PATCH', body: { dpiaStatus: v } }); toast('Evaluación de impacto actualizada'); reload(); } catch (err) { toast(errorText(err), true); }
  }
  async function remove(a: Activity) {
    try { await api(`/processing/${a.id}`, { method: 'DELETE' }); toast('Tratamiento eliminado'); reload(); } catch (err) { toast(errorText(err), true); }
  }

  return (
    <>
      <PageHead eyebrow="Módulo 2 · Registro de tratamientos" title="Inventario de datos"
        lede="Qué datos de pacientes y personal trata la clínica, para qué, con qué base legal, en qué sistema, quién más accede y cuánto tiempo se guardan."
        right={perms.canManage && <button className="btn" onClick={() => { setEditId(null); setForm(form ? null : { ...EMPTY }); }}>Nuevo tratamiento</button>} />
      {form && (
        <div className="dlg"><h2>{editId ? 'Editar tratamiento' : 'Nuevo tratamiento'}</h2>
          <div className="grid g-main">
            <form className="f" onSubmit={save}>
              <label className="full" htmlFor="n_no">Nombre<input id="n_no" required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ej.: Control de asistencia con huella digital" /><FieldErrors errors={errs} name="name" /></label>
              <label className="full" htmlFor="n_fi">Finalidad<input id="n_fi" value={form.purpose} onChange={(e) => set('purpose', e.target.value)} /></label>
              <label className="full" htmlFor="n_da">Datos que se recogen<input id="n_da" value={form.dataCategories} onChange={(e) => set('dataCategories', e.target.value)} /></label>
              <label htmlFor="n_ba">Base de licitud<select id="n_ba" value={form.legalBasis} onChange={(e) => set('legalBasis', e.target.value)}>{BASES.map((b) => <option key={b}>{b}</option>)}</select></label>
              <label htmlFor="n_si">Sistema<input id="n_si" value={form.system} onChange={(e) => set('system', e.target.value)} /></label>
              <label htmlFor="n_en">Terceros que acceden<input id="n_en" value={form.processors} onChange={(e) => set('processors', e.target.value)} placeholder="Ninguno" /></label>
              <label htmlFor="n_co">Plazo de conservación<input id="n_co" value={form.retention} onChange={(e) => set('retention', e.target.value)} placeholder="Sin definir" /></label>
              <label className="check full"><input type="checkbox" checked={form.sensitive} onChange={(e) => set('sensitive', e.target.checked)} /> Incluye datos de salud u otros datos sensibles</label>
              <div className="full row"><button className="btn" type="submit">{editId ? 'Guardar cambios' : 'Guardar en el inventario'}</button><button className="btn ghost" type="button" onClick={() => { setForm(null); setEditId(null); }}>Cancelar</button></div>
            </form>
            <div className="copilot"><h3>Copiloto de cumplimiento</h3>
              {preview?.findings.length ? (<>
                <ul>{preview.findings.map((f, i) => <li key={i}><span className="art">{f.article}</span> {f.message}</li>)}</ul>
                <p className="small mt-s">Riesgo sugerido: <b>{RISK_LABEL[preview.risk]}</b> · Evaluación de impacto: <b>{DPIA_LABEL[preview.dpiaStatus]}</b></p>
                <p className="small muted mt-s">Sugerencias basadas en reglas. Requieren revisión del responsable de privacidad.</p>
              </>) : <p className="small">Escriba el tratamiento y aquí aparecerán las obligaciones que activa.</p>}
            </div>
          </div>
        </div>
      )}
      <div className="filters">
        <input type="search" placeholder="Buscar tratamiento o sistema" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
        <select value={risk} onChange={(e) => setRisk(e.target.value)} aria-label="Riesgo"><option value="">Todo riesgo</option><option value="ALTO">Alto</option><option value="MEDIO">Medio</option><option value="BAJO">Bajo</option></select>
        <select value={sens} onChange={(e) => setSens(e.target.value)} aria-label="Sensibles"><option value="">Todos</option><option value="true">Con datos sensibles</option><option value="false">Sin datos sensibles</option></select>
      </div>
      {error ? <ErrorBox error={error} onRetry={reload} /> : loading && !data ? <Loading /> : !data?.length ? <Empty>No hay tratamientos con esos filtros.</Empty> : (
        <div className="tablewrap"><table>
          <thead><tr><th>Tratamiento</th><th>Datos</th><th>Base de licitud</th><th>Sistema · terceros</th><th>Conservación</th><th>Riesgo</th><th>Evaluación de impacto</th><th></th></tr></thead>
          <tbody>{data.map((a) => (<Fragment key={a.id}>
            <tr key={a.id}>
              <td><div style={{ fontWeight: 600 }}>{a.name}</div><div className="sub">{a.purpose}</div>{a.sensitive && <span className="pill acc" style={{ marginTop: 4 }}>Sensible</span>}</td>
              <td className="sub">{a.dataCategories}</td>
              <td>{/sin definir/i.test(a.legalBasis) ? <Pill tone="bad">Sin definir</Pill> : a.legalBasis}</td>
              <td><div>{a.system}</div><div className="sub">{a.processors}</div></td>
              <td>{/sin definir/i.test(a.retention) ? <Pill tone="warn">Sin definir</Pill> : a.retention}</td>
              <td><Pill tone={riskTone(a.risk)}>{RISK_LABEL[a.risk]}</Pill></td>
              <td>{perms.canManage ? (
                <select value={a.dpiaStatus} onChange={(e) => setDpia(a, e.target.value)} aria-label="Evaluación de impacto">{Object.entries(DPIA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              ) : DPIA_LABEL[a.dpiaStatus]}</td>
              <td><div className="row">
                <button className="linkbtn" onClick={() => setOpen(open === a.id ? null : a.id)}>{a.findings.length} alertas</button>
                {perms.canManage && <button className="linkbtn" onClick={() => startEdit(a)}>Editar</button>}
                {perms.canManage && <ConfirmButton className="linkbtn" onConfirm={() => remove(a)} confirmText="¿Eliminar?">Eliminar</ConfirmButton>}
              </div></td>
            </tr>
            {open === a.id && <tr key={`${a.id}-f`}><td colSpan={8}><ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{a.findings.map((f, i) => <li key={i}><span className="art">{f.article}</span> {f.message}</li>)}</ul></td></tr>}
          </Fragment>))}</tbody>
        </table></div>
      )}
      <Disclaimer />
    </>
  );
}
