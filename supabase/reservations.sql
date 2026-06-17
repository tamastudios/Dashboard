-- ============================================================
-- TAMA Dashboard — Reservas (de restaurantes cliente)
-- ------------------------------------------------------------
-- Una sola tabla para reservas que llegan por WEB y por WhatsApp.
-- Las inserta la Edge Function "reservation-intake" (service role).
-- El equipo (admin/socio) las gestiona desde el dashboard.
-- Ejecutar en Supabase SQL Editor después del schema principal.
-- ============================================================
drop table if exists public.reservations cascade;

create table public.reservations (
  id          uuid primary key default gen_random_uuid(),
  restaurant  text not null default 'TOT PIZZA',  -- a qué cliente pertenece
  name        text not null,
  phone       text not null,
  email       text,
  res_date    date not null,                       -- fecha de la reserva
  res_time    text not null,                       -- hora (HH:MM)
  people      int  not null default 2,             -- comensales
  notes       text,
  source      text not null default 'web'
              check (source in ('web','whatsapp','telefono','interno')),
  status      text not null default 'pendiente'
              check (status in ('pendiente','confirmada','cancelada','no_show')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index reservations_date_idx    on public.reservations(res_date);
create index reservations_status_idx  on public.reservations(status);
create index reservations_rest_idx    on public.reservations(restaurant);

-- ============================================================
-- RLS: el equipo gestiona; el público no lee ni escribe directo
-- (las altas entran por la Edge Function con service role).
-- ============================================================
alter table public.reservations enable row level security;

drop policy if exists "reservations_read"   on public.reservations;
drop policy if exists "reservations_update" on public.reservations;
drop policy if exists "reservations_delete" on public.reservations;

create policy "reservations_read"   on public.reservations for select to authenticated using (true);
create policy "reservations_update" on public.reservations for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "reservations_delete" on public.reservations for delete to authenticated using (public.is_staff());

alter publication supabase_realtime add table public.reservations;
