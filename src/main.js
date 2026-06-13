import './styles/main.css';
import { supabase, configMissing } from './lib/supabase.js';
import { state, loadAll, teardown, onChange } from './lib/store.js';
import { initTheme, toggleTheme, getTheme } from './lib/theme.js';
import { startIdle, stopIdle, isExpiredOnLoad, clearActivity } from './lib/idle.js';
import { esc, avatarHTML, roleLabel, ICONS, debounce, asset } from './lib/ui.js';
import { renderLogin, renderSetup } from './views/login.js';
import { renderDashboard } from './views/dashboard.js';
import { renderCompanies } from './views/companies.js';
import { renderTasks } from './views/tasks.js';
import { renderKanban } from './views/kanban.js';
import { renderCalendar } from './views/calendar.js';
import { renderTeam } from './views/team.js';
import { renderActivity } from './views/activity.js';
import { renderSettings } from './views/settings.js';
import { taskDetailModal } from './views/forms.js';
import { companyModal } from './views/forms.js';

initTheme();

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: ICONS.dashboard, render: renderDashboard },
  { id: 'empresas',  label: 'Empresas',  icon: ICONS.companies, render: renderCompanies },
  { id: 'tareas',    label: 'Tareas',    icon: ICONS.tasks,     render: renderTasks },
  { id: 'kanban',    label: 'Kanban',    icon: ICONS.kanban,    render: renderKanban },
  { id: 'calendario',label: 'Calendario',icon: ICONS.calendar,  render: renderCalendar },
  { id: 'equipo',    label: 'Equipo',    icon: ICONS.team,      render: renderTeam },
  { id: 'actividad', label: 'Actividad', icon: ICONS.activity,  render: renderActivity },
  { id: 'ajustes',   label: 'Ajustes',   icon: ICONS.settings,  render: renderSettings }
];

let current = 'dashboard';
let unsubscribe = null;
let idleNotice = false;

/* ============================================================
   ARRANQUE
   ============================================================ */
async function boot() {
  if (configMissing) { renderSetup(); return; }
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    if (isExpiredOnLoad()) {
      // la sesión estaba abierta pero llevaba >5 min sin uso → cerrar
      clearActivity();
      await supabase.auth.signOut();
      renderLogin(enterApp, 'Tu sesión se cerró por inactividad.');
    } else {
      await enterApp(data.session.user);
    }
  } else {
    renderLogin(enterApp);
  }

  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') logout();
  });
}

/** Se llama cuando se cumplen los 5 min de inactividad. */
function handleIdleTimeout() {
  idleNotice = true;
  clearActivity();
  supabase.auth.signOut();   // dispara SIGNED_OUT → logout()
}

async function enterApp(user) {
  const app = document.getElementById('app');
  app.innerHTML = `<div class="boot-spinner"></div>`;
  try {
    await loadAll(user);
  } catch (err) {
    app.innerHTML = `<div class="setup-page"><div class="setup-card">
      <h1>⚠️ Error al cargar datos</h1>
      <p>${esc(err.message || 'Error desconocido')}</p>
      <p style="margin-top:10px">Comprueba que ejecutaste <code>supabase/schema.sql</code> y que tu usuario tiene un perfil en la tabla <code>profiles</code>.</p>
      <button class="btn btn-ghost" onclick="location.reload()" style="margin-top:14px">Reintentar</button>
    </div></div>`;
    return;
  }
  renderShell();
  // re-render de la vista actual cuando cambian los datos (realtime)
  unsubscribe = onChange(debounce(() => renderView(), 60));
  // cierre de sesión automático tras 5 min de inactividad
  startIdle(handleIdleTimeout);
}

function logout() {
  stopIdle();
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  teardown();
  const msg = idleNotice ? 'Tu sesión se cerró por inactividad.' : null;
  idleNotice = false;
  renderLogin(enterApp, msg);
}

/* ============================================================
   SHELL
   ============================================================ */
function renderShell() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="shell">
      <div class="sb-overlay" id="sb-overlay"></div>
      <aside class="sidebar">
        <div class="sb-brand">
          <img class="iso brand-light" src="${asset('brand/isotipo.svg')}" alt="" />
          <img class="iso brand-dark" src="${asset('brand/isotipo-white.svg')}" alt="" />
          <span class="name">TAMA <span>· Studios</span></span>
        </div>
        <nav class="sb-nav" id="sb-nav">
          ${NAV.map(n => `<button class="sb-link" data-view="${n.id}">${n.icon}<span>${n.label}</span></button>`).join('')}
        </nav>
        <div class="sb-foot">
          <button class="sb-link" id="theme-toggle">${getTheme() === 'dark' ? ICONS.sun : ICONS.moon}<span>${getTheme() === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span></button>
          <div class="sb-copy">© ${new Date().getFullYear()} TAMA Studios · Uso interno</div>
        </div>
      </aside>

      <div class="main">
        <header class="header">
          <button class="icon-btn hd-burger" id="burger">${ICONS.menu}</button>
          <div class="hd-search">
            ${ICONS.search}
            <input type="search" id="global-search" placeholder="Buscar empresas y tareas…" autocomplete="off" />
            <div class="hd-search-results" id="search-results"></div>
          </div>
          <div class="hd-right">
            <button class="icon-btn" id="hd-theme" title="Cambiar tema">${getTheme() === 'dark' ? ICONS.sun : ICONS.moon}</button>
            <button class="hd-user" id="hd-user">
              ${avatarHTML(state.me)}
              <span style="text-align:left">
                <div class="uname">${esc(state.me?.name || state.me?.email || '')}</div>
                <div class="urole">${esc(roleLabel(state.me?.role))}</div>
              </span>
            </button>
          </div>
        </header>
        <main class="view" id="view"></main>
      </div>
    </div>`;

  // navegación
  app.querySelectorAll('.sb-link[data-view]').forEach(btn =>
    btn.addEventListener('click', () => navigate(btn.dataset.view)));

  // tema
  const onTheme = () => {
    toggleTheme();
    renderShell();      // re-pinta iconos
    renderView();
  };
  app.querySelector('#theme-toggle').addEventListener('click', onTheme);
  app.querySelector('#hd-theme').addEventListener('click', onTheme);

  // menú móvil
  const burger = app.querySelector('#burger');
  const overlay = app.querySelector('#sb-overlay');
  burger.addEventListener('click', () => document.body.classList.toggle('sb-open'));
  overlay.addEventListener('click', () => document.body.classList.remove('sb-open'));

  // usuario → ajustes
  app.querySelector('#hd-user').addEventListener('click', () => navigate('ajustes'));

  // búsqueda global
  setupSearch(app);

  renderView();
}

function navigate(view) {
  current = view;
  document.body.classList.remove('sb-open');
  document.querySelectorAll('.sb-link[data-view]').forEach(b =>
    b.classList.toggle('active', b.dataset.view === view));
  renderView();
  document.getElementById('view')?.scrollTo(0, 0);
}

function renderView() {
  const view = document.getElementById('view');
  if (!view) return;
  const entry = NAV.find(n => n.id === current) || NAV[0];
  document.querySelectorAll('.sb-link[data-view]').forEach(b =>
    b.classList.toggle('active', b.dataset.view === current));
  // pasar callbacks según la vista
  if (current === 'ajustes') entry.render(view, logout);
  else entry.render(view, navigate);
}

/* ============================================================
   BÚSQUEDA GLOBAL
   ============================================================ */
function setupSearch(app) {
  const input = app.querySelector('#global-search');
  const results = app.querySelector('#search-results');

  const run = debounce(() => {
    const q = input.value.trim().toLowerCase();
    if (!q) { results.classList.remove('open'); return; }

    const comp = state.companies.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.contact_person || '').toLowerCase().includes(q)).slice(0, 5);
    const tasks = state.tasks.filter(t =>
      (t.title || '').toLowerCase().includes(q) ||
      (t.labels || []).some(l => l.toLowerCase().includes(q))).slice(0, 6);

    if (!comp.length && !tasks.length) {
      results.innerHTML = `<div class="sr-empty">Sin resultados para "${esc(q)}"</div>`;
      results.classList.add('open');
      return;
    }
    let html = '';
    if (comp.length) {
      html += `<div class="sr-group">Empresas</div>`;
      html += comp.map(c => `<button class="sr-item" data-type="company" data-id="${c.id}">🏢 ${esc(c.name)}<span class="meta">${esc(c.status)}</span></button>`).join('');
    }
    if (tasks.length) {
      html += `<div class="sr-group">Tareas</div>`;
      html += tasks.map(t => `<button class="sr-item" data-type="task" data-id="${t.id}">✓ ${esc(t.title)}<span class="meta">${esc(t.status)}</span></button>`).join('');
    }
    results.innerHTML = html;
    results.classList.add('open');

    results.querySelectorAll('.sr-item').forEach(item =>
      item.addEventListener('click', () => {
        results.classList.remove('open');
        input.value = '';
        if (item.dataset.type === 'task') taskDetailModal(item.dataset.id);
        else { const c = state.companies.find(x => x.id === item.dataset.id); if (c) companyModal(c); }
      }));
  }, 160);

  input.addEventListener('input', run);
  input.addEventListener('focus', run);
  document.addEventListener('click', e => {
    if (!e.target.closest('.hd-search')) results.classList.remove('open');
  });
}

boot();
