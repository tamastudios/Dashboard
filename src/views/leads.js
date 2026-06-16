import { esc, fmtEUR, fmtDate, statusBadge, toast, ICONS } from '../lib/ui.js';
import { renderTablePage } from '../lib/components.js';
import { leads } from '../lib/mock.js';

const STAGES = ['nuevo', 'contactado', 'cualificado', 'propuesta', 'ganado', 'perdido'];

export function renderLeads(root) {
  const open = leads.filter(l => !['ganado', 'perdido'].includes(l.status));
  const won = leads.filter(l => l.status === 'ganado');
  const sum = arr => arr.reduce((s, l) => s + (l.value || 0), 0);

  renderTablePage(root, {
    title: 'Leads',
    subtitle: `${leads.length} leads · ${fmtEUR(sum(leads))} en pipeline`,
    primaryAction: { label: 'Nuevo lead', onClick: () => toast('Disponible al conectar la base de datos') },
    stats: [
      { num: open.length, label: 'Leads abiertos', icon: ICONS.leads, color: 'blue' },
      { num: fmtEUR(sum(open)), label: 'Pipeline activo', icon: ICONS.euro, color: 'orange' },
      { num: won.length, label: 'Ganados', icon: ICONS.check, color: 'green' },
      { num: fmtEUR(sum(won)), label: 'Valor ganado', icon: ICONS.dashboard, color: 'purple' }
    ],
    search: { placeholder: 'Buscar lead…', keys: ['name', 'contact', 'service', 'source'] },
    selects: [{ id: 'status', label: 'Todas las etapas', options: STAGES.map(s => ({ value: s, label: statusLabel(s) })), match: (r, v) => r.status === v }],
    columns: [
      { label: 'Empresa', render: l => `<div class="cell-strong">${esc(l.name)}</div><div class="cell-muted">${esc(l.contact)}</div>` },
      { label: 'Fuente', render: l => `<span class="pill">${esc(l.source)}</span>` },
      { label: 'Servicio', render: l => esc(l.service) },
      { label: 'Valor', align: 'right', nowrap: true, render: l => `<span class="cell-mono">${fmtEUR(l.value)}</span>` },
      { label: 'Estado', render: l => statusBadge(l.status) },
      { label: 'Próxima acción', render: l => `<div>${esc(l.next_action)}</div>${l.next_date ? `<div class="cell-muted">${fmtDate(l.next_date)}</div>` : ''}` },
      { label: 'Resp.', render: l => esc(l.owner) }
    ],
    rows: leads,
    empty: { icon: '🎯', title: 'Sin leads', text: 'Aquí verás tu pipeline comercial.' }
  });
}

function statusLabel(s) {
  return { nuevo: 'Nuevo', contactado: 'Contactado', cualificado: 'Cualificado', propuesta: 'Propuesta', ganado: 'Ganado', perdido: 'Perdido' }[s] || s;
}
