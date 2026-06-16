-- ============================================================
-- TAMA Dashboard — Soporte (solicitudes entrantes de clientes)
-- ------------------------------------------------------------
-- Ejecutar en Supabase SQL Editor después del schema principal.
-- Recoge las solicitudes que llegan desde el formulario web de
-- los clientes (a través de la Edge Function "support-intake").
--
-- Seguridad: la tabla NO es escribible por el público. La Edge
-- Function inserta con la service role (salta RLS). El público no
-- tiene ninguna política, así que no puede leer ni escribir
-- directamente. Solo el equipo (admin/socio) gestiona desde el
-- dashboard.
-- ============================================================

drop table if exists public.support_requests cascade;

create table public.support_requests (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,                       -- quién contacta
  email        text not null,
  phone        text,
  subject      text,
  message      text not null,
  company_id   uuid references public.companies(id) on delete set null,  -- cliente (si se identifica)
  client_name  text,                                -- nombre de empresa indicado en el formulario
  source       text not null default 'web'
               check (source in ('web','whatsapp','email','interno')),
  priority     text not null default 'media'
               check (priority in ('baja','media','alta','urgente')),
  status       text not null default 'nuevo'
               check (status in ('nuevo','abierto','progreso','resuelto','cerrado')),
  assigned_to  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index support_status_idx  on public.support_requests(status);
create index support_created_idx on public.support_requests(created_at desc);

-- ============================================================
-- ROW LEVEL SECURITY
-- Solo el equipo (admin/socio) puede leer y gestionar.
-- No hay política de INSERT para el público: las solicitudes
-- entran exclusivamente vía Edge Function (service role).
-- ============================================================
alter table public.support_requests enable row level security;

drop policy if exists "support_read"   on public.support_requests;
drop policy if exists "support_update" on public.support_requests;
drop policy if exists "support_delete" on public.support_requests;

create policy "support_read"   on public.support_requests for select to authenticated using (true);
create policy "support_update" on public.support_requests for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "support_delete" on public.support_requests for delete to authenticated using (public.is_staff());

-- ============================================================
-- REALTIME
-- ============================================================
alter publication supabase_realtime add table public.support_requests;
