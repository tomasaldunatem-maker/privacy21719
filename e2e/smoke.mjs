import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = (process.env.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const PASS = process.env.DEMO_PASSWORD || 'Demo21719-clinica';
const RID = `p${Date.now().toString(36)}`;
const TAG = `(prueba ${RID})`;
let failures = 0;
const out = new URL('./shots', import.meta.url).pathname;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
const page = await ctx.newPage();
const problems = [];
page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 400) problems.push(`${r.status()} ${r.request().method()} ${r.url()}`); });
const step = async (name, fn) => {
  try { await fn(); console.log('OK  ', name); }
  catch (e) { failures++; console.log('FAIL', name, e.message.split('\n')[0]); await page.screenshot({ path: `${out}/fail-${name.replace(/\W+/g, '_')}.png` }); }
};
const toastHas = async (re) => { await page.locator('.toast', { hasText: re }).waitFor({ timeout: 8000 }); };

await step('login', async () => {
  await page.goto(BASE);
  await page.fill('#email', 'admin@demo.example');
  await page.fill('#password', PASS);
  await page.click('button[type=submit]');
  await page.waitForSelector('text=Estado de cumplimiento');
  await page.screenshot({ path: `${out}/01-dashboard.png`, fullPage: true });
});

await step('diagnostic answer + recommendation + plan', async () => {
  await page.click('nav >> text=Diagnóstico');
  await page.waitForSelector('text=Lo más importante por hacer');
  const q = page.locator('.q').nth(6);
  const current = (await q.locator('button[aria-pressed=true]').getAttribute('class').catch(() => '')) || '';
  const target = current.includes('no') ? 'parcial' : 'no';
  await q.locator(`button.${target}`).click();
  await q.locator(`.rec.${target}`).waitFor();
  const orig = ['si', 'parcial', 'no'].find((x) => current.split(' ').includes(x));
  if (orig) { await q.locator(`button.${orig}`).click(); await q.locator(`.rec.${orig}`).waitFor(); }
  await page.screenshot({ path: `${out}/02-diagnostic.png`, fullPage: false });
  await page.click('text=Generar plan de acción');
  await page.waitForSelector('text=Obligación → riesgo');
});

await step('task create + evidence upload', async () => {
  await page.click('text=Nueva tarea');
  await page.fill('#t_ob', 'Art. 14 quinquies');
  await page.fill('#t_co', `Bloqueo automático de pantalla ${TAG}`);
  await page.click('button:has-text("Guardar tarea")');
  await page.waitForSelector(`text=${TAG}`);
  const acta = new URL('./acta.txt', import.meta.url).pathname; fs.writeFileSync(acta, 'Acta de prueba (ficticia)');
  const row = page.locator('tr', { hasText: TAG });
  await row.locator('input[type=file]').setInputFiles(acta);
  await row.locator('a:has-text("acta.txt")').waitFor();
  await page.fill('input[type=search]', RID);
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 1);
  await page.screenshot({ path: `${out}/03-tasks.png` });
});

await step('processing + copilot', async () => {
  await page.click('nav >> text=Inventario de datos');
  await page.click('text=Nuevo tratamiento');
  await page.fill('#n_no', `Control de asistencia con huella digital ${TAG}`);
  await page.fill('#n_fi', 'Registrar asistencia del personal');
  await page.waitForSelector('.copilot >> text=16 ter');
  await page.screenshot({ path: `${out}/04-copilot.png` });
  await page.click('text=Guardar en el inventario');
  await page.waitForSelector(`td >> text=${TAG}`);
  await page.selectOption('select[aria-label=Riesgo]', 'ALTO');
  await page.waitForTimeout(500);
});

let reqUrl;
await step('request create + detail + link + clinical data', async () => {
  await page.click('nav >> text=Solicitudes de pacientes');
  await page.click('text=Registrar solicitud');
  await page.fill('#r_ti', 'Valentina Díaz Prueba');
  await page.fill('#r_ru', '55.555.555-5');
  await page.selectOption('#r_tp', 'ACCESO');
  await page.fill('#r_de', 'Pide copia de su ficha (prueba)');
  await page.click('text=Registrar y calcular plazo');
  await page.waitForSelector('text=Paciente en el software clínico');
  reqUrl = page.url();
  await page.click('label:has-text("Identidad del solicitante verificada") input');
  await page.waitForSelector('text=Identidad verificada >> nth=0');
  await page.locator('.li', { hasText: 'Valentina' }).locator('button:has-text("Vincular")').click();
  await page.waitForSelector('button:has-text("Desvincular")');
  await page.click('text=Obtener datos desde el software clínico');
  await page.waitForSelector('text=Descargar JSON');
  await page.screenshot({ path: `${out}/05-request-detail.png`, fullPage: true });
  // cerrar sin resumen debe fallar con mensaje
  await page.selectOption('#rq_status', 'RESPONDIDA');
  await toastHas(/resumen/i);
  await page.fill('#rq_sum', 'Se envió copia de ficha y citas por correo (prueba).');
  await page.click('text=Guardar respuesta');
  await toastHas(/Respuesta guardada/);
  await page.selectOption('#rq_status', 'RESPONDIDA');
  await page.waitForSelector('.head >> text=Respondida');
});

await step('incident create + steps', async () => {
  await page.click('nav >> text=Incidentes');
  await page.click('text=Reportar incidente');
  await page.fill('#i_ti', `Notebook de recepción extraviado ${TAG}`);
  await page.click('text=Abrir expediente');
  const card = page.locator('.panel', { hasText: TAG });
  await card.waitFor();
  for (const i of [0, 1, 2, 3, 4]) { await card.locator('input[type=checkbox]').nth(i).check(); await page.waitForTimeout(250); }
  await card.locator('text=Cerrar expediente').click();
  await page.waitForSelector(`.panel:has-text("${TAG}") >> text=Cerrado`);
});

await step('vendor create + contract change', async () => {
  await page.click('nav >> text=Proveedores');
  await page.click('text=Agregar proveedor');
  await page.fill('#p_no', `Laboratorio ${TAG}`);
  await page.check('input[name=sensitive]');
  await page.click('text=Guardar proveedor');
  const row = page.locator('tr', { hasText: `Laboratorio ${TAG}` });
  await row.waitFor();
  await row.locator('select[aria-label=Contrato]').selectOption('FIRMADO');
  await page.waitForTimeout(600);
  await row.locator('text=Medio').or(row.locator('text=Bajo')).first().waitFor();
});

await step('documents save + approve', async () => {
  await page.click('nav >> text=Documentos');
  await page.click('.doclist >> text=Política de privacidad para pacientes');
  await page.waitForFunction(() => (document.querySelector('textarea.doc')?.value ?? '').includes('Clínica Dental Demo'));
  await page.click('text=Guardar versión');
  await page.click('button:has-text("Aprobar")');
  await page.waitForSelector('text=/Aprobado \\d/');
  await page.screenshot({ path: `${out}/06-documents.png` });
});

await step('clinic software sync + tabs', async () => {
  await page.click('nav >> text=Software clínico');
  await page.click('text=Sincronizar ahora');
  await toastHas(/Sincronizado/);
  await page.click('role=tab[name=Pacientes]');
  await page.fill('input[type=search]', 'silva');
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 1);
  await page.click('role=tab[name=Agenda]');
  await page.waitForSelector('tbody tr');
  await page.screenshot({ path: `${out}/07-agenda.png` });
  await page.click('role=tab[name=Conexión]');
  await page.selectOption('#ic_p', 'dentalink');
  await page.fill('#ic_t', 'token-de-prueba-falso-1234');
  await page.click('text=Guardar configuración');
  await page.waitForSelector('text=Guardadas cifradas');
  await page.click('text=Probar conexión');
  await page.waitForSelector('.alert.bad, .alert.ok');
  console.log('     test result:', await page.locator('.alert.bad, .alert.ok').last().textContent());
  await page.screenshot({ path: `${out}/08-connection.png` });
  await page.selectOption('#ic_p', 'mock');
  await page.click('text=Guardar configuración');
  await page.waitForSelector('text=No configuradas');
});

await step('users create', async () => {
  await page.click('nav >> text=Usuarios');
  await page.click('text=Nuevo usuario');
  await page.fill('#u_n', `Dentista ${TAG}`);
  await page.fill('#u_e', `dentista${Date.now()}@demo.example`);
  await page.click('text=Crear usuario');
  await page.waitForSelector('.secret');
  // Se desactiva para no dejar cuentas de prueba activas
  await page.locator('tr', { hasText: `Dentista ${TAG}` }).locator('text=Desactivar').click();
  await toastHas(/desactivado/);
});

await step('audit', async () => {
  await page.click('nav >> text=Auditoría');
  await page.waitForSelector('tbody tr');
});

await step('public form', async () => {
  const p2 = await ctx.newPage();
  await p2.goto(`${BASE}/p/demo`);
  await p2.fill('#pr_n', 'Isidora Contreras Prueba');
  await p2.fill('#pr_r', '77.777.777-7');
  await p2.fill('#pr_e', 'isidora.contreras@example.com');
  await p2.check('input[name=consent]');
  await p2.click('text=Enviar solicitud');
  await p2.waitForSelector('text=Recibimos su solicitud');
  await p2.screenshot({ path: `${out}/09-public.png` });
  await p2.close();
});

await step('viewer role restrictions', async () => {
  const c2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await c2.newPage();
  await p.goto(BASE);
  await p.fill('#email', 'auditor@demo.example');
  await p.fill('#password', PASS);
  await p.click('button[type=submit]');
  await p.waitForSelector('text=Estado de cumplimiento');
  await p.screenshot({ path: `${out}/10-mobile-dashboard.png`, fullPage: true });
  const r = await p.evaluate(async () => (await fetch('/api/vendors', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'privacy21719' }, body: JSON.stringify({ name: 'x' }) })).status);
  if (r !== 403) throw new Error('viewer could write: ' + r);
  await p.click('text=Menú');
  await p.click('nav >> text=Software clínico');
  await p.click('role=tab[name=Pacientes]');
  await p.waitForSelector('tbody tr');
  const rut = await p.locator('tbody tr td').nth(1).textContent();
  if (!rut.includes('••')) throw new Error('rut not masked for viewer: ' + rut);
  await p.screenshot({ path: `${out}/11-mobile-patients.png` });
  await c2.close();
});

console.log(`\n${failures ? 'FALLAS: ' + failures : 'TODO OK'}`);
console.log('\nProblems:', problems.filter((p) => !p.includes('/clinical') && !p.includes('PATCH') && !p.includes('/integration/test')).length ? problems : 'none (expected 4xx only)');
console.log(problems.join('\n'));
await browser.close();
process.exit(failures ? 1 : 0);
