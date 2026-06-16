/* ============================================================
   ui.js — helpers de interfaz: escape, fechas, toast, modal,
   confirmación, iconos y metadatos de estados/prioridades.
   ============================================================ */

export function esc(str) {
  const d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
}

/** Ruta a un archivo de /public respetando la base del despliegue (/Dashboard/). */
export const asset = (p) => import.meta.env.BASE_URL + p.replace(/^\//, '');

/**
 * Devuelve una URL segura para usar en href/src.
 * Bloquea esquemas peligrosos (javascript:, data:, vbscript:, file:)
 * que permitirían ejecutar código. Permite http/https/mailto y, si no
 * hay esquema, asume https. El resultado debe pasarse igualmente por esc().
 */
export function safeUrl(url) {
  const t = (url == null ? '' : String(url)).trim();
  if (!t) return '';
  if (/^(https?:|mailto:)/i.test(t)) return t;
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return '';   // cualquier otro esquema → bloqueado
  return 'https://' + t.replace(/^\/+/, '');         // sin esquema → https://
}

export function el(tag, attrs, html) {
  const n = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  if (html != null) n.innerHTML = html;
  return n;
}

export const debounce = (fn, ms = 250) => {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};

/* ---------- fechas ---------- */
const DF = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
const DFY = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  if (isNaN(d)) return '—';
  return d.getFullYear() === new Date().getFullYear() ? DF.format(d) : DFY.format(d);
}

export function relTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'ahora mismo';
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d} día${d === 1 ? '' : 's'}`;
  return fmtDate(iso);
}

const EUR = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
/** Formatea un número como importe en euros (es-ES). */
export const fmtEUR = (n) => EUR.format(Number(n) || 0);

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isOverdue(task) {
  return task.due_date && task.status !== 'completada' && task.due_date < todayISO();
}

/* ---------- metadatos de dominio ---------- */
export const TASK_STATUSES = [
  { id: 'pendiente',  label: 'Pendiente',   color: 'gray' },
  { id: 'progreso',   label: 'En progreso', color: 'blue' },
  { id: 'revision',   label: 'En revisión', color: 'purple' },
  { id: 'bloqueada',  label: 'Bloqueada',   color: 'red' },
  { id: 'completada', label: 'Completada',  color: 'green' }
];
export const PRIORITIES = [
  { id: 'baja',    label: 'Baja',    color: 'gray' },
  { id: 'media',   label: 'Media',   color: 'blue' },
  { id: 'alta',    label: 'Alta',    color: 'orange' },
  { id: 'urgente', label: 'Urgente', color: 'red' }
];
export const COMPANY_STATUSES = [
  { id: 'prospecto',  label: 'Prospecto',  color: 'yellow' },
  { id: 'activo',     label: 'Activo',     color: 'green' },
  { id: 'pausa',      label: 'En pausa',   color: 'orange' },
  { id: 'finalizado', label: 'Finalizado', color: 'gray' }
];
export const ROLES = [
  { id: 'admin',       label: 'Admin' },
  { id: 'socio',       label: 'Socio' },
  { id: 'colaborador', label: 'Colaborador' }
];
export const INVOICE_STATUSES = [
  { id: 'borrador',  label: 'Borrador',       color: 'gray' },
  { id: 'pendiente', label: 'Pendiente',      color: 'orange' },
  { id: 'pagada',    label: 'Pagada',         color: 'green' },
  { id: 'vencida',   label: 'Vencida',        color: 'red' }
];

const find = (list, id) => list.find(x => x.id === id) || list[0];
export const statusMeta = id => find(TASK_STATUSES, id);
export const priorityMeta = id => find(PRIORITIES, id);
export const companyStatusMeta = id => find(COMPANY_STATUSES, id);
export const invoiceStatusMeta = id => find(INVOICE_STATUSES, id);
export const roleLabel = id => find(ROLES, id).label;

export const chip = (meta) =>
  `<span class="chip chip-${meta.color}"><span class="dot"></span>${esc(meta.label)}</span>`;

export function avatarHTML(profile, size = '') {
  if (!profile) return `<span class="avatar ${size}">?</span>`;
  if (profile.avatar_url) {
    const safe = safeUrl(profile.avatar_url);
    if (safe) return `<span class="avatar ${size}"><img src="${esc(safe)}" alt=""></span>`;
  }
  const initials = (profile.name || profile.email || '?')
    .split(/\s+/).slice(0, 2).map(w => w[0]).join('');
  return `<span class="avatar ${size}">${esc(initials)}</span>`;
}

/* ---------- toast ---------- */
let toastWrap = null;
export function toast(msg, type = 'ok') {
  if (!toastWrap) {
    toastWrap = el('div', { class: 'toast-wrap' });
    document.body.appendChild(toastWrap);
  }
  const t = el('div', { class: `toast ${type}` }, esc(msg));
  toastWrap.appendChild(t);
  setTimeout(() => {
    t.style.transition = 'opacity .3s';
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 320);
  }, 2600);
}

/* ---------- modal ---------- */
export function openModal({ title, body, footer, wide = false, onClose }) {
  const backdrop = el('div', { class: 'modal-backdrop' });
  const modal = el('div', { class: `modal${wide ? ' wide' : ''}`, role: 'dialog', 'aria-modal': 'true' });

  const head = el('div', { class: 'modal-head' });
  head.appendChild(el('h2', null, esc(title)));
  const closeBtn = el('button', { class: 'icon-btn', 'aria-label': 'Cerrar' },
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>');
  head.appendChild(closeBtn);
  modal.appendChild(head);

  const bodyWrap = el('div', { class: 'modal-body' });
  if (typeof body === 'string') bodyWrap.innerHTML = body;
  else if (body) bodyWrap.appendChild(body);
  modal.appendChild(bodyWrap);

  if (footer) {
    const foot = el('div', { class: 'modal-foot' });
    if (typeof footer === 'string') foot.innerHTML = footer;
    else foot.appendChild(footer);
    modal.appendChild(foot);
  }

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  function close() {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
    onClose?.();
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', onKey);

  return { close, modal, body: bodyWrap };
}

/** Modal de confirmación. Devuelve Promise<boolean>. */
export function confirmDialog(text, { confirmLabel = 'Eliminar', danger = true } = {}) {
  return new Promise(resolve => {
    const foot = el('div', { style: 'display:flex;gap:10px;justify-content:flex-end' });
    const cancel = el('button', { class: 'btn btn-ghost' }, 'Cancelar');
    const ok = el('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}` }, esc(confirmLabel));
    foot.append(cancel, ok);
    const m = openModal({
      title: '¿Estás seguro?',
      body: `<p style="color:var(--muted);font-size:.92rem">${esc(text)}</p>`,
      footer: foot,
      onClose: () => resolve(false)
    });
    cancel.addEventListener('click', () => { m.close(); });
    ok.addEventListener('click', () => { resolve(true); m.onConfirmed = true; m.close(); });
  });
}

/* ---------- iconos (lucide-style, inline) ---------- */
export const ICONS = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  companies: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M9 9h2m-2 4h2m6 8v-9h2a2 2 0 0 1 2 2v7"/></svg>',
  tasks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  kanban: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="5" height="18" rx="1.5"/><rect x="10" y="3" width="5" height="12" rx="1.5"/><rect x="17" y="3" width="5" height="8" rx="1.5"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  team: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  activity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  prospector: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
  ban: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.55a16 16 0 0 0 5.55 5.55l1.62-1.62a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  invoices: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/><path d="M14 2v6h6"/><line x1="8.5" y1="13" x2="15.5" y2="13"/><line x1="8.5" y1="17" x2="13" y2="17"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  euro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 7a7 7 0 1 0 0 10"/><line x1="3" y1="10" x2="13" y2="10"/><line x1="3" y1="14" x2="13" y2="14"/></svg>'
};
