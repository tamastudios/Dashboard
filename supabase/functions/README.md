# Recordatorios por email (opcional)

La función `daily-reminders` envía cada mañana un email a cada socio con las
tareas que vencen **hoy o mañana**. Es opcional: las **notificaciones in-app**
(la campana) ya funcionan sin esto. Configúralo solo si quieres también el aviso
por correo.

## Requisitos
- Cuenta gratuita en [resend.com](https://resend.com) (100 emails/día gratis).

> ⚠️ Sin un dominio verificado en Resend, solo puedes enviar emails al **correo
> de tu propia cuenta de Resend** (modo prueba) y el remitente es
> `onboarding@resend.dev`. Para enviar a todo el equipo, verifica tu dominio en
> Resend (Domains → Add domain) y pon `REMINDER_FROM` con ese dominio.

---

## Opción A — Sin instalar nada (panel web de Supabase) ✅ recomendada

1. **Secret de la API key**: en Supabase → *Edge Functions* → *Secrets* (o
   *Project Settings → Edge Functions → Add new secret*):
   - `RESEND_API_KEY` = tu clave de Resend
   - (opcional) `REMINDER_FROM` = `TAMA Studios <avisos@tudominio.com>`

2. **Crear la función**: Supabase → *Edge Functions* → *Deploy a new function* →
   *Via editor*. Nómbrala `daily-reminders` y pega el contenido de
   [`daily-reminders/index.ts`](daily-reminders/index.ts). Deploy.

3. **Programar el cron**: ver el paso 4 más abajo.

---

## Opción B — Con Supabase CLI

Requiere [Supabase CLI](https://supabase.com/docs/guides/cli) instalado.

## Pasos

1. **Consigue una API key de Resend** y, si tienes dominio propio, verifícalo en
   Resend para enviar desde `avisos@tudominio.com`. (Sin dominio puedes probar
   con el remitente `onboarding@resend.dev`.)

2. **Guarda los secretos** en Supabase:
   ```bash
   supabase secrets set RESEND_API_KEY=re_xxxxxxxx
   supabase secrets set REMINDER_FROM="TAMA Studios <avisos@tudominio.com>"
   ```

3. **Despliega la función**:
   ```bash
   supabase functions deploy daily-reminders
   ```

4. **Prográmala cada mañana** (p. ej. 8:00). En el **SQL Editor** de Supabase:
   ```sql
   -- activar las extensiones (una vez)
   create extension if not exists pg_cron;
   create extension if not exists pg_net;

   -- ejecutar la función cada día a las 08:00 UTC
   select cron.schedule(
     'daily-reminders',
     '0 8 * * *',
     $$
     select net.http_post(
       url     := 'https://TU-PROYECTO.functions.supabase.co/daily-reminders',
       headers := jsonb_build_object('Authorization', 'Bearer TU_ANON_KEY')
     );
     $$
   );
   ```
   Sustituye `TU-PROYECTO` y `TU_ANON_KEY`.

5. **Prueba manual** (opcional):
   ```bash
   supabase functions invoke daily-reminders
   ```

## Cómo desactivarlo
```sql
select cron.unschedule('daily-reminders');
```
