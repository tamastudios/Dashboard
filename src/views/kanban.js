import {
  esc, chip, fmtDate, avatarHTML, isOverdue, toast,
  priorityMeta, TASK_STATUSES, ICONS
} from '../lib/ui.js';
import { state, companyById, profileById, moveTask } from '../lib/store.js';
import { taskModal, taskDetailModal } from './forms.js';

const COLORS = { gray: 'var(--gray)', blue: 'var(--blue)', purple: 'var(--purple)', red: 'var(--red)', green: 'var(--green)' };

export function renderKanban(root) {
  root.innerHTML = `
    <div class="page-head">
      <div><h1>Kanban</h1><div class="sub">Arrastra las tarjetas para cambiar su estado</div></div>
      <div class="page-actions"><button class="btn btn-primary" id="kb-new">${ICONS.plus} Nueva tarea</button></div>
    </div>
    <div class="kanban" id="kanban"></div>`;

  root.querySelector('#kb-new').addEventListener('click', () => taskModal());
  paint(root);
}

function paint(root) {
  const board = root.querySelector('#kanban');
  board.innerHTML = TASK_STATUSES.map(s => {
    const items = state.tasks.filter(t => t.status === s.id);
    return `<div class="kb-col" data-status="${s.id}">
      <div class="kb-col-head">
        <span class="dot" style="background:${COLORS[s.color]}"></span>
        ${s.label} <span class="count">${items.length}</span>
      </div>
      <div class="kb-cards" data-drop="${s.id}">
        ${items.map(cardHTML).join('')}
      </div>
    </div>`;
  }).join('');

  // click para detalle
  board.querySelectorAll('.kb-card').forEach(card => {
    card.addEventListener('click', e => {
      if (card.dataset.dragging) return;
      taskDetailModal(card.dataset.id);
    });
    card.addEventListener('dragstart', e => {
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', card.dataset.id);
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });

  // zonas de drop
  board.querySelectorAll('.kb-col').forEach(col => {
    const status = col.dataset.status;
    col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drag-over'); });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', async e => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const id = e.dataTransfer.getData('text/plain');
      const task = state.tasks.find(t => t.id === id);
      if (!task || task.status === status) return;
      const meta = TASK_STATUSES.find(s => s.id === status);
      try { await moveTask(id, status, meta.label); }
      catch { toast('No se pudo mover', 'err'); }
    });
  });
}

function cardHTML(t) {
  const comp = companyById(t.company_id);
  const who = profileById(t.assigned_to);
  const overdue = isOverdue(t);
  return `<div class="kb-card" draggable="true" data-id="${t.id}">
    <div class="kc-title">${esc(t.title)}</div>
    <div class="kc-meta">
      ${chip(priorityMeta(t.priority))}
      ${comp ? `<span class="chip chip-gray">${esc(comp.name)}</span>` : ''}
    </div>
    <div class="kc-foot">
      <span class="kc-due ${overdue ? 'overdue' : ''}">${t.due_date ? (overdue ? '⚠ ' : '') + fmtDate(t.due_date) : ''}</span>
      ${who ? avatarHTML(who, 'sm') : ''}
    </div>
  </div>`;
}
