// SAT topic adapter for the shared MG account service.
const CONFIG=window.READING_CONFIG;
let AUTH=null,owner=false,submitting=false;
window.readingNames={};
function configured(){return !!MG.user}
function showLogin(){location.href='account.html'}
async function logout(){tick();save();await MG.sync();const {error}=await MG.client.auth.signOut({scope:'local'});if(error)alert('退出失败，请稍后重试。');else location.reload()}
const accountBaseStart=start,accountBaseFinish=finish,accountBaseGo=go;
go=function(v){if(v==='teacher'){location.href='account.html?view=teacher';return}accountBaseGo(v)};
start=function(cat){accountBaseStart(cat)};
function topicPayload(a){return {id:a.id,kind:'sat-topic',exam:'SAT 专题练习',started:a.started,submitted:a.submitted,mode:'practice',summary:{correct:a.items.filter(x=>x.answer===qby(x.id).answer).length,total:a.items.length},items:a.items.map(x=>{const q=qby(x.id);return {...x,expected:q.answer,correct:x.answer===q.answer,topic:topic(q.topic)[1],section:TOPICS.slice(0,11).some(t=>t[0]===q.topic)?'Reading':'Writing',number:`T${q.test} M${q.module} Q${q.number}`}})}}
finish=async function(){if(!session||submitting)return;submitting=true;try{tick();if(MG.user){const a={id:session.id,started:session.started,submitted:new Date().toISOString(),items:session.ids.map(id=>({id,answer:session.answers[id]||null,seconds:Math.round(session.times[id]||0)}))};await MG.submit(topicPayload(a))}accountBaseFinish()}catch(e){alert(e.message+' 请保留页面并重试。')}finally{submitting=false}};
MG.ready.then(async()=>{
  if(!MG.user)return;
  AUTH={id:MG.user.id};owner=MG.teacher;student=AUTH.id;
  const cache=MG.read('mg-topic-db',{attempts:[],drafts:{}});db=cache;session=null;
  save=function(){MG.write('mg-topic-db',db)};
  $('#account-label').textContent=owner?'教师账号':'学生账号';$('#logout').hidden=false;
  $('#nav-teacher').hidden=!owner;$('#nav-teacher').textContent='教师后台';$('#student').hidden=true;
  document.querySelector('footer').textContent='登录后成绩同步至学习空间。未提交练习保存在当前设备，云端记录可由本人及本站教师查看。';
  render();
  try{const rows=await MG.rows('sat-topic');const known=new Set(QUESTIONS.map(q=>q.id));const merged=new Map(db.attempts.map(a=>[a.id,a]));for(const r of rows){if(r.items.every(x=>x&&known.has(x.id)))merged.set(r.id,{...r,student:r.student_id})}db.attempts=[...merged.values()].sort((a,b)=>a.submitted.localeCompare(b.submitted));save();if(view!=='practice')render()}catch{notify('暂时无法读取云端历史，仍可继续本机练习。')}
});
