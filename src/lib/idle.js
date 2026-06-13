/* ============================================================
   idle.js — cierre de sesión automático por inactividad.
   · 5 minutos sin interacción → se ejecuta el callback (logout).
   · El temporizador se reinicia con cualquier actividad.
   · Sincroniza entre pestañas (si usas otra pestaña, no te cierra).
   · Si cierras el navegador y vuelves más tarde, al cargar detecta
     que pasó el tiempo y cierra la sesión igualmente.
   ============================================================ */
const TIMEOUT = 5 * 60 * 1000;            // 5 minutos
const KEY = 'tama-last-activity';
const EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

let timer = null;
let onTimeout = null;
let lastWrite = 0;

function now() { return Date.now(); }

function reset() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(fire, TIMEOUT);
}

function fire() {
  const cb = onTimeout;
  stopIdle();
  if (cb) cb();
}

function markActivity() {
  const t = now();
  // throttle: solo escribimos en localStorage cada 5 s como mucho
  if (t - lastWrite > 5000) {
    try { localStorage.setItem(KEY, String(t)); } catch {}
    lastWrite = t;
  }
  reset();
}

function onVisible() {
  if (document.visibilityState === 'visible') {
    // al volver a la pestaña comprobamos si ya caducó mientras no mirabas
    try {
      const last = parseInt(localStorage.getItem(KEY) || '0', 10);
      if (last && now() - last >= TIMEOUT) return fire();
    } catch {}
    reset();
  }
}

function onStorage(e) {
  // actividad registrada en otra pestaña → seguimos vivos aquí
  if (e.key === KEY && e.newValue) reset();
}

export function startIdle(cb) {
  onTimeout = cb;
  lastWrite = now();
  try { localStorage.setItem(KEY, String(lastWrite)); } catch {}
  EVENTS.forEach(ev => window.addEventListener(ev, markActivity, { passive: true }));
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('storage', onStorage);
  reset();
}

export function stopIdle() {
  if (timer) { clearTimeout(timer); timer = null; }
  EVENTS.forEach(ev => window.removeEventListener(ev, markActivity));
  document.removeEventListener('visibilitychange', onVisible);
  window.removeEventListener('storage', onStorage);
  onTimeout = null;
}

/** ¿La última actividad registrada caducó? (para comprobar al arrancar). */
export function isExpiredOnLoad() {
  try {
    const last = parseInt(localStorage.getItem(KEY) || '0', 10);
    return !!last && (now() - last >= TIMEOUT);
  } catch { return false; }
}

export function clearActivity() {
  try { localStorage.removeItem(KEY); } catch {}
}
