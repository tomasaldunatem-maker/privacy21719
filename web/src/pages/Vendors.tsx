import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errorText, qs, ApiError } from '../lib/api';
import { useData, useDebounced } from '../lib/useData';
import { usePerms } from '../lib/auth';
import { CONTRACT_LABEL, OUTSIDE_LABEL, RISK_LABEL, fmtDate, riskTone, todayLocal } from '../lib/format';
import { ConfirmButton, Disclaimer, Empty, ErrorBox, FieldErrors, Loading, PageHead, Pill, useToast } from '../components/ui';

interface Vendor { id: string; name: string; service: string | null; sensitive: boolean; contractStatus: string; outsideChile: string; lastReview: string | null; risk: string }

export default function Vendors() {
  const perms = usePerms();
  const toast = useToast();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [contract, setContract] = useState('');
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useData(() => api<Vendor[]>(`/vendors${qs({ q: dq, contract })}`), [dq, contract]);
  const [showNew, setShowNew] = useState(false);
  const [errs, setErrs] = useState<Record<string, string[]>>();

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, unknown>;
    f.sensitive = f.sensitive === 'on';
    f.lastReview = todayLocal();
    try { await api('/vendors', { body: f }); toast('Proveedor agregado'); setShowNew(false); setErrs(undefined); reload(); }
    catch (err) { if (err instanceof ApiError) setErrs(err.details); toast(errorText(err), true); }
  }
  async function update(v: Vendor, body: Partial<Vendor>, msg: string) {
    try { await api(`/vendors/${v.id}`, { method: 'PATCH', body }); toast(msg); reload(); } catch (err) { toast(errorText(err), true); }
  }
  async function remove(v: Vendor) {
    try { await api(`/vendors/${v.id}`, { method: 'DELETE' }); toast('Proveedor eliminado'); reload(); } catch (err) { toast(errorText(err), true); }
  }

  return (
    <>
      <PageHead eyebrow="Módulo 5 · Art. 15 bis" title="Proveedores con acceso a datos"
        lede="Terceros que tratan datos por cuenta de la clínica. Cada uno necesita un contrato que fije instrucciones, confidencialidad y medidas de seguridad. El riesgo se recalcula al cambiar el contrato."
        right={perms.canManage && <button className="btn" onClick={() => setShowNew(!showNew)}>Agregar proveedor</button>} />
      {showNew && (
        <div className="dlg"><h2>Agregar proveedor</h2>
          <form className="f" onSubmit={create}>
            <label htmlFor="p_no">Nombre<input id="p_no" name="name" required /><FieldErrors errors={errs} name="name" /></label>
            <label htmlFor="p_se">Servicio<input id="p_se" name="service" /></label>
            <label htmlFor="p_co">Contrato de encargo<select id="p_co" name="contractStatus">{Object.entries(CONTRACT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label htmlFor="p_ex">¿Datos alojados fuera de Chile?<select id="p_ex" name="outsideChile">{Object.entries(OUTSIDE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="check full"><input type="checkbox" name="sensitive" /> Accede a datos de salud</label>
            <div className="full row"><button className="btn" type="submit">Guardar proveedor</button><button className="btn ghost" type="button" onClick={() => setShowNew(false)}>Cancelar</button></div>
          </form>
        </div>
      )}
      <div className="filters">
        <input type="search" placeholder="Buscar proveedor o servicio" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar proveedores" />
        <select value={contract} onChange={(e) => setContract(e.target.value)} aria-label="Contrato"><option value="">Todos los contratos</option>{Object.entries(CONTRACT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      {error ? <ErrorBox error={error} onRetry={reload} /> : loading && !data ? <Loading /> : !data?.length ? <Empty>No hay proveedores con esos filtros.</Empty> : (
        <div className="tablewrap"><table>
          <thead><tr><th>Proveedor</th><th>Datos de salud</th><th>Contrato</th><th>Fuera de Chile</th><th>Última revisión</th><th>Riesgo</th><th></th></tr></thead>
          <tbody>{data.map((v) => (
            <tr key={v.id}>
              <td><div style={{ fontWeight: 600 }}>{v.name}</div><div className="sub">{v.service}</div></td>
              <td>{v.sensitive ? 'Sí' : 'No'}</td>
              <td>{perms.canManage ? (
                <select value={v.contractStatus} onChange={(e) => update(v, { contractStatus: e.target.value }, 'Contrato actualizado')} aria-label="Contrato">{Object.entries(CONTRACT_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              ) : <Pill tone={v.contractStatus === 'FIRMADO' ? 'ok' : v.contractStatus === 'PENDIENTE' ? 'warn' : 'bad'}>{CONTRACT_LABEL[v.contractStatus]}</Pill>}
                {v.contractStatus !== 'FIRMADO' && <div><button className="linkbtn" onClick={() => nav('/documentos?t=encargo')}>Generar anexo</button></div>}</td>
              <td>{perms.canManage ? (
                <select value={v.outsideChile} onChange={(e) => update(v, { outsideChile: e.target.value }, 'Ubicación actualizada')} aria-label="Fuera de Chile">{Object.entries(OUTSIDE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              ) : OUTSIDE_LABEL[v.outsideChile]}</td>
              <td className="num">{v.lastReview ? fmtDate(v.lastReview) : <Pill>Nunca</Pill>}</td>
              <td><Pill tone={riskTone(v.risk)}>{RISK_LABEL[v.risk]}</Pill></td>
              <td>{perms.canManage && <div className="row">
                <button className="linkbtn" onClick={() => update(v, { lastReview: todayLocal() }, 'Revisión registrada hoy')}>Marcar revisado</button>
                <ConfirmButton className="linkbtn" onConfirm={() => remove(v)} confirmText="¿Eliminar?">Eliminar</ConfirmButton>
              </div>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <Disclaimer />
    </>
  );
}
