-- ============================================================
-- TAMA Dashboard — Esquema de base de datos (Supabase / Postgres)
-- ------------------------------------------------------------
-- Cómo usar:
--   1. Crea un proyecto en https://supabase.com
--   2. Abre el "SQL Editor" y pega TODO este archivo
--   3. Pulsa "Run"
--   4. Crea los usuarios en Authentication → Users (Add user)
--      con email + contraseña. El trigger crea su perfil solo.
--   5. Marca a un usuario como admin (ver el final del archivo).
-- ============================================================

-- ---------- limpieza idempotente (re-ejecutable sin error) ----------
drop table if exists public.comments      cascade;
drop table if exists public.activity_log  cascade;
drop table if exists public.tasks         cascade;
drop table if exists public.companies     cascade;
drop table if exists public.profiles      cascade;

-- ============================================================
-- PROFILES — un registro por usuario autenticado
-- ============================================================
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  name        text,
  avatar_url  text,
  role        text not null default 'socio'
              check (role in ('admin','socio','colaborador')),
  created_at  timestamptz not null default now()
);

-- ============================================================
-- COMPANIES — empresas / clientes
-- ============================================================
create table public.companies (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  contact_person  text,
  email           text,
  phone           text,
  website         text,
  status          text not null default 'prospecto'
                  check (status in ('prospecto','activo','pausa','finalizado')),
  priority        text not null default 'media'
                  check (priority in ('baja','media','alta','urgente')),
  notes           text,
  owner_id        uuid references public.profiles(id) on delete set null,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- TASKS — tareas
-- ============================================================
create table public.tasks (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  company_id    uuid references public.companies(id) on delete set null,
  assigned_to   uuid references public.profiles(id) on delete set null,
  status        text not null default 'pendiente'
                check (status in ('pendiente','progreso','revision','bloqueada','completada')),
  priority      text not null default 'media'
                check (priority in ('baja','media','alta','urgente')),
  due_date      date,
  link_url      text,
  labels        text[] not null default '{}',
  created_by    uuid references public.profiles(id) on delete set null,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index tasks_company_idx  on public.tasks(company_id);
create index tasks_assigned_idx on public.tasks(assigned_to);
create index tasks_status_idx   on public.tasks(status);
create index tasks_due_idx      on public.tasks(due_date);

-- ============================================================
-- COMMENTS — comentarios internos de cada tarea
-- ============================================================
create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  author      uuid references public.profiles(id) on delete set null,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index comments_task_idx on public.comments(task_id);

-- ============================================================
-- ACTIVITY_LOG — historial de cambios
-- ============================================================
create table public.activity_log (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles(id) on delete set null,
  user_name    text,
  action       text not null,
  entity_type  text,
  entity_name  text,
  detail       text,
  created_at   timestamptz not null default now()
);
create index activity_created_idx on public.activity_log(created_at desc);

-- ============================================================
-- NOTIFICATIONS — avisos in-app por usuario
-- ============================================================
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  actor_name  text,
  type        text,
  message     text not null,
  entity_type text,
  entity_id   uuid,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, read, created_at desc);

-- ============================================================
-- TRIGGER: crear perfil automáticamente al registrar un usuario
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    -- el primer usuario del sistema será admin; el resto, socio
    case when (select count(*) from public.profiles) = 0 then 'admin' else 'socio' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- Modelo por rol:
--   · admin / socio  → acceso completo (incluido borrar)
--   · colaborador    → puede ver, crear y editar, pero NO borrar
--                      empresas ni tareas.
-- Nadie sin sesión accede a nada.
-- ============================================================
alter table public.profiles      enable row level security;
alter table public.companies     enable row level security;
alter table public.tasks         enable row level security;
alter table public.comments      enable row level security;
alter table public.activity_log  enable row level security;
alter table public.notifications enable row level security;

-- Función auxiliar: ¿el usuario actual es admin o socio?
create or replace function public.is_staff()
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin','socio')
  );
$$;

-- PROFILES: todos los autenticados pueden leer; cada uno edita el suyo;
-- los admin pueden editar cualquiera (p. ej. cambiar roles).
drop policy if exists "profiles_read"          on public.profiles;
drop policy if exists "profiles_update_self"   on public.profiles;
drop policy if exists "profiles_admin_update"  on public.profiles;
create policy "profiles_read" on public.profiles for select to authenticated using (true);
create policy "profiles_update_self" on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_admin_update" on public.profiles for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- COMPANIES (datos maestros / cartera de clientes):
-- todos pueden verlas; solo admin o socio puede crear, editar y borrar.
drop policy if exists "companies_all"    on public.companies;
drop policy if exists "companies_read"   on public.companies;
drop policy if exists "companies_insert" on public.companies;
drop policy if exists "companies_update" on public.companies;
drop policy if exists "companies_delete" on public.companies;
create policy "companies_read"   on public.companies for select to authenticated using (true);
create policy "companies_insert" on public.companies for insert to authenticated with check (public.is_staff());
create policy "companies_update" on public.companies for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "companies_delete" on public.companies for delete to authenticated using (public.is_staff());

-- TASKS (trabajo diario): todos pueden ver, crear y editar; borrar solo staff.
drop policy if exists "tasks_all"    on public.tasks;
drop policy if exists "tasks_read"   on public.tasks;
drop policy if exists "tasks_insert" on public.tasks;
drop policy if exists "tasks_update" on public.tasks;
drop policy if exists "tasks_delete" on public.tasks;
create policy "tasks_read"   on public.tasks for select to authenticated using (true);
create policy "tasks_insert" on public.tasks for insert to authenticated with check (true);
create policy "tasks_update" on public.tasks for update to authenticated using (true) with check (true);
create policy "tasks_delete" on public.tasks for delete to authenticated using (public.is_staff());

-- COMMENTS: ver todos; solo puedes crear/editar comentarios como tú mismo;
-- borrar el propio o si eres admin/socio.
drop policy if exists "comments_all"    on public.comments;
drop policy if exists "comments_read"   on public.comments;
drop policy if exists "comments_insert" on public.comments;
drop policy if exists "comments_update" on public.comments;
drop policy if exists "comments_delete" on public.comments;
create policy "comments_read"   on public.comments for select to authenticated using (true);
create policy "comments_insert" on public.comments for insert to authenticated with check (author = auth.uid());
create policy "comments_update" on public.comments for update to authenticated using (author = auth.uid()) with check (author = auth.uid());
create policy "comments_delete" on public.comments for delete to authenticated using (author = auth.uid() or public.is_staff());

-- ACTIVITY_LOG: lectura para todos; al insertar, el user_id DEBE ser el tuyo
-- (impide falsificar la autoría de los registros).
drop policy if exists "activity_read"   on public.activity_log;
drop policy if exists "activity_insert" on public.activity_log;
create policy "activity_read"   on public.activity_log for select to authenticated using (true);
create policy "activity_insert" on public.activity_log for insert to authenticated with check (user_id = auth.uid());

-- NOTIFICATIONS: solo ves las tuyas; cualquiera puede crear (avisar a otros);
-- solo marcas como leídas / borras las tuyas.
create policy "notif_read"   on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notif_insert" on public.notifications for insert to authenticated with check (true);
create policy "notif_update" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notif_delete" on public.notifications for delete to authenticated using (user_id = auth.uid());

-- ============================================================
-- REALTIME: publicar cambios de estas tablas
-- ============================================================
alter publication supabase_realtime add table public.companies;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.activity_log;
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.notifications;

-- ============================================================
-- (OPCIONAL) Marcar un usuario concreto como admin:
--   update public.profiles set role = 'admin'
--   where email = 'tu-email@dominio.com';
--
-- (OPCIONAL) Datos de ejemplo para probar la interfaz:
--   insert into public.companies (name, status, priority)
--   values ('Empresa Demo', 'activo', 'alta');
-- ============================================================
