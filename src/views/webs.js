import { esc, chip, companyStatusMeta, safeUrl, ICONS } from '../lib/ui.js';
import { renderTablePage } from '../lib/components.js';
import { state, profileById } from '../lib/store.js';
import { companyModal } from './forms.js';

const SERVICE = 'Desarrollo web';

export function renderWebs(root) {
  const rows = state.companies.filter(c => (c.services || []).includes(SERVICE));
  renderTablePage(root, {
    title: 'Webs',
    subtitle: `${rows.length} clientes con desarrollo web`,
    primaryAction: { label: 'Nueva empresa', onClick: () => companyModal() },
    stats: [
      { num: rows.length, label: 'Webs / clientes', icon: ICONS.globe, color: 'blue' },
      { num: rows.filter(c => c.status === 'activo').length, label: 'Activas', icon: ICONS.check, color: 'green' },
      { num: rows.filter(c => c.website).length, label: 'Con dominio', icon: ICONS.link, color: 'purple' }
    ],
    search: { placeholder: 'Buscar web / cliente…', keys: ['name', 'contact_person', 'website'] },
    columns: [
      { label: 'Cliente', render: c => `<div class="cell-strong">${esc(c.name)}</div>${c.contact_person ? `<div class="cell-muted">${esc(c.contact_person)}</div>` : ''}` },
      { label: 'Web', render: c => c.website && safeUrl(c.website) ? `<a href="${esc(safeUrl(c.website))}" target="_blank" rel="noopener nofollow" style="color:var(--primary)" onclick="event.stopPropagation()">${esc(c.website.replace(/^https?:\/\//, ''))}</a>` : '<span class="cell-muted">— sin dominio —</span>' },
      { label: 'Estado', render: c => chip(companyStatusMeta(c.status)) },
      { label: 'Responsable', render: c => { const o = profileById(c.owner_id); return o ? esc((o.name || o.email).split(' ')[0]) : '<span class="cell-muted">—</span>'; } }
    ],
    rows,
    onRow: (c) => companyModal(c),
    empty: { icon: '🌐', title: 'Aún no hay webs', text: 'Marca el servicio “Desarrollo web” en una empresa y aparecerá aquí.' }
  });
}
