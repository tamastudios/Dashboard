import { esc, avatarHTML, roleLabel, toast, ROLES, TASK_STATUSES, PRIORITIES } from '../lib/ui.js';
import { state, updateProfile } from '../lib/store.js';
import { supabase } from '../lib/supabase.js';
import { setTheme, getTheme } from '../lib/theme.js';

export function renderSettings(root, onLogout) {
  const me = state.me;
  const isAdmin = me?.role === 'admin';

  root.innerHTML = `
    <div class="page-head"><div><h1>Ajustes</h1><div class="sub">Tu perfil y preferencias</div></div></div>
    <div class="settings-grid">

      <div class="card">
        <h2 class="card-title">Perfil</h2>
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
          ${avatarHTML(me, 'lg')}
          <div><div style="font-weight:700">${esc(me?.name || '')}</div>
          <div style="color:var(--muted);font-size:.85rem">${esc(me?.email || '')} · ${esc(roleLabel(me?.role))}</div></div>
        </div>
        <form id="profile-form">
          <div class="fld"><label>Nombre</label><input name="name" value="${esc(me?.name || '')}" /></div>
          <div class="fld"><label>URL del avatar (opcional)</label><input name="avatar_url" value="${esc(me?.avatar_url || '')}" placeholder="https://…" /></div>
          <button class="btn btn-primary btn-sm" type="submit">Guardar perfil</button>
        </form>
      </div>

      <div class="card">
        <h2 class="card-title">Tema</h2>
        <div class="theme-row">
          <button class="theme-opt" data-theme="light">☀️ Claro</button>
          <button class="theme-opt" data-theme="dark">🌙 Oscuro</button>
        </div>
      </div>

      ${isAdmin ? `
      <div class="card">
        <h2 class="card-title">Miembros del equipo</h2>
        <div id="members-list"></div>
        <p style="color:var(--muted);font-size:.82rem;margin-top:12px">
          Para <b>añadir un miembro nuevo</b>: créalo en Supabase → Authentication → Add user (email + contraseña).
          Aparecerá aquí automáticamente al iniciar sesión por primera vez.
        </p>
      </div>` : ''}

      <div class="card">
        <h2 class="card-title">Estados y prioridades</h2>
        <p style="color:var(--muted);font-size:.85rem;margin-bottom:12px">Configuración actual del sistema:</p>
        <div style="margin-bottom:10px"><b style="font-size:.82rem">Estados de tarea:</b><div class="labels-row" style="margin-top:6px">${TASK_STATUSES.map(s => `<span class="chip chip-${s.color}"><span class="dot"></span>${s.label}</span>`).join('')}</div></div>
        <div><b style="font-size:.82rem">Prioridades:</b><div class="labels-row" style="margin-top:6px">${PRIORITIES.map(p => `<span class="chip chip-${p.color}"><span class="dot"></span>${p.label}</span>`).join('')}</div></div>
      </div>

      <div class="card">
        <h2 class="card-title">Sesión</h2>
        <button class="btn btn-ghost" id="logout-btn" style="color:var(--red)">Cerrar sesión</button>
      </div>
    </div>`;

  // perfil
  root.querySelector('#profile-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await updateProfile(me.id, { name: fd.get('name').trim(), avatar_url: fd.get('avatar_url').trim() || null });
      toast('Perfil actualizado');
    } catch { toast('No se pudo guardar', 'err'); }
  });

  // tema
  const cur = getTheme();
  root.querySelectorAll('.theme-opt').forEach(b => {
    b.classList.toggle('active', b.dataset.theme === cur);
    b.addEventListener('click', () => {
      setTheme(b.dataset.theme);
      root.querySelectorAll('.theme-opt').forEach(x => x.classList.toggle('active', x === b));
    });
  });

  // miembros (admin)
  if (isAdmin) {
    const list = root.querySelector('#members-list');
    list.innerHTML = state.profiles.map(p => `
      <div class="member-row">
        ${avatarHTML(p)}
        <div class="m-info"><div class="m-name">${esc(p.name || p.email)}</div><div class="m-doing">${esc(p.email || '')}</div></div>
        <select data-uid="${p.id}" style="background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:5px 9px;font-size:.82rem"${p.id === me.id ? ' disabled' : ''}>
          ${ROLES.map(r => `<option value="${r.id}"${p.role === r.id ? ' selected' : ''}>${r.label}</option>`).join('')}
        </select>
      </div>`).join('');
    list.querySelectorAll('select[data-uid]').forEach(sel =>
      sel.addEventListener('change', async () => {
        try { await updateProfile(sel.dataset.uid, { role: sel.value }); toast('Rol actualizado'); }
        catch { toast('No se pudo cambiar el rol', 'err'); }
      }));
  }

  root.querySelector('#logout-btn').addEventListener('click', async () => {
    await supabase.auth.signOut();
    onLogout();
  });
}
