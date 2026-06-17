// ============================================================
// reservation-intake (desplegada como "super-task") — Deno
// Punto único para RESERVAS:
//   • action ausente / 'create'  → PÚBLICO: el formulario web crea la reserva.
//   • action 'list' / 'update'   → requiere el PIN del dueño (validado aquí)
//     para que el panel del restaurante vea y gestione SUS reservas.
//
// Desplegar SIN verificación de JWT (es público):
//   supabase functions deploy <nombre> --no-verify-jwt
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM = Deno.env.get('REMINDER_FROM') ?? 'TAMA Studios <onboarding@resend.dev>';
const ALLOW = Deno.env.get('SUPPORT_ALLOW_ORIGIN') ?? '*';

// PIN del dueño por restaurante (mismo hash+sal que su panel; ya son públicos en su web).
const RESTAURANTS: Record<string, { salt: string; hash: string }> = {
  'TOT PIZZA': { salt: 'TP$26#pz', hash: 'd6934e6d1db8d9f67bd4f5f895f15c41d06818e315064dfc779177421bca7585' }
};
const RES_STATUSES = ['pendiente', 'confirmada', 'cancelada', 'no_show'];

function corsHeaders(origin: string | null) {
  let allow = '*';
  if (ALLOW !== '*') { const l = ALLOW.split(',').map((s: string) => s.trim()); allow = origin && l.includes(origin) ? origin : l[0]; }
  return { 'Access-Control-Allow-Origin': allow, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
}
const clean = (v: unknown, max = 500) => String(v ?? '').trim().slice(0, max);
async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function validPin(restaurant: string, pin: string) {
  const cfg = RESTAURANTS[restaurant];
  if (!cfg || !pin) return false;
  return (await sha256(cfg.salt + pin)) === cfg.hash;
}
const todayISO = () => new Date().toISOString().slice(0, 10);

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers });

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400, headers }); }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const action = clean(b.action, 20) || 'create';
  const restaurant = clean(b.restaurant, 120) || 'TOT PIZZA';

  // ---------- PANEL DEL DUEÑO (requiere PIN) ----------
  if (action === 'list' || action === 'update') {
    if (!(await validPin(restaurant, clean(b.pin, 40)))) {
      return new Response(JSON.stringify({ error: 'Acceso no autorizado' }), { status: 401, headers });
    }
    if (action === 'list') {
      const { data, error } = await supabase.from('reservations')
        .select('id,name,phone,res_date,res_time,people,notes,status,source')
        .eq('restaurant', restaurant).gte('res_date', todayISO())
        .order('res_date', { ascending: true }).order('res_time', { ascending: true }).limit(200);
      if (error) return new Response(JSON.stringify({ error: 'No se pudo leer' }), { status: 500, headers });
      return new Response(JSON.stringify({ reservations: data }), { status: 200, headers });
    }
    // update
    const id = clean(b.id, 64); const status = clean(b.status, 20);
    if (!id || !RES_STATUSES.includes(status)) return new Response(JSON.stringify({ error: 'Datos no válidos' }), { status: 400, headers });
    const { error } = await supabase.from('reservations')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id).eq('restaurant', restaurant);
    if (error) return new Response(JSON.stringify({ error: 'No se pudo actualizar' }), { status: 500, headers });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  }

  // ---------- ALTA PÚBLICA (formulario web) ----------
  if (clean(b.website) || clean(b._gotcha)) return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  const name = clean(b.name, 120), phone = clean(b.phone, 40), email = clean(b.email, 160).toLowerCase();
  const res_date = clean(b.res_date, 10), res_time = clean(b.res_time, 5);
  const people = Math.max(1, Math.min(99, parseInt(String(b.people ?? '2'), 10) || 2));
  const notes = clean(b.notes, 1000);
  if (!name || !phone || !res_date || !res_time) return new Response(JSON.stringify({ error: 'Faltan datos: nombre, teléfono, fecha y hora.' }), { status: 400, headers });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(res_date)) return new Response(JSON.stringify({ error: 'Fecha no válida.' }), { status: 400, headers });

  const { data: inserted, error } = await supabase.from('reservations')
    .insert({ restaurant, name, phone, email: email || null, res_date, res_time, people, notes: notes || null, source: 'web' })
    .select('id').single();
  if (error) return new Response(JSON.stringify({ error: 'No se pudo registrar la reserva.' }), { status: 500, headers });

  try {
    const { data: staff } = await supabase.from('profiles').select('id,email').in('role', ['admin', 'socio']);
    if (staff?.length) {
      await supabase.from('notifications').insert(staff.map((s: any) => ({
        user_id: s.id, actor_name: name, type: 'reservation',
        message: `Nueva reserva en ${restaurant}: ${name} · ${people}p · ${res_date} ${res_time}`,
        entity_type: 'reservation', entity_id: inserted.id
      })));
      if (RESEND_API_KEY) {
        const to = staff.map((s: any) => s.email).filter(Boolean) as string[];
        if (to.length) await fetch('https://api.resend.com/emails', {
          method: 'POST', headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: FROM, to, subject: `🍽️ Nueva reserva · ${restaurant}`,
            html: `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;color:#0B1020"><h2>Nueva reserva — ${restaurant}</h2><p><b>${name}</b> · ${phone}${email ? ` · ${email}` : ''}</p><p>📅 ${res_date} &nbsp; 🕒 ${res_time} &nbsp; 👥 ${people}</p>${notes ? `<p>📝 ${notes}</p>` : ''}</div>` })
        });
      }
    }
  } catch (_) { /* el aviso no rompe la respuesta */ }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
});
