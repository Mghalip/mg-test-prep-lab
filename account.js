(() => {
  'use strict';
  const el=document.getElementById('account-content'), esc=MG.escape, size=50;
  let profiles=[], loaded=[], page=0, teacherView=false, requestId=0;
  const reviewStates=new Map();
  const labels={'sat-topic':'SAT 专题','sat-mock':'SAT 模考','act-mock':'ACT 模考'};
  const topicNames=r=>[...new Set((r.items||[]).filter(x=>x&&x.topic).map(x=>x.topic))];
  const examName=r=>r.kind==='sat-mock'?String(r.exam??'').replace(/^A(\d+)$/, 'Practice$1'):r.kind==='sat-topic'?(topicNames(r).join('、')||r.exam):r.exam;
  function practiceLabel(r){
    if(r.kind!=='sat-topic')return `${labels[r.kind]}<br>${esc(examName(r))}`;
    const sections=[...new Set((r.items||[]).filter(x=>x&&typeof x==='object').map(x=>x.section==='Reading'?'阅读':x.section==='Writing'?'语法':x.section).filter(Boolean))];
    return `SAT 专题<br>${esc(sections.join(' / ')||'科目未记录')}<br>${esc(examName(r))}`;
  }
  const date=value=>new Date(value).toLocaleString('zh-CN');
  const name=id=>profiles.find(p=>p.id===id)?.display_name || id;
  function message(text){const target=document.getElementById('account-message');if(target)target.textContent=text}
  async function action(form, task){const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);message('正在处理…');try{await task()}catch(e){message(e.message || '请求失败，请稍后重试。')}finally{buttons.forEach(b=>b.disabled=false)}}
  function authForms(){
    el.innerHTML=`<p class="muted">统一用于 SAT、ACT 及后续课程。注册后请验证邮箱；教师权限单独配置。</p><p id="account-message" class="message" role="status"></p><div class="auth-grid"><form class="card" id="signin"><h2>登录</h2><label>邮箱<input name="email" type="email" autocomplete="username" required></label><label>密码<input name="password" type="password" autocomplete="current-password" required></label><div class="actions"><button class="primary">登录</button><button type="button" id="forgot">忘记密码</button></div></form><form class="card" id="signup"><h2>创建学生账号</h2><label>姓名 / 学习昵称<input name="display_name" maxlength="80" autocomplete="name" required></label><label>邮箱<input name="email" type="email" autocomplete="email" required></label><label>密码（至少 10 位）<input name="password" type="password" minlength="10" autocomplete="new-password" required></label><p class="muted">登录后的作答记录会保存到云端，供你和本站教师查看。访客旧记录不会自动归入新账号。</p><button class="primary">注册并发送验证邮件</button></form></div>`;
    document.getElementById('signin').onsubmit=e=>{e.preventDefault();const f=e.target;action(f,async()=>{const {error}=await MG.client.auth.signInWithPassword({email:f.email.value.trim(),password:f.password.value});if(error)throw Error('登录失败，请检查邮箱、密码和邮箱验证状态。');location.reload()})};
    document.getElementById('signup').onsubmit=e=>{e.preventDefault();const f=e.target;action(f,async()=>{if(!f.display_name.value.trim())throw Error('请输入姓名或学习昵称。');const {error}=await MG.client.auth.signUp({email:f.email.value.trim(),password:f.password.value,options:{emailRedirectTo:new URL('account.html',location.href).href,data:{display_name:f.display_name.value.trim()}}});if(error)throw error;f.password.value='';message('请查收邮箱验证邮件。完成验证后回到这里登录。若已有账号，请直接登录或重置密码。')})};
    document.getElementById('forgot').onclick=()=>{const f=document.getElementById('signin');if(!f.email.reportValidity())return;action(f,async()=>{const {error}=await MG.client.auth.resetPasswordForEmail(f.email.value.trim(),{redirectTo:new URL('account.html',location.href).href});if(error)throw error;message('如该邮箱可接收重置邮件，请通过邮件链接设置新密码。')})};
  }
  function passwordForm(){el.innerHTML='<form id="reset" class="card"><h2>设置新密码</h2><label>新密码（至少 10 位）<input name="password" type="password" autocomplete="new-password" minlength="10" required></label><label>再次输入新密码<input name="confirm" type="password" autocomplete="new-password" minlength="10" required></label><p id="account-message" class="message"></p><button class="primary">保存新密码</button></form>';document.getElementById('reset').onsubmit=e=>{e.preventDefault();const f=e.target;if(f.password.value!==f.confirm.value)return message('两次输入的密码不一致。');action(f,async()=>{const {error}=await MG.client.auth.updateUser({password:f.password.value});if(error)throw error;location.replace('account.html')})}}
  function filters(){return {student:document.getElementById('filter-student')?.value||'',kind:document.getElementById('filter-kind').value,from:document.getElementById('filter-from').value,to:document.getElementById('filter-to').value}}
  function query(columns='*',count){const f=filters();let q=MG.client.from('mg_attempts').select(columns,count?{count:'exact'}:undefined).order('submitted',{ascending:false}).order('id');if(!teacherView)q=q.eq('student_id',MG.user.id);else if(f.student)q=q.eq('student_id',f.student);if(f.kind)q=q.eq('kind',f.kind);if(f.from)q=q.gte('submitted',new Date(f.from+'T00:00:00').toISOString());if(f.to){const end=new Date(f.to+'T00:00:00');end.setDate(end.getDate()+1);q=q.lt('submitted',end.toISOString())}return q}
  async function loadProfiles(){profiles=[];for(let offset=0;;offset+=500){const {data,error}=await MG.client.from('mg_profiles').select('id,display_name,created_at').order('id').range(offset,offset+499);if(error)throw error;profiles.push(...data);if(data.length<500)break}}
  async function dashboard(){
    teacherView=MG.teacher&&new URLSearchParams(location.search).get('view')==='teacher';
    await loadProfiles();
    document.querySelector('main > h1').textContent=teacherView?'教师工作台':'我的学习空间';
    document.querySelector('main > .kicker').textContent=teacherView?'TEACHER WORKSPACE':'MY LEARNING';
    el.innerHTML=`<div class="actions account-tabs"><a href="account.html">我的成绩</a>${MG.teacher?'<a href="account.html?view=teacher">教师后台</a>':''}<a href="sat.html">SAT 专题</a><a href="mock.html">SAT 模考</a><a href="act.html">ACT 模考</a><button id="signout">退出登录</button></div>${teacherView?'':`<section class="learning-shortcuts" aria-label="练习入口"><a href="sat.html"><strong>SAT 专题</strong><span>按考点练习 →</span></a><a href="mock.html"><strong>SAT 模考</strong><span>${MG.read('sat-mock-v1',null)?.phase&&MG.read('sat-mock-v1',null).phase!=='done'?'继续未完成的模考':'选择套卷'} →</span></a><a href="act.html"><strong>ACT 模考</strong><span>${MG.read('mg-act-draft-v1',null)?.phase&&MG.read('mg-act-draft-v1',null).phase!=='done'?'继续未完成的模考':'选择套卷'} →</span></a></section>`}<section class="card review-workspace" aria-label="复盘进度"><h2>${teacherView?'待处理与反馈':'我的错题复盘'}</h2><p class="muted">当前筛选页的模考记录 · 按最新提交的分析判断反馈状态</p><div id="review-queue" aria-live="polite">正在读取…</div></section><h2>${teacherView?'学生练习与反馈':'我的学习记录'}</h2><p class="muted">${teacherView?'可按学生、练习类型和日期筛选，查看逐题作答与用时。':'这里显示当前账号已同步的记录；同一账号可在其他设备查看。'}成绩为网站练习记录，不是官方成绩；作答与计时来自学生浏览器。</p><p id="account-message" class="message" role="status"></p><section class="card"><div class="filters">${teacherView?`<label>学生<select id="filter-student"><option value="">全部学生</option>${profiles.map(p=>`<option value="${esc(p.id)}">${esc(p.display_name)} · ${esc(p.id.slice(0,8))}</option>`).join('')}</select></label>`:''}<label>练习类型<select id="filter-kind"><option value="">全部练习</option>${Object.entries(labels).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label>开始日期<input id="filter-from" type="date"></label><label>结束日期<input id="filter-to" type="date"></label></div><div class="actions"><button id="refresh" class="primary">筛选 / 刷新</button><button id="export">导出筛选结果 CSV</button></div></section><div id="stats" class="stats"></div><section class="card"><div id="records">正在加载…</div><div class="actions"><button id="previous">上一页</button><span id="page-label"></span><button id="next">下一页</button></div></section><form id="profile" class="card"><h2>学习昵称</h2><label>姓名 / 昵称<input name="display_name" maxlength="80" required value="${esc(name(MG.user.id))}"></label><button>保存昵称</button></form>`;
    document.getElementById('signout').onclick=async()=>{await MG.sync();const {error}=await MG.client.auth.signOut({scope:'local'});if(error)message('退出失败，请重试。');else location.reload()};
    document.getElementById('refresh').onclick=()=>{page=0;loadRecords()};
    document.getElementById('previous').onclick=()=>{page--;loadRecords()};
    document.getElementById('next').onclick=()=>{page++;loadRecords()};
    document.getElementById('export').onclick=exportRows;
    document.getElementById('profile').onsubmit=e=>{e.preventDefault();const f=e.target;action(f,async()=>{const value=f.display_name.value.trim();if(!value)throw Error('请输入昵称。');const {error}=await MG.client.from('mg_profiles').update({display_name:value}).eq('id',MG.user.id);if(error)throw error;message('昵称已更新。');await loadProfiles()})};
    await loadRecords();
  }
  function score(r){const s=r.summary||{};if(r.kind==='act-mock')return `${['reading','english','math'].map(id=>`${id==='reading'?'Reading':id==='english'?'English':'Math'} ${(s.sections||[]).find(x=>x.id===id)?.scale??'—'}`).join(' · ')} · 总分 ${s.composite??'—'}`;if(r.kind==='sat-mock'){const p=SatScore.fromModules(s.modules);return p?`Verbal ${p.rw.center} · Math ${p.math.center} · 预测总分 ${p.total.center}（${p.total.low}–${p.total.high}）`:`Verbal ${s.rw??0}/54 · Math ${s.math??0}/44（缺少模块数据，暂无预测分）`;}return `${s.correct??0}/${s.total??r.items?.length??0} 正确`}
  async function loadRecords(){
    const current=++requestId;reviewStates.clear();document.getElementById('records').textContent='正在加载…';document.getElementById('previous').disabled=true;document.getElementById('next').disabled=true;
    try{const f=filters();if(f.from&&f.to&&f.from>f.to)throw Error('结束日期不能早于开始日期。');const {data,error,count}=await query('id,student_id,kind,exam,started,submitted,mode,summary,items',true).range(page*size,(page+1)*size-1);if(current!==requestId)return;if(error)throw error;loaded=data;
      document.getElementById('stats').innerHTML=`<div><strong>${count??"—"}</strong>筛选范围内练习次数</div>${teacherView?`<div><strong>${profiles.length}</strong>已建立学习档案的账号</div>`:''}`;
      document.getElementById('records').innerHTML=data.length?`<div class="table-wrap"><table><thead><tr>${teacherView?'<th>学生</th>':''}<th>练习</th><th>提交时间</th><th>成绩</th><th>详情</th><th>错题分析</th></tr></thead><tbody>${data.map((r,i)=>`<tr>${teacherView?`<td data-label="学生">${esc(name(r.student_id))}<br><small>${esc(r.student_id.slice(0,8))}</small></td>`:''}<td data-label="练习">${practiceLabel(r)}</td><td data-label="提交时间">${esc(date(r.submitted))}</td><td data-label="成绩">${compactScore(r)}</td><td data-label="详情"><button data-row="${i}">查看逐题记录</button></td><td data-label="错题分析">${r.kind==='sat-topic'? `<div class="analysis-progress"><strong>0/${wrongItems(r).length}</strong><span class="muted">暂未提交</span></div>`:`<div class="analysis-progress"><strong data-progress="${i}">正在读取…</strong><button data-wrong="${i}" disabled>查看错题分析</button></div>`}</td></tr>`).join('')}</tbody></table></div>`:'<p>当前筛选范围没有已同步的练习记录。</p>';
      document.querySelectorAll('#records td[data-label]').forEach(td=>{const value=document.createElement('div');value.className='record-value';while(td.firstChild)value.append(td.firstChild);td.append(value)});
      document.querySelectorAll('[data-row]').forEach(b=>b.onclick=()=>detail(loaded[Number(b.dataset.row)]));
      document.querySelectorAll('[data-wrong]').forEach(b=>b.onclick=()=>detail(loaded[Number(b.dataset.wrong)],true));
      data.forEach((r,i)=>{if(r.kind!=='sat-topic')updateProgress(r,i,current)});renderReviewQueue();
      document.getElementById('page-label').textContent=`第 ${page+1} / ${Math.max(1,Math.ceil((count??data.length)/size))} 页`;
      document.getElementById('previous').disabled=page===0;document.getElementById('next').disabled=count===null?data.length<size:(page+1)*size>=count;message('');
    }catch(e){if(current!==requestId)return;message(e.message);document.getElementById('records').textContent='加载失败，请点击刷新重试。'}
  }
  function compactScore(r){
    if(r.kind==='sat-topic')return esc(score(r));
    const p=r.kind==='sat-mock'?SatScore.fromModules(r.summary?.modules):null;
    let values;
    if(r.kind==='sat-mock')values=[['Verbal',p?.rw.center??'—'],['Math',p?.math.center??'—'],['总分',p?.total.center??'—']];
    else {const sections=r.summary?.sections||[];values=['reading','english','math'].map(id=>[id==='math'?'Math':id==='reading'?'Reading':'English',sections.find(s=>s.id===id)?.scale??'—']);values.push(['总分',r.summary?.composite??'—']);}
    return `<div class="result-score-strip">${values.map(([label,value],i)=>`<span class="${i===values.length-1?'score-total':''}"><small>${label}</small><strong>${esc(value)}</strong></span>`).join('')}</div>${r.kind==='sat-mock'?'<small class="muted">练习预测分</small>':(r.summary?.sections||[]).filter(s=>s.id==='science').map(s=>`<small class="muted">Science ${esc(s.scale??'—')}（单独计分）</small>`).join('')}`;
  }
  function renderReviewQueue(){
    const host=document.getElementById('review-queue');if(!host)return;
    const entries=loaded.map((r,i)=>({r,i})).filter(({r})=>r.kind!=='sat-topic');
    host.innerHTML=entries.length?entries.map(({r,i})=>{
      const st=reviewStates.get(i);
      let text='正在读取…',tone='';
      if(st?.failed)text='读取失败，请刷新重试';
      else if(st){text=st.total===0?'没有错题':`${st.total-st.done} 题未提交`;if(st.feedbackFailed)text+=' · 反馈状态读取失败';else if(st.total){text+=` · ${st.done-st.reviewed} 题待反馈 · ${st.reviewed} 题已反馈`;tone=st.done>st.reviewed?'pending':st.reviewed?'reviewed':''}}
      return `<div class="review-queue-row"><div><strong>${teacherView?esc(name(r.student_id))+' · ':''}${esc(examName(r))}</strong><p class="review-state ${tone}">${esc(text)}</p></div><button data-queue="${i}" ${!st||st.failed||(teacherView&&!st.done)?'disabled':''}>${teacherView?(st&&!st.done?'暂无提交':'查看分析'):'查看 / 写分析'}</button></div>`;
    }).join(''):'<p class="muted">当前页暂无模考记录。完成模考后，可在这里跟进错题分析与反馈。</p>';
    host.querySelectorAll('[data-queue]').forEach(b=>b.onclick=()=>detail(loaded[Number(b.dataset.queue)],teacherView));
  }
  const wrongItems=r=>(Array.isArray(r.items)?r.items:[]).filter(x=>x&&typeof x==='object'&&x.correct===false&&x.scored!==false);
  async function updateProgress(row,index,current){
    const wrong=new Set(wrongItems(row).map(x=>x.id));
    try{
      const done=new Set(),revisions=new Map();
      for(let offset=0;;offset+=500){
        const {data,error}=await MG.client.from('mg_reflections').select('question_id,revision').eq('student_id',row.student_id).eq('attempt_id',row.id).range(offset,offset+499);
        if(error)throw error;
        for(const r of data||[])if(wrong.has(r.question_id)){done.add(r.question_id);revisions.set(r.question_id,r.revision)}
        if((data||[]).length<500)break;
      }
      let feedbackFailed=false;const reviewed=new Set();
      try{for(let offset=0;;offset+=500){
        const result=await MG.client.from('mg_feedback').select('question_id,revision').eq('student_id',row.student_id).eq('attempt_id',row.id).range(offset,offset+499);
        if(result.error)throw result.error;
        for(const f of result.data||[])if(revisions.has(f.question_id)&&revisions.get(f.question_id)===f.revision)reviewed.add(f.question_id);
        if((result.data||[]).length<500)break;
      }}catch{feedbackFailed=true}
      if(current!==requestId)return;
      reviewStates.set(index,{total:wrong.size,done:done.size,reviewed:reviewed.size,feedbackFailed});renderReviewQueue();
      const target=document.querySelector(`[data-progress="${index}"]`);if(target)target.textContent=`${done.size}/${wrong.size}`;
      const button=document.querySelector(`[data-wrong="${index}"]`);if(button){button.disabled=done.size===0;button.textContent=done.size?'查看错题分析':'暂未提交';}
    }catch{if(current===requestId){reviewStates.set(index,{failed:true});renderReviewQueue();const target=document.querySelector(`[data-progress="${index}"]`);if(target)target.textContent='进度读取失败';}}
  }
  async function detail(row,wrongOnly=false){
    const dialog=document.getElementById('attempt-detail');dialog.innerHTML='<p>正在读取逐题记录…</p><button onclick="this.closest(\'dialog\').close()">关闭</button>';dialog.showModal();
    try{const {data:r,error}=await MG.client.from('mg_attempts').select('*').eq('id',row.id).eq('student_id',row.student_id).single();if(error)throw error;
      let detailItems=r.items.filter(x=>x&&typeof x==='object');
      if(wrongOnly){
        const {data:analyses,error:analysisError}=await MG.client.from('mg_reflections').select('question_id').eq('student_id',r.student_id).eq('attempt_id',r.id).range(0,499);
        if(analysisError)throw analysisError;
        const submitted=new Set((analyses||[]).map(x=>x.question_id));detailItems=wrongItems(r).filter(x=>submitted.has(x.id));
      }
      dialog.innerHTML=`<div class="detail-top"><h2>${esc(name(r.student_id))} · ${esc(examName(r))}</h2><button onclick="this.closest('dialog').close()">关闭</button></div><p>${esc(score(r))} · ${esc(date(r.submitted))}</p>${wrongOnly?`<p>已提交错题分析 · ${detailItems.length} 道${detailItems.length?'':' · 暂未提交'}</p>`:''}<div class="table-wrap"><table><thead><tr><th>科目 / 题号</th><th>作答</th><th>答案</th><th>结果</th><th>用时</th><th>思路与反馈</th></tr></thead><tbody>${detailItems.map((x,i)=>`<tr><td>${esc(r.kind==='sat-topic'?[x.section==='Reading'?'阅读':x.section==='Writing'?'语法':x.section,x.topic].filter(Boolean).join(' · '):(x.section||x.topic||''))} · ${esc(x.number||x.id)}${x.scored===false?'（不计分）':''}</td><td>${esc(x.answer||'未作答')}</td><td>${esc(x.expected||'—')}</td><td class="${x.correct?'good':'bad'}">${x.correct?'正确':'错误'}</td><td>${Math.round(Number(x.seconds)||0)} 秒</td><td>${r.kind!=='sat-topic'?`<button data-reasoning="${i}">${teacherView?'查看思路 / 反馈':'写分析 / 看反馈'}</button>`:'—'}</td></tr>`).join('')}</tbody></table></div>`;
      dialog.querySelectorAll('[data-reasoning]').forEach(button=>button.onclick=()=>reasoning(r,detailItems[Number(button.dataset.reasoning)],wrongOnly));
      if(r.kind!=='sat-topic'){
        const buttons=[...dialog.querySelectorAll('[data-reasoning]')],items=detailItems;
        MG.client.from('mg_reflections').select('question_id,revision').eq('student_id',r.student_id).eq('attempt_id',r.id).then(({data,error})=>{
          if(error)return;const submitted=new Map((data||[]).map(x=>[x.question_id,x.revision]));
          buttons.forEach(b=>{if(b.isConnected){const rev=submitted.get(items[Number(b.dataset.reasoning)].id);b.textContent=(rev?'已提交第 '+rev+' 版 · ':'未提交 · ')+(teacherView?'查看 / 反馈':'写分析 / 看反馈')}});
        });
      }
    }catch{dialog.innerHTML='<p>无法读取记录，请关闭后重试。</p><button onclick="this.closest(\'dialog\').close()">关闭</button>'}
  }
  async function reasoning(row,item,wrongOnly=false){
    const dialog=document.getElementById('attempt-detail');
    dialog.innerHTML=`<div class="detail-top"><h2>${esc(examName(row))} · ${esc(item.section||'')} · ${esc(item.number||item.id)}</h2><button id="back-attempt">返回逐题记录</button><button id="close-reasoning">关闭</button></div><p>学生答案：${esc(item.answer||'未作答')} · 参考答案：${esc(item.expected||'—')}</p><div class="reasoning-layout"><section class="reasoning-question" aria-label="原题"></section><section class="reasoning-editor"></section></div>`;
    document.getElementById('back-attempt').onclick=()=>{dialog.close();detail(row,wrongOnly)};
    document.getElementById('close-reasoning').onclick=()=>dialog.close();
    const host=dialog.querySelector('.reasoning-question');
    MGReflection.question(host,row,item).catch(()=>{if(host.isConnected)host.textContent='原题加载失败，请返回逐题记录后重试。'});
    await MGReflection.mount(dialog.querySelector('.reasoning-editor'),{student:row.student_id,attempt:row.id,row,item,teacher:teacherView});
  }
  async function exportRows(){const button=document.getElementById('export');button.disabled=true;try{const all=[];for(let offset=0;;offset+=500){const {data,error}=await query().range(offset,offset+499);if(error)throw error;all.push(...data);if(data.length<500)break}const lines=[['Student','Student ID','Type','Test','Submitted','Mode','Section','Question','Answer','Expected','Correct','Seconds','Scored','Score summary'],...all.flatMap(r=>r.items.filter(x=>x&&typeof x==='object').map(x=>[name(r.student_id),r.student_id,labels[r.kind],r.exam,r.submitted,r.mode,x.section||x.topic||'',x.number||x.id,x.answer||'',x.expected||'',x.correct?1:0,x.seconds,x.scored===false?0:1,score(r)]))];const csv='\uFEFF'+lines.map(row=>row.map(v=>'"'+String(v??'').replace(/^[\s]*[=+@-]/,m=>"'"+m).replace(/"/g,'""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='MG-practice-records.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message(`已导出 ${all.length} 次练习的逐题记录。`)}catch(e){message(e.message)}finally{button.disabled=false}}
  document.getElementById('attempt-detail').addEventListener('close',()=>{if(document.getElementById('records'))loadRecords()});
  MG.ready.then(async()=>{if(!MG.available){el.innerHTML=`<div class="card"><h2>云端学习空间正在配置</h2><p>${esc(MG.error||'数据库尚未启用。')}</p><p>现有专题练习和模考仍可使用，体验记录保存在本机。</p><button onclick="location.reload()">重新连接</button></div>`;return}if(MG.recovery&&MG.user)return passwordForm();if(!MG.user)return authForms();try{await dashboard()}catch(e){el.textContent='无法加载账号：'+e.message}});
})();
