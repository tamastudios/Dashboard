import { esc, statusBadge, safeUrl, toast, ICONS } from '../lib/ui.js';
import { renderTablePage } from '../lib/components.js';
import { webs } from '../lib/mock.js';

const ST = ['diseno', 'desarrollo', 'publicado', 'mantenimiento'];
const yn = v => v && v !== 'no' && v !== '—'
  ? `<span class="pill" style="color:var(--green)">${esc(v === 'ok' ? 'OK' : v)}</span>`
  : `<span class="cell-muted">—</span>`;

export function renderWebs(root) {
  renderTablePage(root, {
    title: 'Webs',
    subtitle: `${webs.length} webs · ${webs.filter(w => w.status === 'publicado').length} publicadas`,
    primaryAction: { label: 'Nueva web', onClick: () => toast('Disponible al conectar la base de datos') },
    stats: [
      { num: webs.filter(w => w.status === 'desarrollo' || w.status === 'diseno').length, label: 'En desarrollo', icon: ICONS.globe, color: 'blue' },
      { num: webs.filter(w => w.status === 'publicado').length, label: 'Publicadas', icon: ICONS.check, color: 'green' },
      { num: webs.filter(w => w.status === 'mantenimiento').length, label: 'En mantenimiento', icon: ICONS.maintenance, color: 'purple' },
      { num: webs.filter(w => w.seo === 'ok').length, label: 'Con SEO listo', icon: ICONS.reports, color: 'orange' }
    ],
    search: { placeholder: 'Buscar web…', keys: ['name', 'client', 'domain', 'tech'] },
    selects: [{ id: 'status', label: 'Todos los estados', options: ST.map(s => ({ value: s, label: s })), match: (r, v) => r.status === v }],
    columns: [
      { label: 'Web', render: w => `<div class="cell-strong">${esc(w.name)}</div><div class="cell-muted">${esc(w.client)}</div>` },
      { label: 'Dominio', render: w => w.domain && w.domain !== '—' ? `<a href="${esc(safeUrl(w.domain))}" target="_blank" rel="noopener nofollow" style="color:var(--primary)" onclick="event.stopPropagation()">${esc(w.domain)}</a>` : '<span class="cell-muted">—</span>' },
      { label: 'Hosting', render: w => `<span class="cell-muted">${esc(w.hosting)}</span>` },
      { label: 'Stack', render: w => `<span class="pill">${esc(w.tech)}</span>` },
      { label: 'Diseño', render: w => statusBadge(w.design) },
      { label: 'Desarrollo', render: w => statusBadge(w.dev) },
      { label: 'SEO', align: 'center', render: w => yn(w.seo) },
      { label: 'Analytics', align: 'center', render: w => yn(w.analytics) },
      { label: 'Estado', render: w => statusBadge(w.status) }
    ],
    rows: webs,
    empty: { icon: '🌐', title: 'Sin webs', text: 'Tus proyectos web aparecerán aquí.' }
  });
}
