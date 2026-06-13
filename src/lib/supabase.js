import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** true si faltan las variables de entorno (muestra pantalla de setup) */
export const configMissing = !url || !anonKey || url.includes('TU-PROYECTO');

export const supabase = configMissing ? null : createClient(url, anonKey);
