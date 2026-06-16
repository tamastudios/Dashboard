/* ============================================================
   components.js — componentes de UI reutilizables (SaaS).
   Todos devuelven HTML (string) salvo renderTablePage, que
   pinta una página completa de listado con filtros.
   ============================================================ */
import { esc, ICONS, debounce } from './ui.js';

/* ---------- PageHeader ---------- */
export function pageHeader({ title, subtitle = '', actions = '' }) {
  return `
    <div class="page-head">
      <div>
        <h1>${esc(title)}</h1>
        ${subtitle ? `<div class="sub">${esc(subtitle)}</div>` : ''}
      </div>
      ${actions ? `<div class="page-actions">${actions}</div>` : ''}
    </div>`;
}

/* ---------- StatsCard / StatsRow ---------- */
export function statsCard({ num, label, icon = ICONS.dashboard, color = 'gray', hint = '' }) {
  return `
    <div class="card stat-card">
      <div class="stat-icon" style="background:var(--${color}-soft);color:var(--${color})">${icon}</div>
      <div class="num">${esc(num)}</div>
      <div class="lbl">${esc(label)}</div>
      ${hint ? `<div class="lbl" style="color:var(--muted);font-size:.72rem;margin-top:2px">${esc(hint)}</div>` : ''}
    </div>`;
}
export const statsRow = (cards) => `<div class="stats-grid">${cards.map(statsCard).join('')}</div>`;

/* ---------- ProgressBar ---------- */
export function progressBar(pct, { color = 'var(--primary)' } = {}) {
  const v = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
  return `<div class="progress" title="${v}%"><div class="progress-fill" style="width:${v}%;background:${color}"></div></div>`;
}

/* ---------- EmptyState ---------- */
export function emptyState({ icon = '📭', title = 'Sin datos', text = '', actionLabel = '', actionId = '' }) {
  return `<div class="empty">
    <div class="ico">${icon}</div>
    <h3>${esc(title)}</h3>
    ${text ? `<p>${esc(text)}</p>` : ''}
    ${actionLabel ? `<button class="btn btn-primary" id="${esc(actionId)}">${ICONS.plus} ${esc(actionLabel)}</button>` : ''}
  </div>`;
}

/* ---------- SectionCard ---------- */
export function sectionCard({ title, more = '', body = '' }) {
  return `<div class="card">
    <h2 class="card-title">${esc(title)}${more ? ` <span class="more" data-nav="${esc(more)}">Ver todo →</span>` : ''}</h2>
    ${body}
  </div>`;
}

/* ---------- DataTable ---------- */
/** columns: [{ label, render(row), align, nowrap, width }]. rows con id. */
export function dataTable({ columns, rows, rowAttr = () => '' }) {
  return `<div class="table-wrap"><table>
    <thead><tr>${columns.map(c => `<th${c.align ? ` style="text-align:${c.align}"` : ''}${c.width ? ` data-w` : ''}>${esc(c.label)}</th>`).join('')}</tr></thead>
    <tbody>
      ${rows.map(r => `<tr data-id="${esc(r.id ?? '')}" ${rowAttr(r)}>${columns.map(c => {
        const val = c.render ? c.render(r) : esc(r[c.key] ?? '');
        const st = [c.align ? `text-align:${c.align}` : '', c.nowrap ? 'white-space:nowrap' : ''].filter(Boolean).join(';');
        return `<td${st ? ` style="${st}"` : ''}>${val}</td>`;
      }).join('')}</tr>`).join('')}
    </tbody>
  </table></div>`;
}

/* ============================================================
   renderTablePage — página de listado completa con filtros.
   cfg = {
     title, subtitle, actions,
     stats: [statsCard cfgs],
     search: { placeholder, keys:[...] },
     selects: [{ id, label, options:[{value,label}], match(row,value) }],
     columns, rows,
     onRow(row),                         // click en fila (opcional)
     empty: { icon, title, text }
   }
   ============================================================ */
export function renderTablePage(root, cfg) {
  const filterState = {};
  (cfg.selects || []).forEach(s => { filterState[s.id] = 'all'; });
  let query = '';

  const actionsHTML = cfg.primaryAction
    ? `<button class="btn btn-primary" id="tp-action">${cfg.primaryAction.icon || ICONS.plus} ${esc(cfg.primaryAction.label)}</button>`
    : (cfg.actions || '');

  root.innerHTML = `
    ${pageHeader({ title: cfg.title, subtitle: cfg.subtitle, actions: actionsHTML })}
    ${cfg.stats && cfg.stats.length ? statsRow(cfg.stats) : ''}
    ${(cfg.search || (cfg.selects && cfg.selects.length)) ? `
      <div class="filters">
        ${cfg.search ? `<input type="search" id="tp-q" placeholder="${esc(cfg.search.placeholder || 'Buscar…')}" />` : ''}
        ${(cfg.selects || []).map(s => `<select id="tp-${esc(s.id)}">
          <option value="all">${esc(s.label)}</option>
          ${s.options.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}
        </select>`).join('')}
      </div>` : ''}
    <div id="tp-body"></div>`;

  const body = root.querySelector('#tp-body');

  function apply() {
    let list = [...cfg.rows];
    if (query && cfg.search) {
      const q = query.toLowerCase();
      list = list.filter(r => (cfg.search.keys || []).some(k =>
        String(r[k] ?? '').toLowerCase().includes(q)));
    }
    (cfg.selects || []).forEach(s => {
      const v = filterState[s.id];
      if (v && v !== 'all') list = list.filter(r => s.match ? s.match(r, v) : r[s.id] === v);
    });
    return list;
  }

  function paintBody() {
    const list = apply();
    if (!list.length) {
      body.innerHTML = cfg.rows.length
        ? emptyState({ icon: '🔍', title: 'Sin resultados', text: 'Ningún registro coincide con los filtros.' })
        : emptyState(cfg.empty || { icon: '📭', title: 'Sin datos', text: '' });
      return;
    }
    body.innerHTML = dataTable({ columns: cfg.columns, rows: list });
    if (cfg.onRow) {
      body.querySelectorAll('tbody tr').forEach(tr => {
        const r = list.find(x => String(x.id) === tr.dataset.id);
        if (r) tr.addEventListener('click', () => cfg.onRow(r));
        tr.style.cursor = 'pointer';
      });
    }
  }

  if (cfg.primaryAction?.onClick) {
    root.querySelector('#tp-action')?.addEventListener('click', cfg.primaryAction.onClick);
  }
  if (cfg.search) {
    root.querySelector('#tp-q').addEventListener('input', debounce(e => { query = e.target.value; paintBody(); }, 180));
  }
  (cfg.selects || []).forEach(s => {
    root.querySelector(`#tp-${s.id}`).addEventListener('change', e => { filterState[s.id] = e.target.value; paintBody(); });
  });

  paintBody();
}
