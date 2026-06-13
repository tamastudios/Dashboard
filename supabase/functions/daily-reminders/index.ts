// ============================================================
// daily-reminders — Edge Function de Supabase (Deno)
// Envía un email a cada responsable con las tareas que vencen
// HOY o MAÑANA y que no están completadas.
//
// Pensada para ejecutarse 1 vez al día con pg_cron (ver README).
//
// Requiere estas variables (Project Settings → Edge Functions → Secrets):
//   SUPABASE_URL              (ya disponible por defecto)
//   SUPABASE_SERVICE_ROLE_KEY (ya disponible por defecto)
//   RESEND_API_KEY            (tu clave de https://resend.com)
//   REMINDER_FROM             (ej. "TAMA Studios <avisos@tudominio.com>")
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const FROM = Deno.env.get('REMINDER_FROM') ?? 'TAMA Studios <onboarding@resend.dev>';

const PRIORITY_LABEL: Record<string, string> = {
  baja: 'Baja', media: 'Media', alta: 'Alta', urgente: 'Urgente'
};

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const today = new Date();
  const tomorrow = new Date(Date.now() + 864e5);
  const dueDates = [isoDate(today), isoDate(tomorrow)];

  // tareas que vencen hoy/mañana, no completadas, con responsable
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id,title,due_date,priority,assigned_to,company_id')
    .in('due_date', dueDates)
    .neq('status', 'completada')
    .not('assigned_to', 'is', null);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  if (!tasks?.length) return new Response(JSON.stringify({ sent: 0, msg: 'sin tareas' }), { status: 200 });

  const { data: profiles } = await supabase.from('profiles').select('id,name,email');
  const { data: companies } = await supabase.from('companies').select('id,name');
  const profById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const compById = new Map((companies ?? []).map((c) => [c.id, c]));

  // agrupar tareas por responsable
  const byUser = new Map<string, typeof tasks>();
  for (const t of tasks) {
    if (!byUser.has(t.assigned_to)) byUser.set(t.assigned_to, []);
    byUser.get(t.assigned_to)!.push(t);
  }

  let sent = 0;
  for (const [userId, list] of byUser) {
    const prof = profById.get(userId);
    if (!prof?.email) continue;

    const rows = list.map((t) => {
      const comp = t.company_id ? compById.get(t.company_id)?.name : '';
      const when = t.due_date === dueDates[0] ? 'Hoy' : 'Mañana';
      return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #eee">${t.title}${comp ? ` · <span style="color:#666">${comp}</span>` : ''}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">${when} · ${PRIORITY_LABEL[t.priority] ?? t.priority}</td>
      </tr>`;
    }).join('');

    const html = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;color:#0B1020">
        <h2 style="color:#0B1020">Hola ${prof.name ?? ''} 👋</h2>
        <p style="color:#444">Tienes <b>${list.length}</b> tarea(s) que vencen pronto:</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
        <p style="margin-top:24px;font-size:12px;color:#999">TAMA Studios · Dashboard interno</p>
      </div>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: prof.email,
        subject: `⏰ ${list.length} tarea(s) por vencer · TAMA Dashboard`,
        html
      })
    });
    if (res.ok) sent++;
  }

  return new Response(JSON.stringify({ sent }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
