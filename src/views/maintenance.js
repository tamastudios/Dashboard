import { esc, fmtDate, statusBadge, todayISO, toast, ICONS } from '../lib/ui.js';
import { renderTablePage, progressBar } from '../lib/components.js';
import { maintenance } from '../lib/mock.js';

const ST = ['activo', 'pendiente_renovar', 'pausado', 'cancelado'];

export function renderMaintenance(root) {
  const active = maintenance.filter(m => m.status === 'activo' || m.status === 'pendiente_renovar');
  const hoursInc = maintenance.reduce((s, m) => s + (m.hours_inc || 0), 0);
  const hoursUsed = maintenance.reduce((s, m) => s + (m.hours_used || 0), 0);

  renderTablePage(root, {
    title: 'Mantenimiento',
    subtitle: `${active.length} contratos activos`,
    primaryAction: { label: 'Nuevo contrato', onClick: () => toast('Disponible al conectar la base de datos') },
    stats: [
      { num: active.length, label: 'Contratos activos', icon: ICONS.maintenance, color: 'green' },
      { num: maintenance.filter(m => m.status === 'pendiente_renovar').length, label: 'Por renovar', icon: ICONS.clock, color: 'orange' },
      { num: `${hoursUsed}/${hoursInc} h`, label: 'Horas usadas', icon: ICONS.activity, color: 'blue' },
      { num: maintenance.reduce((s, m) => s + (m.agents || 0), 0), label: 'Agentes mantenidos', icon: ICONS.agents, color: 'purple' }
    ],
    search: { placeholder: 'Buscar cliente…', keys: ['client', 'plan'] },
    selects: [{ id: 'status', label: 'Todos los estados', options: ST.map(s => ({ value: s, label: s })), match: (r, v) => r.status === v }],
    columns: [
      { label: 'Cliente', render: m => `<span class="cell-strong">${esc(m.client)}</span>` },
      { label: 'Plan', render: m => `<span class="pill">${esc(m.plan)}</span>` },
      { label: 'Webs', align: 'center', render: m => m.webs || '—' },
      { label: 'Agentes', align: 'center', render: m => m.agents || '—' },
      { label: 'Horas', width: true, render: m => `<div style="display:flex;align-items:center;gap:8px">${progressBar(m.hours_inc ? (m.hours_used / m.hours_inc) * 100 : 0, { color: (m.hours_used >= m.hours_inc ? 'var(--red)' : 'var(--primary)') })}<span class="cell-muted cell-mono">${m.hours_used}/${m.hours_inc}</span></div>` },
      { label: 'Renovación', nowrap: true, render: m => { const soon = m.renewal < todayISO(); return `<span style="${soon ? 'color:var(--red);font-weight:600' : 'color:var(--muted)'}">${fmtDate(m.renewal)}</span>`; } },
      { label: 'Estado', render: m => statusBadge(m.status) }
    ],
    rows: maintenance,
    empty: { icon: '🔧', title: 'Sin contratos de mantenimiento', text: 'Los planes de mantenimiento de clientes aparecerán aquí.' }
  });
}
