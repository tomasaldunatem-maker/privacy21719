import { useState, type FormEvent } from 'react';
import { api, errorText } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function Login() {
  const { refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api('/auth/login', { body: { email, password } });
      await refresh();
    } catch (err) { setError(errorText(err)); } finally { setBusy(false); }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand"><b>PRIVACY 21719</b><span>Cumplimiento Ley 21.719 · clínicas dentales</span></div>
        <form className="f one mt" onSubmit={submit}>
          <label htmlFor="email">Correo<input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label htmlFor="password">Contraseña<input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          {error && <div className="alert bad">{error}</div>}
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
        </form>
        <p className="small muted mt">Si olvidó su contraseña, pida al administrador de su clínica que la restablezca.</p>
      </div>
    </div>
  );
}
