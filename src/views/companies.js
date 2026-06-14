import {
  esc, chip, fmtDate, avatarHTML, confirmDialog, toast, debounce, safeUrl,
  companyStatusMeta, priorityMeta, COMPANY_STATUSES, ICONS
} from '../lib/ui.js';
import { state, profileById, deleteCompany, isStaff } from '../lib/store.js';
import { companyModal } from './forms.js';

let filters = { q: '', status: 'all', sort: 'created_desc' };

export function renderCompanies(root) {
  root.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Empresas</h1>
        <div class="sub">${state.companies.length} empresa${state.companies.length === 1 ? '' : 's'} registrada${state.companies.length === 1 ? '' : 's'}</div>
      </div>
      <div class="page-actions">
        ${isStaff() ? `<button class="btn btn-primary" id="new-company">${ICONS.plus} Nueva empresa</button>` : ''}
      </div>
    </div>

    <div class="filters">
      <input type="search" id="f-q" placeholder="Buscar empresa…" value="${esc(filters.q)}" />
      <select id="f-status">
        <option value="all">Todos los estados</option>
        ${COMPANY_STATUSES.map(s => `<option value="${s.id}"${filters.status === s.id ? ' selected' : ''}>${s.label}</option>`).join('')}
      </select>
      <select id="f-sort">
        <option value="created_desc">Más recientes</option>
        <option value="name">Nombre A-Z</option>
        <option value="priority">Prioridad</option>
      </select>
    </div>

    <div id="companies-body"></div>`;

  root.querySelector('#new-company')?.addEventListener('click', () => companyModal());
  root.querySelector('#f-q').addEventListener('input', debounce(e => { filters.q = e.target.value; paint(root); }, 200));
  root.querySelector('#f-status').addEventListener('change', e => { filters.status = e.target.value; paint(root); });
  root.querySelector('#f-sort').addEventListener('change', e => { filters.sort = e.target.value; paint(root); });
  paint(root);
}

function paint(root) {
  const body = root.querySelector('#companies-body');
  let list = [...state.companies];

  if (filters.q) {
    const q = filters.q.toLowerCase();
    list = list.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.contact_person || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q));
  }
  if (filters.status !== 'all') list = list.filter(c => c.status === filters.status);

  const prioRank = { urgente: 0, alta: 1, media: 2, baja: 3 };
  if (filters.sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
  else if (filters.sort === 'priority') list.sort((a, b) => (prioRank[a.priority] ?? 9) - (prioRank[b.priority] ?? 9));
  else list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

  if (!list.length) {
    body.innerHTML = state.companies.length
      ? `<div class="empty"><div class="ico">🔍</div><h3>Sin resultados</h3><p>Ninguna empresa coincide con los filtros.</p></div>`
      : `<div class="empty"><div class="ico">🏢</div><h3>Aún no hay empresas</h3><p>Crea tu primera empresa o cliente para empezar a organizar el trabajo.</p><button class="btn btn-primary" id="empty-new">${ICONS.plus} Nueva empresa</button></div>`;
    body.querySelector('#empty-new')?.addEventListener('click', () => companyModal());
    return;
  }

  body.innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr>
        <th>Empresa</th><th>Contacto</th><th>Estado</th><th>Prioridad</th>
        <th>Responsable</th><th>Creada</th><th></th>
      </tr></thead>
      <tbody>
        ${list.map(c => {
          const owner = profileById(c.owner_id);
          return `<tr data-id="${c.id}">
            <td>
              <div style="font-weight:600">${esc(c.name)}</div>
              ${c.website && safeUrl(c.website) ? `<a href="${esc(safeUrl(c.website))}" target="_blank" rel="noopener nofollow" style="font-size:.78rem;color:var(--primary)" onclick="event.stopPropagation()">${esc(c.website.replace(/^https?:\/\//, ''))}</a>` : ''}
            </td>
            <td>
              ${c.contact_person ? `<div>${esc(c.contact_person)}</div>` : ''}
              ${c.email ? `<div style="font-size:.78rem;color:var(--muted)">${esc(c.email)}</div>` : ''}
              ${!c.contact_person && !c.email ? '<span style="color:var(--muted)">—</span>' : ''}
            </td>
            <td>${chip(companyStatusMeta(c.status))}</td>
            <td>${chip(priorityMeta(c.priority))}</td>
            <td>${owner ? `<div style="display:flex;align-items:center;gap:7px">${avatarHTML(owner, 'sm')}<span style="font-size:.82rem">${esc((owner.name || owner.email).split(' ')[0])}</span></div>` : '<span style="color:var(--muted)">—</span>'}</td>
            <td style="color:var(--muted);font-size:.82rem">${fmtDate(c.created_at)}</td>
            <td><div class="row-actions">
              ${isStaff() ? `<button class="icon-btn edit" title="Editar">${ICONS.edit}</button>
              <button class="icon-btn del" title="Eliminar" style="color:var(--red)">${ICONS.trash}</button>` : ''}
            </div></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>`;

  body.querySelectorAll('tbody tr').forEach(tr => {
    const c = state.companies.find(x => x.id === tr.dataset.id);
    if (!isStaff()) return;   // los colaboradores solo consultan la cartera
    tr.querySelector('.edit').addEventListener('click', e => { e.stopPropagation(); companyModal(c); });
    tr.querySelector('.del')?.addEventListener('click', async e => {
      e.stopPropagation();
      const linked = state.tasks.filter(t => t.company_id === c.id).length;
      const warn = linked ? ` Tiene ${linked} tarea(s) asociada(s) que quedarán sin empresa.` : '';
      if (await confirmDialog(`Se eliminará "${c.name}".${warn}`)) {
        try { await deleteCompany(c.id); toast('Empresa eliminada'); }
        catch { toast('No se pudo eliminar', 'err'); }
      }
    });
    tr.addEventListener('click', () => companyModal(c));
  });
}
