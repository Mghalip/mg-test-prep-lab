const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
const install=fs.readFileSync(__dirname+'/001_accounts.sql','utf8');await db.exec(install);await db.exec(install);
const a='11111111-1111-4111-8111-111111111111', b='22222222-2222-4222-8222-222222222222', t='33333333-3333-4333-8333-333333333333', attempt='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
await db.exec(`insert into auth.users values('${a}','a@example.test',now()),('${b}','b@example.test',now()),('${t}','teacher@example.test',null);`);
async function as(uid,sql,role='authenticated'){await db.exec(`set role ${role};select set_config('request.jwt.claim.sub','${uid}',false);`);try{return await db.query(sql)}finally{await db.exec('reset role')}}
async function denied(uid,sql,role){await assert.rejects(()=>as(uid,sql,role));}
for(const u of [a,b,t])await as(u,`insert into public.mg_profiles(display_name) values('Student')`);
await denied(a,`insert into public.mg_profiles(id,display_name) values('${t}','Imposter')`);
const insert=(id,student)=>`insert into public.mg_attempts(id,student_id,kind,exam,started,submitted,mode,summary,items) values('${id}','${student}','sat-topic','SAT',now(),now(),'practice','{}','[{"id":"q1"}]')`;
await as(a,insert(attempt,a));await as(b,insert(attempt,b));
assert.equal((await as(a,'select * from public.mg_attempts')).rows.length,1);
assert.equal((await as(a,'select * from public.mg_profiles')).rows.length,1);
await denied(a,insert('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',b));
await denied(a,`update public.mg_attempts set summary='{}'`);
await denied(a,'delete from public.mg_attempts');
await denied(a,`update public.mg_profiles set id='${b}'`);
assert.equal((await as(a,`update public.mg_profiles set display_name='Hacked' where id='${b}' returning *`)).rows.length,0);
await denied(a,`insert into mg_private.teachers(user_id) values('${a}')`);
await denied('','select * from public.mg_profiles','anon');await denied('','select * from public.mg_attempts','anon');await denied('','select public.mg_is_teacher()','anon');
assert.equal((await as('','select public.mg_backend_version() as version','anon')).rows[0].version,1);
await assert.rejects(()=>db.exec(fs.readFileSync(__dirname+'/002_teacher.sql','utf8').replaceAll('YOUR_VERIFIED_TEACHER_EMAIL','teacher@example.test')));
await db.exec(`update auth.users set email_confirmed_at=now() where id='${t}'`);await db.exec(fs.readFileSync(__dirname+'/002_teacher.sql','utf8').replaceAll('YOUR_VERIFIED_TEACHER_EMAIL','teacher@example.test'));
assert.equal((await as(t,'select public.mg_is_teacher() as yes')).rows[0].yes,true);
assert.equal((await as(a,'select public.mg_is_teacher() as yes')).rows[0].yes,false);
assert.equal((await as(t,'select * from public.mg_attempts')).rows.length,2);
assert.equal((await as(t,'select * from public.mg_profiles')).rows.length,3);
await denied(t,insert('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',a));
console.log('PASS: repeatable install; anonymous denial; own-only reads/inserts; immutable attempts; profile column restrictions; no teacher self-promotion; verified teacher bootstrap; teacher read access.');await db.close();
})().catch(e=>{console.error(e);process.exit(1)});
