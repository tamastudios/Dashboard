import {
  esc, chip, fmtDate, relTime, avatarHTML, isOverdue, fmtEUR, todayISO,
  statusMeta, priorityMeta, statusBadge, TASK_STATUSES, INVOICE_STATUSES, ICONS
} from '../lib/ui.js';
import { progressBar } from '../lib/components.js';
import { state, companyById, profileById } from '../lib/store.js';
import { taskModal, taskDetailModal } from './forms.js';
import { barChart, donutChart, hbarChart } from '../lib/charts.js';
import { projects, agents, webs } from '../lib/mock.js';

const CHART_COLORS = {
  gray: '#94a3b8', blue: '#3b82f6', purple: '#a855f7', red: '#ef4444', green: '#22c55e', orange: '#f59e0b'
};

/** Importe facturado (emitido) en cada uno de los últimos 6 meses. */
function billedByMonth(invoices) {
  const M = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const now = new Date();
  const out = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const nd = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const end = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}-01`;
    const val = invoices
      .filter(x => (x.issue_date || '') >= start && (x.issue_date || '') < end)
      .reduce((s, x) => s + (Number(x.total) || 0), 0);
    out.push({ label: M[d.getMonth()], value: Math.round(val), color: 'var(--primary)' });
  }
  return out;
}

/** Tareas completadas en cada una de las últimas 6 semanas. */
function completedByWeek() {
  const weeks = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() + 1 - i * 7); // lunes de esa semana
    start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(start.getDate() + 7);
    const count = state.tasks.filter(t =>
      t.completed_at && new Date(t.completed_at) >= start && new Date(t.completed_at) < end).length;
    const label = i === 0 ? 'Esta' : `-${i}`;
    weeks.push({ label, value: count, color: 'var(--primary)' });
  }
  return weeks;
}

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

  /* ----- finanzas ----- */
  const year = new Date().getFullYear();
  const yStart = `${year}-01-01`;
  const invoices = state.invoices;
  const issued = invoices.filter(i => i.status !== 'borrador');           // facturas emitidas
  const issuedYear = issued.filter(i => (i.issue_date || '') >= yStart);
  const pendInv = invoices
    .filter(i => i.status === 'pendiente' || i.status === 'vencida')
    .sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
  const sumE = (arr, k) => arr.reduce((s, i) => s + (Number(i[k]) || 0), 0);
  const facturadoYear = sumE(issuedYear, 'total');
  const cobradoYear = sumE(issuedYear.filter(i => i.status === 'pagada'), 'total');
  const pendienteAmount = sumE(pendInv, 'total');
  const ivaYear = sumE(issuedYear, 'vat_amount');
  const monthStart = `${year}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;
  const ingresosMes = sumE(issued.filter(i => i.status === 'pagada' && (i.paid_date || i.issue_date || '') >= monthStart), 'total');

  /* ----- negocio (mock hasta conectar tablas) ----- */
  const projActive = projects.filter(p => p.status !== 'entregado');
  const leadsNew = state.leads.filter(l => l.status === 'nuevo');
  const agentsActive = agents.filter(a => a.status === 'activo');
  const websDev = webs.filter(w => w.status === 'desarrollo' || w.status === 'diseno');
  const ticketsOpen = state.supportRequests.filter(t => ['nuevo', 'abierto', 'progreso'].includes(t.status));
  const nextDeliveries = projects
    .filter(p => p.status !== 'entregado' && p.due >= todayISO())
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, 5);

  const stat = (num, lbl, icon, color, extra = '') => `
    <div class="card stat-card">
      <div class="stat-icon" style="background:var(--${color}-soft);color:var(--${color})">${icon}</div>
      <div class="num">${num}</div>
      <div class="lbl">${lbl}</div>
      ${extra}
    </div>`;
  const muted = (txt) => `<div class="lbl" style="color:var(--muted);font-size:.72rem;margin-top:2px">${esc(txt)}</div>`;

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
      ${stat(projActive.length, 'Proyectos activos', ICONS.projects, 'blue')}
      ${stat(leadsNew.length, 'Leads nuevos', ICONS.leads, 'purple')}
      ${stat(fmtEUR(ingresosMes), 'Ingresos del mes', ICONS.euro, 'green')}
      ${stat(pendInv.length, 'Facturas pendientes', ICONS.invoices, 'orange', muted(fmtEUR(pendienteAmount)))}
      ${stat(agentsActive.length, 'Agentes IA activos', ICONS.agents, 'blue')}
      ${stat(websDev.length, 'Webs en desarrollo', ICONS.globe, 'purple')}
      ${stat(ticketsOpen.length, 'Tickets abiertos', ICONS.tickets, 'red')}
    </div>
    <div class="charts-grid two" style="margin-bottom:22px">
      <div class="card">
        <h2 class="card-title">Proyectos activos <span class="more" data-nav="proyectos">Ver todos →</span></h2>
        <div id="dash-projects"></div>
      </div>
      <div class="card">
        <h2 class="card-title">Próximas entregas <span class="more" data-nav="entregas">Ver QA →</span></h2>
        <div id="dash-deliveries"></div>
      </div>
    </div>

    <div class="charts-grid">
      <div class="card">
        <h2 class="card-title">Completadas por semana</h2>
        ${barChart(completedByWeek(), { height: 130 })}
      </div>
      <div class="card">
        <h2 class="card-title">Tareas por estado</h2>
        ${donutChart(TASK_STATUSES.map(s => ({
          label: s.label,
          value: state.tasks.filter(t => t.status === s.id).length,
          color: CHART_COLORS[s.color]
        })))}
      </div>
      <div class="card">
        <h2 class="card-title">Carga por persona</h2>
        ${hbarChart(state.profiles.map(p => ({
          label: (p.name || p.email || '?').split(' ')[0],
          value: state.tasks.filter(t => t.assigned_to === p.id && t.status !== 'completada').length
        })))}
      </div>
    </div>

    ${invoices.length ? `
    <div style="display:flex;align-items:center;justify-content:space-between;margin:6px 0 14px">
      <h2 style="font-size:1.1rem;margin:0">Finanzas</h2>
      <span class="more" data-nav="facturas">Ver facturas →</span>
    </div>
    <div class="stats-grid">
      ${stat(fmtEUR(facturadoYear), 'Facturado ' + year, ICONS.euro, 'green', muted(issuedYear.length + ' emitida' + (issuedYear.length === 1 ? '' : 's')))}
      ${stat(fmtEUR(cobradoYear), 'Cobrado ' + year, ICONS.check, 'blue')}
      ${stat(fmtEUR(pendienteAmount), 'Pendiente de cobro', ICONS.clock, 'red', muted(pendInv.length + ' factura' + (pendInv.length === 1 ? '' : 's')))}
      ${stat(fmtEUR(ivaYear), 'IVA a liquidar ' + year, ICONS.invoices, 'orange', muted('Modelo 303 · sin gastos'))}
    </div>
    <div class="charts-grid">
      <div class="card">
        <h2 class="card-title">Facturado por mes</h2>
        ${barChart(billedByMonth(issued), { height: 130 })}
      </div>
      <div class="card">
        <h2 class="card-title">Facturas por estado</h2>
        ${donutChart(INVOICE_STATUSES.map(s => ({
          label: s.label,
          value: invoices.filter(i => i.status === s.id).length,
          color: CHART_COLORS[s.color]
        })), { centerLabel: 'facturas', emptyText: 'Sin facturas' })}
      </div>
      <div class="card">
        <h2 class="card-title">Pendientes de pago <span class="more" data-nav="facturas">Ver todas →</span></h2>
        <div id="dash-invoices"></div>
      </div>
    </div>` : `
    <div class="card" style="margin-bottom:22px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap">
      <div>
        <h2 class="card-title" style="margin:0">Finanzas</h2>
        <p style="color:var(--muted);font-size:.86rem;margin-top:4px">Aún no hay facturas. Crea la primera para ver aquí el seguimiento del dinero.</p>
      </div>
      <button class="btn btn-primary" data-nav="facturas">${ICONS.invoices} Ir a Facturas</button>
    </div>`}

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

  // proyectos activos
  const projWrap = root.querySelector('#dash-projects');
  if (projWrap) {
    projWrap.innerHTML = projActive.length
      ? projActive.slice(0, 5).map(projectLine).join('')
      : `<p style="color:var(--muted);font-size:.87rem;padding:8px 0">Sin proyectos activos.</p>`;
    projWrap.querySelectorAll('[data-nav-proj]').forEach(r => r.addEventListener('click', () => nav('proyectos')));
  }

  // próximas entregas
  const delWrap = root.querySelector('#dash-deliveries');
  if (delWrap) {
    delWrap.innerHTML = nextDeliveries.length
      ? nextDeliveries.map(deliveryLine).join('')
      : `<p style="color:var(--muted);font-size:.87rem;padding:8px 0">No hay entregas próximas.</p>`;
    delWrap.querySelectorAll('[data-nav-proj]').forEach(r => r.addEventListener('click', () => nav('proyectos')));
  }

  // facturas pendientes de pago
  const invWrap = root.querySelector('#dash-invoices');
  if (invWrap) {
    invWrap.innerHTML = pendInv.length
      ? pendInv.slice(0, 6).map(invoiceLine).join('')
      : `<p style="color:var(--muted);font-size:.87rem;padding:8px 0">No hay facturas pendientes de cobro 🎉</p>`;
    invWrap.querySelectorAll('[data-nav-inv]').forEach(r =>
      r.addEventListener('click', () => nav('facturas')));
  }

  root.querySelector('#dash-new-task').addEventListener('click', () => taskModal());
  root.querySelectorAll('[data-nav]').forEach(b =>
    b.addEventListener('click', () => nav(b.dataset.nav)));
}

function invoiceLine(i) {
  const overdue = i.status === 'pendiente' && i.due_date && i.due_date < todayISO();
  return `<div class="task-line" data-nav-inv="1" style="cursor:pointer">
    <span class="tl-title">${esc(i.number)} · ${esc(i.client_name)}</span>
    <span class="tl-meta" style="${overdue ? 'color:var(--red);font-weight:600' : ''}">${fmtEUR(i.total)}${i.due_date ? ' · vence ' + fmtDate(i.due_date) : ''}${overdue ? ' ⚠' : ''}</span>
  </div>`;
}

function projectLine(p) {
  return `<div class="task-line" data-nav-proj="1" style="cursor:pointer;align-items:center">
    <span class="tl-title">${esc(p.name)} <span style="color:var(--muted);font-weight:400">· ${esc(p.client)}</span></span>
    <span style="display:flex;align-items:center;gap:8px;flex:none">${progressBar(p.progress)}<span class="tl-meta">${p.progress}%</span></span>
  </div>`;
}

function deliveryLine(p) {
  const soon = p.due <= todayISO();
  return `<div class="task-line" data-nav-proj="1" style="cursor:pointer">
    <span class="tl-title">${esc(p.name)} <span style="color:var(--muted);font-weight:400">· ${esc(p.client)}</span></span>
    <span class="tl-meta" style="${soon ? 'color:var(--red);font-weight:600' : ''}">${fmtDate(p.due)}</span>
  </div>`;
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
