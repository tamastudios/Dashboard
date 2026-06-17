// ============================================================
// reservation-intake — Edge Function de Supabase (Deno)
// Punto de entrada PÚBLICO para el formulario de reservas de la web.
// Valida, frena spam (honeypot) e inserta en `reservations` con la
// service role. Avisa al equipo (notificación in-app + email opcional).
// El futuro agente de WhatsApp puede escribir en la MISMA tabla.
//
// Desplegar SIN verificación de JWT (es público):
//   supabase functions deploy reservation-intake --no-verify-jwt
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM = Deno.env.get('REMINDER_FROM') ?? 'TAMA Studios <onboarding@resend.dev>';
const ALLOW = Deno.env.get('SUPPORT_ALLOW_ORIGIN') ?? '*';

function corsHeaders(origin: string | null) {
  let allow = '*';
  if (ALLOW !== '*') {
    const list = ALLOW.split(',').map((s) => s.trim());
    allow = origin && list.includes(origin) ? origin : list[0];
  }
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
}

const clean = (v: unknown, max = 500) => String(v ?? '').trim().slice(0, max);

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers });

  let b: Record<string, unknown>;
  try { b = await req.json(); }
  catch { return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400, headers }); }

  if (clean(b.website) || clean(b._gotcha)) return new Response(JSON.stringify({ ok: true }), { status: 200, headers });

  const restaurant = clean(b.restaurant, 120) || 'TOT PIZZA';
  const name = clean(b.name, 120);
  const phone = clean(b.phone, 40);
  const email = clean(b.email, 160).toLowerCase();
  const res_date = clean(b.res_date, 10);   // YYYY-MM-DD
  const res_time = clean(b.res_time, 5);    // HH:MM
  const people = Math.max(1, Math.min(99, parseInt(String(b.people ?? '2'), 10) || 2));
  const notes = clean(b.notes, 1000);

  if (!name || !phone || !res_date || !res_time) {
    return new Response(JSON.stringify({ error: 'Faltan datos: nombre, teléfono, fecha y hora.' }), { status: 400, headers });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(res_date)) {
    return new Response(JSON.stringify({ error: 'Fecha no válida.' }), { status: 400, headers });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: inserted, error } = await supabase.from('reservations')
    .insert({ restaurant, name, phone, email: email || null, res_date, res_time, people, notes: notes || null, source: 'web' })
    .select('id').single();

  if (error) return new Response(JSON.stringify({ error: 'No se pudo registrar la reserva.' }), { status: 500, headers });

  try {
    const { data: staff } = await supabase.from('profiles').select('id,email').in('role', ['admin', 'socio']);
    if (staff?.length) {
      await supabase.from('notifications').insert(staff.map((s) => ({
        user_id: s.id, actor_name: name, type: 'reservation',
        message: `Nueva reserva en ${restaurant}: ${name} · ${people}p · ${res_date} ${res_time}`,
        entity_type: 'reservation', entity_id: inserted.id
      })));
      if (RESEND_API_KEY) {
        const to = staff.map((s) => s.email).filter(Boolean) as string[];
        if (to.length) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: FROM, to,
              subject: `🍽️ Nueva reserva · ${restaurant}`,
              html: `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;color:#0B1020">
                <h2>Nueva reserva — ${restaurant}</h2>
                <p><b>${name}</b> · ${phone}${email ? ` · ${email}` : ''}</p>
                <p>📅 ${res_date} &nbsp; 🕒 ${res_time} &nbsp; 👥 ${people}</p>
                ${notes ? `<p>📝 ${notes}</p>` : ''}
                <p style="font-size:12px;color:#999;margin-top:20px">Gestiónala en el dashboard → Reservas</p>
              </div>`
            })
          });
        }
      }
    }
  } catch (_) { /* el aviso no debe romper la respuesta */ }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
});
