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
  loaded: false
};

/* ---------- eventos ---------- */
const listeners = new Set();
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); }

/* ---------- helpers ---------- */
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
  const [profiles, companies, tasks, activity] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at'),
    supabase.from('companies').select('*').order('created_at', { ascending: false }),
    supabase.from('tasks').select('*').order('created_at', { ascending: false }),
    supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(80)
  ]);
  for (const r of [profiles, companies, tasks, activity]) {
    if (r.error) throw r.error;
  }
  state.profiles = profiles.data;
  state.companies = companies.data;
  state.tasks = tasks.data;
  state.activity = activity.data;
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
    .subscribe();
}

function applyChange(list, payload) {
  if (payload.eventType === 'DELETE') removeLocal(list, payload.old.id);
  else upsertLocal(list, payload.new);
  emit();
}

export function teardown() {
  if (channel) { supabase.removeChannel(channel); channel = null; }
  state.loaded = false;
  state.profiles = []; state.companies = []; state.tasks = []; state.activity = [];
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
  return data;
}

export async function updateTask(id, fields, activityMsg = 'editó la tarea') {
  if (fields.status === 'completada' && taskById(id)?.status !== 'completada') {
    fields.completed_at = new Date().toISOString();
  }
  const { data, error } = await supabase.from('tasks')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id).select().single();
  if (error) throw error;
  upsertLocal(state.tasks, data); emit();
  logActivity(activityMsg, 'task', data.title);
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
