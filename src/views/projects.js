import { esc, chip, companyStatusMeta, ICONS } from '../lib/ui.js';
import { renderTablePage } from '../lib/components.js';
import { state, profileById } from '../lib/store.js';
import { companyModal } from './forms.js';

export function renderProjects(root) {
  const rows = state.companies.filter(c => (c.services || []).length > 0);
  renderTablePage(root, {
    title: 'Proyectos',
    subtitle: `${rows.length} clientes en producción`,
    primaryAction: { label: 'Nueva empresa', onClick: () => companyModal() },
    stats: [
      { num: rows.length, label: 'Clientes con servicios', icon: ICONS.projects, color: 'blue' },
      { num: rows.filter(c => c.status === 'activo').length, label: 'En activo', icon: ICONS.check, color: 'green' },
      { num: rows.filter(c => (c.services || []).includes('Desarrollo web')).length, label: 'Con web', icon: ICONS.globe, color: 'purple' },
      { num: rows.filter(c => (c.services || []).includes('Agente IA')).length, label: 'Con agente IA', icon: ICONS.agents, color: 'orange' }
    ],
    search: { placeholder: 'Buscar cliente…', keys: ['name', 'contact_person'] },
    columns: [
      { label: 'Cliente', render: c => `<div class="cell-strong">${esc(c.name)}</div>${c.contact_person ? `<div class="cell-muted">${esc(c.contact_person)}</div>` : ''}` },
      { label: 'Servicios', render: c => (c.services || []).map(s => `<span class="pill">${esc(s)}</span>`).join(' ') || '<span class="cell-muted">—</span>' },
      { label: 'Estado', render: c => chip(companyStatusMeta(c.status)) },
      { label: 'Responsable', render: c => { const o = profileById(c.owner_id); return o ? esc((o.name || o.email).split(' ')[0]) : '<span class="cell-muted">—</span>'; } }
    ],
    rows,
    onRow: (c) => companyModal(c),
    empty: { icon: '📁', title: 'Aún no hay proyectos', text: 'Crea una empresa y marca sus servicios contratados; aparecerá aquí.' }
  });
}
