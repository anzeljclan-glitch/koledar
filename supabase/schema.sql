-- =====================================================================
--  SKUPNI KOLEDAR — shema baze + Row-Level Security (RLS)
--  Zaženi to v Supabase Dashboard -> SQL Editor (celotno naenkrat).
--  Model dovoljenj je vsiljen TUKAJ, na ravni baze — ne le v vmesniku.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1) PROFILI: en profil na uporabnika (razširi auth.users z vlogo)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text not null default '',
  role       text not null default 'viewer'
             check (role in ('admin', 'editor', 'viewer')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2) DOGODKI: en skupni koledar (vsi uporabniki vidijo iste dogodke)
-- ---------------------------------------------------------------------
create table if not exists public.events (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text not null default '',
  start_at     timestamptz not null,
  end_at       timestamptz not null,
  color        text not null default 'blue',
  -- ponavljanje: 'none' | 'daily' | 'weekly' | 'monthly'
  repeat_freq  text not null default 'none'
               check (repeat_freq in ('none', 'daily', 'weekly', 'monthly')),
  repeat_until date,                       -- neobvezen datum zaključka serije
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists events_start_idx on public.events (start_at);

-- ---------------------------------------------------------------------
-- 3) POMOŽNE FUNKCIJE za preverjanje vloge
--    SECURITY DEFINER + fiksen search_path, da ne pride do rekurzije RLS.
-- ---------------------------------------------------------------------
create or replace function public.current_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_role() = 'admin', false);
$$;

create or replace function public.can_edit()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_role() in ('admin', 'editor'), false);
$$;

-- ---------------------------------------------------------------------
-- 4) RLS: PROFILI
--    - vsak prijavljen uporabnik lahko BERE seznam uporabnikov
--    - samo ADMIN lahko dodaja / spreminja / briše profile
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_insert_admin on public.profiles;
create policy profiles_insert_admin on public.profiles
  for insert to authenticated with check (public.is_admin());

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin on public.profiles
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- 5) RLS: DOGODKI
--    - vsak prijavljen uporabnik lahko BERE koledar (skupni pogled)
--    - samo ADMIN in EDITOR lahko dodajajo / spreminjajo / brišejo
--    - GLEDALEC lahko samo bere
-- ---------------------------------------------------------------------
alter table public.events enable row level security;

drop policy if exists events_select on public.events;
create policy events_select on public.events
  for select to authenticated using (true);

drop policy if exists events_insert_editor on public.events;
create policy events_insert_editor on public.events
  for insert to authenticated with check (public.can_edit());

drop policy if exists events_update_editor on public.events;
create policy events_update_editor on public.events
  for update to authenticated using (public.can_edit()) with check (public.can_edit());

drop policy if exists events_delete_editor on public.events;
create policy events_delete_editor on public.events
  for delete to authenticated using (public.can_edit());

-- =====================================================================
-- 6) BOOTSTRAP PRVEGA ADMINA
--    Ker javne registracije ni, prvega uporabnika ustvariš ročno:
--    a) Supabase Dashboard -> Authentication -> Users -> "Add user"
--       (vnesi e-pošto + geslo, potrdi).
--    b) Nato zaženi spodnji stavek in zamenjaj e-pošto s svojo,
--       da temu uporabniku ustvariš admin profil:
--
--    insert into public.profiles (id, email, full_name, role)
--    select id, email, 'Ime Priimek', 'admin'
--    from auth.users where email = 'tvoj-email@primer.com'
--    on conflict (id) do update set role = 'admin';
--
--    Od tu naprej lahko vse ostale uporabnike dodajaš iz aplikacije (/admin).
-- =====================================================================
