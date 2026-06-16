# Formulario de soporte embebible

Formulario público que los clientes usan para abrir una solicitud de soporte.
Las solicitudes llegan al dashboard (sección **Soporte / Tickets**) en tiempo real.

## Cómo funciona

```
Cliente → formulario (este HTML) → Edge Function "support-intake" → tabla support_requests → Dashboard
```

La tabla está cerrada al público: solo la Edge Function (validada y con anti-spam) puede escribir.

## Puesta en marcha (una vez)

1. **Base de datos:** en Supabase → SQL Editor, ejecuta `supabase/support.sql`.
2. **Edge Function:** despliega la función como pública (sin verificación de JWT):
   ```bash
   supabase functions deploy support-intake --no-verify-jwt
   ```
   (Opcional) Secrets en Project Settings → Edge Functions:
   - `RESEND_API_KEY` y `REMINDER_FROM` → aviso por email al equipo.
   - `SUPPORT_ALLOW_ORIGIN` → CSV de dominios permitidos (CORS). Por defecto `*`.
3. **Formulario:** abre `support-form/index.html` y pega la URL de tu función en
   `FUNCTION_URL` (la ves en Supabase → Edge Functions → support-intake).

## Cómo ponerlo en la web de un cliente

**Opción A — iframe (lo más simple):** sube `index.html` a una URL (o a la web del cliente) y empótralo:

```html
<iframe src="https://tu-dominio.com/support-form/index.html"
        style="width:100%;max-width:560px;height:680px;border:0"></iframe>
```

**Opción B — integrado:** copia el `<form>`, el `<style>` y el `<script>` directamente
en una página del cliente (p. ej. `/soporte`). Solo necesita el `FUNCTION_URL`.

**Opción C — enlace/QR:** comparte la URL del formulario tal cual (página de soporte propia).

## Anti-spam
Incluye un *honeypot* (campo oculto `website`). Si quieres más capas más adelante:
límite por IP en la función, o un captcha (hCaptcha/Turnstile) validado en la función.
