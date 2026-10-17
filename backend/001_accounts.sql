-- MG Test Prep Lab. Run in the Supabase SQL editor as the database administrator.
-- Additive installation: does not change existing reading_* tables or auth accounts.
begin;
create schema if not exists mg_private;
revoke all on schema mg_private from public, anon, authenticated;
create table if not exists mg_private.teachers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table mg_private.teachers enable row level security;
revoke all on mg_private.teachers from public, anon, authenticated;
create or replace function public.mg_is_teacher() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from mg_private.teachers where user_id = auth.uid());
$$;
revoke all on function public.mg_is_teacher() from public, anon;
grant execute on function public.mg_is_teacher() to authenticated;

create table if not exists public.mg_profiles (
  id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now()
);
alter table public.mg_profiles enable row level security;
revoke all on public.mg_profiles from public, anon, authenticated;
grant select on public.mg_profiles to authenticated;
grant insert (id, display_name), update (display_name) on public.mg_profiles to authenticated;
drop policy if exists mg_profiles_read on public.mg_profiles;
create policy mg_profiles_read on public.mg_profiles for select to authenticated
using (id = (select auth.uid()) or (select public.mg_is_teacher()));
drop policy if exists mg_profiles_insert on public.mg_profiles;
create policy mg_profiles_insert on public.mg_profiles for insert to authenticated
with check (id = (select auth.uid()));
drop policy if exists mg_profiles_update on public.mg_profiles;
create policy mg_profiles_update on public.mg_profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

create table if not exists public.mg_attempts (
  id uuid not null,
  student_id uuid not null default auth.uid() references public.mg_profiles(id) on delete cascade,
  kind text not null check (kind in ('sat-topic','sat-mock','act-mock')),
  exam text not null check (char_length(exam) between 1 and 120),
  started timestamptz not null,
  submitted timestamptz not null,
  received_at timestamptz not null default now(),
  mode text not null check (char_length(mode) between 1 and 30),
  summary jsonb not null check (jsonb_typeof(summary) = 'object'),
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 300),
  primary key (student_id,id),
  check (submitted >= started),
  check (octet_length(items::text) <= 500000),
  check (octet_length(summary::text) <= 10000)
);
create index if not exists mg_attempts_submitted_idx on public.mg_attempts(submitted desc);
alter table public.mg_attempts enable row level security;
revoke all on public.mg_attempts from public, anon, authenticated;
grant select on public.mg_attempts to authenticated;
grant insert (id,student_id,kind,exam,started,submitted,mode,summary,items) on public.mg_attempts to authenticated;
drop policy if exists mg_attempts_read on public.mg_attempts;
create policy mg_attempts_read on public.mg_attempts for select to authenticated
using (student_id = (select auth.uid()) or (select public.mg_is_teacher()));
drop policy if exists mg_attempts_insert on public.mg_attempts;
create policy mg_attempts_insert on public.mg_attempts for insert to authenticated
with check (student_id = (select auth.uid()));

-- Safe public readiness check: no student or teacher information.
create or replace function public.mg_backend_version() returns integer
language sql immutable set search_path = '' as $$ select 1; $$;
revoke all on function public.mg_backend_version() from public;
grant execute on function public.mg_backend_version() to anon, authenticated;
commit;
