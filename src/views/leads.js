import {
  esc, el, fmtEUR, fmtDate, statusBadge, STATUS_META, openModal,
  toast, confirmDialog, debounce, ICONS
} from '../lib/ui.js';
import { SERVICES } from '../lib/mock.js';
import { state, isStaff, profileById, createLead, updateLead, deleteLead } from '../lib/store.js';

const STAGES = ['nuevo', 'contactado', 'cualificado', 'propuesta', 'ganado', 'perdido'];
let filters = { q: '', status: 'all' };

export function renderLeads(root) {
  const all = state.leads;
  const open = all.filter(l => !['ganado', 'perdido'].includes(l.status));
  const won = all.filter(l => l.status === 'ganado');
  const sum = arr => arr.reduce((s, l) => s + (Number(l.value) || 0), 0);

  root.innerHTML = `
    <div class="page-head">
      <div><h1>Leads</h1><div class="sub">${all.length} leads · ${fmtEUR(sum(all))} en pipeline</div></div>
      <div class="page-actions">${isStaff() ? `<button class="btn btn-primary" id="new-lead">${ICONS.plus} Nuevo lead</button>` : ''}</div>
    </div>
    <div class="stats-grid">
      ${kpi(open.length, 'Leads abiertos', ICONS.leads, 'blue')}
      ${kpi(fmtEUR(sum(open)), 'Pipeline activo', ICONS.euro, 'orange')}
      ${kpi(won.length, 'Ganados', ICONS.check, 'green')}
      ${kpi(fmtEUR(sum(won)), 'Valor ganado', ICONS.dashboard, 'purple')}
    </div>
    <div class="filters">
      <input type="search" id="f-q" placeholder="Buscar lead…" value="${esc(filters.q)}">
      <select id="f-status"><option value="all">Todas las etapas</option>${STAGES.map(s => `<option value="${s}"${filters.status === s ? ' selected' : ''}>${STATUS_META[s].label}</option>`).join('')}</select>
    </div>
    <div id="ld-body"></div>`;

  root.querySelector('#new-lead')?.addEventListener('click', () => leadModal());
  root.querySelector('#f-q').addEventListener('input', debounce(e => { filters.q = e.target.value; paint(root); }, 180));
  root.querySelector('#f-status').addEventListener('change', e => { filters.status = e.target.value; paint(root); });
  paint(root);
}

const kpi = (num, label, icon, color) =>
  `<div class="card stat-card"><div class="stat-icon" style="background:var(--${color}-soft);color:var(--${color})">${icon}</div><div class="num">${esc(num)}</div><div class="lbl">${esc(label)}</div></div>`;

function paint(root) {
  const body = root.querySelector('#ld-body');
  let list = [...state.leads];
  if (filters.q) { const q = filters.q.toLowerCase(); list = list.filter(l => [l.name, l.contact, l.service, l.source].some(v => String(v || '').toLowerCase().includes(q))); }
  if (filters.status !== 'all') list = list.filter(l => l.status === filters.status);
  list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

  if (!list.length) {
    body.innerHTML = state.leads.length
      ? `<div class="empty"><div class="ico">🔍</div><h3>Sin resultados</h3><p>Ningún lead coincide con los filtros.</p></div>`
      : `<div class="empty"><div class="ico">🎯</div><h3>Aún no hay leads</h3><p>Crea tu primer lead para empezar a gestionar el pipeline comercial.</p>${isStaff() ? `<button class="btn btn-primary" id="empty-new">${ICONS.plus} Nuevo lead</button>` : ''}<p style="margin-top:10px;font-size:.78rem;color:var(--muted)">Si es la primera vez, ejecuta <code>supabase/leads.sql</code>.</p></div>`;
    body.querySelector('#empty-new')?.addEventListener('click', () => leadModal());
    return;
  }

  body.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Empresa</th><th>Fuente</th><th>Servicio</th><th style="text-align:right">Valor</th><th>Estado</th><th>Próxima acción</th><th>Resp.</th><th></th></tr></thead>
    <tbody>${list.map(l => {
      const owner = profileById(l.owner_id);
      return `<tr data-id="${esc(l.id)}">
        <td><div class="cell-strong">${esc(l.name)}</div>${l.contact ? `<div class="cell-muted">${esc(l.contact)}</div>` : ''}</td>
        <td>${l.source ? `<span class="pill">${esc(l.source)}</span>` : '<span class="cell-muted">—</span>'}</td>
        <td>${esc(l.service || '—')}</td>
        <td style="text-align:right" class="cell-mono">${fmtEUR(l.value)}</td>
        <td>${isStaff()
          ? `<select class="mini-select ld-st" data-id="${esc(l.id)}">${STAGES.map(s => `<option value="${s}"${l.status === s ? ' selected' : ''}>${STATUS_META[s].label}</option>`).join('')}</select>`
          : statusBadge(l.status)}</td>
        <td>${l.next_action ? `<div>${esc(l.next_action)}</div>` : ''}${l.next_date ? `<div class="cell-muted">${fmtDate(l.next_date)}</div>` : (l.next_action ? '' : '<span class="cell-muted">—</span>')}</td>
        <td>${owner ? esc((owner.name || owner.email).split(' ')[0]) : '<span class="cell-muted">—</span>'}</td>
        <td><div class="row-actions">${isStaff() ? `<button class="icon-btn edit" title="Editar">${ICONS.edit}</button><button class="icon-btn del" title="Eliminar" style="color:var(--red)">${ICONS.trash}</button>` : ''}</div></td>
      </tr>`;
    }).join('')}</tbody></table></div>`;

  body.querySelectorAll('tbody tr').forEach(tr => {
    const l = state.leads.find(x => x.id === tr.dataset.id);
    if (!l) return;
    if (!isStaff()) return;
    tr.querySelector('.ld-st').addEventListener('click', e => e.stopPropagation());
    tr.querySelector('.ld-st').addEventListener('change', async e => { try { await updateLead(l.id, { status: e.target.value }); toast('Estado actualizado'); } catch { toast('No se pudo actualizar', 'err'); } });
    tr.querySelector('.edit').addEventListener('click', e => { e.stopPropagation(); leadModal(l); });
    tr.querySelector('.del').addEventListener('click', async e => { e.stopPropagation(); if (await confirmDialog(`Se eliminará el lead "${l.name}".`)) { try { await deleteLead(l.id); toast('Lead eliminado'); } catch { toast('No se pudo eliminar', 'err'); } } });
    tr.addEventListener('click', () => leadModal(l));
  });
}

function leadModal(lead = null) {
  const isEdit = !!lead;
  const l = lead || {};
  const peopleOpt = (sel) => `<option value="">— Sin asignar —</option>` + state.profiles.map(p => `<option value="${p.id}"${p.id === sel ? ' selected' : ''}>${esc(p.name || p.email)}</option>`).join('');
  const serviceOpt = (sel) => `<option value="">— Servicio —</option>` + SERVICES.map(s => `<option value="${esc(s)}"${s === sel ? ' selected' : ''}>${esc(s)}</option>`).join('');
  const body = el('form', { id: 'lead-form', novalidate: '' });
  body.innerHTML = `
    <div class="fld"><label>Empresa / lead *</label><input name="name" value="${esc(l.name || '')}" required><span class="err">El nombre es obligatorio.</span></div>
    <div class="form-grid">
      <div class="fld"><label>Contacto</label><input name="contact" value="${esc(l.contact || '')}"></div>
      <div class="fld"><label>Email</label><input type="email" name="email" value="${esc(l.email || '')}"></div>
      <div class="fld"><label>Teléfono</label><input name="phone" value="${esc(l.phone || '')}"></div>
      <div class="fld"><label>Fuente</label><input name="source" value="${esc(l.source || '')}" placeholder="Instagram, referido…"></div>
      <div class="fld"><label>Servicio de interés</label><select name="service">${serviceOpt(l.service)}</select></div>
      <div class="fld"><label>Valor estimado (€)</label><input type="number" name="value" min="0" step="50" value="${esc(l.value ?? '')}"></div>
      <div class="fld"><label>Etapa</label><select name="status">${STAGES.map(s => `<option value="${s}"${(l.status || 'nuevo') === s ? ' selected' : ''}>${STATUS_META[s].label}</option>`).join('')}</select></div>
      <div class="fld"><label>Responsable</label><select name="owner_id">${peopleOpt(l.owner_id)}</select></div>
      <div class="fld"><label>Próxima acción</label><input name="next_action" value="${esc(l.next_action || '')}"></div>
      <div class="fld"><label>Fecha próxima acción</label><input type="date" name="next_date" value="${esc(l.next_date || '')}"></div>
    </div>
    <div class="fld"><label>Notas</label><textarea name="notes">${esc(l.notes || '')}</textarea></div>`;

  const foot = el('div', { style: 'display:flex;gap:10px' });
  const cancel = el('button', { class: 'btn btn-ghost', type: 'button' }, 'Cancelar');
  const save = el('button', { class: 'btn btn-primary', type: 'submit', form: 'lead-form' }, isEdit ? 'Guardar' : 'Crear lead');
  foot.append(cancel, save);
  const m = openModal({ title: isEdit ? 'Editar lead' : 'Nuevo lead', body, footer: foot, wide: true });
  cancel.addEventListener('click', m.close);

  body.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(body);
    const name = fd.get('name').trim();
    if (!name) { body.querySelector('.fld').classList.add('invalid'); return; }
    const fields = {
      name, contact: fd.get('contact').trim() || null, email: fd.get('email').trim() || null,
      phone: fd.get('phone').trim() || null, source: fd.get('source').trim() || null,
      service: fd.get('service') || null, value: Number(fd.get('value')) || 0, status: fd.get('status'),
      owner_id: fd.get('owner_id') || null, next_action: fd.get('next_action').trim() || null,
      next_date: fd.get('next_date') || null, notes: fd.get('notes').trim() || null
    };
    save.disabled = true;
    try { if (isEdit) { await updateLead(l.id, fields); toast('Lead actualizado'); } else { await createLead(fields); toast('Lead creado'); } m.close(); }
    catch (err) { toast(err.message || 'Error al guardar', 'err'); save.disabled = false; }
  });
}
