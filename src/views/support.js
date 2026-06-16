import { esc, fmtDate, statusBadge, chip, priorityMeta, ICONS } from '../lib/ui.js';
import { pageHeader, statsRow, sectionCard, dataTable, emptyState } from '../lib/components.js';
import { tickets, maintenance } from '../lib/mock.js';

export function renderSupport(root, nav) {
  const openT = tickets.filter(t => t.status === 'abierto' || t.status === 'progreso');
  const activeM = maintenance.filter(m => m.status === 'activo' || m.status === 'pendiente_renovar');

  root.innerHTML = `
    ${pageHeader({ title: 'Soporte', subtitle: 'Visión general de la postventa' })}
    ${statsRow([
      { num: activeM.length, label: 'Clientes con soporte', icon: ICONS.support, color: 'blue' },
      { num: openT.length, label: 'Solicitudes abiertas', icon: ICONS.tickets, color: 'orange' },
      { num: '3,2 h', label: 'Tiempo medio de respuesta', icon: ICONS.clock, color: 'purple' },
      { num: tickets.filter(t => t.priority === 'urgente' && t.status !== 'cerrado' && t.status !== 'resuelto').length, label: 'Urgentes activos', icon: ICONS.alert, color: 'red' }
    ])}
    <div class="charts-grid two">
      <div id="sp-tickets"></div>
      <div id="sp-clients"></div>
    </div>`;

  root.querySelector('#sp-tickets').innerHTML = sectionCard({
    title: 'Solicitudes abiertas', more: 'tickets',
    body: openT.length ? dataTable({
      columns: [
        { label: 'Ticket', render: t => `<span class="cell-strong">${esc(t.code)}</span>` },
        { label: 'Cliente', render: t => esc(t.client) },
        { label: 'Prioridad', render: t => chip(priorityMeta(t.priority)) },
        { label: 'Estado', render: t => statusBadge(t.status) }
      ], rows: openT
    }) : emptyState({ icon: '🎉', title: 'Sin solicitudes abiertas', text: 'Todo el soporte está al día.' })
  });

  root.querySelector('#sp-clients').innerHTML = sectionCard({
    title: 'Clientes con soporte activo', more: 'mantenimiento',
    body: activeM.length ? dataTable({
      columns: [
        { label: 'Cliente', render: m => `<span class="cell-strong">${esc(m.client)}</span>` },
        { label: 'Plan', render: m => `<span class="pill">${esc(m.plan)}</span>` },
        { label: 'Horas', align: 'right', render: m => `<span class="cell-mono">${m.hours_used}/${m.hours_inc} h</span>` },
        { label: 'Estado', render: m => statusBadge(m.status) }
      ], rows: activeM
    }) : emptyState({ icon: '🛟', title: 'Sin clientes con soporte', text: '' })
  });

  root.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => nav(b.dataset.nav)));
}
