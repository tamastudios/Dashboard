import { esc, fmtDate, statusBadge, chip, priorityMeta, toast, ICONS } from '../lib/ui.js';
import { renderTablePage } from '../lib/components.js';
import { tickets } from '../lib/mock.js';

const ST = ['abierto', 'progreso', 'resuelto', 'cerrado'];
const PRIOS = ['baja', 'media', 'alta', 'urgente'];

export function renderTickets(root) {
  const open = tickets.filter(t => t.status === 'abierto' || t.status === 'progreso');

  renderTablePage(root, {
    title: 'Tickets',
    subtitle: `${tickets.length} tickets · ${open.length} abiertos`,
    primaryAction: { label: 'Nuevo ticket', onClick: () => toast('Disponible al conectar la base de datos') },
    stats: [
      { num: tickets.filter(t => t.status === 'abierto').length, label: 'Abiertos', icon: ICONS.tickets, color: 'orange' },
      { num: tickets.filter(t => t.status === 'progreso').length, label: 'En progreso', icon: ICONS.activity, color: 'blue' },
      { num: tickets.filter(t => t.priority === 'urgente' && t.status !== 'cerrado' && t.status !== 'resuelto').length, label: 'Urgentes', icon: ICONS.alert, color: 'red' },
      { num: tickets.filter(t => t.status === 'resuelto' || t.status === 'cerrado').length, label: 'Resueltos', icon: ICONS.check, color: 'green' }
    ],
    search: { placeholder: 'Buscar ticket…', keys: ['code', 'client', 'project', 'type'] },
    selects: [
      { id: 'status', label: 'Todos los estados', options: ST.map(s => ({ value: s, label: s })), match: (r, v) => r.status === v },
      { id: 'priority', label: 'Todas las prioridades', options: PRIOS.map(s => ({ value: s, label: s })), match: (r, v) => r.priority === v }
    ],
    columns: [
      { label: 'Ticket', nowrap: true, render: t => `<span class="cell-strong">${esc(t.code)}</span>` },
      { label: 'Cliente', render: t => `<div>${esc(t.client)}</div><div class="cell-muted">${esc(t.project)}</div>` },
      { label: 'Tipo', render: t => `<span class="pill">${esc(t.type)}</span>` },
      { label: 'Prioridad', render: t => chip(priorityMeta(t.priority)) },
      { label: 'Estado', render: t => statusBadge(t.status) },
      { label: 'Resp.', render: t => esc(t.owner) },
      { label: 'Creado', nowrap: true, render: t => `<span class="cell-muted">${fmtDate(t.created_at)}</span>` }
    ],
    rows: tickets,
    empty: { icon: '🎫', title: 'Sin tickets', text: 'Las incidencias y solicitudes de clientes aparecerán aquí.' }
  });
}
