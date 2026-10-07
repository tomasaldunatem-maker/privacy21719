/**
 * Copiloto de cumplimiento basado en reglas. Señala obligaciones que activa un tratamiento de datos.
 * Las referencias a artículos son orientativas y deben ser validadas por un abogado.
 */
export interface ActivityInput {
  name?: string; purpose?: string | null; dataCategories?: string | null; system?: string | null;
  processors?: string | null; legalBasis?: string | null; retention?: string | null; sensitive?: boolean;
}
export interface Finding { article: string; message: string; requiresDpia?: boolean; severity: 'alta' | 'media' }

export function analyze(t: ActivityInput): Finding[] {
  const txt = [t.name, t.purpose, t.dataCategories, t.system, t.processors].filter(Boolean).join(' ').toLowerCase();
  const base = (t.legalBasis ?? '').toLowerCase().trim();
  const out: Finding[] = [];
  if (/huella|biom[eé]tr|facial|reconocimiento/.test(txt))
    out.push({ article: 'Art. 16 ter', severity: 'alta', requiresDpia: true, message: 'Hay datos biométricos. Se debe informar sistema, finalidad y plazo, y realizar una evaluación de impacto.' });
  if (/foto|instagram|facebook|tiktok|redes|marketing|publicidad|campa/.test(txt))
    out.push({ article: 'Art. 12 · 16', severity: 'alta', message: 'Uso de imágenes de pacientes con fines de difusión: requiere consentimiento expreso, específico y revocable.' });
  if (/menor|niñ|odontopediatr|ortodoncia/.test(txt))
    out.push({ article: 'Art. 16 quáter', severity: 'alta', message: 'Puede incluir datos de niños, niñas y adolescentes. Aplicar resguardos reforzados y autorización de padres o tutores.' });
  if (/\bia\b|inteligencia artificial|autom[aá]tic|algoritmo|chatbot/.test(txt))
    out.push({ article: 'Art. 8 bis · 15 ter', severity: 'alta', requiresDpia: true, message: 'Posibles decisiones automatizadas. Evaluar impacto y asegurar intervención humana.' });
  if (/nube|cloud|google|microsoft|whatsapp|extranjero|ee\.?uu|aws/.test(txt))
    out.push({ article: 'Título V', severity: 'media', message: 'Verificar dónde se alojan los datos. Si salen de Chile, documentar la garantía de transferencia internacional.' });
  if (t.sensitive)
    out.push({ article: 'Art. 16 · 16 bis', severity: 'media', message: 'Datos de salud: son datos sensibles. Confirmar la base de licitud y limitar el acceso por rol.' });
  if (t.sensitive && (!base || base === 'sin definir'))
    out.push({ article: 'Art. 12–13', severity: 'alta', message: 'No hay base de licitud definida para un tratamiento con datos sensibles. Prioridad alta.' });
  if (t.processors && !/^\s*(ninguno|no|-)?\s*$/i.test(t.processors))
    out.push({ article: 'Art. 15 bis', severity: 'media', message: 'Hay terceros que tratan los datos. Verificar contrato de encargo con instrucciones y medidas de seguridad.' });
  if (!t.retention || /sin definir/i.test(t.retention))
    out.push({ article: 'Art. 3', severity: 'media', message: 'Falta definir el plazo de conservación.' });
  return out;
}

/** Riesgo y estado de evaluación de impacto sugeridos a partir de los hallazgos. */
export function suggestRisk(t: ActivityInput) {
  const f = analyze(t);
  const dpia = f.some((x) => x.requiresDpia);
  const high = f.filter((x) => x.severity === 'alta').length;
  const risk: 'ALTO' | 'MEDIO' | 'BAJO' = t.sensitive || high > 0 ? 'ALTO' : f.length > 2 ? 'MEDIO' : 'BAJO';
  return { findings: f, risk, dpiaStatus: dpia ? ('PENDIENTE' as const) : ('NO_REQUERIDA' as const) };
}
