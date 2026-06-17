-- ============================================================
-- TAMA Dashboard — Leads (pipeline comercial)
-- Ejecutar en Supabase SQL Editor después del schema principal.
-- ============================================================
drop table if exists public.leads cascade;

create table public.leads (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,                       -- empresa / nombre del lead
  contact      text,                                -- persona de contacto
  email        text,
  phone        text,
  source       text,                                -- origen (Instagram, referido, web…)
  service      text,                                -- servicio de interés
  value        numeric(12,2) not null default 0,    -- valor estimado
  status       text not null default 'nuevo'
               check (status in ('nuevo','contactado','cualificado','propuesta','ganado','perdido')),
  next_action  text,                                -- próxima acción
  next_date    date,
  owner_id     uuid references public.profiles(id) on delete set null,  -- responsable
  company_id   uuid references public.companies(id) on delete set null, -- si se convierte en cliente
  notes        text,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index leads_status_idx  on public.leads(status);
create index leads_created_idx on public.leads(created_at desc);

alter table public.leads enable row level security;

drop policy if exists "leads_read"   on public.leads;
drop policy if exists "leads_insert" on public.leads;
drop policy if exists "leads_update" on public.leads;
drop policy if exists "leads_delete" on public.leads;

create policy "leads_read"   on public.leads for select to authenticated using (true);
create policy "leads_insert" on public.leads for insert to authenticated with check (public.is_staff());
create policy "leads_update" on public.leads for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "leads_delete" on public.leads for delete to authenticated using (public.is_staff());

alter publication supabase_realtime add table public.leads;
