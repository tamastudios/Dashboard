/* ============================================================
   forms.js — modales de creación/edición de empresas y tareas,
   y modal de detalle de tarea con comentarios.
   ============================================================ */
import {
  el, esc, openModal, toast, todayISO, confirmDialog,
  TASK_STATUSES, PRIORITIES, COMPANY_STATUSES,
  statusMeta, priorityMeta, companyStatusMeta, chip, fmtDate, avatarHTML, relTime
} from '../lib/ui.js';
import {
  state, createCompany, updateCompany, createTask, updateTask, deleteTask,
  companyById, profileById, loadComments, addComment, onChange
} from '../lib/store.js';

const opt = (list, sel) => list.map(o =>
  `<option value="${o.id}"${o.id === sel ? ' selected' : ''}>${esc(o.label)}</option>`).join('');

const peopleOpt = (sel) => `<option value="">— Sin asignar —</option>` +
  state.profiles.map(p =>
    `<option value="${p.id}"${p.id === sel ? ' selected' : ''}>${esc(p.name || p.email)}</option>`).join('');

const companyOpt = (sel) => `<option value="">— Sin empresa —</option>` +
  state.companies.map(c =>
    `<option value="${c.id}"${c.id === sel ? ' selected' : ''}>${esc(c.name)}</option>`).join('');

/* ============================================================
   EMPRESA
   ============================================================ */
export function companyModal(company = null) {
  const isEdit = !!company;
  const c = company || {};
  const body = el('form', { id: 'company-form', novalidate: '' });
  body.innerHTML = `
    <div class="fld">
      <label>Nombre de la empresa *</label>
      <input name="name" value="${esc(c.name || '')}" required />
      <span class="err">El nombre es obligatorio.</span>
    </div>
    <div class="form-grid">
      <div class="fld"><label>Persona de contacto</label><input name="contact_person" value="${esc(c.contact_person || '')}" /></div>
      <div class="fld"><label>Email</label><input type="email" name="email" value="${esc(c.email || '')}" /></div>
      <div class="fld"><label>Teléfono</label><input name="phone" value="${esc(c.phone || '')}" /></div>
      <div class="fld"><label>Web</label><input name="website" value="${esc(c.website || '')}" placeholder="https://" /></div>
      <div class="fld"><label>Estado</label><select name="status">${opt(COMPANY_STATUSES, c.status || 'prospecto')}</select></div>
      <div class="fld"><label>Prioridad</label><select name="priority">${opt(PRIORITIES, c.priority || 'media')}</select></div>
    </div>
    <div class="fld"><label>Responsable principal</label><select name="owner_id">${peopleOpt(c.owner_id)}</select></div>
    <div class="fld"><label>Notas internas</label><textarea name="notes">${esc(c.notes || '')}</textarea></div>
  `;

  const foot = el('div', { style: 'display:flex;gap:10px' });
  const cancel = el('button', { class: 'btn btn-ghost', type: 'button' }, 'Cancelar');
  const save = el('button', { class: 'btn btn-primary', type: 'submit', form: 'company-form' },
    isEdit ? 'Guardar cambios' : 'Crear empresa');
  foot.append(cancel, save);

  const m = openModal({ title: isEdit ? 'Editar empresa' : 'Nueva empresa', body, footer: foot });
  cancel.addEventListener('click', m.close);

  body.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(body);
    const name = fd.get('name').trim();
    const nameFld = body.querySelector('.fld');
    if (!name) { nameFld.classList.add('invalid'); return; }
    nameFld.classList.remove('invalid');

    const fields = {
      name,
      contact_person: fd.get('contact_person').trim() || null,
      email: fd.get('email').trim() || null,
      phone: fd.get('phone').trim() || null,
      website: fd.get('website').trim() || null,
      status: fd.get('status'),
      priority: fd.get('priority'),
      owner_id: fd.get('owner_id') || null,
      notes: fd.get('notes').trim() || null
    };
    save.disabled = true;
    try {
      if (isEdit) { await updateCompany(c.id, fields); toast('Empresa actualizada'); }
      else { await createCompany(fields); toast('Empresa creada'); }
      m.close();
    } catch (err) {
      toast(err.message || 'Error al guardar', 'err');
      save.disabled = false;
    }
  });
}

/* ============================================================
   TAREA (crear / editar)
   ============================================================ */
export function taskModal(task = null, defaults = {}) {
  const isEdit = !!task;
  const t = task || defaults;
  const body = el('form', { id: 'task-form', novalidate: '' });
  body.innerHTML = `
    <div class="fld">
      <label>Título *</label>
      <input name="title" value="${esc(t.title || '')}" required />
      <span class="err">El título es obligatorio.</span>
    </div>
    <div class="fld"><label>Descripción</label><textarea name="description">${esc(t.description || '')}</textarea></div>
    <div class="form-grid">
      <div class="fld"><label>Empresa / cliente</label><select name="company_id">${companyOpt(t.company_id)}</select></div>
      <div class="fld"><label>Responsable</label><select name="assigned_to">${peopleOpt(t.assigned_to)}</select></div>
      <div class="fld"><label>Estado</label><select name="status">${opt(TASK_STATUSES, t.status || 'pendiente')}</select></div>
      <div class="fld"><label>Prioridad</label><select name="priority">${opt(PRIORITIES, t.priority || 'media')}</select></div>
      <div class="fld"><label>Fecha límite</label><input type="date" name="due_date" value="${esc(t.due_date || '')}" /></div>
      <div class="fld"><label>Enlace (opcional)</label><input name="link_url" value="${esc(t.link_url || '')}" placeholder="https://" /></div>
    </div>
    <div class="fld"><label>Etiquetas (separadas por comas)</label><input name="labels" value="${esc((t.labels || []).join(', '))}" placeholder="diseño, urgente, web" /></div>
  `;

  const foot = el('div', { style: 'display:flex;gap:10px' });
  const cancel = el('button', { class: 'btn btn-ghost', type: 'button' }, 'Cancelar');
  const save = el('button', { class: 'btn btn-primary', type: 'submit', form: 'task-form' },
    isEdit ? 'Guardar cambios' : 'Crear tarea');
  foot.append(cancel, save);

  const m = openModal({ title: isEdit ? 'Editar tarea' : 'Nueva tarea', body, footer: foot, wide: true });
  cancel.addEventListener('click', m.close);

  body.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(body);
    const title = fd.get('title').trim();
    const titleFld = body.querySelector('.fld');
    if (!title) { titleFld.classList.add('invalid'); return; }
    titleFld.classList.remove('invalid');

    const labels = fd.get('labels').split(',').map(s => s.trim()).filter(Boolean);
    const fields = {
      title,
      description: fd.get('description').trim() || null,
      company_id: fd.get('company_id') || null,
      assigned_to: fd.get('assigned_to') || null,
      status: fd.get('status'),
      priority: fd.get('priority'),
      due_date: fd.get('due_date') || null,
      link_url: fd.get('link_url').trim() || null,
      labels
    };
    save.disabled = true;
    try {
      if (isEdit) { await updateTask(t.id, fields); toast('Tarea actualizada'); }
      else { await createTask(fields); toast('Tarea creada'); }
      m.close();
    } catch (err) {
      toast(err.message || 'Error al guardar', 'err');
      save.disabled = false;
    }
  });
}

/* ============================================================
   DETALLE DE TAREA + COMENTARIOS
   ============================================================ */
export async function taskDetailModal(taskId) {
  const t = state.tasks.find(x => x.id === taskId);
  if (!t) return;
  const comp = companyById(t.company_id);
  const assignee = profileById(t.assigned_to);

  const body = el('div');
  function paint() {
    const labels = (t.labels || []).length
      ? `<div class="labels-row" style="margin-top:6px">${t.labels.map(l => `<span class="label-tag">${esc(l)}</span>`).join('')}</div>` : '';
    body.innerHTML = `
      <div class="detail-grid">
        <div class="d-item"><div class="l">Estado</div>${chip(statusMeta(t.status))}</div>
        <div class="d-item"><div class="l">Prioridad</div>${chip(priorityMeta(t.priority))}</div>
        <div class="d-item"><div class="l">Empresa</div><div>${comp ? esc(comp.name) : '—'}</div></div>
        <div class="d-item"><div class="l">Responsable</div><div style="display:flex;align-items:center;gap:7px">${assignee ? avatarHTML(assignee, 'sm') + esc(assignee.name || assignee.email) : '—'}</div></div>
        <div class="d-item"><div class="l">Fecha límite</div><div>${fmtDate(t.due_date)}</div></div>
        <div class="d-item"><div class="l">Enlace</div><div>${t.link_url ? `<a href="${esc(t.link_url)}" target="_blank" rel="noopener" style="color:var(--primary)">Abrir ↗</a>` : '—'}</div></div>
      </div>
      ${t.description ? `<div class="detail-desc">${esc(t.description)}</div>` : ''}
      ${labels}
      <div class="comments">
        <h3>Comentarios</h3>
        <div id="cm-list"><div class="skeleton" style="height:40px"></div></div>
        <form class="comment-form" id="cm-form">
          <input id="cm-input" placeholder="Escribe un comentario…" autocomplete="off" />
          <button class="btn btn-primary btn-sm" type="submit">Enviar</button>
        </form>
      </div>`;
    wireComments();
  }

  async function wireComments() {
    const list = body.querySelector('#cm-list');
    const form = body.querySelector('#cm-form');
    const input = body.querySelector('#cm-input');
    try {
      const comments = await loadComments(taskId);
      if (!comments.length) {
        list.innerHTML = `<p style="color:var(--muted);font-size:.85rem">Sin comentarios todavía.</p>`;
      } else {
        list.innerHTML = comments.map(cm => {
          const author = profileById(cm.author);
          return `<div class="comment">
            ${avatarHTML(author, 'sm')}
            <div class="c-body">
              <div class="c-head"><span class="c-author">${esc(author?.name || 'Usuario')}</span><span class="c-time">${relTime(cm.created_at)}</span></div>
              <div class="c-text">${esc(cm.body)}</div>
            </div></div>`;
        }).join('');
      }
    } catch { list.innerHTML = `<p style="color:var(--red);font-size:.85rem">No se pudieron cargar los comentarios.</p>`; }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const txt = input.value.trim();
      if (!txt) return;
      input.value = '';
      try { await addComment(taskId, txt); wireComments(); }
      catch { toast('No se pudo enviar', 'err'); }
    });
  }

  const foot = el('div', { style: 'display:flex;gap:10px;width:100%;justify-content:space-between' });
  const left = el('div', { style: 'display:flex;gap:8px' });
  const editBtn = el('button', { class: 'btn btn-ghost btn-sm' }, 'Editar');
  const delBtn = el('button', { class: 'btn btn-ghost btn-sm', style: 'color:var(--red)' }, 'Eliminar');
  left.append(editBtn, delBtn);
  const doneBtn = el('button', { class: 'btn btn-primary btn-sm' },
    t.status === 'completada' ? 'Reabrir' : 'Marcar completada');
  foot.append(left, doneBtn);

  const m = openModal({ title: t.title, body, footer: foot, wide: true });
  paint();

  editBtn.addEventListener('click', () => { m.close(); taskModal(t); });
  delBtn.addEventListener('click', async () => {
    if (await confirmDialog(`Se eliminará la tarea "${t.title}".`)) {
      try { await deleteTask(t.id); toast('Tarea eliminada'); m.close(); }
      catch { toast('No se pudo eliminar', 'err'); }
    }
  });
  doneBtn.addEventListener('click', async () => {
    const next = t.status === 'completada' ? 'pendiente' : 'completada';
    try { await updateTask(t.id, { status: next }, next === 'completada' ? 'completó la tarea' : 'reabrió la tarea'); m.close(); }
    catch { toast('Error', 'err'); }
  });

  // refrescar si llega cambio por realtime mientras está abierto
  const off = onChange(() => {
    const fresh = state.tasks.find(x => x.id === taskId);
    if (fresh) { Object.assign(t, fresh); }
  });
  const origClose = m.close;
  m.close = () => { off(); origClose(); };
}
