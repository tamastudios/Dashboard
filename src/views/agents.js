import { esc, chip, companyStatusMeta, ICONS } from '../lib/ui.js';
import { renderTablePage } from '../lib/components.js';
import { state, profileById } from '../lib/store.js';
import { companyModal } from './forms.js';

const SERVICE = 'Agente IA';

export function renderAgents(root) {
  const rows = state.companies.filter(c => (c.services || []).includes(SERVICE));
  renderTablePage(root, {
    title: 'Agentes IA',
    subtitle: `${rows.length} clientes con agente IA`,
    primaryAction: { label: 'Nueva empresa', onClick: () => companyModal() },
    stats: [
      { num: rows.length, label: 'Agentes / clientes', icon: ICONS.agents, color: 'blue' },
      { num: rows.filter(c => c.status === 'activo').length, label: 'Activos', icon: ICONS.check, color: 'green' }
    ],
    search: { placeholder: 'Buscar cliente…', keys: ['name', 'contact_person'] },
    columns: [
      { label: 'Cliente', render: c => `<div class="cell-strong">${esc(c.name)}</div>${c.contact_person ? `<div class="cell-muted">${esc(c.contact_person)}</div>` : ''}` },
      { label: 'Email', render: c => c.email ? `<span class="cell-muted">${esc(c.email)}</span>` : '<span class="cell-muted">—</span>' },
      { label: 'Estado', render: c => chip(companyStatusMeta(c.status)) },
      { label: 'Responsable', render: c => { const o = profileById(c.owner_id); return o ? esc((o.name || o.email).split(' ')[0]) : '<span class="cell-muted">—</span>'; } }
    ],
    rows,
    onRow: (c) => companyModal(c),
    empty: { icon: '🤖', title: 'Aún no hay agentes IA', text: 'Marca el servicio “Agente IA” en una empresa y aparecerá aquí.' }
  });
}
