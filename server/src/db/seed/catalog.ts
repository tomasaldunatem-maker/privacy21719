import { sql } from 'drizzle-orm';
import { db, pool, schema } from '../index.js';
import { QUESTIONS, TEMPLATES } from './catalog-data.js';

/** Carga o actualiza los catálogos del producto. Es idempotente: se puede ejecutar en producción. */
export async function seedCatalog() {
  for (const [i, q] of QUESTIONS.entries()) {
    await db.insert(schema.diagnosticQuestions).values({ ...q, sortOrder: i + 1 })
      .onConflictDoUpdate({ target: schema.diagnosticQuestions.id, set: { ...q, sortOrder: i + 1 } });
  }
  for (const [i, t] of TEMPLATES.entries()) {
    await db.insert(schema.documentTemplates).values({ ...t, sortOrder: i + 1 })
      .onConflictDoUpdate({ target: schema.documentTemplates.id, set: { title: t.title, reference: t.reference, body: t.body, sortOrder: i + 1, version: sql`case when ${schema.documentTemplates.body} <> excluded.body then ${schema.documentTemplates.version} + 1 else ${schema.documentTemplates.version} end` } });
  }
  console.log(`Catálogo: ${QUESTIONS.length} preguntas, ${TEMPLATES.length} plantillas.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await seedCatalog();
  await pool.end();
}
