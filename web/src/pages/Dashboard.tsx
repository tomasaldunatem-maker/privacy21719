import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useData } from '../lib/useData';
import { useAuth } from '../lib/auth';
import { RISK_LABEL, REQ_TYPE_LABEL, deadlineText, deadlineTone, fmtDate, fmtDateTime } from '../lib/format';
import { Disclaimer, ErrorBox, Loading, PageHead, Pill } from '../components/ui';
import { Priorities, type Priority } from './Diagnostic';

interface Dash {
  daysToLaw: number;
  compliance: { score: number; answered: number; totalQuestions: number; riskLevel: string; criticalGaps: number };
  priorities: Priority[];
  processing: { total: number; sensitive: number; dpiaPending: number };
  vendors: { total: number; withoutContract: number };
  requests: { open: number; overdue: number; dueSoon: number; upcoming: { id: string; folio: string; type: string; requesterName: string; details: string | null; dueAt: string; daysLeft: number }[] };
  incidents: { open: number };
  tasks: { total: number; open: number; overdue: number; withEvidence: number; upcoming: { id: string; control: string; obligation: string; owner: string; dueDate: string; daysLeft: number }[] };
  clinicSoftware: { provider: string; label: string; isMock: boolean; patients: number; professionals: number; appointmentsNext7: number; lastSyncAt: string | null; lastSyncStatus: string | null };
}

export default function Dashboard() {
  const { me } = useAuth();
  const { data: d, error, loading, reload } = useData(() => api<Dash>('/dashboard'));
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (loading || !d) return <Loading />;
  const c = d.compliance;
  return (
    <>
      <PageHead eyebrow={`Panel de gobierno · ${me?.organization.name}`} title="Estado de cumplimiento"
        lede={`Indicadores calculados desde los registros de la clínica. ${c.answered} de ${c.totalQuestions} preguntas del diagnóstico respondidas.`}
        right={<span className="countdown">{d.daysToLaw > 0 ? `Faltan ${d.daysToLaw} días para el 1 dic 2026` : 'Ley 21.719 en vigencia'}</span>} />
      <div className="grid g4">
        <div className="panel stat"><div className="k">Avance interno</div><div className="v">{c.score}%</div><div className="bar"><i style={{ width: `${c.score}%` }} /></div></div>
        <div className="panel stat"><div className="k">Nivel de riesgo</div><div className="v">{RISK_LABEL[c.riskLevel]}</div><div className="s">{c.criticalGaps} brechas críticas abiertas</div></div>
        <div className="panel stat"><div className="k">Tratamientos identificados</div><div className="v">{d.processing.total}</div><div className="s">{d.processing.sensitive} con datos sensibles</div></div>
        <div className="panel stat"><div className="k">Proveedores con acceso</div><div className="v">{d.vendors.total}</div><div className="s">{d.vendors.withoutContract} sin contrato firmado</div></div>
      </div>
      <div className="grid g-main mt">
        <div className="panel">
          <div className="spread"><h2>Solicitudes de pacientes con plazo</h2><Link className="btn ghost sm" to="/solicitudes">Ver todas</Link></div>
          {d.requests.overdue > 0 && <div className="alert bad" style={{ marginBottom: 8 }}>{d.requests.overdue} solicitud(es) vencida(s). Responda cuanto antes.</div>}
          <div className="list">
            {d.requests.upcoming.length ? d.requests.upcoming.map((r) => (
              <Link key={r.id} to={`/solicitudes/${r.id}`} className="li" style={{ color: 'inherit', textDecoration: 'none' }}>
                <div><div className="t">{REQ_TYPE_LABEL[r.type]} · {r.requesterName}</div><div className="m">{r.folio}{r.details ? ` · ${r.details}` : ''}</div></div>
                <div style={{ textAlign: 'right' }}><Pill tone={deadlineTone(r.daysLeft)}>{deadlineText(r.daysLeft)}</Pill><div className="m">vence {fmtDate(r.dueAt)}</div></div>
              </Link>
            )) : <p className="muted">Sin solicitudes abiertas.</p>}
          </div>
          <div className="spread mt"><h2>Próximas tareas</h2><Link className="btn ghost sm" to="/plan">Plan de acción</Link></div>
          <div className="list">
            {d.tasks.upcoming.length ? d.tasks.upcoming.map((t) => (
              <div className="li" key={t.id}>
                <div><div className="t">{t.control}</div><div className="m"><span className="art">{t.obligation}</span> · {t.owner}</div></div>
                <Pill tone={t.daysLeft < 0 ? 'bad' : t.daysLeft <= 7 ? 'warn' : 'neu'}>{t.daysLeft < 0 ? 'Atrasada' : fmtDate(t.dueDate)}</Pill>
              </div>
            )) : <p className="muted">No hay tareas abiertas.</p>}
          </div>
        </div>
        <div className="grid" style={{ alignContent: 'start' }}>
          <Priorities items={d.priorities} total={c.criticalGaps} compact />
          <div className="panel">
            <h2>Actividad abierta</h2>
            <dl className="kv">
              <dt>Incidentes abiertos</dt><dd><Pill tone={d.incidents.open ? 'bad' : 'ok'}>{d.incidents.open}</Pill></dd>
              <dt>Evaluaciones de impacto pendientes</dt><dd>{d.processing.dpiaPending}</dd>
              <dt>Tareas abiertas</dt><dd>{d.tasks.open}{d.tasks.overdue ? <> · <Pill tone="bad">{d.tasks.overdue} atrasadas</Pill></> : null}</dd>
              <dt>Tareas con evidencia</dt><dd>{d.tasks.withEvidence} de {d.tasks.total}</dd>
            </dl>
          </div>
          <div className="panel">
            <div className="spread"><h2>Software clínico</h2>{d.clinicSoftware.isMock ? <Pill tone="warn">Datos de prueba</Pill> : <Pill tone="acc">{d.clinicSoftware.label}</Pill>}</div>
            <dl className="kv">
              <dt>Pacientes sincronizados</dt><dd>{d.clinicSoftware.patients}</dd>
              <dt>Profesionales activos</dt><dd>{d.clinicSoftware.professionals}</dd>
              <dt>Citas próximos 7 días</dt><dd>{d.clinicSoftware.appointmentsNext7}</dd>
              <dt>Última sincronización</dt><dd>{fmtDateTime(d.clinicSoftware.lastSyncAt)}{d.clinicSoftware.lastSyncStatus === 'ERROR' && <> <Pill tone="bad">Error</Pill></>}</dd>
            </dl>
            <Link className="linkbtn mt" style={{ display: 'inline-block' }} to="/software-clinico">Ver conexión</Link>
          </div>
          <div className="panel">
            <h2>Exposición a sanciones</h2>
            <p className="small muted">Multas de la Ley 21.719 según gravedad (montos por validar con asesoría legal):</p>
            <dl className="kv mt-s"><dt>Leves</dt><dd className="num">hasta 5.000 UTM</dd><dt>Graves</dt><dd className="num">hasta 10.000 UTM</dd><dt>Gravísimas</dt><dd className="num">hasta 20.000 UTM</dd></dl>
          </div>
        </div>
      </div>
      <Disclaimer />
    </>
  );
}
