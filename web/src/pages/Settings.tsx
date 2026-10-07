import { useState, type FormEvent } from 'react';
import { api, errorText, ApiError } from '../lib/api';
import { useAuth, usePerms } from '../lib/auth';
import { FieldErrors, PageHead, useToast } from '../components/ui';
import ChangePassword from './ChangePassword';

export default function Settings() {
  const { me, refresh } = useAuth();
  const perms = usePerms();
  const toast = useToast();
  const [errs, setErrs] = useState<Record<string, string[]>>();
  const o = me!.organization;

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try { await api('/organization', { method: 'PATCH', body: Object.fromEntries(new FormData(e.currentTarget)) }); toast('Datos de la clínica guardados'); setErrs(undefined); refresh(); }
    catch (err) { if (err instanceof ApiError) setErrs(err.details); toast(errorText(err), true); }
  }
  return (
    <>
      <PageHead eyebrow="Configuración" title="Datos de la clínica" lede="Estos datos completan automáticamente las políticas, consentimientos y protocolos del módulo Documentos." />
      <div className="grid g2">
        <div className="panel">
          <h2>Clínica</h2>
          <form className="f one" onSubmit={save}>
            <label htmlFor="c_no">Nombre<input id="c_no" name="name" defaultValue={o.name} disabled={!perms.canManage} required /><FieldErrors errors={errs} name="name" /></label>
            <label htmlFor="c_ru">RUT<input id="c_ru" name="rut" defaultValue={o.rut ?? ''} disabled={!perms.canManage} placeholder="76.123.456-7" /><FieldErrors errors={errs} name="rut" /></label>
            <label htmlFor="c_di">Dirección<input id="c_di" name="address" defaultValue={o.address ?? ''} disabled={!perms.canManage} /></label>
            <label htmlFor="c_em">Correo de privacidad<input id="c_em" name="privacyEmail" type="email" defaultValue={o.privacyEmail ?? ''} disabled={!perms.canManage} /><FieldErrors errors={errs} name="privacyEmail" /></label>
            <label htmlFor="c_re">Responsable de privacidad<input id="c_re" name="privacyOfficer" defaultValue={o.privacyOfficer ?? ''} disabled={!perms.canManage} /></label>
            {perms.canManage && <button className="btn" type="submit">Guardar</button>}
          </form>
          <p className="small muted mt">Formulario público para pacientes: <span className="mono">/p/{o.slug}</span></p>
        </div>
        <div className="panel">
          <h2>Mi contraseña</h2>
          <ChangePassword />
        </div>
      </div>
    </>
  );
}
