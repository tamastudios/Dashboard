import {
  esc, fmtDate, relTime, statusBadge, chip, priorityMeta, PRIORITIES,
  STATUS_META, avatarHTML, openModal, toast, confirmDialog, debounce, safeUrl, ICONS
} from '../lib/ui.js';
import {
  state, isStaff, profileById, companyById, updateSupportRequest, deleteSupportRequest
} from '../lib/store.js';
import { incidentReportPDF } from './reports.js';

const ST = ['nuevo', 'abierto', 'progreso', 'resuelto', 'cerrado'];
const PR = ['baja', 'media', 'alta', 'urgente'];
let filters = { q: '', status: 'all', priority: 'all' };

export function renderTickets(root) {
  const all = state.supportRequests;
  const open = all.filter(t => ['nuevo', 'abierto', 'progreso'].includes(t.status));

  root.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Tickets</h1>
        <div class="sub">${all.length} solicitudes · ${open.length} abiertas</div>
      </div>
    </div>
    <div class="stats-grid">
      ${kpi(all.filter(t => t.status === 'nuevo').length, 'Nuevas', ICONS.bell, 'blue')}
      ${kpi(open.length, 'Abiertas', ICONS.tickets, 'orange')}
      ${kpi(all.filter(t => t.priority === 'urgente' && !['resuelto', 'cerrado'].includes(t.status)).length, 'Urgentes', ICONS.alert, 'red')}
      ${kpi(all.filter(t => t.status === 'resuelto' || t.status === 'cerrado').length, 'Resueltas', ICONS.check, 'green')}
    </div>
    <div class="filters">
      <input type="search" id="f-q" placeholder="Buscar por nombre, email o asunto…" value="${esc(filters.q)}">
      <select id="f-status"><option value="all">Todos los estados</option>${ST.map(s => `<option value="${s}"${filters.status === s ? ' selected' : ''}>${STATUS_META[s].label}</option>`).join('')}</select>
      <select id="f-priority"><option value="all">Todas las prioridades</option>${PR.map(p => `<option value="${p}"${filters.priority === p ? ' selected' : ''}>${priorityMeta(p).label}</option>`).join('')}</select>
    </div>
    <div id="tk-body"></div>`;

  root.querySelector('#f-q').addEventListener('input', debounce(e => { filters.q = e.target.value; paint(root); }, 180));
  root.querySelector('#f-status').addEventListener('change', e => { filters.status = e.target.value; paint(root); });
  root.querySelector('#f-priority').addEventListener('change', e => { filters.priority = e.target.value; paint(root); });
  paint(root);
}

function kpi(num, label, icon, color) {
  return `<div class="card stat-card"><div class="stat-icon" style="background:var(--${color}-soft);color:var(--${color})">${icon}</div><div class="num">${num}</div><div class="lbl">${label}</div></div>`;
}

function paint(root) {
  const body = root.querySelector('#tk-body');
  let list = [...state.supportRequests];
  if (filters.q) {
    const q = filters.q.toLowerCase();
    list = list.filter(t => [t.name, t.email, t.subject, t.message, t.client_name].some(v => String(v || '').toLowerCase().includes(q)));
  }
  if (filters.status !== 'all') list = list.filter(t => t.status === filters.status);
  if (filters.priority !== 'all') list = list.filter(t => t.priority === filters.priority);
  list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

  if (!list.length) {
    body.innerHTML = state.supportRequests.length
      ? `<div class="empty"><div class="ico">🔍</div><h3>Sin resultados</h3><p>Ninguna solicitud coincide con los filtros.</p></div>`
      : `<div class="empty"><div class="ico">🎫</div><h3>Aún no hay solicitudes</h3><p>Cuando un cliente escriba desde el formulario de soporte, aparecerá aquí en tiempo real.</p><p style="margin-top:10px;font-size:.78rem;color:var(--muted)">Configura la tabla <code>supabase/support.sql</code> y la función <code>support-intake</code>.</p></div>`;
    return;
  }

  body.innerHTML = `
    <div class="table-wrap"><table>
      <thead><tr>
        <th>Solicitante</th><th>Asunto</th><th>Canal</th><th>Prioridad</th><th>Estado</th><th>Responsable</th><th>Recibido</th><th></th>
      </tr></thead>
      <tbody>
        ${list.map(t => {
          const comp = companyById(t.company_id);
          const cliente = comp?.name || t.client_name || '';
          return `<tr data-id="${esc(t.id)}">
            <td><div class="cell-strong">${esc(t.name)}</div><div class="cell-muted">${esc(t.email)}</div></td>
            <td><div>${esc(t.subject || '(sin asunto)')}</div>${cliente ? `<div class="cell-muted">${esc(cliente)}</div>` : ''}</td>
            <td><span class="pill">${esc(t.source)}</span></td>
            <td>${isStaff()
              ? `<select class="mini-select tk-pri" data-id="${esc(t.id)}">${PR.map(p => `<option value="${p}"${t.priority === p ? ' selected' : ''}>${priorityMeta(p).label}</option>`).join('')}</select>`
              : chip(priorityMeta(t.priority))}</td>
            <td>${isStaff()
              ? `<select class="mini-select tk-st" data-id="${esc(t.id)}">${ST.map(s => `<option value="${s}"${t.status === s ? ' selected' : ''}>${STATUS_META[s].label}</option>`).join('')}</select>`
              : statusBadge(t.status)}</td>
            <td>${isStaff()
              ? `<select class="mini-select tk-asg" data-id="${esc(t.id)}"><option value="">— Sin asignar —</option>${state.profiles.map(p => `<option value="${p.id}"${t.assigned_to === p.id ? ' selected' : ''}>${esc(p.name || p.email)}</option>`).join('')}</select>`
              : '—'}</td>
            <td class="cell-muted" style="white-space:nowrap">${relTime(t.created_at)}</td>
            <td><div class="row-actions">
              <button class="icon-btn view" title="Ver">${ICONS.search}</button>
              ${isStaff() ? `<button class="icon-btn del" title="Eliminar" style="color:var(--red)">${ICONS.trash}</button>` : ''}
            </div></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>`;

  body.querySelectorAll('tbody tr').forEach(tr => {
    const t = state.supportRequests.find(x => x.id === tr.dataset.id);
    if (!t) return;
    tr.querySelector('.view').addEventListener('click', e => { e.stopPropagation(); detailModal(t); });
    tr.addEventListener('click', () => detailModal(t));
    if (!isStaff()) return;
    ['tk-pri', 'tk-st', 'tk-asg'].forEach(c => tr.querySelector('.' + c)?.addEventListener('click', e => e.stopPropagation()));
    tr.querySelector('.tk-pri').addEventListener('change', async e => { e.stopPropagation(); try { await updateSupportRequest(t.id, { priority: e.target.value }); } catch { toast('No se pudo actualizar', 'err'); } });
    tr.querySelector('.tk-st').addEventListener('change', async e => { e.stopPropagation(); try { await updateSupportRequest(t.id, { status: e.target.value }); toast('Estado actualizado'); } catch { toast('No se pudo actualizar', 'err'); } });
    tr.querySelector('.tk-asg').addEventListener('change', async e => { e.stopPropagation(); try { await updateSupportRequest(t.id, { assigned_to: e.target.value || null }); } catch { toast('No se pudo actualizar', 'err'); } });
    tr.querySelector('.del').addEventListener('click', async e => {
      e.stopPropagation();
      if (await confirmDialog(`Se eliminará la solicitud de "${t.name}".`)) {
        try { await deleteSupportRequest(t.id); toast('Solicitud eliminada'); } catch { toast('No se pudo eliminar', 'err'); }
      }
    });
  });
}

function detailModal(t) {
  const comp = companyById(t.company_id);
  const cliente = comp?.name || t.client_name || '';
  const body = `
    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${statusBadge(t.status)}${chip(priorityMeta(t.priority))}<span class="pill">${esc(t.source)}</span></div>
      <div class="cell-muted">Recibido ${fmtDate(t.created_at)} · ${esc(relTime(t.created_at))}</div>
    </div>
    <div class="fld"><label>Solicitante</label><div>${esc(t.name)} · <a href="mailto:${esc(t.email)}" style="color:var(--primary)">${esc(t.email)}</a>${t.phone ? ` · ${esc(t.phone)}` : ''}</div></div>
    ${cliente ? `<div class="fld"><label>Empresa</label><div>${esc(cliente)}</div></div>` : ''}
    ${t.subject ? `<div class="fld"><label>Asunto</label><div>${esc(t.subject)}</div></div>` : ''}
    <div class="fld"><label>Mensaje</label><div style="white-space:pre-wrap;background:var(--surface-2);border-radius:10px;padding:12px;color:var(--ink)">${esc(t.message)}</div></div>
    ${isStaff() ? `<div class="fld"><label>Resolución · qué se ha hecho (sale en el informe PDF)</label><textarea id="tk-res" placeholder="Describe el trabajo realizado para resolver la incidencia…">${esc(t.resolution || '')}</textarea></div>` : (t.resolution ? `<div class="fld"><label>Resolución</label><div style="white-space:pre-wrap">${esc(t.resolution)}</div></div>` : '')}`;

  const foot = document.createElement('div');
  foot.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap';
  const mail = document.createElement('a');
  mail.className = 'btn btn-ghost'; mail.href = `mailto:${encodeURIComponent(t.email)}?subject=${encodeURIComponent('Re: ' + (t.subject || 'Tu solicitud de soporte'))}`;
  mail.textContent = 'Responder por email';
  foot.appendChild(mail);

  const pdf = document.createElement('button');
  pdf.className = 'btn btn-ghost'; pdf.textContent = 'Descargar informe';
  pdf.addEventListener('click', () => incidentReportPDF({ ...t, resolution: getRes() ?? t.resolution }));
  foot.appendChild(pdf);

  if (isStaff()) {
    const saveRes = document.createElement('button');
    saveRes.className = 'btn btn-ghost'; saveRes.textContent = 'Guardar resolución';
    saveRes.addEventListener('click', async () => { try { await updateSupportRequest(t.id, { resolution: getRes() || null }); toast('Resolución guardada'); } catch { toast('Error', 'err'); } });
    foot.appendChild(saveRes);
    if (t.status !== 'resuelto') {
      const done = document.createElement('button');
      done.className = 'btn btn-primary'; done.textContent = 'Marcar resuelta';
      done.addEventListener('click', async () => { try { await updateSupportRequest(t.id, { status: 'resuelto', resolution: getRes() || null }); toast('Marcada como resuelta'); m.close(); } catch { toast('Error', 'err'); } });
      foot.appendChild(done);
    }
  }
  const m = openModal({ title: `Solicitud de ${t.name}`, body, footer: foot });
  const getRes = () => m.body.querySelector('#tk-res')?.value.trim();
}
