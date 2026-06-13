import {
  esc, chip, fmtDate, avatarHTML, isOverdue, debounce,
  statusMeta, priorityMeta, TASK_STATUSES, PRIORITIES, ICONS
} from '../lib/ui.js';
import { state, companyById, profileById } from '../lib/store.js';
import { taskModal, taskDetailModal } from './forms.js';

let filters = { q: '', status: 'all', priority: 'all', assignee: 'all', company: 'all', sort: 'created_desc' };

export function renderTasks(root) {
  root.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Tareas</h1>
        <div class="sub">Gestiona el trabajo del equipo</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" id="new-task">${ICONS.plus} Nueva tarea</button>
      </div>
    </div>

    <div class="filters">
      <input type="search" id="f-q" placeholder="Buscar tarea…" value="${esc(filters.q)}" />
      <select id="f-status"><option value="all">Todos los estados</option>${TASK_STATUSES.map(s => `<option value="${s.id}">${s.label}</option>`).join('')}</select>
      <select id="f-priority"><option value="all">Toda prioridad</option>${PRIORITIES.map(p => `<option value="${p.id}">${p.label}</option>`).join('')}</select>
      <select id="f-assignee"><option value="all">Todos</option>${state.profiles.map(p => `<option value="${p.id}">${esc(p.name || p.email)}</option>`).join('')}</select>
      <select id="f-company"><option value="all">Toda empresa</option>${state.companies.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
      <select id="f-sort">
        <option value="created_desc">Más recientes</option>
        <option value="due">Fecha límite</option>
        <option value="priority">Prioridad</option>
      </select>
    </div>

    <div id="tasks-body"></div>`;

  root.querySelector('#new-task').addEventListener('click', () => taskModal());
  root.querySelector('#f-q').addEventListener('input', debounce(e => { filters.q = e.target.value; paint(root); }, 200));
  ['status', 'priority', 'assignee', 'company', 'sort'].forEach(k => {
    const sel = root.querySelector(`#f-${k}`);
    sel.value = filters[k] === undefined ? 'all' : filters[k];
    sel.addEventListener('change', e => { filters[k] = e.target.value; paint(root); });
  });
  paint(root);
}

function paint(root) {
  const body = root.querySelector('#tasks-body');
  let list = [...state.tasks];

  if (filters.q) {
    const q = filters.q.toLowerCase();
    list = list.filter(t => (t.title || '').toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q) ||
      (t.labels || []).some(l => l.toLowerCase().includes(q)));
  }
  if (filters.status !== 'all') list = list.filter(t => t.status === filters.status);
  if (filters.priority !== 'all') list = list.filter(t => t.priority === filters.priority);
  if (filters.assignee !== 'all') list = list.filter(t => t.assigned_to === filters.assignee);
  if (filters.company !== 'all') list = list.filter(t => t.company_id === filters.company);

  const prioRank = { urgente: 0, alta: 1, media: 2, baja: 3 };
  if (filters.sort === 'due') list.sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
  else if (filters.sort === 'priority') list.sort((a, b) => (prioRank[a.priority] ?? 9) - (prioRank[b.priority] ?? 9));
  else list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

  if (!list.length) {
    body.innerHTML = state.tasks.length
      ? `<div class="empty"><div class="ico">🔍</div><h3>Sin resultados</h3><p>Ninguna tarea coincide con los filtros.</p></div>`
      : `<div class="empty"><div class="ico">✅</div><h3>Aún no hay tareas</h3><p>Crea la primera tarea para empezar a organizar el trabajo del equipo.</p><button class="btn btn-primary" id="empty-new">${ICONS.plus} Nueva tarea</button></div>`;
    body.querySelector('#empty-new')?.addEventListener('click', () => taskModal());
    return;
  }

  body.innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr>
        <th>Tarea</th><th>Empresa</th><th>Responsable</th>
        <th>Estado</th><th>Prioridad</th><th>Límite</th><th></th>
      </tr></thead>
      <tbody>
        ${list.map(t => {
          const comp = companyById(t.company_id);
          const who = profileById(t.assigned_to);
          const overdue = isOverdue(t);
          return `<tr data-id="${t.id}">
            <td>
              <div style="font-weight:600${t.status === 'completada' ? ';text-decoration:line-through;color:var(--muted)' : ''}">${esc(t.title)}</div>
              ${(t.labels || []).length ? `<div class="labels-row" style="margin-top:4px">${t.labels.slice(0, 3).map(l => `<span class="label-tag">${esc(l)}</span>`).join('')}</div>` : ''}
            </td>
            <td style="font-size:.85rem">${comp ? esc(comp.name) : '<span style="color:var(--muted)">—</span>'}</td>
            <td>${who ? `<div style="display:flex;align-items:center;gap:7px">${avatarHTML(who, 'sm')}<span style="font-size:.82rem">${esc((who.name || who.email).split(' ')[0])}</span></div>` : '<span style="color:var(--muted)">—</span>'}</td>
            <td>${chip(statusMeta(t.status))}</td>
            <td>${chip(priorityMeta(t.priority))}</td>
            <td style="font-size:.82rem;${overdue ? 'color:var(--red);font-weight:600' : 'color:var(--muted)'}">${overdue ? '⚠ ' : ''}${fmtDate(t.due_date)}</td>
            <td><div class="row-actions">
              <button class="icon-btn edit" title="Editar">${ICONS.edit}</button>
            </div></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>`;

  body.querySelectorAll('tbody tr').forEach(tr => {
    const t = state.tasks.find(x => x.id === tr.dataset.id);
    tr.querySelector('.edit').addEventListener('click', e => { e.stopPropagation(); taskModal(t); });
    tr.addEventListener('click', () => taskDetailModal(t.id));
  });
}
