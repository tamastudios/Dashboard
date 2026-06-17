import { esc, fmtDate, relTime, chip, todayISO, debounce, toast, confirmDialog, ICONS } from '../lib/ui.js';
import { state, isStaff, updateReservation, deleteReservation } from '../lib/store.js';

const RES_ST = [
  { id: 'pendiente',  label: 'Pendiente',  color: 'orange' },
  { id: 'confirmada', label: 'Confirmada', color: 'green' },
  { id: 'cancelada',  label: 'Cancelada',  color: 'gray' },
  { id: 'no_show',    label: 'No-show',    color: 'red' }
];
const stMeta = id => RES_ST.find(s => s.id === id) || RES_ST[0];
let filters = { q: '', status: 'all', restaurant: 'all' };

export function renderReservations(root) {
  const all = state.reservations;
  const today = todayISO();
  const future = (r) => (r.res_date || '') >= today && r.status !== 'cancelada';
  const in7 = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); })();

  root.innerHTML = `
    <div class="page-head">
      <div><h1>Reservas</h1><div class="sub">${all.length} reservas · web y WhatsApp en un solo sitio</div></div>
    </div>
    <div class="stats-grid">
      ${kpi(all.filter(r => r.res_date === today && r.status !== 'cancelada').length, 'Hoy', ICONS.reservations, 'blue')}
      ${kpi(all.filter(r => future(r) && r.res_date <= in7).length, 'Próximos 7 días', ICONS.calendar, 'purple')}
      ${kpi(all.filter(r => r.status === 'pendiente').length, 'Pendientes', ICONS.clock, 'orange')}
      ${kpi(all.filter(r => r.status === 'confirmada' && future(r)).length, 'Confirmadas', ICONS.check, 'green')}
    </div>
    <div class="filters">
      <input type="search" id="f-q" placeholder="Buscar por nombre o teléfono…" value="${esc(filters.q)}">
      <select id="f-rest"><option value="all">Todos los restaurantes</option>${[...new Set(all.map(r => r.restaurant))].map(rt => `<option value="${esc(rt)}"${filters.restaurant === rt ? ' selected' : ''}>${esc(rt)}</option>`).join('')}</select>
      <select id="f-status"><option value="all">Todos los estados</option>${RES_ST.map(s => `<option value="${s.id}"${filters.status === s.id ? ' selected' : ''}>${s.label}</option>`).join('')}</select>
    </div>
    <div id="rs-body"></div>`;

  root.querySelector('#f-q').addEventListener('input', debounce(e => { filters.q = e.target.value; paint(root); }, 180));
  root.querySelector('#f-rest').addEventListener('change', e => { filters.restaurant = e.target.value; paint(root); });
  root.querySelector('#f-status').addEventListener('change', e => { filters.status = e.target.value; paint(root); });
  paint(root);
}

const kpi = (num, label, icon, color) =>
  `<div class="card stat-card"><div class="stat-icon" style="background:var(--${color}-soft);color:var(--${color})">${icon}</div><div class="num">${num}</div><div class="lbl">${label}</div></div>`;

function paint(root) {
  const body = root.querySelector('#rs-body');
  let list = [...state.reservations];
  if (filters.q) { const q = filters.q.toLowerCase(); list = list.filter(r => [r.name, r.phone].some(v => String(v || '').toLowerCase().includes(q))); }
  if (filters.restaurant !== 'all') list = list.filter(r => r.restaurant === filters.restaurant);
  if (filters.status !== 'all') list = list.filter(r => r.status === filters.status);
  list.sort((a, b) => (a.res_date || '').localeCompare(b.res_date || '') || (a.res_time || '').localeCompare(b.res_time || ''));

  if (!list.length) {
    body.innerHTML = state.reservations.length
      ? `<div class="empty"><div class="ico">🔍</div><h3>Sin resultados</h3><p>Ninguna reserva coincide con los filtros.</p></div>`
      : `<div class="empty"><div class="ico">🍽️</div><h3>Aún no hay reservas</h3><p>Las reservas de la web y de WhatsApp aparecerán aquí en tiempo real.</p><p style="margin-top:10px;font-size:.78rem;color:var(--muted)">Si es la primera vez, ejecuta <code>supabase/reservations.sql</code> y despliega la función <code>reservation-intake</code>.</p></div>`;
    return;
  }

  body.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Restaurante</th><th>Cliente</th><th>Fecha</th><th align="center">Comensales</th><th>Estado</th><th>Origen</th><th>Recibida</th><th></th></tr></thead>
    <tbody>${list.map(r => {
      const past = (r.res_date || '') < todayISO();
      return `<tr data-id="${esc(r.id)}"${past ? ' style="opacity:.6"' : ''}>
        <td>${esc(r.restaurant)}</td>
        <td><div class="cell-strong">${esc(r.name)}</div><div class="cell-muted">${r.phone ? `<a href="tel:${esc(r.phone)}" style="color:inherit">${esc(r.phone)}</a>` : ''}</div></td>
        <td class="cell-mono" style="white-space:nowrap">${fmtDate(r.res_date)} · ${esc(r.res_time || '')}</td>
        <td style="text-align:center">${esc(r.people)}</td>
        <td>${isStaff()
          ? `<select class="mini-select rs-st" data-id="${esc(r.id)}">${RES_ST.map(s => `<option value="${s.id}"${r.status === s.id ? ' selected' : ''}>${s.label}</option>`).join('')}</select>`
          : chip(stMeta(r.status))}</td>
        <td><span class="pill">${esc(r.source)}</span></td>
        <td class="cell-muted" style="white-space:nowrap">${esc(relTime(r.created_at))}</td>
        <td><div class="row-actions">${r.notes ? `<button class="icon-btn note" title="Ver notas">${ICONS.search}</button>` : ''}${isStaff() ? `<button class="icon-btn del" title="Eliminar" style="color:var(--red)">${ICONS.trash}</button>` : ''}</div></td>
      </tr>`;
    }).join('')}</tbody></table></div>`;

  body.querySelectorAll('tbody tr').forEach(tr => {
    const r = state.reservations.find(x => x.id === tr.dataset.id);
    if (!r) return;
    tr.querySelector('.note')?.addEventListener('click', () => toast(r.notes || '—'));
    if (!isStaff()) return;
    tr.querySelector('.rs-st').addEventListener('change', async e => {
      try { await updateReservation(r.id, { status: e.target.value }); toast('Reserva actualizada'); }
      catch { toast('No se pudo actualizar', 'err'); paint(root); }
    });
    tr.querySelector('.del').addEventListener('click', async () => {
      if (await confirmDialog(`Eliminar la reserva de "${r.name}" (${fmtDate(r.res_date)})?`)) {
        try { await deleteReservation(r.id); toast('Reserva eliminada'); } catch { toast('No se pudo eliminar', 'err'); }
      }
    });
  });
}
