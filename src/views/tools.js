import { esc, fmtEUR, statusBadge, toast, ICONS } from '../lib/ui.js';
import { renderTablePage } from '../lib/components.js';
import { tools } from '../lib/mock.js';

export function renderTools(root) {
  const monthly = tools.reduce((s, t) => s + (t.cost_month || 0), 0);
  const cats = [...new Set(tools.map(t => t.category))];

  renderTablePage(root, {
    title: 'Herramientas',
    subtitle: `${tools.length} herramientas · ${fmtEUR(monthly)}/mes`,
    primaryAction: { label: 'Añadir herramienta', onClick: () => toast('Disponible al conectar la base de datos') },
    stats: [
      { num: tools.length, label: 'Herramientas activas', icon: ICONS.tools, color: 'blue' },
      { num: fmtEUR(monthly), label: 'Coste mensual', icon: ICONS.euro, color: 'orange' },
      { num: fmtEUR(monthly * 12), label: 'Coste anual estimado', icon: ICONS.dashboard, color: 'purple' },
      { num: cats.length, label: 'Categorías', icon: ICONS.kanban, color: 'green' }
    ],
    search: { placeholder: 'Buscar herramienta…', keys: ['name', 'category', 'client'] },
    selects: [{ id: 'category', label: 'Todas las categorías', options: cats.map(c => ({ value: c, label: c })), match: (r, v) => r.category === v }],
    columns: [
      { label: 'Herramienta', render: t => `<span class="cell-strong">${esc(t.name)}</span>` },
      { label: 'Categoría', render: t => `<span class="pill">${esc(t.category)}</span>` },
      { label: 'Coste/mes', align: 'right', nowrap: true, render: t => t.cost_month ? `<span class="cell-mono">${fmtEUR(t.cost_month)}</span>` : `<span class="cell-muted">Gratis</span>` },
      { label: 'Renovación', render: t => `<span class="cell-muted">${esc(t.renewal)}</span>` },
      { label: 'Cliente', render: t => esc(t.client) },
      { label: 'Estado', render: t => statusBadge(t.status) }
    ],
    rows: tools,
    empty: { icon: '🧰', title: 'Sin herramientas', text: 'Tu stack: OpenAI, Supabase, Vercel, Figma, Make…' }
  });
}
