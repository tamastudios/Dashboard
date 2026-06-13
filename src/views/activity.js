import { esc, avatarHTML, relTime } from '../lib/ui.js';
import { state, profileById } from '../lib/store.js';

export function renderActivity(root) {
  root.innerHTML = `
    <div class="page-head">
      <div><h1>Actividad</h1><div class="sub">Historial de cambios del equipo</div></div>
    </div>
    <div class="card" id="act-card"></div>`;

  const card = root.querySelector('#act-card');
  if (!state.activity.length) {
    card.innerHTML = `<div class="empty" style="border:none"><div class="ico">📋</div><h3>Sin actividad</h3><p>Cuando el equipo cree o edite empresas y tareas, el historial aparecerá aquí.</p></div>`;
    return;
  }

  // agrupar por día
  const groups = {};
  for (const a of state.activity) {
    const day = a.created_at.slice(0, 10);
    (groups[day] = groups[day] || []).push(a);
  }
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const dayLabel = d => d === today ? 'Hoy' : d === yesterday ? 'Ayer'
    : new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  card.innerHTML = Object.entries(groups).map(([day, items]) => `
    <div style="font-size:.74rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:16px 0 6px">${esc(dayLabel(day))}</div>
    ${items.map(a => {
      const author = profileById(a.user_id);
      return `<div class="activity-item">
        ${avatarHTML(author, 'sm')}
        <div class="a-body">
          <div class="a-text"><b>${esc(a.user_name || 'Alguien')}</b> ${esc(a.action)} <b>${esc(a.entity_name)}</b>${a.detail ? ' ' + esc(a.detail) : ''}</div>
          <div class="a-time">${relTime(a.created_at)}</div>
        </div>
      </div>`;
    }).join('')}
  `).join('');
}
