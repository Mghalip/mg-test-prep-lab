-- Discussion board (讨论区) schema, triggers, RPC, and RLS policies.
-- Idempotent migration: safe to run in Supabase SQL Editor.

create table if not exists public.mg_comments (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.mg_comments(id) on delete cascade,
  subject text not null check (subject in ('all', 'sat', 'act', 'math')),
  title text not null default '' check (char_length(title) <= 120),
  body text not null check (char_length(trim(body)) between 1 and 2000),
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default '',
  is_teacher boolean not null default false,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mg_comments_top_idx
  on public.mg_comments (pinned desc, created_at desc)
  where parent_id is null;

create index if not exists mg_comments_subject_idx
  on public.mg_comments (subject, pinned desc, created_at desc)
  where parent_id is null;

create index if not exists mg_comments_parent_idx
  on public.mg_comments (parent_id, created_at asc)
  where parent_id is not null;

create or replace function public.mg_comments_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_anon boolean := coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
  v_profile_name text;
  v_meta_name text;
  v_email_name text;
  v_parent record;
begin
  if v_uid is null or v_is_anon then
    raise exception 'AUTH_REQUIRED';
  end if;

  new.user_id := v_uid;
  new.is_teacher := coalesce(public.mg_is_teacher(), false);
  new.title := btrim(coalesce(new.title, ''));
  new.body := btrim(coalesce(new.body, ''));

  if new.body = '' then
    raise exception 'EMPTY_BODY';
  end if;

  select p.display_name
    into v_profile_name
    from public.mg_profiles p
   where p.id = v_uid;

  v_meta_name := nullif(btrim(coalesce(auth.jwt() -> 'user_metadata' ->> 'display_name', '')), '');
  v_email_name := nullif(btrim(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1)), '');

  new.author_name := left(
    coalesce(nullif(btrim(v_profile_name), ''), v_meta_name, v_email_name, '同学'),
    80
  );

  if new.parent_id is not null then
    select id, parent_id, subject
      into v_parent
      from public.mg_comments
     where id = new.parent_id;

    if not found then
      raise exception 'PARENT_NOT_FOUND';
    end if;

    if v_parent.parent_id is not null then
      raise exception 'NESTING_NOT_ALLOWED';
    end if;

    new.subject := v_parent.subject;
    new.title := '';
    new.pinned := false;
  else
    new.pinned := case
      when new.is_teacher then coalesce(new.pinned, false)
      else false
    end;
  end if;

  if not new.is_teacher then
    if exists (
      select 1
        from public.mg_comments c
       where c.user_id = new.user_id
         and c.created_at > now() - interval '5 seconds'
    ) then
      raise exception 'RATE_LIMIT';
    end if;
  end if;

  new.created_at := coalesce(new.created_at, now());
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_mg_comments_before_insert on public.mg_comments;
create trigger trg_mg_comments_before_insert
  before insert on public.mg_comments
  for each row
  execute function public.mg_comments_before_insert();

create or replace function public.mg_board_set_pin(p_id uuid, p_pinned boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(public.mg_is_teacher(), false) then
    raise exception 'insufficient_privilege';
  end if;

  update public.mg_comments
     set pinned = coalesce(p_pinned, false),
         updated_at = now()
   where id = p_id
     and parent_id is null;
end;
$$;

alter table public.mg_comments enable row level security;

drop policy if exists mg_comments_select on public.mg_comments;
create policy mg_comments_select
  on public.mg_comments
  for select
  to anon, authenticated
  using (true);

drop policy if exists mg_comments_insert on public.mg_comments;
create policy mg_comments_insert
  on public.mg_comments
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    and user_id = auth.uid()
  );

drop policy if exists mg_comments_delete on public.mg_comments;
create policy mg_comments_delete
  on public.mg_comments
  for delete
  to authenticated
  using (
    coalesce(public.mg_is_teacher(), false)
    or (
      auth.uid() = user_id
      and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    )
  );

grant select on public.mg_comments to anon, authenticated;
grant insert, delete on public.mg_comments to authenticated;
grant execute on function public.mg_board_set_pin(uuid, boolean) to authenticated;
