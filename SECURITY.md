# Seguridad — TAMA Dashboard

Resumen del modelo de seguridad, qué puede hacer cada rol y cómo verificarlo.

## Autenticación
- Login email + contraseña (Supabase Auth). Contraseñas con hash bcrypt, nunca en el código.
- **2FA (TOTP)** con app de autenticación. **Obligatorio para admin y socio**, opcional para colaborador.
- Recuperación de contraseña por email.
- Cierre de sesión automático tras 5 min de inactividad.
- Sin sesión válida no se accede a ningún dato.

## Roles y permisos

| Acción | Admin | Socio | Colaborador |
|---|:---:|:---:|:---:|
| Ver empresas, tareas, calendario, equipo | ✅ | ✅ | ✅ |
| Crear / editar **tareas** | ✅ | ✅ | ✅ |
| Borrar **tareas** | ✅ | ✅ | ❌ |
| Crear / editar **empresas** | ✅ | ✅ | ❌ |
| Borrar **empresas** | ✅ | ✅ | ❌ |
| Comentar (como uno mismo) | ✅ | ✅ | ✅ |
| Cambiar roles de otros | ✅ | ❌ | ❌ |
| Editar el propio perfil | ✅ | ✅ | ✅ |
| 2FA | Obligatorio | Obligatorio | Opcional |

> Las empresas son "datos maestros" (cartera de clientes): solo admin y socio las gestionan.
> Las tareas son el trabajo diario: todos colaboran, pero borrar queda restringido.

Estas reglas se aplican en **dos capas**: la interfaz oculta los botones según el rol
(UX) y, lo importante, las **políticas RLS de la base de datos** las imponen de verdad
(aunque alguien intente saltarse la interfaz).

## Row Level Security (RLS)
RLS activado en las 6 tablas. Resumen de políticas (ver `supabase/schema.sql`):

- `profiles`: lectura para autenticados; cada uno edita el suyo; solo admin edita roles.
- `companies`: lectura todos; crear/editar/borrar solo `is_staff()` (admin o socio).
- `tasks`: lectura/crear/editar todos; borrar solo `is_staff()`.
- `comments`: lectura todos; crear/editar solo como uno mismo; borrar el propio o staff.
- `activity_log`: lectura todos; insertar solo con el propio `user_id` (no se falsifica autoría).
- `notifications`: cada usuario solo ve / marca las suyas.

## Frontend
- **CSP** estricta (`script-src 'self'`, sin inline) — ver `<meta>` en `index.html`.
- `safeUrl()` bloquea `javascript:`/`data:` en enlaces y avatares (anti-XSS).
- Todo el contenido se renderiza escapado con `esc()`.
- Enlaces externos con `rel="noopener nofollow"`.
- `referrer-policy: strict-origin-when-cross-origin`.

## Secretos
- `.env` en `.gitignore` (nunca en el repo). Solo `.env.example` como plantilla.
- La `anon key` es pública por diseño; la protección real la dan las RLS.
- `service_role` y `RESEND_API_KEY` viven solo en los secrets de Supabase.

## Limitaciones conocidas (hosting)
GitHub Pages no permite cabeceras HTTP propias, así que `X-Frame-Options`,
`Strict-Transport-Security` (HSTS) y `X-Content-Type-Options` no se pueden enviar
como headers. La CSP incluye `frame-ancestors 'none'` vía `<meta>` como mitigación
de clickjacking. Para cabeceras completas, poner Cloudflare (gratis) por delante
del dominio y configurarlas ahí.

---

## ✅ Cómo probar las RLS manualmente (recomendado)

Crea un usuario de cada rol en **Authentication → Users** y comprueba:

### Como **colaborador**
1. Entra al dashboard. En **Empresas** no debe aparecer el botón "Nueva empresa"
   ni los de editar/eliminar.
2. En **Tareas**: sí puede crear y editar; al abrir el detalle, el botón
   "Eliminar" no debe aparecer.
3. Prueba de fuerza (consola del navegador, estando logueado como colaborador):
   ```js
   const { error } = await supabase.from('companies').delete().eq('id', 'UN_ID_REAL');
   // Debe NO borrar nada (RLS lo bloquea). error null pero 0 filas afectadas.
   ```

### Como **socio**
1. Debe poder crear/editar/borrar empresas y tareas.
2. En **Ajustes** NO debe ver el bloque "Miembros del equipo" (solo admin).
3. Al iniciar sesión por primera vez, debe **forzar la activación de 2FA**.

### Como **admin**
1. Control total. En Ajustes ve "Miembros del equipo" y puede cambiar roles.
2. También se le exige 2FA al entrar.

### 2FA
- Con un usuario admin/socio recién creado, al entrar debe salir el QR obligatorio.
- Una vez activado, al volver a entrar debe pedir el código de 6 dígitos.
- Un código incorrecto debe rechazar el acceso.

### Aislamiento de notificaciones
- Logueado como usuario A, en consola:
  ```js
  const { data } = await supabase.from('notifications').select('*');
  // Solo deben aparecer notificaciones cuyo user_id sea el de A.
  ```
