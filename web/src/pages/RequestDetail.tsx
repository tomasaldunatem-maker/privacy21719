import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorText, qs } from '../lib/api';
import { useData, useDebounced } from '../lib/useData';
import { usePerms } from '../lib/auth';
import { REQ_STATUS_LABEL, REQ_TYPE_LABEL, daysUntil, deadlineText, deadlineTone, fmtDate, fmtDateTime } from '../lib/format';
import { ErrorBox, Loading, PageHead, Pill, useToast } from '../components/ui';
import { isClosed, type DataRequest } from './Requests';

interface Patient { id: string; source: string; externalId: string; firstName: string; lastName: string | null; rut: string | null; email: string | null }
interface Detail extends DataRequest { events: { id: string; action: string; note: string | null; createdAt: string; userName: string | null }[]; patient: Patient | null; suggestions: Patient[]; extensionReason: string | null }
interface ClinicalData { generatedAt: string; folio: string; source: string; isMock: boolean; patient: unknown; appointments: unknown[]; note: string }

const HINT: Record<string, string> = {
  SUPRESION: 'La ficha clínica debe conservarse al menos 15 años; la supresión puede ser parcial (p. ej., fotos de marketing o datos de contacto).',
  ACCESO: 'Entregue copia de la ficha y las imágenes en un formato legible, previa verificación de identidad.',
  PORTABILIDAD: 'Entregue los datos en formato estructurado y de uso común (p. ej., PDF de la ficha y DICOM de las radiografías).',
  RECTIFICACION: 'Corrija el dato también en el software clínico y deje constancia del cambio.',
};

export default function RequestDetail() {
  const { id } = useParams();
  const perms = usePerms();
  const toast = useToast();
  const { data: r, error, loading, reload } = useData(() => api<Detail>(`/requests/${id}`), [id]);
  const [summary, setSummary] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [extReason, setExtReason] = useState('');
  const [search, setSearch] = useState('');
  const ds = useDebounced(search);
  const found = useData(() => (ds.length >= 2 ? api<Patient[]>(`/integration/patients${qs({ q: ds, limit: 8 })}`) : Promise.resolve([])), [ds]);
  const [clinical, setClinical] = useState<ClinicalData | null>(null);
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>, msg: string) {
    setBusy(true);
    try { await api(`/requests/${id}`, { method: 'PATCH', body }); toast(msg); setNote(''); await reload(); } catch (e) { toast(errorText(e), true); } finally { setBusy(false); }
  }
  async function extend() {
    try { await api(`/requests/${id}/extend`, { body: { reason: extReason } }); toast('Plazo prorrogado 30 días'); setExtReason(''); reload(); } catch (e) { toast(errorText(e), true); }
  }
  async function fetchClinical() {
    setBusy(true);
    try { setClinical(await api<ClinicalData>(`/requests/${id}/clinical-data`)); reload(); } catch (e) { toast(errorText(e), true); } finally { setBusy(false); }
  }
  function download() {
    if (!clinical) return;
    const blob = new Blob([JSON.stringify(clinical, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `${clinical.folio}-datos.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (loading || !r) return <Loading />;
  const d = daysUntil(r.dueAt);
  const closed = isClosed(r.status);
  const pname = (p: Patient) => `${p.firstName} ${p.lastName ?? ''}`.trim();

  return (
    <>
      <PageHead eyebrow={<><Link to="/solicitudes">Solicitudes</Link> · <span className="mono">{r.folio}</span></>}
        title={`${REQ_TYPE_LABEL[r.type]} · ${r.requesterName}`}
        lede={r.details ?? undefined}
        right={closed ? <Pill tone="ok">{REQ_STATUS_LABEL[r.status]}</Pill> : <Pill tone={deadlineTone(d)}>{deadlineText(d)} · vence {fmtDate(r.dueAt)}</Pill>} />
      <div className="grid g-main">
        <div className="grid" style={{ alignContent: 'start' }}>
          {HINT[r.type] && !closed && <div className="alert">{HINT[r.type]}</div>}
          <div className="panel">
            <h2>Gestión</h2>
            <div className="grid g2">
              <label htmlFor="rq_status">Estado
                <select id="rq_status" value={r.status} disabled={!perms.canOperate || busy} onChange={(e) => patch({ status: e.target.value, ...(summary ? { responseSummary: summary } : {}) }, `Estado: ${REQ_STATUS_LABEL[e.target.value]}`)}>
                  {Object.entries(REQ_STATUS_LABEL).map(([k, v]) => <option key={k} value={k} disabled={!perms.canManage && isClosed(k)}>{v}</option>)}
                </select>
              </label>
              <label className="check" style={{ alignSelf: 'end' }}><input type="checkbox" checked={r.identityVerified} disabled={!perms.canOperate || busy} onChange={(e) => patch({ identityVerified: e.target.checked }, e.target.checked ? 'Identidad verificada' : 'Verificación anulada')} /> Identidad del solicitante verificada</label>
            </div>
            <label className="mt" htmlFor="rq_sum">Resumen de la respuesta enviada al paciente (obligatorio para cerrar)
              <textarea id="rq_sum" value={summary ?? r.responseSummary ?? ''} disabled={!perms.canManage} onChange={(e) => setSummary(e.target.value)} />
            </label>
            {perms.canManage && summary !== null && summary !== (r.responseSummary ?? '') && <button className="btn sm mt-s" disabled={busy} onClick={() => patch({ responseSummary: summary }, 'Respuesta guardada').then(() => setSummary(null))}>Guardar respuesta</button>}
            {perms.canOperate && (
              <div className="row mt">
                <input style={{ flex: 1 }} placeholder="Agregar una nota interna" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Nota" />
                <button className="btn ghost sm" disabled={!note.trim() || busy} onClick={() => patch({ note }, 'Nota agregada')}>Agregar nota</button>
              </div>
            )}
            {perms.canManage && !closed && !r.extended && d >= 0 && (
              <div className="row mt">
                <input style={{ flex: 1 }} placeholder="Motivo de la prórroga (se informa al paciente)" value={extReason} onChange={(e) => setExtReason(e.target.value)} aria-label="Motivo de prórroga" />
                <button className="btn ghost sm" disabled={extReason.trim().length < 10} onClick={extend}>Prorrogar 30 días</button>
              </div>
            )}
            {r.extended && <p className="small muted mt">Plazo prorrogado: {r.extensionReason}</p>}
          </div>

          <div className="panel">
            <h2>Paciente en el software clínico</h2>
            {r.patient ? (
              <div className="spread">
                <div><b>{pname(r.patient)}</b><div className="small muted">{r.patient.rut ?? 'Sin RUT'} · {r.patient.email ?? 'Sin correo'} · origen: {r.patient.source}</div></div>
                {perms.canOperate && !closed && <button className="btn ghost sm" onClick={() => patch({ patientId: null }, 'Paciente desvinculado')}>Desvincular</button>}
              </div>
            ) : (
              <>
                {r.suggestions.length > 0 && <>
                  <p className="small">Coincidencias por RUT o correo:</p>
                  <div className="list">{r.suggestions.map((p) => (
                    <div className="li" key={p.id}><div><div className="t">{pname(p)}</div><div className="m">{p.rut} · {p.email}</div></div>
                      {perms.canOperate && <button className="btn sm" onClick={() => patch({ patientId: p.id }, 'Solicitud vinculada al paciente')}>Vincular</button>}</div>
                  ))}</div>
                </>}
                {perms.canOperate && <>
                  <input className="mt-s" style={{ width: '100%' }} type="search" placeholder="Buscar paciente por nombre o RUT" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar paciente" />
                  <div className="list">{(found.data ?? []).map((p) => (
                    <div className="li" key={p.id}><div><div className="t">{pname(p)}</div><div className="m">{p.rut ?? 'Sin RUT'} · {p.source}</div></div>
                      <button className="btn ghost sm" onClick={() => patch({ patientId: p.id }, 'Solicitud vinculada al paciente')}>Vincular</button></div>
                  ))}</div>
                </>}
                {!r.suggestions.length && !search && <p className="small muted mt-s">Vincule la solicitud para poder obtener los datos desde el software clínico.</p>}
              </>
            )}
            {perms.canManage && ['ACCESO', 'PORTABILIDAD'].includes(r.type) && (
              <div className="mt">
                <button className="btn" disabled={busy || !r.patient || !r.identityVerified} onClick={fetchClinical}>Obtener datos desde el software clínico</button>
                {(!r.patient || !r.identityVerified) && <p className="small muted mt-s">Requiere identidad verificada y paciente vinculado.</p>}
              </div>
            )}
            {clinical && (
              <div className="mt">
                {clinical.isMock && <div className="alert warn">Datos de prueba: la clínica aún no tiene conectado su software clínico.</div>}
                <p className="small mt-s">{clinical.note}</p>
                <pre className="doc mt-s" style={{ maxHeight: 280 }}>{JSON.stringify({ paciente: clinical.patient, citas: clinical.appointments }, null, 2)}</pre>
                <button className="btn ghost sm mt-s" onClick={download}>Descargar JSON</button>
              </div>
            )}
          </div>
        </div>

        <div className="grid" style={{ alignContent: 'start' }}>
          <div className="panel">
            <h2>Datos de la solicitud</h2>
            <dl className="kv">
              <dt>Folio</dt><dd className="mono">{r.folio}</dd>
              <dt>Solicitante</dt><dd>{r.requesterName}</dd>
              <dt>RUT</dt><dd>{r.requesterRut ?? '—'}</dd>
              <dt>Correo</dt><dd>{r.requesterEmail ?? '—'}</dd>
              <dt>Canal</dt><dd>{r.channel}</dd>
              <dt>Recibida</dt><dd>{fmtDate(r.receivedAt)}</dd>
              <dt>Vence</dt><dd>{fmtDate(r.dueAt)}</dd>
            </dl>
          </div>
          <div className="panel">
            <h2>Historial</h2>
            <ul className="timeline">{r.events.map((e) => (
              <li key={e.id}><div className="small"><b>{e.action}</b></div>{e.note && <div className="small">{e.note}</div>}<div className="small muted">{fmtDateTime(e.createdAt)} · {e.userName ?? 'Formulario web'}</div></li>
            ))}</ul>
          </div>
        </div>
      </div>
    </>
  );
}
