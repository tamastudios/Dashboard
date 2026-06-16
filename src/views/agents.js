import { esc, fmtEUR, statusBadge, toast, ICONS } from '../lib/ui.js';
import { renderTablePage } from '../lib/components.js';
import { agents } from '../lib/mock.js';

const ST = ['desarrollo', 'revision', 'activo', 'pausado'];

export function renderAgents(root) {
  const active = agents.filter(a => a.status === 'activo');
  const convs = agents.reduce((s, a) => s + (a.conversations || 0), 0);
  const cost = agents.reduce((s, a) => s + (a.cost_month || 0), 0);
  const errs = agents.reduce((s, a) => s + (a.errors || 0), 0);

  renderTablePage(root, {
    title: 'Agentes IA',
    subtitle: `${agents.length} agentes · ${active.length} activos`,
    primaryAction: { label: 'Nuevo agente', onClick: () => toast('Disponible al conectar la base de datos') },
    stats: [
      { num: active.length, label: 'Agentes activos', icon: ICONS.agents, color: 'green' },
      { num: convs.toLocaleString('es-ES'), label: 'Conversaciones', icon: ICONS.activity, color: 'blue' },
      { num: fmtEUR(cost), label: 'Coste IA / mes', icon: ICONS.euro, color: 'orange' },
      { num: errs, label: 'Errores (30d)', icon: ICONS.alert, color: 'red' }
    ],
    search: { placeholder: 'Buscar agente…', keys: ['name', 'client', 'type', 'channel', 'model'] },
    selects: [
      { id: 'status', label: 'Todos los estados', options: ST.map(s => ({ value: s, label: s })), match: (r, v) => r.status === v },
      { id: 'channel', label: 'Todos los canales', options: ['Web', 'WhatsApp', 'Email', 'Interno'].map(c => ({ value: c, label: c })), match: (r, v) => r.channel === v }
    ],
    columns: [
      { label: 'Agente', render: a => `<div class="cell-strong">${esc(a.name)}</div><div class="cell-muted">${esc(a.client)}</div>` },
      { label: 'Tipo', render: a => esc(a.type) },
      { label: 'Canal', render: a => `<span class="pill">${esc(a.channel)}</span>` },
      { label: 'Modelo', render: a => `<span class="cell-muted">${esc(a.model)}</span>` },
      { label: 'Integraciones', render: a => `<span class="cell-muted">${esc(a.integrations)}</span>` },
      { label: 'Convers.', align: 'right', nowrap: true, render: a => `<span class="cell-mono">${(a.conversations || 0).toLocaleString('es-ES')}</span>` },
      { label: 'Errores', align: 'right', render: a => a.errors ? `<span class="cell-mono" style="color:var(--red)">${a.errors}</span>` : `<span class="cell-muted">0</span>` },
      { label: 'Coste/mes', align: 'right', nowrap: true, render: a => `<span class="cell-mono">${fmtEUR(a.cost_month)}</span>` },
      { label: 'Estado', render: a => statusBadge(a.status) }
    ],
    rows: agents,
    empty: { icon: '🤖', title: 'Sin agentes', text: 'Tus agentes de IA aparecerán aquí.' }
  });
}
