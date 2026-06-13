-- ============================================================
-- NOTIFICACIONES — ejecutar una vez en el SQL Editor de Supabase.
-- (Si instalas desde cero con schema.sql, ya está incluido allí.)
-- ============================================================

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,  -- destinatario
  actor_name  text,        -- quién originó la notificación
  type        text,        -- 'assigned' | 'comment' | 'due' | ...
  message     text not null,
  entity_type text,        -- 'task' | 'company'
  entity_id   uuid,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, read, created_at desc);

alter table public.notifications enable row level security;

-- Solo ves TUS notificaciones; cualquiera autenticado puede crear (para avisar
-- a otros); solo puedes marcar como leídas las tuyas.
drop policy if exists "notif_read"   on public.notifications;
drop policy if exists "notif_insert" on public.notifications;
drop policy if exists "notif_update" on public.notifications;
drop policy if exists "notif_delete" on public.notifications;
create policy "notif_read"   on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notif_insert" on public.notifications for insert to authenticated with check (true);
create policy "notif_update" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notif_delete" on public.notifications for delete to authenticated using (user_id = auth.uid());

-- Realtime
alter publication supabase_realtime add table public.notifications;
