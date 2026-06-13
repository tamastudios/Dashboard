-- ============================================================
-- ACTUALIZACIÓN DE SEGURIDAD — ejecutar UNA vez en un proyecto
-- que ya tenía el schema.sql original aplicado.
--
-- Qué hace (no borra datos):
--   · Permisos por rol: colaboradores no pueden borrar empresas/tareas.
--   · activity_log: impide falsificar la autoría de los registros.
--   · comments: solo creas/editas comentarios como tú mismo.
--
-- Cómo usar: SQL Editor de Supabase → pega todo → Run.
-- ============================================================

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

-- COMPANIES
drop policy if exists "companies_all"    on public.companies;
drop policy if exists "companies_read"   on public.companies;
drop policy if exists "companies_insert" on public.companies;
drop policy if exists "companies_update" on public.companies;
drop policy if exists "companies_delete" on public.companies;
create policy "companies_read"   on public.companies for select to authenticated using (true);
create policy "companies_insert" on public.companies for insert to authenticated with check (true);
create policy "companies_update" on public.companies for update to authenticated using (true) with check (true);
create policy "companies_delete" on public.companies for delete to authenticated using (public.is_staff());

-- TASKS
drop policy if exists "tasks_all"    on public.tasks;
drop policy if exists "tasks_read"   on public.tasks;
drop policy if exists "tasks_insert" on public.tasks;
drop policy if exists "tasks_update" on public.tasks;
drop policy if exists "tasks_delete" on public.tasks;
create policy "tasks_read"   on public.tasks for select to authenticated using (true);
create policy "tasks_insert" on public.tasks for insert to authenticated with check (true);
create policy "tasks_update" on public.tasks for update to authenticated using (true) with check (true);
create policy "tasks_delete" on public.tasks for delete to authenticated using (public.is_staff());

-- COMMENTS
drop policy if exists "comments_all"    on public.comments;
drop policy if exists "comments_read"   on public.comments;
drop policy if exists "comments_insert" on public.comments;
drop policy if exists "comments_update" on public.comments;
drop policy if exists "comments_delete" on public.comments;
create policy "comments_read"   on public.comments for select to authenticated using (true);
create policy "comments_insert" on public.comments for insert to authenticated with check (author = auth.uid());
create policy "comments_update" on public.comments for update to authenticated using (author = auth.uid()) with check (author = auth.uid());
create policy "comments_delete" on public.comments for delete to authenticated using (author = auth.uid() or public.is_staff());

-- ACTIVITY_LOG
drop policy if exists "activity_read"   on public.activity_log;
drop policy if exists "activity_insert" on public.activity_log;
create policy "activity_read"   on public.activity_log for select to authenticated using (true);
create policy "activity_insert" on public.activity_log for insert to authenticated with check (user_id = auth.uid());

-- Listo. Las políticas quedan actualizadas sin afectar a tus datos.
