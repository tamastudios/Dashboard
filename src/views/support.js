import { esc, relTime, fmtDate, statusBadge, chip, priorityMeta, ICONS } from '../lib/ui.js';
import { state, profileById } from '../lib/store.js';
import { pageHeader, statsRow, sectionCard, dataTable, emptyState } from '../lib/components.js';

export function renderSupport(root, nav) {
  const reqs = state.supportRequests;
  const open = reqs.filter(t => ['nuevo', 'abierto', 'progreso'].includes(t.status));
  const resolved = reqs.filter(t => t.status === 'resuelto' || t.status === 'cerrado')
    .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));

  root.innerHTML = `
    ${pageHeader({ title: 'Soporte', subtitle: 'Visión general de la postventa' })}
    ${statsRow([
      { num: open.length, label: 'Solicitudes abiertas', icon: ICONS.tickets, color: 'orange' },
      { num: reqs.filter(t => t.status === 'nuevo').length, label: 'Sin atender', icon: ICONS.bell, color: 'blue' },
      { num: reqs.filter(t => t.priority === 'urgente' && !['resuelto', 'cerrado'].includes(t.status)).length, label: 'Urgentes', icon: ICONS.alert, color: 'red' },
      { num: resolved.length, label: 'Resueltas', icon: ICONS.check, color: 'green' }
    ])}
    <div class="charts-grid two">
      <div id="sp-open"></div>
      <div id="sp-resolved"></div>
    </div>`;

  root.querySelector('#sp-open').innerHTML = sectionCard({
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

  root.querySelector('#sp-resolved').innerHTML = sectionCard({
    title: 'Resueltas recientemente', more: 'informes',
    body: resolved.length ? dataTable({
      columns: [
        { label: 'Solicitante', render: t => `<div class="cell-strong">${esc(t.name)}</div><div class="cell-muted">${esc(t.subject || '')}</div>` },
        { label: 'Responsable', render: t => { const o = profileById(t.assigned_to); return o ? esc((o.name || o.email).split(' ')[0]) : '<span class="cell-muted">—</span>'; } },
        { label: 'Resuelto', nowrap: true, render: t => `<span class="cell-muted">${fmtDate(t.updated_at)}</span>` }
      ], rows: resolved.slice(0, 8)
    }) : emptyState({ icon: '📄', title: 'Sin incidencias resueltas', text: 'Aquí verás las últimas resueltas y su informe.' })
  });

  root.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => nav(b.dataset.nav)));
}
