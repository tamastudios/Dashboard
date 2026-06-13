# TAMA · Dashboard

Dashboard interno de **TAMA Studios** para gestionar clientes, tareas, responsables y calendario, con **datos compartidos en tiempo real** entre todos los socios.

No es una app local: usa una base de datos en la nube (Supabase) y los cambios de cualquier usuario se ven al instante en el resto de pantallas, sin recargar.

![estado](https://img.shields.io/badge/estado-listo%20para%20usar-22c55e) ![stack](https://img.shields.io/badge/stack-Vite%20%2B%20Supabase-4f46e5)

---

## ✨ Funcionalidades

- **Autenticación** por email y contraseña (solo el equipo accede).
- **Dashboard** con métricas: empresas activas, tareas pendientes / en progreso / completadas, vencidas, próximas entregas, actividad reciente y "qué hace cada socio".
- **Empresas / Clientes**: alta, edición, borrado, búsqueda, filtros por estado y prioridad, responsable principal y notas internas.
- **Tareas**: estados (Pendiente, En progreso, En revisión, Bloqueada, Completada), prioridades, fecha límite, etiquetas, enlace, comentarios y asignación a un socio y a una empresa.
- **Kanban** con arrastrar y soltar — el estado se actualiza en la base de datos en tiempo real.
- **Calendario** mensual y semanal, con color por prioridad o estado; clic para ver detalle, clic en un día para crear tarea.
- **Equipo**: carga de trabajo, tareas hechas/pendientes/vencidas y próximas entregas por persona.
- **Actividad**: historial agrupado por día (quién hizo qué y cuándo).
- **Ajustes**: perfil, tema claro/oscuro y gestión de roles (admin).
- **Tiempo real** en empresas, tareas, comentarios y actividad.
- **UX**: toasts, estados de carga, estados vacíos, confirmación antes de borrar, búsqueda global, filtros y ordenación.
- **Modo claro y oscuro**, responsive (escritorio, tablet y móvil).

---

## 🧱 Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | HTML + CSS + JavaScript (ES modules), **Vite** |
| Backend / BBDD | **Supabase** (PostgreSQL + Auth + Realtime) |
| Autenticación | Supabase Auth (email + contraseña) |
| Despliegue | **GitHub Pages** (GitHub Actions) |

Sin frameworks pesados: JS vanilla modular, rápido y fácil de mantener.

---

## 📸 Capturas

> _Espacio reservado para capturas. Añade imágenes en `docs/` y enlázalas aquí._
>
> - `docs/dashboard.png` — Vista principal
> - `docs/kanban.png` — Tablero Kanban
> - `docs/calendar.png` — Calendario

---

## 🚀 Instalación local

Requisitos: **Node.js 18+**.

```bash
git clone https://github.com/tamastudios/Dashboard.git
cd Dashboard
npm install
cp .env.example .env      # y rellena los valores (ver abajo)
npm run dev
```

Abre la URL que muestra Vite (por defecto `http://localhost:5173`).

---

## 🔑 Variables de entorno

Copia `.env.example` como `.env` y rellena con los datos de tu proyecto Supabase (**Settings → API**):

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...tu-anon-key...
```

> La `anon key` es **pública por diseño**: la seguridad real la imponen las políticas RLS de la base de datos. Aun así, el archivo `.env` **nunca se sube** al repositorio (está en `.gitignore`). Para el despliegue se usan *secrets* de GitHub.

---

## 🗄️ Configuración de la base de datos

1. Crea un proyecto gratis en [supabase.com](https://supabase.com).
2. Ve al **SQL Editor**, pega todo el contenido de [`supabase/schema.sql`](supabase/schema.sql) y pulsa **Run**.
   Esto crea las tablas, los índices, el trigger de creación de perfiles, las políticas de seguridad (RLS) y activa el *realtime*.
3. Crea los usuarios en **Authentication → Users → Add user** (email + contraseña). Empieza por los **dos socios**.
   - El **primer usuario** que se cree recibe el rol `admin` automáticamente.
   - El perfil de cada usuario se crea solo gracias al trigger.
4. (Opcional) Marca a alguien como admin manualmente:
   ```sql
   update public.profiles set role = 'admin' where email = 'tu-email@dominio.com';
   ```

### Estructura de tablas

| Tabla | Contenido |
|-------|-----------|
| `profiles` | Usuarios: nombre, email, avatar, rol (`admin` / `socio` / `colaborador`) |
| `companies` | Empresas/clientes con estado, prioridad, contacto, responsable y notas |
| `tasks` | Tareas con estado, prioridad, fecha, etiquetas, empresa y responsable |
| `comments` | Comentarios internos por tarea |
| `activity_log` | Historial de cambios (quién, qué, cuándo) |

Relaciones: una empresa tiene muchas tareas; una tarea pertenece a una empresa y a un responsable; los comentarios pertenecen a una tarea. Todas las tablas tienen `created_at`/`updated_at` y `created_by`/`assigned_to` según corresponda.

---

## ☁️ Despliegue en GitHub Pages

El repositorio incluye un workflow ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) que compila y publica automáticamente en cada push a `main`.

**Pasos (una sola vez):**

1. En GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. En **Settings → Secrets and variables → Actions**, crea dos *secrets*:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Haz push a `main`. El workflow construye el sitio y lo publica en:
   `https://tamastudios.github.io/Dashboard/`
4. En Supabase, añade esa URL en **Authentication → URL Configuration → Site URL / Redirect URLs**.

> El `base` de Vite ya está configurado como `/Dashboard/` para que las rutas funcionen en GitHub Pages.

### Comandos

```bash
npm run dev       # desarrollo local
npm run build     # build de producción (carpeta dist/)
npm run preview   # previsualizar el build
```

---

## 🗺️ Roadmap

Ver [`ROADMAP.md`](ROADMAP.md). Resumen:

- Notificaciones por email y push.
- Integración con Google Calendar, Slack/Discord.
- Adjuntos reales (Supabase Storage).
- Exportar tareas a CSV/PDF.
- Métricas de productividad y CRM avanzado (pipeline de ventas, facturación).
- Permisos avanzados por equipo.

---

## 🔒 Seguridad

- No se exponen claves secretas: solo la `anon key` pública, protegida por **RLS**.
- Variables de entorno fuera del repositorio (`.env` en `.gitignore`); `.env.example` como plantilla.
- Acceso al dashboard **solo para usuarios autenticados**.
- Validación de formularios en el cliente.
- Confirmación antes de borrar.

---

## 📄 Licencia

MIT © TAMA Studios. Ver [`LICENSE`](LICENSE).
