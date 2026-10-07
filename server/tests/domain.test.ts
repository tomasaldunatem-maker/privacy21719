import { describe, expect, it } from 'vitest';
import { addDaysISO, daysBetween, requestDueDate } from '../src/lib/dates.js';
import { isValidRut, formatRut } from '../src/lib/rut.js';
import { priorities, riskLevel, score, type Question } from '../src/domain/diagnostic.js';
import { analyze, suggestRisk } from '../src/domain/copilot.js';
import { renderTemplate } from '../src/domain/templates.js';
import { vendorRisk } from '../src/domain/vendors.js';

describe('plazos (art. 11)', () => {
  it('30 días corridos, cruzando meses', () => {
    expect(requestDueDate('2026-11-15')).toBe('2026-12-15');
    expect(requestDueDate('2026-01-31')).toBe('2026-03-02');
  });
  it('prórroga suma otros 30', () => expect(requestDueDate('2026-11-15', true)).toBe('2027-01-14'));
  it('diferencia de días', () => {
    expect(daysBetween('2026-10-07', '2026-12-01')).toBe(55);
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('RUT', () => {
  it('valida dígito verificador', () => {
    expect(isValidRut('11.111.111-1')).toBe(true);
    expect(isValidRut('11.111.111-2')).toBe(false);
    expect(isValidRut('12.345.678-5')).toBe(true);
    expect(isValidRut('abc')).toBe(false);
  });
  it('formatea', () => expect(formatRut('123456785')).toBe('12.345.678-5'));
});

const q = (id: string, critical: boolean, impact: number): Question => ({ id, area: 'A', text: 't', article: 'Art', critical, impact, taskControl: `c-${id}`, taskRisk: 'r', recNo: `no-${id}`, recPartial: `par-${id}` });

describe('diagnóstico', () => {
  const qs = [q('a', false, 3), q('b', true, 1), q('c', false, 1), q('d', true, 1)];
  it('puntaje con parciales', () => expect(score(qs, { a: 'si', b: 'parcial', c: 'no', d: 'si' })).toBe(63));
  it('prioriza críticas, luego No sobre Parcial, luego impacto', () => {
    const p = priorities(qs, { a: 'no', b: 'parcial', c: 'no', d: 'no' });
    expect(p.map((x) => x.questionId)).toEqual(['d', 'b', 'c', 'a']);
    expect(p[1].recommendation).toBe('par-b');
  });
  it('nivel de riesgo', () => {
    expect(riskLevel(90, 0)).toBe('BAJO');
    expect(riskLevel(90, 1)).toBe('MEDIO');
    expect(riskLevel(40, 0)).toBe('ALTO');
  });
});

describe('copiloto', () => {
  it('biometría exige evaluación de impacto', () => {
    const s = suggestRisk({ name: 'Control de asistencia con huella digital', retention: '1 año' });
    expect(s.findings.some((f) => f.article === 'Art. 16 ter')).toBe(true);
    expect(s.dpiaStatus).toBe('PENDIENTE');
    expect(s.risk).toBe('ALTO');
  });
  it('sensible sin base de licitud', () => {
    expect(analyze({ name: 'Ficha', sensitive: true, legalBasis: 'Sin definir' }).some((f) => f.article === 'Art. 12–13')).toBe(true);
  });
  it('tratamiento simple tiene riesgo bajo', () => {
    expect(suggestRisk({ name: 'Libro de reclamos', retention: '2 años', processors: 'Ninguno' }).risk).toBe('BAJO');
  });
});

describe('plantillas y proveedores', () => {
  it('marca datos faltantes', () => expect(renderTemplate('{{clinica.nombre}} {{clinica.rut}}', { 'clinica.nombre': 'X', 'clinica.rut': '' })).toBe('X [clinica.rut]'));
  it('riesgo de proveedor', () => {
    expect(vendorRisk({ sensitive: true, contractStatus: 'SIN_CONTRATO', outsideChile: 'NO' })).toBe('ALTO');
    expect(vendorRisk({ sensitive: true, contractStatus: 'FIRMADO', outsideChile: 'SI' })).toBe('MEDIO');
    expect(vendorRisk({ sensitive: false, contractStatus: 'FIRMADO', outsideChile: 'NO' })).toBe('BAJO');
  });
});
