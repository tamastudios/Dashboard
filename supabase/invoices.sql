-- ============================================================
-- TAMA Dashboard — Facturación (módulo Facturas)
-- ------------------------------------------------------------
-- Ejecutar en Supabase SQL Editor después del schema principal.
-- Guarda las facturas que emitimos a clientes (autónomos): base
-- imponible, IVA, retención de IRPF, estado de cobro y líneas.
-- ============================================================

-- ---------- limpieza idempotente ----------
drop table if exists public.invoices cascade;

-- ============================================================
-- INVOICES — facturas emitidas a clientes
-- ============================================================
create table public.invoices (
  id             uuid primary key default gen_random_uuid(),
  number         text not null,                       -- nº de factura (ej. 2026-001)
  company_id     uuid references public.companies(id) on delete set null,  -- cliente (opcional)
  client_name    text not null,                       -- nombre/razón social del cliente
  client_tax_id  text,                                -- NIF / CIF del cliente
  client_address text,
  client_email   text,
  issue_date     date not null default current_date,  -- fecha de emisión
  due_date       date,                                -- fecha de vencimiento
  items          jsonb not null default '[]'::jsonb,  -- [{concept, qty, price}]
  vat_rate       numeric(5,2) not null default 21,    -- % IVA repercutido
  irpf_rate      numeric(5,2) not null default 0,     -- % retención IRPF
  notes          text,
  status         text not null default 'pendiente'
                 check (status in ('borrador','pendiente','pagada','vencida')),
  paid_date      date,
  -- totales calculados al guardar (para listados y resúmenes rápidos)
  subtotal       numeric(12,2) not null default 0,    -- base imponible
  vat_amount     numeric(12,2) not null default 0,    -- importe de IVA
  irpf_amount    numeric(12,2) not null default 0,    -- importe de retención
  total          numeric(12,2) not null default 0,    -- total a cobrar (base + IVA - IRPF)
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index invoices_status_idx  on public.invoices(status);
create index invoices_issue_idx   on public.invoices(issue_date desc);
create index invoices_company_idx on public.invoices(company_id);
create unique index invoices_number_uidx on public.invoices(number);

-- ============================================================
-- ROW LEVEL SECURITY
-- Datos financieros sensibles: todos los autenticados pueden
-- consultarlos, pero solo admin o socio puede crear/editar/borrar
-- (mismo criterio que las empresas).
-- ============================================================
alter table public.invoices enable row level security;

drop policy if exists "invoices_read"   on public.invoices;
drop policy if exists "invoices_insert" on public.invoices;
drop policy if exists "invoices_update" on public.invoices;
drop policy if exists "invoices_delete" on public.invoices;

create policy "invoices_read"   on public.invoices for select to authenticated
  using (true);
create policy "invoices_insert" on public.invoices for insert to authenticated
  with check (public.is_staff());
create policy "invoices_update" on public.invoices for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy "invoices_delete" on public.invoices for delete to authenticated
  using (public.is_staff());

-- ============================================================
-- REALTIME
-- ============================================================
alter publication supabase_realtime add table public.invoices;
