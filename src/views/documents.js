import { esc, fmtDate, toast, ICONS } from '../lib/ui.js';
import { renderTablePage } from '../lib/components.js';
import { documents } from '../lib/mock.js';

const TYPES = ['Contrato', 'Briefing', 'Propuesta', 'Manual', 'Técnica', 'Factura'];

export function renderDocuments(root) {
  renderTablePage(root, {
    title: 'Documentos',
    subtitle: `${documents.length} documentos`,
    primaryAction: { label: 'Subir documento', icon: ICONS.download, onClick: () => toast('Disponible al conectar el almacenamiento') },
    stats: [
      { num: documents.filter(d => d.type === 'Contrato').length, label: 'Contratos', icon: ICONS.documents, color: 'blue' },
      { num: documents.filter(d => d.type === 'Propuesta').length, label: 'Propuestas', icon: ICONS.quotes, color: 'orange' },
      { num: documents.filter(d => d.type === 'Manual' || d.type === 'Técnica').length, label: 'Manuales y técnicos', icon: ICONS.reports, color: 'purple' },
      { num: documents.length, label: 'Total archivos', icon: ICONS.documents, color: 'gray' }
    ],
    search: { placeholder: 'Buscar documento…', keys: ['name', 'client', 'project', 'type'] },
    selects: [{ id: 'type', label: 'Todos los tipos', options: TYPES.map(t => ({ value: t, label: t })), match: (r, v) => r.type === v }],
    columns: [
      { label: 'Documento', render: d => `<div class="cell-strong">${esc(d.name)}</div>` },
      { label: 'Tipo', render: d => `<span class="pill">${esc(d.type)}</span>` },
      { label: 'Cliente', render: d => esc(d.client) },
      { label: 'Proyecto', render: d => `<span class="cell-muted">${esc(d.project)}</span>` },
      { label: 'Fecha', nowrap: true, render: d => `<span class="cell-muted">${fmtDate(d.date)}</span>` }
    ],
    rows: documents,
    empty: { icon: '📂', title: 'Sin documentos', text: 'Contratos, briefings, propuestas y manuales por cliente.' }
  });
}
