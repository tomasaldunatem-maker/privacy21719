import { useState, type FormEvent } from 'react';
import { api, errorText, qs, ApiError } from '../lib/api';
import { useData, useDebounced } from '../lib/useData';
import { usePerms } from '../lib/auth';
import { fmtDate, fmtDateTime, todayLocal } from '../lib/format';
import { Empty, ErrorBox, FieldErrors, Loading, PageHead, Pill, useToast } from '../components/ui';

interface Status {
  provider: string; label: string; isMock: boolean; credentialSource: string; baseUrl: string | null; savedProvider: string; tokenLast4: string | null;
  endpointsVerified: boolean | null; encryptionKeyConfigured: boolean; lastSyncAt: string | null; lastSyncStatus: string | null; lastSyncError: string | null;
  lastSyncCounts: Record<string, number> | null; providers: { id: string; label: string; defaultBaseUrl: string | null }[];
}
interface Patient { id: string; source: string; firstName: string; lastName: string | null; rut: string | null; email: string | null; phone: string | null; syncedAt: string | null }
interface Professional { id: string; externalId: string; name: string; specialty: string | null; active: boolean; source: string }
interface Appt { id: string; date: string; time: string | null; durationMin: number | null; status: string | null; patientName: string | null; professionalName: string | null; branchName: string | null }

const plus = (d: number) => { const t = new Date(`${todayLocal()}T12:00:00`); t.setDate(t.getDate() + d); return t.toISOString().slice(0, 10); };

function Connection() {
  const perms = usePerms();
  const toast = useToast();
  const { data: s, error, loading, reload } = useData(() => api<Status>('/integration'));
  const [provider, setProvider] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);

  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (loading || !s) return <Loading />;
  const p = provider ?? s.savedProvider;

  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true);
    try { await api('/integration', { method: 'PUT', body: { provider: p, baseUrl, token } }); setToken(''); toast('Configuración guardada'); setTest(null); reload(); }
    catch (err) { toast(errorText(err), true); } finally { setBusy(false); }
  }
  async function runTest() {
    setBusy(true);
    try { setTest(await api('/integration/test', { method: 'POST' })); } catch (err) { toast(errorText(err), true); } finally { setBusy(false); }
  }
  async function sync() {
    setBusy(true);
    try {
      const r = await api<{ counts: Record<string, number> }>('/integration/sync', { method: 'POST' });
      toast(`Sincronizado: ${r.counts.patients} pacientes, ${r.counts.professionals} profesionales, ${r.counts.appointments} citas`); reload();
    } catch (err) { toast(errorText(err), true); reload(); } finally { setBusy(false); }
  }

  return (
    <div className="grid g-main">
      <div className="grid" style={{ alignContent: 'start' }}>
        <div className="panel">
          <div className="spread"><h2>Estado de la conexión</h2>{s.isMock ? <Pill tone="warn">Datos de prueba</Pill> : <Pill tone="acc">{s.label}</Pill>}</div>
          {s.isMock && <div className="alert warn">La clínica aún no tiene conectado su software clínico. Se muestran datos ficticios para poder probar la plataforma.</div>}
          {!s.isMock && s.endpointsVerified === false && <div className="alert warn mt-s">Conexión configurada. Las rutas de la API de {s.label} están pendientes de verificar con su documentación oficial (ver README).</div>}
          <dl className="kv mt">
            <dt>Proveedor activo</dt><dd>{s.label}</dd>
            <dt>Credenciales</dt><dd>{s.credentialSource === 'database' ? `Guardadas cifradas (termina en ••••${s.tokenLast4})` : s.credentialSource === 'environment' ? 'Variables de entorno del servidor' : 'No configuradas'}</dd>
            {s.baseUrl && <><dt>URL de la API</dt><dd className="mono">{s.baseUrl}</dd></>}
            <dt>Última sincronización</dt><dd>{fmtDateTime(s.lastSyncAt)} {s.lastSyncStatus && <Pill tone={s.lastSyncStatus === 'OK' ? 'ok' : 'bad'}>{s.lastSyncStatus}</Pill>}</dd>
            {s.lastSyncError && <><dt>Error</dt><dd className="small" style={{ color: 'var(--bad)' }}>{s.lastSyncError}</dd></>}
            {s.lastSyncCounts && <><dt>Registros leídos</dt><dd>{s.lastSyncCounts.patients} pacientes · {s.lastSyncCounts.professionals} profesionales · {s.lastSyncCounts.branches} sucursales · {s.lastSyncCounts.appointments} citas</dd></>}
          </dl>
          {perms.canManage && <div className="row mt">
            <button className="btn" disabled={busy} onClick={sync}>{busy ? 'Procesando…' : 'Sincronizar ahora'}</button>
            <button className="btn ghost" disabled={busy} onClick={runTest}>Probar conexión</button>
          </div>}
          {test && <div className={`alert mt ${test.ok ? 'ok' : 'bad'}`}>{test.message}</div>}
        </div>
        <div className="panel">
          <h2>Qué se sincroniza</h2>
          <p className="small">Solo identificación de pacientes, profesionales, sucursales y la agenda de los últimos 90 días y próximos 60. <b>No se copian fichas clínicas, diagnósticos ni imágenes.</b> Cuando una solicitud de acceso o portabilidad lo requiere, los datos se consultan en el momento y queda registro en la auditoría.</p>
        </div>
      </div>
      {perms.isAdmin && (
        <div className="panel">
          <h2>Configurar conexión</h2>
          {!s.encryptionKeyConfigured && <div className="alert bad">El servidor no tiene configurada la clave de cifrado (INTEGRATION_ENCRYPTION_KEY). No se pueden guardar credenciales.</div>}
          <form className="f one mt-s" onSubmit={save}>
            <label htmlFor="ic_p">Software clínico<select id="ic_p" value={p} onChange={(e) => setProvider(e.target.value)}>{s.providers.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
            {p !== 'mock' && <>
              <label htmlFor="ic_u">URL base de la API (opcional)<input id="ic_u" type="url" placeholder={s.providers.find((x) => x.id === p)?.defaultBaseUrl ?? ''} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} /></label>
              <label htmlFor="ic_t">Token de API {s.tokenLast4 && s.savedProvider === p && <span className="muted">(guardado: ••••{s.tokenLast4}; deje vacío para mantenerlo)</span>}
                <input id="ic_t" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Pegue aquí el token entregado por el proveedor" /></label>
              <p className="small muted">El token se guarda cifrado en el servidor y nunca se vuelve a mostrar en el navegador.</p>
            </>}
            <button className="btn" type="submit" disabled={busy}>Guardar configuración</button>
          </form>
        </div>
      )}
    </div>
  );
}

function Patients() {
  const perms = usePerms();
  const toast = useToast();
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useData(() => api<Patient[]>(`/integration/patients${qs({ q: dq, limit: 100 })}`), [dq]);
  const [showNew, setShowNew] = useState(false);
  const [errs, setErrs] = useState<Record<string, string[]>>();
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try { await api('/integration/patients', { body: Object.fromEntries(new FormData(e.currentTarget)) }); toast('Paciente agregado'); setShowNew(false); setErrs(undefined); reload(); }
    catch (err) { if (err instanceof ApiError) setErrs(err.details); toast(errorText(err), true); }
  }
  return (
    <>
      <div className="filters">
        <input type="search" placeholder="Buscar por nombre, RUT o correo" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar pacientes" />
        {perms.canOperate && <button className="btn ghost" onClick={() => setShowNew(!showNew)}>Agregar paciente manual</button>}
      </div>
      {showNew && (
        <div className="dlg"><h2>Agregar paciente manual</h2>
          <p className="small muted" style={{ marginBottom: 10 }}>Úselo para titulares que no están en el software clínico (por ejemplo, alguien que nunca se atendió y pide que se borren sus datos de contacto).</p>
          <form className="f" onSubmit={create}>
            <label htmlFor="pm_f">Nombre<input id="pm_f" name="firstName" required /><FieldErrors errors={errs} name="firstName" /></label>
            <label htmlFor="pm_l">Apellidos<input id="pm_l" name="lastName" /></label>
            <label htmlFor="pm_r">RUT<input id="pm_r" name="rut" /><FieldErrors errors={errs} name="rut" /></label>
            <label htmlFor="pm_e">Correo<input id="pm_e" name="email" type="email" /><FieldErrors errors={errs} name="email" /></label>
            <label htmlFor="pm_p">Teléfono<input id="pm_p" name="phone" /></label>
            <div className="full row"><button className="btn" type="submit">Guardar paciente</button><button className="btn ghost" type="button" onClick={() => setShowNew(false)}>Cancelar</button></div>
          </form>
        </div>
      )}
      {error ? <ErrorBox error={error} onRetry={reload} /> : loading && !data ? <Loading /> : !data?.length ? <Empty>No hay pacientes{q ? ' con esa búsqueda' : '. Sincronice el software clínico'}.</Empty> : (
        <div className="tablewrap"><table>
          <thead><tr><th>Paciente</th><th>RUT</th><th>Correo</th><th>Teléfono</th><th>Origen</th></tr></thead>
          <tbody>{data.map((p) => (
            <tr key={p.id}><td style={{ fontWeight: 600 }}>{p.firstName} {p.lastName}</td><td className="num">{p.rut ?? '—'}</td><td>{p.email ?? '—'}</td><td className="num">{p.phone ?? '—'}</td>
              <td><Pill tone={p.source === 'manual' ? 'neu' : p.source === 'mock' ? 'warn' : 'acc'}>{p.source === 'manual' ? 'Manual' : p.source === 'mock' ? 'Prueba' : p.source}</Pill></td></tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  );
}

function Professionals() {
  const { data, error, loading, reload } = useData(() => api<Professional[]>('/integration/professionals'));
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (loading || !data) return <Loading />;
  return (
    <>
      <p className="small muted" style={{ marginBottom: 10 }}>Use esta lista para revisar periódicamente quién tiene acceso a fichas clínicas (Art. 14 quinquies). Los profesionales inactivos no deberían conservar usuario.</p>
      {!data.length ? <Empty>Sin profesionales sincronizados.</Empty> : (
        <div className="tablewrap"><table>
          <thead><tr><th>Profesional</th><th>Especialidad</th><th>Estado</th></tr></thead>
          <tbody>{data.map((p) => <tr key={p.id}><td style={{ fontWeight: 600 }}>{p.name}</td><td>{p.specialty ?? '—'}</td><td><Pill tone={p.active ? 'ok' : 'warn'}>{p.active ? 'Activo' : 'Inactivo · revisar acceso'}</Pill></td></tr>)}</tbody>
        </table></div>
      )}
    </>
  );
}

function Agenda() {
  const [from, setFrom] = useState(plus(-7));
  const [to, setTo] = useState(plus(14));
  const [pro, setPro] = useState('');
  const pros = useData(() => api<Professional[]>('/integration/professionals'));
  const { data, error, loading, reload } = useData(() => api<Appt[]>(`/integration/appointments${qs({ from, to, professional: pro })}`), [from, to, pro]);
  return (
    <>
      <div className="filters">
        <label className="check">Desde <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="check">Hasta <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <select value={pro} onChange={(e) => setPro(e.target.value)} aria-label="Profesional"><option value="">Todos los profesionales</option>{pros.data?.map((p) => <option key={p.id} value={p.externalId}>{p.name}</option>)}</select>
      </div>
      {error ? <ErrorBox error={error} onRetry={reload} /> : loading && !data ? <Loading /> : !data?.length ? <Empty>No hay citas en ese rango.</Empty> : (
        <div className="tablewrap"><table>
          <thead><tr><th>Fecha</th><th>Hora</th><th>Paciente</th><th>Profesional</th><th>Sucursal</th><th>Estado</th></tr></thead>
          <tbody>{data.map((a) => (
            <tr key={a.id}><td className="num">{fmtDate(a.date)}</td><td className="num">{a.time ?? '—'}{a.durationMin ? ` · ${a.durationMin} min` : ''}</td><td>{a.patientName ?? '—'}</td><td>{a.professionalName ?? '—'}</td><td>{a.branchName ?? '—'}</td><td><Pill>{a.status ?? '—'}</Pill></td></tr>
          ))}</tbody>
        </table></div>
      )}
      <p className="small muted mt">La agenda se lee del software clínico; las citas se crean y modifican allí. Esta vista sirve para medir el volumen de tratamiento y responder solicitudes.</p>
    </>
  );
}

const TABS = [['conexion', 'Conexión'], ['pacientes', 'Pacientes'], ['profesionales', 'Profesionales'], ['agenda', 'Agenda']] as const;

export default function ClinicSoftware() {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('conexion');
  return (
    <>
      <PageHead eyebrow="Integración" title="Software clínico"
        lede="Conexión con Dentalink o Medilink. Las credenciales viven solo en el servidor; el navegador nunca se comunica directamente con el proveedor." />
      <div className="tabs" role="tablist">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'conexion' && <Connection />}
      {tab === 'pacientes' && <Patients />}
      {tab === 'profesionales' && <Professionals />}
      {tab === 'agenda' && <Agenda />}
    </>
  );
}
