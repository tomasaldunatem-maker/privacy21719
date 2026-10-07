import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, errorText, qs } from '../lib/api';
import { useData } from '../lib/useData';
import { usePerms } from '../lib/auth';
import { fmtDateTime } from '../lib/format';
import { Disclaimer, ErrorBox, Loading, PageHead, Pill, useToast } from '../components/ui';

interface Tpl { id: string; title: string; reference: string; latest: { version: number; status: string } | null }
interface Doc { id: string; templateId: string; title: string; body: string; version: number; status: string; createdAt: string; approvedAt: string | null }

export default function Documents() {
  const perms = usePerms();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tpls = useData(() => api<Tpl[]>('/documents/templates'));
  const sel = params.get('t') ?? tpls.data?.[0]?.id ?? null;
  const versions = useData(() => (sel ? api<Doc[]>(`/documents${qs({ templateId: sel })}`) : Promise.resolve([])), [sel]);
  const [viewing, setViewing] = useState<string | 'draft'>('draft');
  const [draft, setDraft] = useState<string>('');
  const [busy, setBusy] = useState(false);

  // Al cambiar de plantilla se genera un borrador nuevo con los datos actuales de la clínica
  useEffect(() => {
    if (!sel) return;
    setViewing('draft');
    api<{ body: string }>(`/documents/templates/${sel}/preview`).then((p) => setDraft(p.body)).catch((e) => toast(errorText(e), true));
  }, [sel, toast]);

  const tpl = tpls.data?.find((t) => t.id === sel);
  const doc = viewing !== 'draft' ? versions.data?.find((d) => d.id === viewing) : null;

  async function save() {
    setBusy(true);
    try {
      const d = await api<Doc>('/documents', { body: { templateId: sel, body: draft } });
      toast(`Versión ${d.version} guardada como borrador`); await versions.reload(); await tpls.reload(); setViewing(d.id);
    } catch (e) { toast(errorText(e), true); } finally { setBusy(false); }
  }
  async function approve(d: Doc) {
    setBusy(true);
    try { await api(`/documents/${d.id}/approve`, { method: 'POST' }); toast('Documento aprobado'); await versions.reload(); await tpls.reload(); }
    catch (e) { toast(errorText(e), true); } finally { setBusy(false); }
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); toast('Texto copiado'); } catch { toast('No se pudo copiar; seleccione el texto manualmente', true); }
  }

  if (tpls.error) return <ErrorBox error={tpls.error} onRetry={tpls.reload} />;
  if (tpls.loading && !tpls.data) return <Loading />;
  return (
    <>
      <PageHead eyebrow="Módulo 6 · Generador documental" title="Documentos de cumplimiento"
        lede="Borradores generados con los datos de la clínica (se completan en Datos de la clínica). Puede editarlos, guardar versiones y aprobarlos. Ningún documento debe usarse sin aprobación humana." />
      <div className="grid g-side">
        <div className="panel doclist">
          {tpls.data!.map((t) => (
            <button key={t.id} type="button" aria-pressed={t.id === sel} onClick={() => setParams({ t: t.id })}>
              <div style={{ fontWeight: 600 }}>{t.title}</div>
              <div className="m">{t.reference}</div>
              <div className="mt-s">{t.latest ? <Pill tone={t.latest.status === 'APROBADO' ? 'ok' : 'warn'}>v{t.latest.version} · {t.latest.status === 'APROBADO' ? 'Aprobado' : 'Borrador'}</Pill> : <Pill>Sin guardar</Pill>}</div>
            </button>
          ))}
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="spread" style={{ marginBottom: 10 }}>
            <div className="row">
              <select value={viewing} onChange={(e) => setViewing(e.target.value)} aria-label="Versión">
                <option value="draft">Nuevo borrador (datos actuales)</option>
                {versions.data?.map((d) => <option key={d.id} value={d.id}>Versión {d.version} · {d.status === 'APROBADO' ? 'aprobada' : 'borrador'} · {fmtDateTime(d.createdAt)}</option>)}
              </select>
              {tpl && <span className="art">{tpl.reference}</span>}
            </div>
            <div className="row">
              <button className="btn ghost sm" onClick={() => copy(doc ? doc.body : draft)}>Copiar texto</button>
              {perms.canManage && viewing === 'draft' && <button className="btn sm" disabled={busy || !draft.trim()} onClick={save}>Guardar versión</button>}
              {perms.canManage && doc && doc.status !== 'APROBADO' && <button className="btn sm" disabled={busy} onClick={() => approve(doc)}>Aprobar</button>}
            </div>
          </div>
          {doc ? (
            <>
              <div className="row" style={{ marginBottom: 8 }}>{doc.status === 'APROBADO' ? <Pill tone="ok">Aprobado {fmtDateTime(doc.approvedAt)}</Pill> : <Pill tone="warn">Borrador · requiere aprobación</Pill>}</div>
              <div className="doc">{doc.body}</div>
            </>
          ) : (
            <>
              {/\[clinica\.[a-z]+\]/.test(draft) && <div className="alert warn" style={{ marginBottom: 8 }}>Faltan datos de la clínica (aparecen entre corchetes). Complételos en "Datos de la clínica".</div>}
              <textarea className="doc" value={draft} onChange={(e) => setDraft(e.target.value)} readOnly={!perms.canManage} aria-label="Texto del documento" />
            </>
          )}
        </div>
      </div>
      <Disclaimer />
    </>
  );
}
