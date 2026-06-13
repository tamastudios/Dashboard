import {
  esc, chip, fmtDate, relTime, avatarHTML, isOverdue,
  statusMeta, priorityMeta, ICONS
} from '../lib/ui.js';
import { state, companyById, profileById } from '../lib/store.js';
import { taskModal, taskDetailModal } from './forms.js';

export function renderDashboard(root, nav) {
  const tasks = state.tasks;
  const companies = state.companies;
  const activeCompanies = companies.filter(c => c.status === 'activo').length;
  const pending = tasks.filter(t => t.status === 'pendiente').length;
  const progress = tasks.filter(t => t.status === 'progreso').length;
  const completed = tasks.filter(t => t.status === 'completada').length;
  const overdue = tasks.filter(isOverdue);

  const upcoming = tasks
    .filter(t => t.due_date && t.status !== 'completada')
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 6);

  const stat = (num, lbl, icon, color, extra = '') => `
    <div class="card stat-card">
      <div class="stat-icon" style="background:var(--${color}-soft);color:var(--${color})">${icon}</div>
      <div class="num">${num}</div>
      <div class="lbl">${lbl}</div>
      ${extra}
    </div>`;

  root.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Hola, ${esc((state.me?.name || '').split(' ')[0] || 'equipo')} 👋</h1>
        <div class="sub">Esto es lo que está pasando en TAMA Studios</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" id="dash-new-task">${ICONS.plus} Nueva tarea</button>
      </div>
    </div>

    <div class="stats-grid">
      ${stat(activeCompanies, 'Empresas activas', ICONS.companies, 'green')}
      ${stat(pending, 'Pendientes', ICONS.clock, 'gray')}
      ${stat(progress, 'En progreso', ICONS.activity, 'blue')}
      ${stat(completed, 'Completadas', ICONS.check, 'purple')}
      ${stat(overdue.length, 'Vencidas / urgentes', ICONS.alert, 'red')}
    </div>

    <div class="dash-grid">
      <div class="dash-col">
        <div class="card">
          <h2 class="card-title">Próximas tareas <span class="more" data-nav="calendario">Ver calendario →</span></h2>
          <div id="dash-upcoming"></div>
        </div>
        ${overdue.length ? `
        <div class="card">
          <h2 class="card-title" style="color:var(--red)">⚠ Vencidas</h2>
          <div id="dash-overdue"></div>
        </div>` : ''}
      </div>
      <div class="dash-col">
        <div class="card">
          <h2 class="card-title">Qué está haciendo cada uno</h2>
          <div id="dash-members"></div>
        </div>
        <div class="card">
          <h2 class="card-title">Actividad reciente <span class="more" data-nav="actividad">Ver toda →</span></h2>
          <div id="dash-activity"></div>
        </div>
      </div>
    </div>`;

  // próximas
  const upWrap = root.querySelector('#dash-upcoming');
  if (!upcoming.length) {
    upWrap.innerHTML = `<p style="color:var(--muted);font-size:.87rem;padding:8px 0">No hay tareas con fecha próxima. ¡Todo al día!</p>`;
  } else {
    upWrap.innerHTML = upcoming.map(t => taskLine(t)).join('');
    wireTaskLines(upWrap);
  }

  // vencidas
  if (overdue.length) {
    const ov = root.querySelector('#dash-overdue');
    ov.innerHTML = overdue.slice(0, 6).map(t => taskLine(t, true)).join('');
    wireTaskLines(ov);
  }

  // miembros
  const mem = root.querySelector('#dash-members');
  const socios = state.profiles.filter(p => p.role !== 'colaborador').concat(
    state.profiles.filter(p => p.role === 'colaborador'));
  mem.innerHTML = socios.map(p => {
    const active = state.tasks.find(t => t.assigned_to === p.id && t.status === 'progreso');
    const count = state.tasks.filter(t => t.assigned_to === p.id && t.status !== 'completada').length;
    return `<div class="member-row">
      ${avatarHTML(p)}
      <div class="m-info">
        <div class="m-name">${esc(p.name || p.email)}</div>
        <div class="m-doing">${active ? '⚡ ' + esc(active.title) : `${count} tarea${count === 1 ? '' : 's'} pendiente${count === 1 ? '' : 's'}`}</div>
      </div>
    </div>`;
  }).join('') || `<p style="color:var(--muted);font-size:.85rem">Sin miembros.</p>`;

  // actividad
  const act = root.querySelector('#dash-activity');
  const recent = state.activity.slice(0, 7);
  act.innerHTML = recent.length
    ? recent.map(activityLine).join('')
    : `<p style="color:var(--muted);font-size:.85rem">Sin actividad todavía.</p>`;

  root.querySelector('#dash-new-task').addEventListener('click', () => taskModal());
  root.querySelectorAll('[data-nav]').forEach(b =>
    b.addEventListener('click', () => nav(b.dataset.nav)));
}

export function taskLine(t, overdueStyle = false) {
  const comp = companyById(t.company_id);
  const done = t.status === 'completada';
  return `<div class="task-line ${done ? 'done' : ''}" data-task="${t.id}">
    <span class="tl-check">${done ? '✓' : ''}</span>
    <span class="tl-title">${esc(t.title)}</span>
    ${chip(priorityMeta(t.priority))}
    <span class="tl-meta" style="${overdueStyle ? 'color:var(--red);font-weight:600' : ''}">${comp ? esc(comp.name) + ' · ' : ''}${fmtDate(t.due_date)}</span>
  </div>`;
}

export function wireTaskLines(wrap) {
  wrap.querySelectorAll('[data-task]').forEach(row =>
    row.addEventListener('click', () => taskDetailModal(row.dataset.task)));
}

export function activityLine(a) {
  const author = profileById(a.user_id);
  return `<div class="activity-item">
    ${avatarHTML(author, 'sm')}
    <div class="a-body">
      <div class="a-text"><b>${esc(a.user_name || 'Alguien')}</b> ${esc(a.action)} <b>${esc(a.entity_name)}</b>${a.detail ? ' ' + esc(a.detail) : ''}</div>
      <div class="a-time">${relTime(a.created_at)}</div>
    </div>
  </div>`;
}
