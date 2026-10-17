-- Run after 001_accounts.sql. Additive: existing scores and accounts are unchanged.
begin;
create table if not exists public.mg_reflections (
 student_id uuid not null,
 attempt_id uuid not null,
 question_id text not null check(char_length(question_id) between 1 and 160),
 mistake text not null default '' check(char_length(mistake)<=4000),
 reasoning text not null check(char_length(reasoning) between 1 and 8000),
 revision integer not null check(revision>0),
 updated_at timestamptz not null default now(),
 primary key(student_id,attempt_id,question_id),
 foreign key(student_id,attempt_id) references public.mg_attempts(student_id,id) on delete cascade
);
create table if not exists public.mg_feedback (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null,
 attempt_id uuid not null,
 question_id text not null,
 revision integer not null,
 mistake text not null,
 reasoning text not null,
 feedback text not null check(char_length(feedback) between 1 and 8000),
 teacher_id uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 foreign key(student_id,attempt_id,question_id) references public.mg_reflections(student_id,attempt_id,question_id) on delete cascade
);
create index if not exists mg_feedback_question_idx on public.mg_feedback(student_id,attempt_id,question_id,created_at desc);
alter table public.mg_reflections enable row level security;
alter table public.mg_feedback enable row level security;
revoke all on public.mg_reflections,public.mg_feedback from public,anon,authenticated;
grant select on public.mg_reflections,public.mg_feedback to authenticated;
drop policy if exists mg_reflections_read on public.mg_reflections;
create policy mg_reflections_read on public.mg_reflections for select to authenticated using(student_id=(select auth.uid()) or (select public.mg_is_teacher()));
drop policy if exists mg_feedback_read on public.mg_feedback;
create policy mg_feedback_read on public.mg_feedback for select to authenticated using(student_id=(select auth.uid()) or (select public.mg_is_teacher()));

create or replace function public.mg_save_reflection(p_attempt uuid,p_question text,p_mistake text,p_reasoning text,p_revision integer)
returns public.mg_reflections language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); current_revision integer; result public.mg_reflections;
begin
 if uid is null then raise exception 'Please sign in.'; end if;
 if p_revision is null or p_revision<0 or p_question is null or char_length(p_question) not between 1 and 160 or p_reasoning is null or char_length(trim(p_reasoning)) not between 1 and 8000 or char_length(coalesce(p_mistake,''))>4000 then raise exception 'Invalid reflection.'; end if;
 if not exists(select 1 from public.mg_attempts a where a.student_id=uid and a.id=p_attempt and exists(select 1 from jsonb_array_elements(a.items) x where x->>'id'=p_question)) then raise exception 'Sync your submitted attempt before saving a reflection.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||p_attempt::text||p_question,0));
 select revision into current_revision from public.mg_reflections where student_id=uid and attempt_id=p_attempt and question_id=p_question;
 if coalesce(current_revision,0)<>p_revision then raise exception 'Reflection changed on another device. Reload before submitting.'; end if;
 insert into public.mg_reflections(student_id,attempt_id,question_id,mistake,reasoning,revision) values(uid,p_attempt,p_question,coalesce(p_mistake,''),trim(p_reasoning),p_revision+1)
 on conflict(student_id,attempt_id,question_id) do update set mistake=excluded.mistake,reasoning=excluded.reasoning,revision=excluded.revision,updated_at=now()
 returning * into result;
 return result;
end $$;
create or replace function public.mg_publish_feedback(p_student uuid,p_attempt uuid,p_question text,p_revision integer,p_feedback text)
returns public.mg_feedback language plpgsql security definer set search_path='' as $$
declare reflection public.mg_reflections; result public.mg_feedback;
begin
 if auth.uid() is null or not public.mg_is_teacher() then raise exception 'Teacher access required.'; end if;
 if p_feedback is null or char_length(trim(p_feedback)) not between 1 and 8000 then raise exception 'Enter feedback (maximum 8000 characters).'; end if;
 select * into reflection from public.mg_reflections where student_id=p_student and attempt_id=p_attempt and question_id=p_question for share;
 if not found or p_revision is null or reflection.revision<>p_revision then raise exception 'Student reflection changed. Reload and review before publishing.'; end if;
 insert into public.mg_feedback(student_id,attempt_id,question_id,revision,mistake,reasoning,feedback,teacher_id)
 values(p_student,p_attempt,p_question,p_revision,reflection.mistake,reflection.reasoning,trim(p_feedback),auth.uid()) returning * into result;
 return result;
end $$;
revoke all on function public.mg_save_reflection(uuid,text,text,text,integer),public.mg_publish_feedback(uuid,uuid,text,integer,text) from public,anon;
grant execute on function public.mg_save_reflection(uuid,text,text,text,integer),public.mg_publish_feedback(uuid,uuid,text,integer,text) to authenticated;
commit;
