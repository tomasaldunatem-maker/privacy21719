/**
 * DATOS DE DEMOSTRACIÓN (ficticios). Crea una clínica de ejemplo con usuarios y registros para probar.
 * No se ejecuta en producción salvo con --force. No contiene datos reales de pacientes.
 */
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, pool, schema } from '../index.js';
import { seedCatalog } from './catalog.js';
import { addDaysISO, requestDueDate, todayISO } from '../../lib/dates.js';
import { syncOrganization } from '../../modules/integration-sync.js';
import { orgVars, renderTemplate } from '../../domain/templates.js';

export const DEMO_SLUG = 'demo';
// En ambientes publicados la contraseña viene de DEMO_PASSWORD; la fija solo se usa en local
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo21719-clinica';
export const DEMO_USERS = [
  { email: 'admin@demo.example', name: 'Andrea Pérez (demo)', role: 'ADMIN' as const },
  { email: 'privacidad@demo.example', name: 'Carlos Núñez (demo)', role: 'DPO' as const },
  { email: 'recepcion@demo.example', name: 'Daniela Torres (demo)', role: 'STAFF' as const },
  { email: 'auditor@demo.example', name: 'Auditor externo (demo)', role: 'VIEWER' as const },
];

export async function seedDemo() {
  const ifMissing = process.argv.includes('--if-missing');
  const allowed = process.env.NODE_ENV !== 'production' || process.argv.includes('--force') || (ifMissing && process.env.SEED_DEMO === 'true');
  if (!allowed) throw new Error('El seed de demostración no se ejecuta en producción (use --force si está seguro).');
  if (process.env.NODE_ENV === 'production' && (!process.env.DEMO_PASSWORD || process.env.DEMO_PASSWORD.length < 12)) {
    throw new Error('En producción defina DEMO_PASSWORD (mínimo 12 caracteres) para los usuarios de demostración.');
  }
  await seedCatalog();
  const existing = await db.select().from(schema.organizations).where(eq(schema.organizations.slug, DEMO_SLUG));
  if (existing.length && ifMissing) {
    console.log('La clínica de demostración ya existe; no se modifica.');
    return;
  }
  if (existing.length) {
    await db.delete(schema.organizations).where(eq(schema.organizations.id, existing[0].id)).catch(async () => {
      // audit_logs es de solo inserción: si existen registros, se renombra la clínica antigua en vez de borrarla
      await db.update(schema.organizations).set({ slug: `demo-old-${Date.now()}`, name: 'Demo antigua (archivada)' }).where(eq(schema.organizations.id, existing[0].id));
      for (const u of DEMO_USERS) await db.delete(schema.users).where(eq(schema.users.email, u.email));
    });
  }
  const today = todayISO();
  const [org] = await db.insert(schema.organizations).values({
    name: 'Clínica Dental Demo (ficticia)', slug: DEMO_SLUG, rut: '76.111.111-6', address: 'Av. Ejemplo 1234, Providencia, Santiago',
    privacyEmail: 'privacidad@demo.example', privacyOfficer: 'Carlos Núñez (demo)',
  }).returning();
  const hash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const users = await db.insert(schema.users).values(DEMO_USERS.map((u) => ({ ...u, organizationId: org.id, passwordHash: hash }))).returning();
  const admin = users[0];
  const O = org.id;

  const answers: Record<string, 'si' | 'parcial' | 'no'> = { q1: 'parcial', q2: 'si', q3: 'parcial', q4: 'no', q5: 'no', q6: 'si', q7: 'no', q8: 'parcial', q9: 'no', q10: 'parcial', q11: 'no', q12: 'parcial', q13: 'no', q14: 'si', q15: 'si', q16: 'parcial' };
  await db.insert(schema.diagnosticAnswers).values(Object.entries(answers).map(([questionId, answer]) => ({ organizationId: O, questionId, answer, answeredBy: admin.id })));

  await db.insert(schema.processingActivities).values([
    { name: 'Ficha clínica odontológica', purpose: 'Atención, diagnóstico y continuidad del tratamiento', dataCategories: 'Identificación, RUT, anamnesis, odontograma, diagnósticos, plan de tratamiento', sensitive: true, legalBasis: 'Prestación de salud (Ley 20.584)', system: 'Software clínico en la nube', processors: 'Proveedor de software clínico', retention: '15 años desde la última atención', risk: 'ALTO', dpiaStatus: 'EN_CURSO' },
    { name: 'Imágenes radiológicas', purpose: 'Diagnóstico (periapicales, panorámicas, CBCT)', dataCategories: 'Imágenes, identificación del paciente', sensitive: true, legalBasis: 'Prestación de salud (Ley 20.584)', system: 'Equipo de rayos + servidor local', processors: 'Centro radiológico externo', retention: '15 años (forma parte de la ficha)', risk: 'ALTO', dpiaStatus: 'PENDIENTE' },
    { name: 'Agenda y recordatorios', purpose: 'Gestión de citas y confirmaciones', dataCategories: 'Nombre, teléfono, correo, motivo de consulta', sensitive: true, legalBasis: 'Ejecución del servicio solicitado', system: 'Agenda online + WhatsApp Business', processors: 'Proveedor de mensajería', retention: '2 años', risk: 'MEDIO', dpiaStatus: 'NO_REQUERIDA' },
    { name: 'Presupuestos, pagos y bonos', purpose: 'Cobro, boletas y bonos Fonasa/Isapre', dataCategories: 'RUT, previsión, prestaciones, montos', sensitive: true, legalBasis: 'Obligación legal', system: 'Software contable y plataforma de bonos', processors: 'Contador externo', retention: '6 años (tributario)', risk: 'MEDIO', dpiaStatus: 'NO_REQUERIDA' },
    { name: 'Órdenes al laboratorio dental', purpose: 'Fabricación de prótesis, coronas y alineadores', dataCategories: 'Nombre, escaneo intraoral, color, indicaciones', sensitive: true, legalBasis: 'Prestación de salud (Ley 20.584)', system: 'Correo y escáner intraoral', processors: 'Laboratorio dental', retention: 'Mientras dure el tratamiento', risk: 'MEDIO', dpiaStatus: 'NO_REQUERIDA' },
    { name: 'Fotos clínicas en redes sociales', purpose: 'Difusión de casos antes/después', dataCategories: 'Fotografías de rostro y sonrisa', sensitive: true, legalBasis: 'Sin definir', system: 'Instagram y Facebook', processors: 'Agencia de marketing', retention: 'Sin definir', risk: 'ALTO', dpiaStatus: 'PENDIENTE' },
    { name: 'Cámaras de recepción', purpose: 'Seguridad de personas e instalaciones', dataCategories: 'Imagen de pacientes y personal', sensitive: false, legalBasis: 'Interés legítimo', system: 'Grabador local (DVR)', processors: 'Empresa de seguridad', retention: '30 días', risk: 'MEDIO', dpiaStatus: 'NO_REQUERIDA' },
    { name: 'Personal clínico y administrativo', purpose: 'Gestión laboral y remuneraciones', dataCategories: 'Datos de contrato, previsión, registro profesional', sensitive: false, legalBasis: 'Obligación legal', system: 'Planilla de RR.HH.', processors: 'Contador externo', retention: 'Según legislación laboral', risk: 'MEDIO', dpiaStatus: 'NO_REQUERIDA' },
    { name: 'Formulario de contacto web', purpose: 'Responder consultas de potenciales pacientes', dataCategories: 'Nombre, correo, teléfono, mensaje', sensitive: false, legalBasis: 'Consentimiento', system: 'Sitio web', processors: 'Empresa de hosting', retention: '1 año', risk: 'BAJO', dpiaStatus: 'NO_REQUERIDA' },
  ].map((x) => ({ ...x, organizationId: O, risk: x.risk as 'ALTO' | 'MEDIO' | 'BAJO', dpiaStatus: x.dpiaStatus as 'NO_REQUERIDA' | 'PENDIENTE' | 'EN_CURSO' })));

  type V = typeof schema.vendors.$inferInsert;
  const vendors: Omit<V, 'organizationId'>[] = [
    { name: 'Software clínico (ficha y agenda)', service: 'Ficha clínica, agenda, odontograma', sensitive: true, contractStatus: 'FIRMADO', outsideChile: 'SI', lastReview: addDaysISO(today, -80), risk: 'MEDIO' },
    { name: 'Laboratorio dental', service: 'Prótesis y coronas', sensitive: true, contractStatus: 'SIN_CONTRATO', outsideChile: 'NO', risk: 'ALTO' },
    { name: 'Centro radiológico', service: 'Radiografías panorámicas y CBCT', sensitive: true, contractStatus: 'PENDIENTE', outsideChile: 'NO', lastReview: addDaysISO(today, -150), risk: 'ALTO' },
    { name: 'Proveedor de mensajería', service: 'Recordatorios por WhatsApp y SMS', sensitive: true, contractStatus: 'SIN_CONTRATO', outsideChile: 'SI', risk: 'ALTO' },
    { name: 'Agencia de marketing', service: 'Redes sociales y campañas', sensitive: true, contractStatus: 'SIN_CONTRATO', outsideChile: 'NO', risk: 'ALTO' },
    { name: 'Contador externo', service: 'Contabilidad y remuneraciones', sensitive: false, contractStatus: 'FIRMADO', outsideChile: 'NO', lastReview: addDaysISO(today, -200), risk: 'BAJO' },
    { name: 'Empresa de seguridad', service: 'Cámaras de recepción', sensitive: false, contractStatus: 'PENDIENTE', outsideChile: 'NO', risk: 'MEDIO' },
    { name: 'Hosting del sitio web', service: 'Sitio y formulario de contacto', sensitive: false, contractStatus: 'FIRMADO', outsideChile: 'SI', lastReview: addDaysISO(today, -260), risk: 'BAJO' },
  ];
  await db.insert(schema.vendors).values(vendors.map((v) => ({ ...v, organizationId: O })));

  // Sincroniza el espejo del software clínico con el proveedor de prueba
  await syncOrganization(O);
  const pats = await db.select().from(schema.patients).where(eq(schema.patients.organizationId, O));
  const byRut = (r: string) => pats.find((p) => p.rut === r)?.id ?? null;

  const reqs = [
    { folio: `SOL-${today.slice(0, 4)}-0001`, requesterName: 'Camila Muñoz Prueba', requesterRut: '11.111.111-1', requesterEmail: 'camila.munoz@example.com', type: 'SUPRESION' as const, details: 'Pide retirar sus fotos antes/después publicadas en Instagram', channel: 'Correo', receivedAt: addDaysISO(today, -26), status: 'EN_ANALISIS' as const, identityVerified: true, patientId: byRut('11.111.111-1') },
    { folio: `SOL-${today.slice(0, 4)}-0002`, requesterName: 'Martín Fuentes Prueba', requesterRut: '22.222.222-2', requesterEmail: 'martin.fuentes@example.com', type: 'ACCESO' as const, details: 'Solicita copia de su ficha clínica y radiografías', channel: 'Portal web', receivedAt: addDaysISO(today, -14), status: 'VERIFICANDO_IDENTIDAD' as const, identityVerified: false, patientId: null },
    { folio: `SOL-${today.slice(0, 4)}-0003`, requesterName: 'Josefa Rojas Prueba', requesterRut: '33.333.333-3', requesterEmail: null, type: 'RECTIFICACION' as const, details: 'Teléfono y correo desactualizados', channel: 'Presencial en recepción', receivedAt: addDaysISO(today, -6), status: 'RECIBIDA' as const, identityVerified: false, patientId: null },
    { folio: `SOL-${today.slice(0, 4)}-0004`, requesterName: 'Pedro Soto Prueba', requesterRut: '44.444.444-4', requesterEmail: 'pedro.soto@example.com', type: 'PORTABILIDAD' as const, details: 'Traspaso de radiografías a otra clínica', channel: 'Correo', receivedAt: addDaysISO(today, -45), status: 'RESPONDIDA' as const, identityVerified: true, patientId: byRut('44.444.444-4'), responseSummary: 'Se enviaron radiografías en formato DICOM y ficha en PDF por correo cifrado.', closedAt: new Date() },
  ];
  for (const r of reqs) {
    const [row] = await db.insert(schema.dataRequests).values({ ...r, organizationId: O, dueAt: requestDueDate(r.receivedAt) }).returning();
    await db.insert(schema.requestEvents).values({ requestId: row.id, action: 'Recibida', note: `Canal: ${r.channel}` });
  }

  await db.insert(schema.incidents).values([
    { organizationId: O, title: 'Correo de phishing con acceso al software clínico', detectedAt: addDaysISO(today, -4), type: 'Acceso no autorizado', sensitive: true, affected: 'Por determinar', steps: { contener: true, evaluar: false, agencia: false, titulares: false, registro: false }, createdBy: admin.id },
    { organizationId: O, title: 'Presupuesto enviado a correo equivocado', detectedAt: addDaysISO(today, -54), type: 'Divulgación accidental', sensitive: true, affected: '1', status: 'CERRADO', closedAt: new Date(), steps: { contener: true, evaluar: true, agencia: true, titulares: true, registro: true }, agencyNotifiedAt: new Date(), subjectsNotifiedAt: new Date(), createdBy: admin.id },
  ]);

  await db.insert(schema.tasks).values([
    { obligation: 'Art. 12 · Art. 16', risk: 'Fotos clínicas sin consentimiento', control: 'Implementar formulario de consentimiento expreso para fotos clínicas', owner: 'Carlos Núñez (demo)', dueDate: addDaysISO(today, 13), status: 'EN_CURSO' as const, sourceQuestionId: 'q4' },
    { obligation: 'Art. 14 sexies', risk: 'Notificación tardía de vulneraciones', control: 'Aprobar protocolo de respuesta a incidentes y designar responsables', owner: 'Administración', dueDate: addDaysISO(today, 24), status: 'PENDIENTE' as const, sourceQuestionId: 'q9' },
    { obligation: 'Art. 15 bis', risk: 'Laboratorio sin contrato', control: 'Firmar anexo de encargo con el laboratorio dental', owner: 'Administración', dueDate: addDaysISO(today, 34), status: 'PENDIENTE' as const },
    { obligation: 'Art. 14 quinquies', risk: 'Robo de credenciales', control: 'Activar MFA en software clínico y correo institucional', owner: 'Soporte TI', dueDate: addDaysISO(today, -2), status: 'EN_CURSO' as const, sourceQuestionId: 'q7' },
    { obligation: 'Art. 14 bis', risk: 'Filtración por error humano', control: 'Capacitar al equipo y registrar asistencia como evidencia', owner: 'Carlos Núñez (demo)', dueDate: addDaysISO(today, -7), status: 'COMPLETADA' as const, completedAt: new Date(), sourceQuestionId: 'q14' },
    { obligation: 'Art. 4–11', risk: 'Solicitudes sin respuesta', control: 'Publicar canal de solicitudes de pacientes', owner: 'Recepción', dueDate: addDaysISO(today, 25), status: 'PENDIENTE' as const },
  ].map((t) => ({ ...t, organizationId: O, createdBy: admin.id })));

  const [tpl] = await db.select().from(schema.documentTemplates).where(eq(schema.documentTemplates.id, 'aviso'));
  await db.insert(schema.documents).values({ organizationId: O, templateId: tpl.id, title: tpl.title, body: renderTemplate(tpl.body, orgVars(org, today)), version: 1, status: 'APROBADO', createdBy: admin.id, approvedBy: admin.id, approvedAt: new Date() });

  console.log('\nClínica de demostración creada (datos ficticios).');
  console.log(`Formulario público para pacientes: /p/${DEMO_SLUG}`);
  console.log(process.env.NODE_ENV === 'production' ? 'Contraseña de los usuarios demo: la definida en DEMO_PASSWORD' : `Contraseña de todos los usuarios demo: ${DEMO_PASSWORD}`);
  for (const u of DEMO_USERS) console.log(`  ${u.role.padEnd(6)} ${u.email}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { await seedDemo(); } catch (e) { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; }
  await pool.end();
}
