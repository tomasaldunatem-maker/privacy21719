/** Reemplaza marcadores {{clave}} con los datos de la clínica. Los marcadores desconocidos quedan visibles. */
export function renderTemplate(body: string, vars: Record<string, string | null | undefined>): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (m, k: string) => {
    const v = vars[k];
    return v && v.trim() ? v : `[${k}]`;
  });
}

export function orgVars(org: { name: string; rut: string | null; address: string | null; privacyEmail: string | null; privacyOfficer: string | null }, today: string) {
  return {
    'clinica.nombre': org.name,
    'clinica.rut': org.rut,
    'clinica.direccion': org.address,
    'clinica.email': org.privacyEmail,
    'clinica.responsable': org.privacyOfficer,
    'fecha': today,
  };
}
