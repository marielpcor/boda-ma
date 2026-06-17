-- ============================================================
--  Música Boda M & A — Esquema para Supabase
--  Cómo usarlo:
--    1. Entra a tu proyecto en https://supabase.com
--    2. Menú lateral: "SQL Editor" → "New query"
--    3. Pega TODO este archivo y presiona "Run".
-- ============================================================

-- Tabla de canciones
create table if not exists songs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  url        text not null,
  song_key   text not null unique,   -- clave para evitar duplicados
  platform   text,
  added_by   text not null,
  added_at   timestamptz not null default now(),
  requests   integer not null default 1   -- cuántas veces la han pedido (favoritas)
);

-- Tabla de bitácora
create table if not exists log (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,          -- 'added' o 'duplicate'
  actor       text,                   -- quién hizo la acción
  name        text,
  url         text,
  message     text,
  created_at  timestamptz not null default now()
);

-- Seguridad: el servidor usa la clave "service_role" (secreta), que tiene
-- acceso completo. Mantenemos RLS activado para que nadie más pueda leer/escribir
-- con la clave pública.
alter table songs enable row level security;
alter table log   enable row level security;
