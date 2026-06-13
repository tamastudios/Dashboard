import { esc, avatarHTML, fmtDate, roleLabel, isOverdue, ICONS } from '../lib/ui.js';
import { state, companyById } from '../lib/store.js';
import { taskDetailModal } from './forms.js';

export function renderTeam(root) {
  root.innerHTML = `
    <div class="page-head">
      <div><h1>Equipo</h1><div class="sub">${state.profiles.length} miembro${state.profiles.length === 1 ? '' : 's'} · carga de trabajo y próximas entregas</div></div>
    </div>
    <div class="team-grid" id="team-grid"></div>`;

  const grid = root.querySelector('#team-grid');
  const maxLoad = Math.max(1, ...state.profiles.map(p =>
    state.tasks.filter(t => t.assigned_to === p.id && t.status !== 'completada').length));

  grid.innerHTML = state.profiles.map(p => {
    const mine = state.tasks.filter(t => t.assigned_to === p.id);
    const pending = mine.filter(t => t.status !== 'completada').length;
    const done = mine.filter(t => t.status === 'completada').length;
    const overdue = mine.filter(isOverdue).length;
    const next = mine
      .filter(t => t.due_date && t.status !== 'completada')
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .slice(0, 3);
    const loadPct = Math.round((pending / maxLoad) * 100);

    return `<div class="card team-card">
      <div class="t-head">
        ${avatarHTML(p, 'lg')}
        <div>
          <div class="t-name">${esc(p.name || p.email)}</div>
          <div style="color:var(--muted);font-size:.8rem">${esc(roleLabel(p.role))}${p.email ? ' · ' + esc(p.email) : ''}</div>
        </div>
      </div>
      <div class="t-stats">
        <div class="t-stat"><div class="n">${pending}</div><div class="l">Pendientes</div></div>
        <div class="t-stat"><div class="n">${done}</div><div class="l">Hechas</div></div>
        <div class="t-stat"><div class="n" style="color:${overdue ? 'var(--red)' : 'inherit'}">${overdue}</div><div class="l">Vencidas</div></div>
      </div>
      <div style="font-size:.74rem;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.04em">Carga de trabajo</div>
      <div class="workload"><b style="width:${loadPct}%"></b></div>
      <div style="font-size:.78rem;font-weight:600;margin-bottom:6px">Próximas entregas</div>
      <ul class="t-next">
        ${next.length ? next.map(t => {
          const comp = companyById(t.company_id);
          return `<li data-id="${t.id}" style="cursor:pointer">
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.title)}${comp ? ` · ${esc(comp.name)}` : ''}</span>
            <span style="${isOverdue(t) ? 'color:var(--red);font-weight:600' : ''};flex:none">${fmtDate(t.due_date)}</span>
          </li>`;
        }).join('') : '<li style="color:var(--muted)">Sin entregas próximas</li>'}
      </ul>
    </div>`;
  }).join('') || `<div class="empty"><div class="ico">👥</div><h3>Sin miembros</h3><p>Los miembros aparecen aquí cuando se registran en Supabase.</p></div>`;

  grid.querySelectorAll('[data-id]').forEach(li =>
    li.addEventListener('click', () => taskDetailModal(li.dataset.id)));
}
