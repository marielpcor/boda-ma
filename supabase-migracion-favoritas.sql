-- ============================================================
--  Migración: contador de "favoritas" (canciones más pedidas)
--  Ejecuta esto UNA sola vez en Supabase si tu tabla "songs" ya existía
--  antes de esta función.
--    1. Supabase → SQL Editor → New query
--    2. Pega esto y presiona "Run".
-- ============================================================

alter table songs
  add column if not exists requests integer not null default 1;
