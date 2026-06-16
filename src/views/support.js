import { esc, relTime, statusBadge, chip, priorityMeta, ICONS } from '../lib/ui.js';
import { state } from '../lib/store.js';
import { pageHeader, statsRow, sectionCard, dataTable, emptyState } from '../lib/components.js';
import { maintenance } from '../lib/mock.js';

export function renderSupport(root, nav) {
  const reqs = state.supportRequests;
  const open = reqs.filter(t => ['nuevo', 'abierto', 'progreso'].includes(t.status));
  const activeM = maintenance.filter(m => m.status === 'activo' || m.status === 'pendiente_renovar');

  root.innerHTML = `
    ${pageHeader({ title: 'Soporte', subtitle: 'Visión general de la postventa' })}
    ${statsRow([
      { num: open.length, label: 'Solicitudes abiertas', icon: ICONS.tickets, color: 'orange' },
      { num: reqs.filter(t => t.status === 'nuevo').length, label: 'Sin atender', icon: ICONS.bell, color: 'blue' },
      { num: reqs.filter(t => t.priority === 'urgente' && !['resuelto', 'cerrado'].includes(t.status)).length, label: 'Urgentes', icon: ICONS.alert, color: 'red' },
      { num: activeM.length, label: 'Clientes con mantenimiento', icon: ICONS.support, color: 'green' }
    ])}
    <div class="charts-grid two">
      <div id="sp-tickets"></div>
      <div id="sp-clients"></div>
    </div>`;

  root.querySelector('#sp-tickets').innerHTML = sectionCard({
    title: 'Solicitudes abiertas', more: 'tickets',
    body: open.length ? dataTable({
      columns: [
        { label: 'Solicitante', render: t => `<div class="cell-strong">${esc(t.name)}</div><div class="cell-muted">${esc(t.subject || t.email)}</div>` },
        { label: 'Prioridad', render: t => chip(priorityMeta(t.priority)) },
        { label: 'Estado', render: t => statusBadge(t.status) },
        { label: 'Recibido', nowrap: true, render: t => `<span class="cell-muted">${esc(relTime(t.created_at))}</span>` }
      ], rows: open.slice(0, 8)
    }) : emptyState({ icon: '🎉', title: 'Sin solicitudes abiertas', text: 'Todo el soporte está al día.' })
  });

  root.querySelector('#sp-clients').innerHTML = sectionCard({
    title: 'Clientes con mantenimiento', more: 'mantenimiento',
    body: activeM.length ? dataTable({
      columns: [
        { label: 'Cliente', render: m => `<span class="cell-strong">${esc(m.client)}</span>` },
        { label: 'Plan', render: m => `<span class="pill">${esc(m.plan)}</span>` },
        { label: 'Horas', align: 'right', render: m => `<span class="cell-mono">${m.hours_used}/${m.hours_inc} h</span>` },
        { label: 'Estado', render: m => statusBadge(m.status) }
      ], rows: activeM
    }) : emptyState({ icon: '🛟', title: 'Sin contratos de mantenimiento', text: 'Aún no hay clientes con plan de mantenimiento.' })
  });

  root.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => nav(b.dataset.nav)));
}
