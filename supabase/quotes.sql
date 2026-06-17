-- ============================================================
-- TAMA Dashboard — Presupuestos
-- Ejecutar en Supabase SQL Editor después del schema principal.
-- ============================================================
drop table if exists public.quotes cascade;

create table public.quotes (
  id             uuid primary key default gen_random_uuid(),
  number         text not null,                       -- nº de presupuesto (ej. PRE-2026-001)
  company_id     uuid references public.companies(id) on delete set null,
  client_name    text not null,
  client_tax_id  text,
  client_address text,
  client_email   text,
  issue_date     date not null default current_date,
  expires_at     date,
  items          jsonb not null default '[]'::jsonb,  -- [{concept, qty, price}]
  vat_rate       numeric(5,2) not null default 21,
  notes          text,
  status         text not null default 'borrador'
                 check (status in ('borrador','enviado','aceptado','rechazado')),
  subtotal       numeric(12,2) not null default 0,
  vat_amount     numeric(12,2) not null default 0,
  total          numeric(12,2) not null default 0,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index quotes_status_idx on public.quotes(status);
create index quotes_issue_idx  on public.quotes(issue_date desc);
create unique index quotes_number_uidx on public.quotes(number);

alter table public.quotes enable row level security;

drop policy if exists "quotes_read"   on public.quotes;
drop policy if exists "quotes_insert" on public.quotes;
drop policy if exists "quotes_update" on public.quotes;
drop policy if exists "quotes_delete" on public.quotes;

create policy "quotes_read"   on public.quotes for select to authenticated using (true);
create policy "quotes_insert" on public.quotes for insert to authenticated with check (public.is_staff());
create policy "quotes_update" on public.quotes for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "quotes_delete" on public.quotes for delete to authenticated using (public.is_staff());

alter publication supabase_realtime add table public.quotes;
