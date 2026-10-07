import { useState } from 'react';
import { api, qs } from '../lib/api';
import { useData } from '../lib/useData';
import { fmtDateTime } from '../lib/format';
import { Empty, ErrorBox, Loading, PageHead } from '../components/ui';

interface Item { id: number; action: string; entity: string; entityId: string | null; userEmail: string | null; meta: Record<string, unknown> | null; createdAt: string }
const ENTITIES: Record<string, string> = { user: 'Usuarios', organization: 'Clínica', diagnostic: 'Diagnóstico', task: 'Tareas', evidence: 'Evidencia', processing_activity: 'Inventario', data_request: 'Solicitudes', incident: 'Incidentes', vendor: 'Proveedores', document: 'Documentos', integration: 'Integración', patient: 'Pacientes' };

export default function AuditLog() {
  const [entity, setEntity] = useState('');
  const [pages, setPages] = useState<Item[][]>([]);
  const [next, setNext] = useState<number | null>(null);
  const first = useData(async () => {
    const r = await api<{ items: Item[]; nextBefore: number | null }>(`/audit${qs({ entity })}`);
    setPages([r.items]); setNext(r.nextBefore); return r;
  }, [entity]);
  async function more() {
    const r = await api<{ items: Item[]; nextBefore: number | null }>(`/audit${qs({ entity, before: next })}`);
    setPages((p) => [...p, r.items]); setNext(r.nextBefore);
  }
  const items = pages.flat();
  return (
    <>
      <PageHead eyebrow="Responsabilidad proactiva" title="Registro de auditoría"
        lede="Quién hizo qué y cuándo. Este registro no se puede modificar ni borrar, ni siquiera desde la base de datos de la aplicación." />
      <div className="filters">
        <select value={entity} onChange={(e) => setEntity(e.target.value)} aria-label="Módulo"><option value="">Todos los módulos</option>{Object.entries(ENTITIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      {first.error ? <ErrorBox error={first.error} onRetry={first.reload} /> : first.loading && !items.length ? <Loading /> : !items.length ? <Empty>Sin registros.</Empty> : (
        <div className="tablewrap"><table>
          <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Módulo</th><th>Detalle</th></tr></thead>
          <tbody>{items.map((i) => (
            <tr key={i.id}><td className="num">{fmtDateTime(i.createdAt)}</td><td>{i.userEmail ?? 'Sistema / formulario web'}</td><td className="mono">{i.action}</td><td>{ENTITIES[i.entity] ?? i.entity}</td>
              <td className="sub mono" style={{ maxWidth: 360, overflowWrap: 'anywhere' }}>{i.meta ? JSON.stringify(i.meta) : ''}</td></tr>
          ))}</tbody>
        </table></div>
      )}
      {next && <button className="btn ghost mt" onClick={more}>Cargar más</button>}
    </>
  );
}
