import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth, usePerms } from './lib/auth';
import { api } from './lib/api';
import { Loading } from './components/ui';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Dashboard from './pages/Dashboard';
import Diagnostic from './pages/Diagnostic';
import Tasks from './pages/Tasks';
import Processing from './pages/Processing';
import Requests from './pages/Requests';
import RequestDetail from './pages/RequestDetail';
import Incidents from './pages/Incidents';
import Vendors from './pages/Vendors';
import Documents from './pages/Documents';
import ClinicSoftware from './pages/ClinicSoftware';
import Users from './pages/Users';
import AuditLog from './pages/AuditLog';
import Settings from './pages/Settings';
import PublicRequest from './pages/PublicRequest';

interface Counts { requests: number; requestsAlert: boolean; incidents: number; tasks: number; critical: number }

function Layout() {
  const { me, logout } = useAuth();
  const perms = usePerms();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    setOpen(false);
    api<{ requests: { open: number; overdue: number; dueSoon: number }; incidents: { open: number }; tasks: { open: number }; compliance: { criticalGaps: number } }>('/dashboard')
      .then((d) => setCounts({ requests: d.requests.open, requestsAlert: d.requests.overdue + d.requests.dueSoon > 0, incidents: d.incidents.open, tasks: d.tasks.open, critical: d.compliance.criticalGaps }))
      .catch(() => {});
  }, [loc.pathname]);

  const item = (to: string, label: string, n?: number, alert?: boolean) => (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
      <span>{label}</span>{!!n && <span className={`count ${alert ? 'alert' : ''}`}>{n}</span>}
    </NavLink>
  );

  return (
    <div className="app">
      <aside className={`rail ${open ? 'open' : ''}`}>
        <div className="rail-top">
          <div className="brand"><b>PRIVACY 21719</b><span>Vertical Dental</span></div>
          <button className="btn ghost sm menu-toggle" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.2)' }} onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Cerrar' : 'Menú'}</button>
        </div>
        <nav className="nav" aria-label="Módulos">
          {item('/', 'Panel')}
          {item('/diagnostico', 'Diagnóstico', counts?.critical, !!counts?.critical)}
          {item('/plan', 'Plan de acción', counts?.tasks)}
          {item('/inventario', 'Inventario de datos')}
          {item('/solicitudes', 'Solicitudes de pacientes', counts?.requests, counts?.requestsAlert)}
          {item('/incidentes', 'Incidentes', counts?.incidents, !!counts?.incidents)}
          {item('/proveedores', 'Proveedores')}
          {item('/documentos', 'Documentos')}
          <div className="nav-sep">Clínica</div>
          {item('/software-clinico', 'Software clínico')}
          {perms.canManage && item('/usuarios', 'Usuarios')}
          {perms.canManage && item('/auditoria', 'Auditoría')}
          {item('/ajustes', 'Datos de la clínica')}
        </nav>
        <div className="rail-foot">
          <div><b>{me?.organization.name}</b></div>
          <div>{me?.user.name}<br />{me && <span style={{ opacity: .8 }}>{({ ADMIN: 'Administrador', DPO: 'Responsable de privacidad', STAFF: 'Recepción / equipo', VIEWER: 'Solo lectura' })[me.user.role]}</span>}</div>
          <button type="button" onClick={logout}>Cerrar sesión</button>
        </div>
      </aside>
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/diagnostico" element={<Diagnostic />} />
          <Route path="/plan" element={<Tasks />} />
          <Route path="/inventario" element={<Processing />} />
          <Route path="/solicitudes" element={<Requests />} />
          <Route path="/solicitudes/:id" element={<RequestDetail />} />
          <Route path="/incidentes" element={<Incidents />} />
          <Route path="/proveedores" element={<Vendors />} />
          <Route path="/documentos" element={<Documents />} />
          <Route path="/software-clinico" element={<ClinicSoftware />} />
          <Route path="/usuarios" element={<Users />} />
          <Route path="/auditoria" element={<AuditLog />} />
          <Route path="/ajustes" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const { me, loading } = useAuth();
  const loc = useLocation();
  if (loc.pathname.startsWith('/p/')) return <Routes><Route path="/p/:slug" element={<PublicRequest />} /></Routes>;
  if (loading) return <Loading />;
  if (!me) return <Login />;
  if (me.user.mustChangePassword) return <ChangePassword forced />;
  return <Layout />;
}
