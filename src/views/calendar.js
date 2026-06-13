import { esc, todayISO, priorityMeta, statusMeta, ICONS } from '../lib/ui.js';
import { state, companyById } from '../lib/store.js';
import { taskModal, taskDetailModal } from './forms.js';

const COLORS = { gray: 'var(--gray)', blue: 'var(--blue)', purple: 'var(--purple)', red: 'var(--red)', green: 'var(--green)', orange: 'var(--orange)', yellow: 'var(--yellow)' };
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

let cursor = new Date();
let mode = 'month';
let colorBy = 'priority';

export function renderCalendar(root) {
  root.innerHTML = `
    <div class="page-head">
      <div><h1>Calendario</h1><div class="sub">Tareas organizadas por fecha límite</div></div>
      <div class="page-actions"><button class="btn btn-primary" id="cal-new">${ICONS.plus} Nueva tarea</button></div>
    </div>
    <div class="cal-head">
      <button class="btn btn-ghost btn-sm" id="cal-prev">‹</button>
      <button class="btn btn-ghost btn-sm" id="cal-today">Hoy</button>
      <button class="btn btn-ghost btn-sm" id="cal-next">›</button>
      <h2 id="cal-label"></h2>
      <select id="cal-colorby" style="margin-left:8px;background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:6px 10px;font-size:.82rem">
        <option value="priority">Color por prioridad</option>
        <option value="status">Color por estado</option>
      </select>
      <div class="cal-views">
        <button data-mode="month" class="${mode === 'month' ? 'active' : ''}">Mes</button>
        <button data-mode="week" class="${mode === 'week' ? 'active' : ''}">Semana</button>
      </div>
    </div>
    <div id="cal-body"></div>`;

  root.querySelector('#cal-new').addEventListener('click', () => taskModal());
  root.querySelector('#cal-prev').addEventListener('click', () => { shift(-1); paint(root); });
  root.querySelector('#cal-next').addEventListener('click', () => { shift(1); paint(root); });
  root.querySelector('#cal-today').addEventListener('click', () => { cursor = new Date(); paint(root); });
  root.querySelector('#cal-colorby').addEventListener('change', e => { colorBy = e.target.value; paint(root); });
  root.querySelectorAll('[data-mode]').forEach(b =>
    b.addEventListener('click', () => {
      mode = b.dataset.mode;
      root.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('active', x === b));
      paint(root);
    }));
  paint(root);
}

function shift(dir) {
  if (mode === 'month') cursor.setMonth(cursor.getMonth() + dir);
  else cursor.setDate(cursor.getDate() + dir * 7);
}

function isoOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function tasksOn(iso) {
  return state.tasks.filter(t => t.due_date === iso);
}
function evtColor(t) {
  const meta = colorBy === 'status' ? statusMeta(t.status) : priorityMeta(t.priority);
  return COLORS[meta.color] || 'var(--gray)';
}

function paint(root) {
  const label = root.querySelector('#cal-label');
  const bodyEl = root.querySelector('#cal-body');
  const today = todayISO();

  if (mode === 'month') {
    label.textContent = `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    let startDow = (first.getDay() + 6) % 7; // lunes=0
    const start = new Date(first); start.setDate(1 - startDow);

    let cells = '';
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const iso = isoOf(d);
      const other = d.getMonth() !== cursor.getMonth();
      const dayTasks = tasksOn(iso);
      const shown = dayTasks.slice(0, 3);
      const extra = dayTasks.length - shown.length;
      cells += `<div class="cal-day ${other ? 'other' : ''} ${iso === today ? 'today' : ''}" data-date="${iso}">
        <div class="d-num">${d.getDate()}</div>
        ${shown.map(t => evtHTML(t)).join('')}
        ${extra > 0 ? `<div class="cal-more">+${extra} más</div>` : ''}
      </div>`;
    }
    bodyEl.innerHTML = `<div class="cal-grid">
      ${DOW.map(d => `<div class="cal-dow">${d}</div>`).join('')}
      ${cells}
    </div>`;
  } else {
    // semana
    const monday = new Date(cursor);
    monday.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
    const end = new Date(monday); end.setDate(monday.getDate() + 6);
    label.textContent = `${monday.getDate()} ${MONTHS[monday.getMonth()].slice(0, 3)} – ${end.getDate()} ${MONTHS[end.getMonth()].slice(0, 3)}`;
    let cols = '';
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      const iso = isoOf(d);
      const dayTasks = tasksOn(iso);
      cols += `<div class="cw-day ${iso === today ? 'today' : ''}" data-date="${iso}">
        <div class="cw-head">${DOW[i]} <span class="n">${d.getDate()}</span></div>
        ${dayTasks.map(t => evtHTML(t, true)).join('') || '<div style="color:var(--muted);font-size:.78rem">—</div>'}
      </div>`;
    }
    bodyEl.innerHTML = `<div class="cal-week">${cols}</div>`;
  }

  // eventos → abrir detalle
  bodyEl.querySelectorAll('.cal-evt').forEach(e =>
    e.addEventListener('click', ev => { ev.stopPropagation(); taskDetailModal(e.dataset.id); }));
  // clic en día → nueva tarea con esa fecha
  bodyEl.querySelectorAll('[data-date]').forEach(cell =>
    cell.addEventListener('click', () => taskModal(null, { due_date: cell.dataset.date })));
}

function evtHTML(t, expanded = false) {
  const comp = companyById(t.company_id);
  const color = evtColor(t);
  const sub = expanded && comp ? ` · ${esc(comp.name)}` : '';
  return `<div class="cal-evt ${t.status === 'completada' ? 'done' : ''}" data-id="${t.id}"
    style="color:${color};background:color-mix(in srgb, ${color} 13%, transparent)"
    title="${esc(t.title)}">${esc(t.title)}${sub}</div>`;
}
