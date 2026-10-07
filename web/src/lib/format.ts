export const fmtDate = (s?: string | null) => {
  if (!s) return '—';
  const d = s.length === 10 ? new Date(`${s}T12:00:00`) : new Date(s);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
};
export const fmtDateTime = (s?: string | null) => (s ? new Date(s).toLocaleString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
export const todayLocal = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
export const daysUntil = (iso: string) => {
  const t = todayLocal();
  const u = (x: string) => { const [y, m, d] = x.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((u(iso) - u(t)) / 86_400_000);
};
export const bytes = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);

export const ROLE_LABEL: Record<string, string> = { ADMIN: 'Administrador', DPO: 'Responsable de privacidad', STAFF: 'Recepción / equipo', VIEWER: 'Solo lectura' };
export const RISK_LABEL: Record<string, string> = { ALTO: 'Alto', MEDIO: 'Medio', BAJO: 'Bajo' };
export const DPIA_LABEL: Record<string, string> = { NO_REQUERIDA: 'No requerida', PENDIENTE: 'Pendiente', EN_CURSO: 'En curso', APROBADA: 'Aprobada' };
export const TASK_LABEL: Record<string, string> = { PENDIENTE: 'Pendiente', EN_CURSO: 'En curso', COMPLETADA: 'Completada' };
export const REQ_TYPE_LABEL: Record<string, string> = { ACCESO: 'Acceso', RECTIFICACION: 'Rectificación', SUPRESION: 'Supresión', OPOSICION: 'Oposición', PORTABILIDAD: 'Portabilidad', BLOQUEO: 'Bloqueo' };
export const REQ_STATUS_LABEL: Record<string, string> = { RECIBIDA: 'Recibida', VERIFICANDO_IDENTIDAD: 'Verificando identidad', EN_ANALISIS: 'En análisis', RESPONDIDA: 'Respondida', RECHAZADA: 'Rechazada' };
export const CONTRACT_LABEL: Record<string, string> = { FIRMADO: 'Firmado', PENDIENTE: 'Pendiente', SIN_CONTRATO: 'Sin contrato' };
export const OUTSIDE_LABEL: Record<string, string> = { SI: 'Sí', NO: 'No', NO_SE_SABE: 'No se sabe' };
export const riskTone = (r: string) => (r === 'ALTO' ? 'bad' : r === 'MEDIO' ? 'warn' : 'ok');
export const deadlineTone = (d: number) => (d <= 5 ? 'bad' : d <= 10 ? 'warn' : 'ok');
export const deadlineText = (d: number) => (d < 0 ? `Vencida hace ${-d} d` : d === 0 ? 'Vence hoy' : `${d} días`);
