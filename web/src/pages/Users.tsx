import { useState, type FormEvent } from 'react';
import { api, errorText, ApiError } from '../lib/api';
import { useData } from '../lib/useData';
import { useAuth, usePerms } from '../lib/auth';
import { ROLE_LABEL, fmtDateTime } from '../lib/format';
import { ConfirmButton, ErrorBox, FieldErrors, Loading, PageHead, Pill, useToast } from '../components/ui';

interface U { id: string; email: string; name: string; role: string; active: boolean; lastLoginAt: string | null; mustChangePassword: boolean }

export default function Users() {
  const perms = usePerms();
  const { me } = useAuth();
  const toast = useToast();
  const { data, error, loading, reload } = useData(() => api<U[]>('/users'));
  const [showNew, setShowNew] = useState(false);
  const [errs, setErrs] = useState<Record<string, string[]>>();
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      const r = await api<{ user: U; temporaryPassword: string }>('/users', { body: Object.fromEntries(new FormData(e.currentTarget)) });
      setSecret({ email: r.user.email, password: r.temporaryPassword }); setShowNew(false); setErrs(undefined); reload();
    } catch (err) { if (err instanceof ApiError) setErrs(err.details); toast(errorText(err), true); }
  }
  async function update(u: U, body: Partial<U>, msg: string) {
    try { await api(`/users/${u.id}`, { method: 'PATCH', body }); toast(msg); reload(); } catch (err) { toast(errorText(err), true); }
  }
  async function reset(u: U) {
    try { const r = await api<{ temporaryPassword: string }>(`/users/${u.id}/reset-password`, { method: 'POST' }); setSecret({ email: u.email, password: r.temporaryPassword }); reload(); } catch (err) { toast(errorText(err), true); }
  }

  return (
    <>
      <PageHead eyebrow="Gestión de usuarios" title="Usuarios de la clínica"
        lede="Cada persona tiene su propio usuario. Los permisos dependen del rol: Administrador (todo), Responsable de privacidad (programa de cumplimiento), Recepción (registrar solicitudes e incidentes) y Solo lectura."
        right={perms.isAdmin && <button className="btn" onClick={() => setShowNew(!showNew)}>Nuevo usuario</button>} />
      {secret && (
        <div className="alert ok" style={{ marginBottom: 16 }}>
          Contraseña temporal para <b>{secret.email}</b>. Entréguela por un canal seguro; se pedirá cambiarla en el primer ingreso. No se volverá a mostrar.
          <div className="secret mt-s">{secret.password}</div>
          <button className="linkbtn mt-s" onClick={() => setSecret(null)}>Ocultar</button>
        </div>
      )}
      {showNew && (
        <div className="dlg"><h2>Nuevo usuario</h2>
          <form className="f" onSubmit={create}>
            <label htmlFor="u_n">Nombre<input id="u_n" name="name" required /><FieldErrors errors={errs} name="name" /></label>
            <label htmlFor="u_e">Correo<input id="u_e" name="email" type="email" required /><FieldErrors errors={errs} name="email" /></label>
            <label htmlFor="u_r">Rol<select id="u_r" name="role" defaultValue="STAFF">{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <div className="full row"><button className="btn" type="submit">Crear usuario</button><button className="btn ghost" type="button" onClick={() => setShowNew(false)}>Cancelar</button></div>
          </form>
        </div>
      )}
      {error ? <ErrorBox error={error} onRetry={reload} /> : loading || !data ? <Loading /> : (
        <div className="tablewrap"><table>
          <thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Último ingreso</th><th></th></tr></thead>
          <tbody>{data.map((u) => (
            <tr key={u.id}>
              <td><div style={{ fontWeight: 600 }}>{u.name}{u.id === me?.user.id && ' (usted)'}</div><div className="sub">{u.email}</div></td>
              <td>{perms.isAdmin ? <select value={u.role} onChange={(e) => update(u, { role: e.target.value }, 'Rol actualizado')} aria-label="Rol">{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select> : ROLE_LABEL[u.role]}</td>
              <td><Pill tone={u.active ? 'ok' : 'neu'}>{u.active ? 'Activo' : 'Desactivado'}</Pill>{u.mustChangePassword && <div className="sub">Contraseña temporal</div>}</td>
              <td className="num">{fmtDateTime(u.lastLoginAt)}</td>
              <td>{perms.isAdmin && u.id !== me?.user.id && <div className="row">
                <button className="linkbtn" onClick={() => update(u, { active: !u.active }, u.active ? 'Usuario desactivado' : 'Usuario activado')}>{u.active ? 'Desactivar' : 'Activar'}</button>
                <ConfirmButton className="linkbtn" onConfirm={() => reset(u)} confirmText="¿Restablecer?">Restablecer contraseña</ConfirmButton>
              </div>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  );
}
