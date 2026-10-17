-- Run AFTER the teacher registers and verifies their email.
-- Only the database administrator can assign teacher access. No client role fields.
do $$
declare teacher_id uuid;
begin
  select id into teacher_id from auth.users
  where lower(email) = 'YOUR_VERIFIED_TEACHER_EMAIL' and email_confirmed_at is not null;
  if teacher_id is null then
    raise exception 'First register YOUR_VERIFIED_TEACHER_EMAIL and verify its email, then run this script again.';
  end if;
  insert into mg_private.teachers(user_id) values(teacher_id) on conflict do nothing;
end $$;
