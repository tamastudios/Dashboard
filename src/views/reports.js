import { esc, fmtDate, chip, toast, ICONS } from '../lib/ui.js';
import { renderTablePage } from '../lib/components.js';
import { reports } from '../lib/mock.js';

export function renderReports(root) {
  renderTablePage(root, {
    title: 'Informes',
    subtitle: `${reports.length} informes · exportación a PDF próximamente`,
    primaryAction: { label: 'Generar informe', icon: ICONS.reports, onClick: () => toast('Generación de informes disponible próximamente') },
    stats: [
      { num: reports.filter(r => r.type === 'cliente').length, label: 'Informes de cliente', icon: ICONS.reports, color: 'blue' },
      { num: reports.filter(r => r.type === 'interno').length, label: 'Informes internos', icon: ICONS.documents, color: 'purple' },
      { num: 'Mayo 2026', label: 'Último periodo', icon: ICONS.calendar, color: 'orange' },
      { num: 'PDF', label: 'Exportación (pronto)', icon: ICONS.download, color: 'gray' }
    ],
    search: { placeholder: 'Buscar informe…', keys: ['name', 'period'] },
    selects: [{ id: 'type', label: 'Todos los tipos', options: [{ value: 'cliente', label: 'Cliente' }, { value: 'interno', label: 'Interno' }], match: (r, v) => r.type === v }],
    columns: [
      { label: 'Informe', render: r => `<div class="cell-strong">${esc(r.name)}</div>` },
      { label: 'Tipo', render: r => chip(r.type === 'cliente' ? { label: 'Cliente', color: 'blue' } : { label: 'Interno', color: 'purple' }) },
      { label: 'Periodo', render: r => esc(r.period) },
      { label: 'Fecha', nowrap: true, render: r => `<span class="cell-muted">${fmtDate(r.date)}</span>` },
      { label: '', align: 'right', render: () => `<span class="pill">${ICONS.download} PDF</span>` }
    ],
    rows: reports,
    empty: { icon: '📊', title: 'Sin informes', text: 'Rendimiento de webs, conversaciones IA, leads y costes.' }
  });
}
