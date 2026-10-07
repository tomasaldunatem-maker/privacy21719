import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { api, errorText, ApiError } from '../lib/api';
import { useData } from '../lib/useData';
import { fmtDate, REQ_TYPE_LABEL } from '../lib/format';
import { ErrorBox, FieldErrors, Loading } from '../components/ui';

const DESC: Record<string, string> = {
  ACCESO: 'Saber qué datos tenemos de usted y obtener una copia.',
  RECTIFICACION: 'Corregir datos inexactos o desactualizados.',
  SUPRESION: 'Eliminar datos que ya no sean necesarios (la ficha clínica debe conservarse por ley).',
  OPOSICION: 'Oponerse a un uso específico, por ejemplo publicidad.',
  PORTABILIDAD: 'Recibir sus datos en un formato para llevarlos a otro prestador.',
  BLOQUEO: 'Suspender temporalmente el uso de sus datos.',
};

/** Formulario para pacientes, sin inicio de sesión. Solo devuelve folio y fecha de respuesta. */
export default function PublicRequest() {
  const { slug } = useParams();
  const clinic = useData(() => api<{ name: string; privacyEmail: string | null }>(`/public/clinics/${slug}`), [slug]);
  const [done, setDone] = useState<{ folio: string; dueAt: string } | null>(null);
  const [errs, setErrs] = useState<Record<string, string[]>>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, unknown>;
    f.consent = f.consent === 'on';
    setBusy(true); setError(null);
    try { setDone(await api(`/public/clinics/${slug}/requests`, { body: f })); }
    catch (err) { if (err instanceof ApiError) setErrs(err.details); setError(errorText(err)); } finally { setBusy(false); }
  }

  return (
    <div className="public-wrap"><div className="public-card">
      {clinic.error ? <ErrorBox error="No encontramos esta clínica. Revise el enlace." /> : clinic.loading || !clinic.data ? <Loading /> : (
        <div className="panel">
          <div className="eyebrow">Solicitud sobre sus datos personales</div>
          <h1>{clinic.data.name}</h1>
          {done ? (
            <div className="mt">
              <div className="alert ok">Recibimos su solicitud.</div>
              <dl className="kv mt"><dt>Folio</dt><dd className="mono">{done.folio}</dd><dt>Respuesta a más tardar</dt><dd>{fmtDate(done.dueAt)}</dd></dl>
              <p className="small mt">Guarde el folio. Le contactaremos al correo indicado; para proteger su información, podemos pedirle verificar su identidad antes de responder.</p>
            </div>
          ) : (
            <>
              <p className="lede">Usted puede pedir acceso, rectificación, supresión, oposición, portabilidad o bloqueo de sus datos personales (Ley 21.719). Responderemos dentro de 30 días corridos.</p>
              <form className="f mt" onSubmit={submit}>
                <label className="full" htmlFor="pr_n">Nombre completo<input id="pr_n" name="requesterName" required autoComplete="name" /><FieldErrors errors={errs} name="requesterName" /></label>
                <label htmlFor="pr_r">RUT<input id="pr_r" name="requesterRut" required placeholder="12.345.678-5" /><FieldErrors errors={errs} name="requesterRut" /></label>
                <label htmlFor="pr_e">Correo<input id="pr_e" name="requesterEmail" type="email" required autoComplete="email" /><FieldErrors errors={errs} name="requesterEmail" /></label>
                <label className="full" htmlFor="pr_t">¿Qué necesita?<select id="pr_t" name="type">{Object.entries(REQ_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}: {DESC[k]}</option>)}</select></label>
                <label className="full" htmlFor="pr_d">Detalle (opcional)<textarea id="pr_d" name="details" placeholder="No incluya información de salud que no sea necesaria." /></label>
                <input type="text" name="website" tabIndex={-1} autoComplete="off" style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true" />
                <label className="check full"><input type="checkbox" name="consent" required /> Acepto que la clínica use estos datos solo para tramitar y responder esta solicitud.</label>
                {error && <div className="alert bad full">{error}</div>}
                <div className="full"><button className="btn" type="submit" disabled={busy}>{busy ? 'Enviando…' : 'Enviar solicitud'}</button></div>
              </form>
              {clinic.data.privacyEmail && <p className="small muted mt">También puede escribir a {clinic.data.privacyEmail}.</p>}
            </>
          )}
        </div>
      )}
    </div></div>
  );
}
