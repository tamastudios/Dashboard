import { supabase } from '../lib/supabase.js';
import { el, asset } from '../lib/ui.js';

export function renderLogin(onSuccess) {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <div class="login-logo">
          <img class="brand-light" src="${asset('brand/logo.svg')}" alt="TAMA Studios" />
          <img class="brand-dark" src="${asset('brand/logo-white.svg')}" alt="TAMA Studios" />
        </div>
        <h1>Bienvenido de nuevo</h1>
        <p class="sub">Inicia sesión para acceder al panel</p>
        <div class="login-err" id="login-err"></div>
        <form id="login-form" novalidate>
          <div class="fld">
            <label for="lg-email">Email</label>
            <input type="email" id="lg-email" autocomplete="email" required placeholder="tu@email.com" />
          </div>
          <div class="fld">
            <label for="lg-pass">Contraseña</label>
            <input type="password" id="lg-pass" autocomplete="current-password" required placeholder="••••••••" />
          </div>
          <button type="submit" class="btn btn-primary btn-block" id="lg-btn">Entrar</button>
        </form>
        <p class="login-foot">TAMA Studios · Acceso solo para el equipo</p>
      </div>
    </div>`;

  const form = document.getElementById('login-form');
  const errBox = document.getElementById('login-err');
  const btn = document.getElementById('lg-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.classList.remove('show');
    const email = document.getElementById('lg-email').value.trim();
    const pass = document.getElementById('lg-pass').value;
    if (!email || !pass) {
      errBox.textContent = 'Introduce email y contraseña.';
      errBox.classList.add('show');
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Entrando…';
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) {
      errBox.textContent = error.message === 'Invalid login credentials'
        ? 'Email o contraseña incorrectos.'
        : error.message;
      errBox.classList.add('show');
      btn.disabled = false;
      btn.textContent = 'Entrar';
      return;
    }
    onSuccess(data.user);
  });

  document.getElementById('lg-email').focus();
}

export function renderSetup() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="setup-page">
      <div class="setup-card">
        <h1>⚙️ Configuración pendiente</h1>
        <p>El dashboard no encuentra las credenciales de Supabase. Para conectarlo:</p>
        <ol>
          <li>Crea un proyecto gratis en <code>supabase.com</code></li>
          <li>Ejecuta el SQL de <code>supabase/schema.sql</code> en el editor SQL</li>
          <li>Copia <code>.env.example</code> como <code>.env</code> y rellena
              <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code>
              (Settings → API)</li>
          <li>Reinicia el servidor (<code>npm run dev</code>)</li>
        </ol>
        <p style="margin-top:14px">Tienes todos los detalles en el <code>README.md</code>.</p>
      </div>
    </div>`;
}
