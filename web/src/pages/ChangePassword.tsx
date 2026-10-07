import { useState, type FormEvent } from 'react';
import { api, errorText } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/ui';

export default function ChangePassword({ forced = false, onDone }: { forced?: boolean; onDone?: () => void }) {
  const { refresh, logout } = useAuth();
  const toast = useToast();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [rep, setRep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (next !== rep) return setError('Las contraseñas nuevas no coinciden');
    setBusy(true); setError(null);
    try {
      await api('/auth/change-password', { body: { currentPassword: cur, newPassword: next } });
      toast('Contraseña actualizada');
      setCur(''); setNext(''); setRep('');
      await refresh();
      onDone?.();
    } catch (err) { setError(errorText(err)); } finally { setBusy(false); }
  }

  const form = (
    <form className="f one" onSubmit={submit}>
      <label htmlFor="cp_cur">Contraseña actual{forced && ' (temporal)'}<input id="cp_cur" type="password" autoComplete="current-password" required value={cur} onChange={(e) => setCur(e.target.value)} /></label>
      <label htmlFor="cp_new">Nueva contraseña<input id="cp_new" type="password" autoComplete="new-password" required minLength={10} value={next} onChange={(e) => setNext(e.target.value)} /></label>
      <label htmlFor="cp_rep">Repita la nueva contraseña<input id="cp_rep" type="password" autoComplete="new-password" required value={rep} onChange={(e) => setRep(e.target.value)} /></label>
      <p className="small muted">Mínimo 10 caracteres, con letras y números.</p>
      {error && <div className="alert bad">{error}</div>}
      <div className="row"><button className="btn" type="submit" disabled={busy}>Guardar contraseña</button>{forced && <button type="button" className="btn ghost" onClick={logout}>Salir</button>}</div>
    </form>
  );

  if (!forced) return form;
  return (
    <div className="auth-wrap"><div className="auth-card">
      <div className="brand"><b>PRIVACY 21719</b><span>Primer ingreso</span></div>
      <p className="mt small">Por seguridad, reemplace la contraseña temporal antes de continuar.</p>
      <div className="mt">{form}</div>
    </div></div>
  );
}
