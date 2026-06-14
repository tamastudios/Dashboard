import { esc, avatarHTML, roleLabel, toast, openModal, el, ROLES, TASK_STATUSES, PRIORITIES } from '../lib/ui.js';
import { state, updateProfile } from '../lib/store.js';
import { supabase } from '../lib/supabase.js';
import { setTheme, getTheme } from '../lib/theme.js';
import { listVerifiedFactors, enrollTotp, verifyCode, unenroll } from '../lib/mfa.js';

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

      <div class="card">
        <h2 class="card-title">Verificación en dos pasos (2FA)</h2>
        <div id="mfa-status"><div class="skeleton" style="height:38px"></div></div>
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

  // 2FA
  renderMfaSection(root.querySelector('#mfa-status'), me);

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

/* ============================================================
   Sección 2FA de Ajustes
   ============================================================ */
async function renderMfaSection(box, me) {
  const required = me?.role === 'admin' || me?.role === 'socio';
  let factors = [];
  try { factors = await listVerifiedFactors(); } catch {}
  const active = factors.length > 0;

  box.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <span class="chip ${active ? 'chip-green' : 'chip-gray'}"><span class="dot"></span>${active ? 'Activado' : 'Desactivado'}</span>
      ${required ? '<span class="chip chip-blue">Obligatorio para tu rol</span>' : '<span style="color:var(--muted);font-size:.82rem">Opcional para tu rol</span>'}
    </div>
    <p style="color:var(--muted);font-size:.85rem;margin-bottom:12px">
      Añade una capa extra con una app de autenticación (Google Authenticator, Authy…).
    </p>
    <div style="display:flex;gap:8px">
      ${active
        ? (required ? '<button class="btn btn-ghost btn-sm" id="mfa-reconfig">Reconfigurar</button>'
                    : '<button class="btn btn-ghost btn-sm" id="mfa-off" style="color:var(--red)">Desactivar 2FA</button>')
        : '<button class="btn btn-primary btn-sm" id="mfa-on">Activar 2FA</button>'}
    </div>`;

  box.querySelector('#mfa-on')?.addEventListener('click', () => enrollFlow(box, me));
  box.querySelector('#mfa-reconfig')?.addEventListener('click', () => enrollFlow(box, me));
  box.querySelector('#mfa-off')?.addEventListener('click', async () => {
    try {
      for (const f of factors) await unenroll(f.id);
      toast('2FA desactivado');
      renderMfaSection(box, me);
    } catch { toast('No se pudo desactivar', 'err'); }
  });
}

function enrollFlow(box, me) {
  enrollTotp().then(factor => {
    const body = el('div');
    body.innerHTML = `
      <p style="color:var(--muted);font-size:.88rem;margin-bottom:10px">Escanea el código con tu app de autenticación e introduce el código de 6 dígitos.</p>
      <div class="mfa-qr"><img src="${factor.totp.qr_code}" alt="QR 2FA" width="170" height="170"></div>
      <p class="mfa-secret">Clave manual: <code>${esc(factor.totp.secret)}</code></p>
      <div class="fld"><input id="mfa-enr-code" inputmode="numeric" maxlength="6" placeholder="123456" style="text-align:center;letter-spacing:.3em;font-size:1.1rem"></div>
      <div class="login-err" id="mfa-enr-err"></div>`;
    const foot = el('div', { style: 'display:flex;gap:10px;justify-content:flex-end' });
    const cancel = el('button', { class: 'btn btn-ghost' }, 'Cancelar');
    const ok = el('button', { class: 'btn btn-primary' }, 'Activar');
    foot.append(cancel, ok);
    const m = openModal({ title: 'Activar verificación en dos pasos', body, footer: foot });
    cancel.addEventListener('click', m.close);
    ok.addEventListener('click', async () => {
      const code = body.querySelector('#mfa-enr-code').value.trim();
      const err = body.querySelector('#mfa-enr-err');
      if (!/^\d{6}$/.test(code)) { err.textContent = 'Son 6 dígitos.'; err.classList.add('show'); return; }
      ok.disabled = true;
      try {
        await verifyCode(factor.id, code);
        m.close(); toast('2FA activado');
        renderMfaSection(box, me);
      } catch {
        err.textContent = 'Código incorrecto. Inténtalo otra vez.';
        err.classList.add('show'); ok.disabled = false;
      }
    });
  }).catch(() => toast('No se pudo iniciar el 2FA', 'err'));
}
