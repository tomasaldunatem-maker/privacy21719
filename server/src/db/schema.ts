import {
  customType,
  pgTable, pgEnum, uuid, text, boolean, integer, timestamp, date, jsonb, bigserial,
  primaryKey, uniqueIndex, index,
} from 'drizzle-orm/pg-core';

/** Archivos de evidencia guardados en la base de datos (persisten y se respaldan con ella). */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });

/* ───────────── Enums ───────────── */
export const roleEnum = pgEnum('role', ['ADMIN', 'DPO', 'STAFF', 'VIEWER']);
export const answerEnum = pgEnum('answer', ['si', 'parcial', 'no']);
export const taskStatusEnum = pgEnum('task_status', ['PENDIENTE', 'EN_CURSO', 'COMPLETADA']);
export const riskEnum = pgEnum('risk_level', ['ALTO', 'MEDIO', 'BAJO']);
export const dpiaEnum = pgEnum('dpia_status', ['NO_REQUERIDA', 'PENDIENTE', 'EN_CURSO', 'APROBADA']);
export const requestTypeEnum = pgEnum('request_type', ['ACCESO', 'RECTIFICACION', 'SUPRESION', 'OPOSICION', 'PORTABILIDAD', 'BLOQUEO']);
export const requestStatusEnum = pgEnum('request_status', ['RECIBIDA', 'VERIFICANDO_IDENTIDAD', 'EN_ANALISIS', 'RESPONDIDA', 'RECHAZADA']);
export const incidentStatusEnum = pgEnum('incident_status', ['EN_EVALUACION', 'CERRADO']);
export const contractEnum = pgEnum('contract_status', ['FIRMADO', 'PENDIENTE', 'SIN_CONTRATO']);
export const outsideEnum = pgEnum('outside_chile', ['SI', 'NO', 'NO_SE_SABE']);
export const docStatusEnum = pgEnum('document_status', ['BORRADOR', 'APROBADO']);
export const sourceEnum = pgEnum('record_source', ['dentalink', 'medilink', 'mock', 'manual']);

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const created = () => ts('created_at').notNull().defaultNow();
const updated = () => ts('updated_at').notNull().defaultNow();
const orgRef = () => uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' });

/* ───────────── Organización y usuarios ───────────── */
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(), // identificador público para el formulario de pacientes
  rut: text('rut'),
  address: text('address'),
  privacyEmail: text('privacy_email'),
  privacyOfficer: text('privacy_officer'),
  createdAt: created(),
  updatedAt: updated(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: orgRef(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').notNull().default('STAFF'),
  active: boolean('active').notNull().default(true),
  failedLogins: integer('failed_logins').notNull().default(0),
  lockedUntil: ts('locked_until'),
  lastLoginAt: ts('last_login_at'),
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index('users_org_idx').on(t.organizationId)]);

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(), // SHA-256 del token; el token en claro solo vive en la cookie
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: ts('expires_at').notNull(),
  ip: text('ip'),
  userAgent: text('user_agent'),
  createdAt: created(),
}, (t) => [index('sessions_user_idx').on(t.userId)]);

/* ───────────── Catálogos globales (contenido del producto, no datos de la clínica) ───────────── */
export const diagnosticQuestions = pgTable('diagnostic_questions', {
  id: text('id').primaryKey(),
  area: text('area').notNull(),
  text: text('text').notNull(),
  article: text('article').notNull(),
  critical: boolean('critical').notNull().default(false),
  impact: integer('impact').notNull().default(2), // 1 = mayor impacto
  taskControl: text('task_control').notNull(),
  taskRisk: text('task_risk').notNull(),
  recNo: text('rec_no').notNull(),
  recPartial: text('rec_partial').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
});

export const documentTemplates = pgTable('document_templates', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  reference: text('reference').notNull(),
  body: text('body').notNull(), // con marcadores {{clinica.nombre}}, etc.
  version: integer('version').notNull().default(1),
  sortOrder: integer('sort_order').notNull().default(0),
});

/* ───────────── Programa de cumplimiento de cada clínica ───────────── */
export const diagnosticAnswers = pgTable('diagnostic_answers', {
  organizationId: orgRef(),
  questionId: text('question_id').notNull().references(() => diagnosticQuestions.id),
  answer: answerEnum('answer').notNull(),
  notes: text('notes'),
  answeredBy: uuid('answered_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: updated(),
}, (t) => [primaryKey({ columns: [t.organizationId, t.questionId] })]);

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: orgRef(),
  obligation: text('obligation').notNull(),
  risk: text('risk'),
  control: text('control').notNull(),
  owner: text('owner').notNull(),
  dueDate: date('due_date', { mode: 'string' }).notNull(),
  status: taskStatusEnum('status').notNull().default('PENDIENTE'),
  sourceQuestionId: text('source_question_id').references(() => diagnosticQuestions.id),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  completedAt: ts('completed_at'),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index('tasks_org_idx').on(t.organizationId)]);

export const evidence = pgTable('evidence', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: orgRef(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  originalName: text('original_name').notNull(),
  storedName: text('stored_name').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  sha256: text('sha256').notNull(),
  content: bytea('content'),
  uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: created(),
}, (t) => [index('evidence_task_idx').on(t.taskId)]);

export const processingActivities = pgTable('processing_activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: orgRef(),
  name: text('name').notNull(),
  purpose: text('purpose'),
  dataCategories: text('data_categories'),
  sensitive: boolean('sensitive').notNull().default(false),
  legalBasis: text('legal_basis').notNull().default('Sin definir'),
  system: text('system'),
  processors: text('processors'),
  retention: text('retention').notNull().default('Sin definir'),
  risk: riskEnum('risk').notNull().default('MEDIO'),
  dpiaStatus: dpiaEnum('dpia_status').notNull().default('NO_REQUERIDA'),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index('processing_org_idx').on(t.organizationId)]);

export const dataRequests = pgTable('data_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: orgRef(),
  folio: text('folio').notNull(),
  requesterName: text('requester_name').notNull(),
  requesterRut: text('requester_rut'),
  requesterEmail: text('requester_email'),
  type: requestTypeEnum('type').notNull(),
  details: text('details'),
  channel: text('channel').notNull().default('Portal web'),
  receivedAt: date('received_at', { mode: 'string' }).notNull(),
  dueAt: date('due_at', { mode: 'string' }).notNull(),
  extended: boolean('extended').notNull().default(false),
  extensionReason: text('extension_reason'),
  status: requestStatusEnum('status').notNull().default('RECIBIDA'),
  identityVerified: boolean('identity_verified').notNull().default(false),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'set null' }),
  responseSummary: text('response_summary'),
  closedAt: ts('closed_at'),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [uniqueIndex('requests_org_folio_uq').on(t.organizationId, t.folio), index('requests_org_idx').on(t.organizationId)]);

export const requestEvents = pgTable('request_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  requestId: uuid('request_id').notNull().references(() => dataRequests.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  note: text('note'),
  createdAt: created(),
}, (t) => [index('request_events_req_idx').on(t.requestId)]);

export const incidents = pgTable('incidents', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: orgRef(),
  title: text('title').notNull(),
  detectedAt: date('detected_at', { mode: 'string' }).notNull(),
  type: text('type').notNull(),
  sensitive: boolean('sensitive').notNull().default(true),
  affected: text('affected'),
  status: incidentStatusEnum('status').notNull().default('EN_EVALUACION'),
  steps: jsonb('steps').$type<Record<string, boolean>>().notNull().default({}),
  agencyNotifiedAt: ts('agency_notified_at'),
  subjectsNotifiedAt: ts('subjects_notified_at'),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  closedAt: ts('closed_at'),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index('incidents_org_idx').on(t.organizationId)]);

export const vendors = pgTable('vendors', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: orgRef(),
  name: text('name').notNull(),
  service: text('service'),
  sensitive: boolean('sensitive').notNull().default(false),
  contractStatus: contractEnum('contract_status').notNull().default('SIN_CONTRATO'),
  outsideChile: outsideEnum('outside_chile').notNull().default('NO_SE_SABE'),
  lastReview: date('last_review', { mode: 'string' }),
  risk: riskEnum('risk').notNull().default('MEDIO'),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index('vendors_org_idx').on(t.organizationId)]);

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: orgRef(),
  templateId: text('template_id').notNull().references(() => documentTemplates.id),
  title: text('title').notNull(),
  body: text('body').notNull(),
  version: integer('version').notNull().default(1),
  status: docStatusEnum('status').notNull().default('BORRADOR'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
  approvedAt: ts('approved_at'),
  createdAt: created(),
}, (t) => [index('documents_org_tpl_idx').on(t.organizationId, t.templateId)]);

/* Registro de auditoría: solo inserción. Un trigger en la base de datos impide UPDATE y DELETE. */
export const auditLogs = pgTable('audit_logs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  userId: uuid('user_id'),
  userEmail: text('user_email'),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id'),
  meta: jsonb('meta').$type<Record<string, unknown>>(),
  ip: text('ip'),
  createdAt: created(),
}, (t) => [index('audit_org_created_idx').on(t.organizationId, t.createdAt)]);

/* ───────────── Software clínico (espejo mínimo, sin datos clínicos) ───────────── */
export const integrationSettings = pgTable('integration_settings', {
  organizationId: uuid('organization_id').primaryKey().references(() => organizations.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull().default('mock'), // mock | dentalink | medilink
  baseUrl: text('base_url'),
  tokenCiphertext: text('token_ciphertext'), // AES-256-GCM, nunca se devuelve al frontend
  tokenLast4: text('token_last4'),
  lastSyncAt: ts('last_sync_at'),
  lastSyncStatus: text('last_sync_status'),
  lastSyncError: text('last_sync_error'),
  lastSyncCounts: jsonb('last_sync_counts').$type<Record<string, number>>(),
  updatedAt: updated(),
});

export const patients = pgTable('patients', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: orgRef(),
  source: sourceEnum('source').notNull(),
  externalId: text('external_id').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name'),
  rut: text('rut'),
  email: text('email'),
  phone: text('phone'),
  syncedAt: ts('synced_at'),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [uniqueIndex('patients_org_src_ext_uq').on(t.organizationId, t.source, t.externalId), index('patients_org_rut_idx').on(t.organizationId, t.rut)]);

export const professionals = pgTable('professionals', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: orgRef(),
  source: sourceEnum('source').notNull(),
  externalId: text('external_id').notNull(),
  name: text('name').notNull(),
  specialty: text('specialty'),
  active: boolean('active').notNull().default(true),
  syncedAt: ts('synced_at'),
}, (t) => [uniqueIndex('professionals_org_src_ext_uq').on(t.organizationId, t.source, t.externalId)]);

export const branches = pgTable('branches', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: orgRef(),
  source: sourceEnum('source').notNull(),
  externalId: text('external_id').notNull(),
  name: text('name').notNull(),
  address: text('address'),
  syncedAt: ts('synced_at'),
}, (t) => [uniqueIndex('branches_org_src_ext_uq').on(t.organizationId, t.source, t.externalId)]);

export const appointments = pgTable('appointments', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: orgRef(),
  source: sourceEnum('source').notNull(),
  externalId: text('external_id').notNull(),
  patientExternalId: text('patient_external_id'),
  professionalExternalId: text('professional_external_id'),
  branchExternalId: text('branch_external_id'),
  date: date('date', { mode: 'string' }).notNull(),
  time: text('time'),
  durationMin: integer('duration_min'),
  status: text('status'),
  syncedAt: ts('synced_at'),
}, (t) => [uniqueIndex('appointments_org_src_ext_uq').on(t.organizationId, t.source, t.externalId), index('appointments_org_date_idx').on(t.organizationId, t.date)]);
