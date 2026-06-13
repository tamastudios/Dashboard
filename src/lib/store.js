/* ============================================================
   store.js — capa de datos.
   Carga inicial, CRUD contra Supabase, registro de actividad
   y sincronización en tiempo real para todos los usuarios.
   ============================================================ */
import { supabase } from './supabase.js';

export const state = {
  user: null,        // sesión auth
  me: null,          // perfil propio
  profiles: [],
  companies: [],
  tasks: [],
  activity: [],
  notifications: [],
  loaded: false,
  online: true       // estado de la conexión en tiempo real
};

/* ---------- eventos ---------- */
const listeners = new Set();
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); }

/* ---------- estado de conexión ---------- */
const connListeners = new Set();
export function onConnChange(fn) { connListeners.add(fn); return () => connListeners.delete(fn); }
function setOnline(v) {
  if (state.online === v) return;
  state.online = v;
  connListeners.forEach(fn => { try { fn(v); } catch (e) { console.error(e); } });
}

/* ---------- helpers ---------- */
/** true si el usuario actual es admin o socio (puede borrar). Los colaboradores no. */
export const isStaff = () => state.me?.role === 'admin' || state.me?.role === 'socio';
export const profileById = id => state.profiles.find(p => p.id === id) || null;
export const companyById = id => state.companies.find(c => c.id === id) || null;
export const taskById = id => state.tasks.find(t => t.id === id) || null;

function upsertLocal(list, row) {
  const i = list.findIndex(x => x.id === row.id);
  if (i >= 0) list[i] = row; else list.push(row);
}
function removeLocal(list, id) {
  const i = list.findIndex(x => x.id === id);
  if (i >= 0) list.splice(i, 1);
}

/* ============================================================
   CARGA INICIAL
   ============================================================ */
export async function loadAll(user) {
  state.user = user;
  const [profiles, companies, tasks, activity, notifications] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at'),
    supabase.from('companies').select('*').order('created_at', { ascending: false }),
    supabase.from('tasks').select('*').order('created_at', { ascending: false }),
    supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(80),
    supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50)
  ]);
  for (const r of [profiles, companies, tasks, activity]) {
    if (r.error) throw r.error;
  }
  state.profiles = profiles.data;
  state.companies = companies.data;
  state.tasks = tasks.data;
  state.activity = activity.data;
  state.notifications = notifications.error ? [] : notifications.data;  // tolera si aún no existe la tabla
  state.me = state.profiles.find(p => p.id === user.id) || null;
  state.loaded = true;
  subscribeRealtime();
  emit();
}

/* ============================================================
   REALTIME — los cambios de cualquier usuario llegan aquí
   ============================================================ */
let channel = null;
function subscribeRealtime() {
  if (channel) return;
  channel = supabase
    .channel('tama-db')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'companies' }, p => applyChange(state.companies, p))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, p => applyChange(state.tasks, p))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, p => {
      applyChange(state.profiles, p);
      if (state.user) state.me = state.profiles.find(x => x.id === state.user.id) || state.me;
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, p => {
      state.activity.unshift(p.new);
      if (state.activity.length > 120) state.activity.pop();
      emit();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => emit())
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, p => {
      if (p.new.user_id === state.user?.id) { state.notifications.unshift(p.new); emit(); }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, p => {
      if (p.new.user_id === state.user?.id) { upsertLocal(state.notifications, p.new); emit(); }
    })
    .subscribe((status) => {
      // SUBSCRIBED = conectado; CHANNEL_ERROR/TIMED_OUT/CLOSED = caído
      setOnline(status === 'SUBSCRIBED');
    });

  // Reaccionar a la conexión del navegador (solo se registra una vez)
  if (!windowListenersSet) {
    window.addEventListener('offline', () => setOnline(false));
    window.addEventListener('online', () => reconnect());
    windowListenersSet = true;
  }
}
let windowListenersSet = false;

/** Reintenta la conexión en tiempo real y recarga los datos perdidos. */
export async function reconnect() {
  if (!state.user) return;
  try {
    if (channel) { await supabase.removeChannel(channel); channel = null; }
    // recarga el estado por si hubo cambios mientras no había conexión
    await refreshData();
    subscribeRealtime();
  } catch (e) { console.warn('[reconnect]', e); setOnline(false); }
}

async function refreshData() {
  const [profiles, companies, tasks, activity] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at'),
    supabase.from('companies').select('*').order('created_at', { ascending: false }),
    supabase.from('tasks').select('*').order('created_at', { ascending: false }),
    supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(80)
  ]);
  if (!profiles.error) state.profiles = profiles.data;
  if (!companies.error) state.companies = companies.data;
  if (!tasks.error) state.tasks = tasks.data;
  if (!activity.error) state.activity = activity.data;
  if (state.user) state.me = state.profiles.find(p => p.id === state.user.id) || state.me;
  emit();
}

function applyChange(list, payload) {
  if (payload.eventType === 'DELETE') removeLocal(list, payload.old.id);
  else upsertLocal(list, payload.new);
  emit();
}

export function teardown() {
  if (channel) { supabase.removeChannel(channel); channel = null; }
  state.loaded = false;
  state.profiles = []; state.companies = []; state.tasks = []; state.activity = []; state.notifications = [];
  state.user = null; state.me = null;
}

/* ============================================================
   ACTIVIDAD
   ============================================================ */
async function logActivity(action, entityType, entityName, detail = '') {
  const row = {
    user_id: state.user.id,
    user_name: state.me?.name || state.user.email,
    action, entity_type: entityType, entity_name: entityName, detail
  };
  // el realtime lo añadirá al estado local
  await supabase.from('activity_log').insert(row);
}

/* ============================================================
   NOTIFICACIONES
   ============================================================ */
export const unreadCount = () => state.notifications.filter(n => !n.read).length;

/** Crea una notificación para otro usuario (no para uno mismo). */
async function notify(userId, type, message, entityType, entityId) {
  if (!userId || userId === state.user.id) return;   // no auto-notificarse
  try {
    await supabase.from('notifications').insert({
      user_id: userId, type, message, entity_type: entityType, entity_id: entityId,
      actor_name: state.me?.name || state.user.email
    });
  } catch (e) { console.warn('[notify]', e); }
}

export async function markNotificationRead(id) {
  const n = state.notifications.find(x => x.id === id);
  if (n) { n.read = true; emit(); }
  await supabase.from('notifications').update({ read: true }).eq('id', id);
}

export async function markAllNotificationsRead() {
  const ids = state.notifications.filter(n => !n.read).map(n => n.id);
  if (!ids.length) return;
  state.notifications.forEach(n => { n.read = true; });
  emit();
  await supabase.from('notifications').update({ read: true }).in('id', ids);
}

/* ============================================================
   EMPRESAS
   ============================================================ */
export async function createCompany(fields) {
  const { data, error } = await supabase.from('companies')
    .insert({ ...fields, created_by: state.user.id }).select().single();
  if (error) throw error;
  upsertLocal(state.companies, data); emit();
  logActivity('creó la empresa', 'company', data.name);
  return data;
}

export async function updateCompany(id, fields) {
  const { data, error } = await supabase.from('companies')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id).select().single();
  if (error) throw error;
  upsertLocal(state.companies, data); emit();
  logActivity('editó la empresa', 'company', data.name);
  return data;
}

export async function deleteCompany(id) {
  const name = companyById(id)?.name || '';
  const { error } = await supabase.from('companies').delete().eq('id', id);
  if (error) throw error;
  removeLocal(state.companies, id); emit();
  logActivity('eliminó la empresa', 'company', name);
}

/* ============================================================
   TAREAS
   ============================================================ */
export async function createTask(fields) {
  const { data, error } = await supabase.from('tasks')
    .insert({ ...fields, created_by: state.user.id }).select().single();
  if (error) throw error;
  upsertLocal(state.tasks, data); emit();
  const comp = companyById(data.company_id);
  logActivity('creó la tarea', 'task', data.title, comp ? `para ${comp.name}` : '');
  // avisar al responsable si se le asignó al crear
  if (data.assigned_to) notify(data.assigned_to, 'assigned', `Te asignaron la tarea «${data.title}»`, 'task', data.id);
  return data;
}

export async function updateTask(id, fields, activityMsg = 'editó la tarea') {
  const prev = taskById(id);
  if (fields.status === 'completada' && prev?.status !== 'completada') {
    fields.completed_at = new Date().toISOString();
  }
  const { data, error } = await supabase.from('tasks')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id).select().single();
  if (error) throw error;
  upsertLocal(state.tasks, data); emit();
  logActivity(activityMsg, 'task', data.title);
  // avisar si cambió el responsable
  if (fields.assigned_to && fields.assigned_to !== prev?.assigned_to) {
    notify(fields.assigned_to, 'assigned', `Te asignaron la tarea «${data.title}»`, 'task', data.id);
  }
  return data;
}

export async function moveTask(id, status, statusLabel) {
  return updateTask(id, { status },
    status === 'completada' ? 'completó la tarea' : `movió a ${statusLabel}`);
}

export async function deleteTask(id) {
  const title = taskById(id)?.title || '';
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
  removeLocal(state.tasks, id); emit();
  logActivity('eliminó la tarea', 'task', title);
}

/* ============================================================
   COMENTARIOS
   ============================================================ */
export async function loadComments(taskId) {
  const { data, error } = await supabase.from('comments')
    .select('*').eq('task_id', taskId).order('created_at');
  if (error) throw error;
  return data;
}

export async function addComment(taskId, body) {
  const { data, error } = await supabase.from('comments')
    .insert({ task_id: taskId, author: state.user.id, body }).select().single();
  if (error) throw error;
  const t = taskById(taskId);
  logActivity('comentó en', 'task', t?.title || '');
  // avisar al responsable de la tarea (si no es quien comenta)
  if (t?.assigned_to) notify(t.assigned_to, 'comment', `Nuevo comentario en «${t.title}»`, 'task', taskId);
  return data;
}

/* ============================================================
   PERFILES
   ============================================================ */
export async function updateProfile(id, fields) {
  const { data, error } = await supabase.from('profiles')
    .update(fields).eq('id', id).select().single();
  if (error) throw error;
  upsertLocal(state.profiles, data);
  if (state.user && id === state.user.id) state.me = data;
  emit();
  return data;
}
