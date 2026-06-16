import { esc, statusBadge, ICONS } from '../lib/ui.js';
import { renderTablePage } from '../lib/components.js';
import { qa } from '../lib/mock.js';

const TYPE = { web: 'Web', agente: 'Agente IA' };
const okIcon = v => v
  ? `<span class="pill" style="color:var(--green)">✓ Sí</span>`
  : `<span class="cell-muted">Pendiente</span>`;

export function renderQA(root) {
  const bugs = qa.reduce((s, q) => s + (q.bugs || 0), 0);
  const ready = qa.filter(q => q.internal_ok && q.client_ok).length;

  renderTablePage(root, {
    title: 'Entregas / QA',
    subtitle: `${qa.length} entregas en control de calidad`,
    stats: [
      { num: qa.length, label: 'En revisión', icon: ICONS.qa, color: 'blue' },
      { num: bugs, label: 'Bugs pendientes', icon: ICONS.alert, color: 'red' },
      { num: qa.filter(q => q.internal_ok).length, label: 'Aprobación interna', icon: ICONS.check, color: 'purple' },
      { num: ready, label: 'Listas para entregar', icon: ICONS.check, color: 'green' }
    ],
    search: { placeholder: 'Buscar entrega…', keys: ['project'] },
    selects: [{ id: 'type', label: 'Todos los tipos', options: Object.entries(TYPE).map(([v, l]) => ({ value: v, label: l })), match: (r, v) => r.type === v }],
    columns: [
      { label: 'Proyecto', render: q => `<div class="cell-strong">${esc(q.project)}</div>` },
      { label: 'Tipo', render: q => `<span class="pill">${esc(TYPE[q.type] || q.type)}</span>` },
      { label: 'Revisión', render: q => statusBadge(q.review) },
      { label: 'Bugs', align: 'center', render: q => q.bugs ? `<span class="cell-mono" style="color:var(--red)">${q.bugs}</span>` : `<span class="cell-muted">0</span>` },
      { label: 'Aprob. interna', align: 'center', render: q => okIcon(q.internal_ok) },
      { label: 'Aprob. cliente', align: 'center', render: q => okIcon(q.client_ok) }
    ],
    rows: qa,
    empty: { icon: '✅', title: 'Sin entregas en QA', text: 'Las checklists de entrega de webs y agentes aparecerán aquí.' }
  });
}
