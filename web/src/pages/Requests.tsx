import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, errorText, qs, ApiError } from '../lib/api';
import { useData, useDebounced } from '../lib/useData';
import { useAuth, usePerms } from '../lib/auth';
import { REQ_STATUS_LABEL, REQ_TYPE_LABEL, daysUntil, deadlineText, deadlineTone, fmtDate, todayLocal } from '../lib/format';
import { Disclaimer, Empty, ErrorBox, FieldErrors, Loading, PageHead, Pill, useToast } from '../components/ui';

export interface DataRequest { id: string; folio: string; requesterName: string; requesterRut: string | null; requesterEmail: string | null; type: string; details: string | null; channel: string; receivedAt: string; dueAt: string; extended: boolean; status: string; identityVerified: boolean; patientId: string | null; responseSummary: string | null }
export const isClosed = (s: string) => s === 'RESPONDIDA' || s === 'RECHAZADA';

export default function Requests() {
  const perms = usePerms();
  const { me } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(true);
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useData(() => api<DataRequest[]>(`/requests${qs({ q: dq, status, type, open: onlyOpen && !status ? 'true' : undefined })}`), [dq, status, type, onlyOpen]);
  const [showNew, setShowNew] = useState(false);
  const [errs, setErrs] = useState<Record<string, string[]>>();

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      const r = await api<DataRequest>('/requests', { body: Object.fromEntries(new FormData(e.currentTarget)) });
      toast(`Solicitud ${r.folio} registrada · vence ${fmtDate(r.dueAt)}`); setShowNew(false); setErrs(undefined);
      nav(`/solicitudes/${r.id}`);
    } catch (err) { if (err instanceof ApiError) setErrs(err.details); toast(errorText(err), true); }
  }
  const publicUrl = `${window.location.origin}/p/${me?.organization.slug}`;

  return (
    <>
      <PageHead eyebrow="Módulo 3 · Art. 4–11" title="Solicitudes de pacientes"
        lede="Plazo de respuesta: 30 días corridos desde la recepción, prorrogable una vez por otros 30 con justificación. El vencimiento se calcula automáticamente."
        right={perms.canOperate && <button className="btn" onClick={() => setShowNew(!showNew)}>Registrar solicitud</button>} />
      {showNew && (
        <div className="dlg"><h2>Registrar solicitud</h2>
          <form className="f" onSubmit={create}>
            <label htmlFor="r_ti">Paciente (titular)<input id="r_ti" name="requesterName" required /><FieldErrors errors={errs} name="requesterName" /></label>
            <label htmlFor="r_ru">RUT<input id="r_ru" name="requesterRut" placeholder="12.345.678-5" /><FieldErrors errors={errs} name="requesterRut" /></label>
            <label htmlFor="r_em">Correo<input id="r_em" name="requesterEmail" type="email" /><FieldErrors errors={errs} name="requesterEmail" /></label>
            <label htmlFor="r_tp">Tipo de derecho<select id="r_tp" name="type">{Object.entries(REQ_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label htmlFor="r_fe">Fecha de recepción<input id="r_fe" name="receivedAt" type="date" required defaultValue={todayLocal()} max={todayLocal()} /><FieldErrors errors={errs} name="receivedAt" /></label>
            <label htmlFor="r_ca">Canal<select id="r_ca" name="channel"><option>Presencial en recepción</option><option>Correo</option><option>Teléfono</option><option>Portal web</option></select></label>
            <label className="full" htmlFor="r_de">Detalle<textarea id="r_de" name="details" /></label>
            <div className="full row"><button className="btn" type="submit">Registrar y calcular plazo</button><button className="btn ghost" type="button" onClick={() => setShowNew(false)}>Cancelar</button></div>
          </form>
        </div>
      )}
      <div className="filters">
        <input type="search" placeholder="Buscar por nombre, RUT o folio" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar solicitudes" />
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Tipo"><option value="">Todos los derechos</option>{Object.entries(REQ_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Estado"><option value="">Todos los estados</option>{Object.entries(REQ_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <label className="check"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} disabled={!!status} /> Solo abiertas</label>
      </div>
      {error ? <ErrorBox error={error} onRetry={reload} /> : loading && !data ? <Loading /> : !data?.length ? <Empty>No hay solicitudes con esos filtros.</Empty> : (
        <div className="tablewrap"><table>
          <thead><tr><th>Folio</th><th>Paciente</th><th>Derecho</th><th>Recibida</th><th>Vence</th><th>Plazo</th><th>Estado</th></tr></thead>
          <tbody>{data.map((r) => {
            const d = daysUntil(r.dueAt);
            return (
              <tr key={r.id} className="clickable" onClick={() => nav(`/solicitudes/${r.id}`)}>
                <td><Link to={`/solicitudes/${r.id}`} className="mono" onClick={(e) => e.stopPropagation()}>{r.folio}</Link></td>
                <td><div style={{ fontWeight: 600 }}>{r.requesterName}</div><div className="sub">{r.details}</div></td>
                <td>{REQ_TYPE_LABEL[r.type]}</td>
                <td className="num">{fmtDate(r.receivedAt)}</td>
                <td className="num">{fmtDate(r.dueAt)}{r.extended && <div className="sub">prorrogada</div>}</td>
                <td>{isClosed(r.status) ? <Pill tone="ok">Cerrada</Pill> : <Pill tone={deadlineTone(d)}>{deadlineText(d)}</Pill>}</td>
                <td>{REQ_STATUS_LABEL[r.status]}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
      <div className="panel mt">
        <h2>Formulario público para pacientes</h2>
        <p className="small muted">Comparta este enlace en su sitio web, correo o un código QR en recepción. Las solicitudes llegan directo a esta bandeja con folio y plazo.</p>
        <div className="row mt-s"><span className="secret">{publicUrl}</span><a className="btn ghost sm" href={`/p/${me?.organization.slug}`} target="_blank" rel="noreferrer">Abrir formulario</a></div>
      </div>
      <Disclaimer />
    </>
  );
}
