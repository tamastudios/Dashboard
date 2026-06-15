-- ============================================================
-- TAMA Dashboard — Tabla de prospectos (módulo Prospector)
-- ------------------------------------------------------------
-- Ejecutar en Supabase SQL Editor después del schema principal.
-- Guarda los negocios encontrados via Google Places que el
-- equipo marca como interesantes (saved) o descartados (vetoed).
-- ============================================================

-- ---------- limpieza idempotente ----------
drop table if exists public.prospects cascade;

-- ============================================================
-- PROSPECTS — negocios encontrados en Google Places
-- ============================================================
create table public.prospects (
  id            uuid primary key default gen_random_uuid(),
  place_id      text not null,                       -- Google Places ID (único por lugar)
  name          text not null,
  address       text,
  website       text,
  phone         text,
  rating        numeric(3,1),
  rating_count  int,
  types         text[],                              -- categorías de Google Places
  maps_url      text,
  status        text not null default 'saved'
                check (status in ('saved','vetoed')),
  notes         text,
  zone          text,                                -- zona donde se buscó
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (place_id, created_by)                     -- cada usuario puede guardar el mismo negocio
);

create index prospects_status_idx   on public.prospects(status);
create index prospects_created_idx  on public.prospects(created_at desc);
create index prospects_user_idx     on public.prospects(created_by);

-- ============================================================
-- ROW LEVEL SECURITY
-- Cada usuario solo ve y gestiona sus propios prospectos.
-- ============================================================
alter table public.prospects enable row level security;

drop policy if exists "prospects_read"   on public.prospects;
drop policy if exists "prospects_insert" on public.prospects;
drop policy if exists "prospects_update" on public.prospects;
drop policy if exists "prospects_delete" on public.prospects;

create policy "prospects_read"   on public.prospects for select to authenticated
  using (created_by = auth.uid());
create policy "prospects_insert" on public.prospects for insert to authenticated
  with check (created_by = auth.uid());
create policy "prospects_update" on public.prospects for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "prospects_delete" on public.prospects for delete to authenticated
  using (created_by = auth.uid());

-- ============================================================
-- REALTIME
-- ============================================================
alter publication supabase_realtime add table public.prospects;
