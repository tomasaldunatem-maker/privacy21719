CREATE TYPE "public"."answer" AS ENUM('si', 'parcial', 'no');--> statement-breakpoint
CREATE TYPE "public"."contract_status" AS ENUM('FIRMADO', 'PENDIENTE', 'SIN_CONTRATO');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('BORRADOR', 'APROBADO');--> statement-breakpoint
CREATE TYPE "public"."dpia_status" AS ENUM('NO_REQUERIDA', 'PENDIENTE', 'EN_CURSO', 'APROBADA');--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('EN_EVALUACION', 'CERRADO');--> statement-breakpoint
CREATE TYPE "public"."outside_chile" AS ENUM('SI', 'NO', 'NO_SE_SABE');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('RECIBIDA', 'VERIFICANDO_IDENTIDAD', 'EN_ANALISIS', 'RESPONDIDA', 'RECHAZADA');--> statement-breakpoint
CREATE TYPE "public"."request_type" AS ENUM('ACCESO', 'RECTIFICACION', 'SUPRESION', 'OPOSICION', 'PORTABILIDAD', 'BLOQUEO');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('ALTO', 'MEDIO', 'BAJO');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('ADMIN', 'DPO', 'STAFF', 'VIEWER');--> statement-breakpoint
CREATE TYPE "public"."record_source" AS ENUM('dentalink', 'medilink', 'mock', 'manual');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('PENDIENTE', 'EN_CURSO', 'COMPLETADA');--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"source" "record_source" NOT NULL,
	"external_id" text NOT NULL,
	"patient_external_id" text,
	"professional_external_id" text,
	"branch_external_id" text,
	"date" date NOT NULL,
	"time" text,
	"duration_min" integer,
	"status" text,
	"synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"user_id" uuid,
	"user_email" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"meta" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"source" "record_source" NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "data_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"folio" text NOT NULL,
	"requester_name" text NOT NULL,
	"requester_rut" text,
	"requester_email" text,
	"type" "request_type" NOT NULL,
	"details" text,
	"channel" text DEFAULT 'Portal web' NOT NULL,
	"received_at" date NOT NULL,
	"due_at" date NOT NULL,
	"extended" boolean DEFAULT false NOT NULL,
	"extension_reason" text,
	"status" "request_status" DEFAULT 'RECIBIDA' NOT NULL,
	"identity_verified" boolean DEFAULT false NOT NULL,
	"patient_id" uuid,
	"response_summary" text,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diagnostic_answers" (
	"organization_id" uuid NOT NULL,
	"question_id" text NOT NULL,
	"answer" "answer" NOT NULL,
	"notes" text,
	"answered_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "diagnostic_answers_organization_id_question_id_pk" PRIMARY KEY("organization_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "diagnostic_questions" (
	"id" text PRIMARY KEY NOT NULL,
	"area" text NOT NULL,
	"text" text NOT NULL,
	"article" text NOT NULL,
	"critical" boolean DEFAULT false NOT NULL,
	"impact" integer DEFAULT 2 NOT NULL,
	"task_control" text NOT NULL,
	"task_risk" text NOT NULL,
	"rec_no" text NOT NULL,
	"rec_partial" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"reference" text NOT NULL,
	"body" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"template_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "document_status" DEFAULT 'BORRADOR' NOT NULL,
	"created_by" uuid,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"original_name" text NOT NULL,
	"stored_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"detected_at" date NOT NULL,
	"type" text NOT NULL,
	"sensitive" boolean DEFAULT true NOT NULL,
	"affected" text,
	"status" "incident_status" DEFAULT 'EN_EVALUACION' NOT NULL,
	"steps" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"agency_notified_at" timestamp with time zone,
	"subjects_notified_at" timestamp with time zone,
	"notes" text,
	"created_by" uuid,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_settings" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'mock' NOT NULL,
	"base_url" text,
	"token_ciphertext" text,
	"token_last4" text,
	"last_sync_at" timestamp with time zone,
	"last_sync_status" text,
	"last_sync_error" text,
	"last_sync_counts" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"rut" text,
	"address" text,
	"privacy_email" text,
	"privacy_officer" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"source" "record_source" NOT NULL,
	"external_id" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text,
	"rut" text,
	"email" text,
	"phone" text,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processing_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"purpose" text,
	"data_categories" text,
	"sensitive" boolean DEFAULT false NOT NULL,
	"legal_basis" text DEFAULT 'Sin definir' NOT NULL,
	"system" text,
	"processors" text,
	"retention" text DEFAULT 'Sin definir' NOT NULL,
	"risk" "risk_level" DEFAULT 'MEDIO' NOT NULL,
	"dpia_status" "dpia_status" DEFAULT 'NO_REQUERIDA' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professionals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"source" "record_source" NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"specialty" text,
	"active" boolean DEFAULT true NOT NULL,
	"synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "request_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"obligation" text NOT NULL,
	"risk" text,
	"control" text NOT NULL,
	"owner" text NOT NULL,
	"due_date" date NOT NULL,
	"status" "task_status" DEFAULT 'PENDIENTE' NOT NULL,
	"source_question_id" text,
	"created_by" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" DEFAULT 'STAFF' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"failed_logins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"service" text,
	"sensitive" boolean DEFAULT false NOT NULL,
	"contract_status" "contract_status" DEFAULT 'SIN_CONTRATO' NOT NULL,
	"outside_chile" "outside_chile" DEFAULT 'NO_SE_SABE' NOT NULL,
	"last_review" date,
	"risk" "risk_level" DEFAULT 'MEDIO' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_answers" ADD CONSTRAINT "diagnostic_answers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_answers" ADD CONSTRAINT "diagnostic_answers_question_id_diagnostic_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."diagnostic_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_answers" ADD CONSTRAINT "diagnostic_answers_answered_by_users_id_fk" FOREIGN KEY ("answered_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_template_id_document_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."document_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_settings" ADD CONSTRAINT "integration_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD CONSTRAINT "processing_activities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professionals" ADD CONSTRAINT "professionals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_events" ADD CONSTRAINT "request_events_request_id_data_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."data_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_events" ADD CONSTRAINT "request_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_source_question_id_diagnostic_questions_id_fk" FOREIGN KEY ("source_question_id") REFERENCES "public"."diagnostic_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "appointments_org_src_ext_uq" ON "appointments" USING btree ("organization_id","source","external_id");--> statement-breakpoint
CREATE INDEX "appointments_org_date_idx" ON "appointments" USING btree ("organization_id","date");--> statement-breakpoint
CREATE INDEX "audit_org_created_idx" ON "audit_logs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "branches_org_src_ext_uq" ON "branches" USING btree ("organization_id","source","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "requests_org_folio_uq" ON "data_requests" USING btree ("organization_id","folio");--> statement-breakpoint
CREATE INDEX "requests_org_idx" ON "data_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "documents_org_tpl_idx" ON "documents" USING btree ("organization_id","template_id");--> statement-breakpoint
CREATE INDEX "evidence_task_idx" ON "evidence" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "incidents_org_idx" ON "incidents" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "patients_org_src_ext_uq" ON "patients" USING btree ("organization_id","source","external_id");--> statement-breakpoint
CREATE INDEX "patients_org_rut_idx" ON "patients" USING btree ("organization_id","rut");--> statement-breakpoint
CREATE INDEX "processing_org_idx" ON "processing_activities" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "professionals_org_src_ext_uq" ON "professionals" USING btree ("organization_id","source","external_id");--> statement-breakpoint
CREATE INDEX "request_events_req_idx" ON "request_events" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tasks_org_idx" ON "tasks" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "users_org_idx" ON "users" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "vendors_org_idx" ON "vendors" USING btree ("organization_id");