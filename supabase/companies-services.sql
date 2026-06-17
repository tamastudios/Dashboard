-- ============================================================
-- TAMA Dashboard — Servicios contratados por empresa
-- Añade la columna `services` a companies. Cada empresa indica
-- qué se le hace (Desarrollo web, Agente IA, etc.) y eso alimenta
-- las secciones de Producción (Webs, Agentes IA, Proyectos).
-- Ejecutar en Supabase SQL Editor.
-- ============================================================
alter table public.companies
  add column if not exists services text[] not null default '{}';
