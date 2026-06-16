// ============================================================
// support-intake — Edge Function de Supabase (Deno)
// Punto de entrada PÚBLICO para el formulario de soporte de los
// clientes. Valida, frena spam (honeypot) e inserta la solicitud
// en `support_requests` usando la service role. Avisa al equipo
// (notificación in-app y, si hay Resend, por email).
//
// Desplegar SIN verificación de JWT (es público):
//   supabase functions deploy support-intake --no-verify-jwt
//
// Secrets (Project Settings → Edge Functions):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (por defecto)
//   RESEND_API_KEY   (opcional, para aviso por email)
//   REMINDER_FROM    (opcional, remitente del email)
//   SUPPORT_ALLOW_ORIGIN (opcional, CSV de dominios permitidos; por defecto *)
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

const clean = (v: unknown, max = 2000) => String(v ?? '').trim().slice(0, max);
const validEmail = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400, headers }); }

  // Honeypot: si un bot rellena el campo oculto, fingimos éxito y no guardamos nada.
  if (clean(body.website) || clean(body._gotcha)) {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  }

  const name = clean(body.name, 120);
  const email = clean(body.email, 160).toLowerCase();
  const phone = clean(body.phone, 40);
  const subject = clean(body.subject, 160);
  const message = clean(body.message, 4000);
  const client_name = clean(body.client_name ?? body.company, 160);

  if (!name || !email || !message) {
    return new Response(JSON.stringify({ error: 'Faltan campos obligatorios (nombre, email y mensaje).' }), { status: 400, headers });
  }
  if (!validEmail(email)) {
    return new Response(JSON.stringify({ error: 'El email no es válido.' }), { status: 400, headers });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: inserted, error } = await supabase
    .from('support_requests')
    .insert({ name, email, phone: phone || null, subject: subject || null, message, client_name: client_name || null, source: 'web' })
    .select('id')
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: 'No se pudo registrar la solicitud.' }), { status: 500, headers });
  }

  // Aviso in-app a todo el equipo (admin/socio)
  try {
    const { data: staff } = await supabase.from('profiles').select('id,email').in('role', ['admin', 'socio']);
    if (staff?.length) {
      await supabase.from('notifications').insert(staff.map((s) => ({
        user_id: s.id,
        actor_name: name,
        type: 'support',
        message: `Nueva solicitud de soporte de ${name}${client_name ? ` (${client_name})` : ''}`,
        entity_type: 'support',
        entity_id: inserted.id
      })));
    }

    // Aviso por email (opcional, solo si hay Resend configurado)
    if (RESEND_API_KEY && staff?.length) {
      const to = staff.map((s) => s.email).filter(Boolean) as string[];
      if (to.length) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: FROM, to,
            subject: `🆘 Nueva solicitud de soporte · ${name}`,
            html: `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;color:#0B1020">
              <h2>Nueva solicitud de soporte</h2>
              <p><b>De:</b> ${name} &lt;${email}&gt;${phone ? ` · ${phone}` : ''}</p>
              ${client_name ? `<p><b>Cliente:</b> ${client_name}</p>` : ''}
              ${subject ? `<p><b>Asunto:</b> ${subject}</p>` : ''}
              <p style="white-space:pre-wrap;border-left:3px solid #eee;padding-left:12px;color:#444">${message}</p>
              <p style="font-size:12px;color:#999;margin-top:24px">Ábrela en el dashboard → Soporte</p>
            </div>`
          })
        });
      }
    }
  } catch (_) { /* el aviso no debe romper la respuesta al cliente */ }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
});
