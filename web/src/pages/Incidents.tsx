import { useState, type FormEvent } from 'react';
import { api, errorText, ApiError } from '../lib/api';
import { useData } from '../lib/useData';
import { usePerms } from '../lib/auth';
import { daysUntil, fmtDate, fmtDateTime, todayLocal } from '../lib/format';
import { Disclaimer, Empty, ErrorBox, FieldErrors, Loading, PageHead, Pill, useToast } from '../components/ui';

interface Incident { id: string; title: string; detectedAt: string; type: string; sensitive: boolean; affected: string | null; status: string; steps: Record<string, boolean>; requiredSteps: string[]; agencyNotifiedAt: string | null; subjectsNotifiedAt: string | null; notes: string | null }
const STEPS: [string, string][] = [
  ['contener', 'Contener: cambiar contraseñas, aislar equipo, revocar accesos'],
  ['evaluar', 'Evaluar riesgo: qué datos, cuántos pacientes, si incluye datos de salud'],
  ['agencia', 'Notificar a la Agencia sin dilaciones indebidas (Art. 14 sexies)'],
  ['titulares', 'Comunicar a los pacientes afectados'],
  ['registro', 'Registrar el incidente, las medidas y las lecciones aprendidas'],
];

export default function Incidents() {
  const perms = usePerms();
  const toast = useToast();
  const { data, error, loading, reload, setData } = useData(() => api<Incident[]>('/incidents'));
  const [showNew, setShowNew] = useState(false);
  const [errs, setErrs] = useState<Record<string, string[]>>();

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, unknown>;
    f.sensitive = f.sensitive === 'on';
    try { await api('/incidents', { body: f }); toast('Expediente abierto'); setShowNew(false); setErrs(undefined); reload(); }
    catch (err) { if (err instanceof ApiError) setErrs(err.details); toast(errorText(err), true); }
  }
  async function step(i: Incident, k: string, v: boolean) {
    // Actualización optimista: el check cambia al instante y se confirma con el servidor
    setData((list) => list?.map((x) => (x.id === i.id ? { ...x, steps: { ...x.steps, [k]: v } } : x)) ?? list);
    try {
      const upd = await api<Incident>(`/incidents/${i.id}`, { method: 'PATCH', body: { steps: { [k]: v } } });
      setData((list) => list?.map((x) => (x.id === i.id ? upd : x)) ?? list);
    } catch (err) { toast(errorText(err), true); reload(); }
  }
  async function close(i: Incident) {
    try { await api(`/incidents/${i.id}/close`, { method: 'POST' }); toast('Expediente cerrado'); reload(); } catch (err) { toast(errorText(err), true); }
  }

  const sorted = [...(data ?? [])].sort((a, b) => Number(a.status === 'CERRADO') - Number(b.status === 'CERRADO'));
  return (
    <>
      <PageHead eyebrow="Módulo 4 · Art. 14 sexies" title="Incidentes de seguridad"
        lede="Expediente completo de cada vulneración. Si hay datos de salud involucrados, notificar a la Agencia y comunicar a los pacientes son pasos obligatorios para cerrar."
        right={perms.canOperate && <button className="btn" onClick={() => setShowNew(!showNew)}>Reportar incidente</button>} />
      {showNew && (
        <div className="dlg"><h2>Reportar incidente</h2>
          <form className="f" onSubmit={create}>
            <label className="full" htmlFor="i_ti">Qué ocurrió<input id="i_ti" name="title" required placeholder="Ej.: Robo de notebook de recepción" /><FieldErrors errors={errs} name="title" /></label>
            <label htmlFor="i_fe">Fecha de detección<input id="i_fe" name="detectedAt" type="date" defaultValue={todayLocal()} max={todayLocal()} required /></label>
            <label htmlFor="i_tp">Tipo<select id="i_tp" name="type"><option>Acceso no autorizado</option><option>Divulgación accidental</option><option>Pérdida o robo de equipo</option><option>Ransomware</option><option>Otro</option></select></label>
            <label htmlFor="i_af">Pacientes afectados (estimado)<input id="i_af" name="affected" placeholder="Por determinar" /></label>
            <label className="check"><input type="checkbox" name="sensitive" defaultChecked /> Involucra fichas, imágenes u otros datos de salud</label>
            <label className="full" htmlFor="i_no">Notas<textarea id="i_no" name="notes" /></label>
            <div className="full row"><button className="btn" type="submit">Abrir expediente</button><button className="btn ghost" type="button" onClick={() => setShowNew(false)}>Cancelar</button></div>
          </form>
        </div>
      )}
      {error ? <ErrorBox error={error} onRetry={reload} /> : loading && !data ? <Loading /> : !sorted.length ? <Empty>No hay incidentes registrados.</Empty> : (
        <div className="grid g2">{sorted.map((i) => {
          const req = new Set(i.requiredSteps);
          const done = i.requiredSteps.filter((s) => i.steps[s]).length;
          const open = i.status !== 'CERRADO';
          return (
            <div className="panel" key={i.id}>
              <div className="spread"><Pill tone={open ? 'bad' : 'ok'}>{open ? 'En evaluación' : 'Cerrado'}</Pill><span className="num muted">{fmtDate(i.detectedAt)}{open && ` · hace ${-daysUntil(i.detectedAt)} d`}</span></div>
              <h2 style={{ marginTop: 10 }}>{i.title}</h2>
              <dl className="kv"><dt>Tipo</dt><dd>{i.type}</dd><dt>Afectados</dt><dd>{i.affected || 'Por determinar'}</dd><dt>Datos de salud</dt><dd>{i.sensitive ? 'Sí' : 'No'}</dd>
                {i.agencyNotifiedAt && <><dt>Agencia notificada</dt><dd>{fmtDateTime(i.agencyNotifiedAt)}</dd></>}
                {i.subjectsNotifiedAt && <><dt>Pacientes comunicados</dt><dd>{fmtDateTime(i.subjectsNotifiedAt)}</dd></>}</dl>
              {i.notes && <p className="small muted mt-s">{i.notes}</p>}
              <div className="bar"><i style={{ width: `${(done / i.requiredSteps.length) * 100}%` }} /></div>
              <div className="steps mt">{STEPS.map(([k, l]) => (
                <label key={k} className="check step"><input type="checkbox" checked={!!i.steps[k]} disabled={!perms.canManage} onChange={(e) => step(i, k, e.target.checked)} />
                  <span>{l}{!req.has(k) && <span className="muted"> (si corresponde)</span>}</span></label>
              ))}</div>
              {open && perms.canManage && <button className="btn sm mt" disabled={done < i.requiredSteps.length} onClick={() => close(i)}>Cerrar expediente</button>}
            </div>
          );
        })}</div>
      )}
      <Disclaimer />
    </>
  );
}
