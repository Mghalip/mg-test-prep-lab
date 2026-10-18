const {chromium}=require('playwright');const assert=require('node:assert/strict');
const ROOT=process.env.MG_TEST_ROOT||'http://127.0.0.1:8770/';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',T='33333333-3333-4333-8333-333333333333';
(async()=>{
const browser=await chromium.launch({channel:'chrome',headless:true});const rows=[],reflections=[],feedback=[];let failInsert=false,failReflection=false;
const errors=[];
async function context(uid,mobile=false){const c=await browser.newContext(mobile?{viewport:{width:390,height:844},isMobile:true}:{});
 if(uid)await c.addInitScript(({uid})=>{if(sessionStorage.getItem('seeded'))return;sessionStorage.setItem('seeded','1');const token=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:uid,exp:Math.floor(Date.now()/1000)+3600}))+'.test';localStorage.setItem('mg-auth-v1',JSON.stringify({access_token:token,refresh_token:'test-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:uid,email:'student@example.test',aud:'authenticated',role:'authenticated',user_metadata:{display_name:'Test Student'}}}));},{uid});
 await c.route('https://*.supabase.co/**',async route=>{const req=route.request(),url=new URL(req.url());let data=null,status=200,headers={};
 if(url.pathname.endsWith('/mg_backend_version'))data=1;
 else if(url.pathname.endsWith('/mg_is_teacher'))data=uid===T;
 else if(url.pathname.endsWith('/mg_profiles')){data=[{id:A,display_name:'Student <A>'},{id:B,display_name:'Student B'},{id:T,display_name:'Teacher'}].filter(p=>uid===T||p.id===uid);if(url.searchParams.has('id'))data=data.filter(p=>'eq.'+p.id===url.searchParams.get('id'));if(req.headers().accept?.includes('vnd.pgrst.object'))data=data[0]||null;}
 else if(url.pathname.endsWith('/mg_save_reflection')){
   const v=req.postDataJSON(),old=reflections.find(r=>r.student_id===uid&&r.attempt_id===v.p_attempt&&r.question_id===v.p_question);
   if(failReflection){status=503;data={message:'test offline'}}else if((old?.revision||0)!==v.p_revision){status=400;data={message:'revision conflict'}}else{data={student_id:uid,attempt_id:v.p_attempt,question_id:v.p_question,mistake:v.p_mistake,reasoning:v.p_reasoning,revision:v.p_revision+1,updated_at:new Date().toISOString()};if(old)Object.assign(old,data);else reflections.push(data);}
 }else if(url.pathname.endsWith('/mg_publish_feedback')){
   const v=req.postDataJSON(),r=reflections.find(r=>r.student_id===v.p_student&&r.attempt_id===v.p_attempt&&r.question_id===v.p_question);
   if(uid!==T||r?.revision!==v.p_revision){status=403;data={message:'denied'}}else{data={...r,id:crypto.randomUUID(),feedback:v.p_feedback,teacher_id:uid,created_at:new Date().toISOString()};feedback.unshift(data);}
 }else if(url.pathname.endsWith('/mg_reflections')||url.pathname.endsWith('/mg_feedback')){
   data=(url.pathname.endsWith('/mg_reflections')?reflections:feedback).filter(r=>uid===T||r.student_id===uid);
   for(const k of ['student_id','attempt_id','question_id'])if(url.searchParams.has(k))data=data.filter(r=>'eq.'+r[k]===url.searchParams.get(k));
   if(req.headers().accept?.includes('vnd.pgrst.object'))data=data[0]||null;
 }else if(url.pathname.endsWith('/mg_attempts')){
   if(req.method()==='POST'){
     if(failInsert){status=503;data={message:'offline'};}else{const row=req.postDataJSON();if(rows.some(r=>r.id===row.id&&r.student_id===uid)){status=409;data={code:'23505',message:'duplicate'}}else{rows.push(row);data=null;status=201;}}
   }else{data=rows.filter(r=>uid===T||r.student_id===uid);for(const name of ['id','student_id','kind'])if(url.searchParams.get(name))data=data.filter(r=>'eq.'+r[name]===url.searchParams.get(name));headers['content-range']=`0-${Math.max(0,data.length-1)}/${data.length}`;if(req.headers().accept?.includes('vnd.pgrst.object'))data=data[0]||null;}
 }else if(url.pathname.endsWith('/logout'))data={};
 else if(url.pathname.endsWith('/user'))data={id:uid,email:'student@example.test',user_metadata:{}};
 else {console.log('Unhandled',req.method(),url.pathname);status=400;data={message:'unhandled'}}
 await route.fulfill({status,headers:{'content-type':'application/json','access-control-expose-headers':'content-range',...headers},body:JSON.stringify(data)});
 });return c;}
async function open(c,path){const p=await c.newPage();p.on('pageerror',e=>errors.push(path+': '+e.message));await p.goto(ROOT+path);await p.waitForFunction(()=>window.MG&&!!document.getElementById('mg-account-bar'));return p;}
const guest=await context(null);const gp=await open(guest,'account.html');await gp.locator('#signup').waitFor();assert.equal(await gp.locator('#signin').count(),1);await guest.close();
const a=await context(A);const p=await open(a,'sat.html');await p.waitForFunction(()=>typeof beginSetup==='function'&&typeof examQuestionMenu==='function');await p.evaluate(()=>{start('all');beginSetup();answer('A');askSubmit()});await p.evaluate(()=>finish());await p.waitForFunction(()=>document.body.innerText.includes('练习结果'));assert.equal(rows.length,1);assert.equal(rows[0].items.length,5);assert.equal(rows[0].student_id,A);assert.equal(await p.locator('#nav-teacher').isVisible(),false);console.log('PASS topic completion + account isolation + hidden teacher navigation');
const mp=await open(a,'mock.html');await mp.locator('.cards .card').first().waitFor();await mp.evaluate(()=>Mock.start('A26','up'));await mp.evaluate(()=>{Mock.begin();Mock.answer('A');Mock.next();Mock.next();Mock.skipBreak();Mock.next();Mock.next()});await mp.locator('.total-prediction').waitFor();assert.match(await mp.locator('h1').innerText(),/模考成绩/);assert.match(await mp.locator('.total-prediction').innerText(),/1600/);await mp.waitForTimeout(300);assert.equal(rows.filter(r=>r.kind==='sat-mock').length,1);assert.equal(rows.find(r=>r.kind==='sat-mock').items.length,98);console.log('PASS full SAT completion + 98 cloud item records');
const ap=await open(a,'act.html');await ap.locator('.test-card').first().waitFor();const actId=await ap.evaluate(async()=>(await (await fetch('act-data/manifest.json')).json())[0].id);await ap.evaluate(id=>ACTLab.start(id,'full',true,'practice'),actId);await ap.evaluate(()=>{ACTLab.begin();ACTLab.showQuestions();ACTLab.answer('A');ACTLab.submitSection();ACTLab.showQuestions();ACTLab.submitSection();ACTLab.skipBreak();ACTLab.showQuestions();ACTLab.submitSection();ACTLab.showQuestions();ACTLab.submitSection()});await ap.waitForFunction(()=>document.body.innerText.includes('TEST RESULTS'));await ap.waitForTimeout(300);assert.equal(rows.filter(r=>r.kind==='act-mock').length,1);assert.equal(rows.find(r=>r.kind==='act-mock').items.length,171);console.log('PASS full ACT completion + 171 cloud item records');
// Retry after network failure and avoid duplicate results.
failInsert=true;await p.evaluate(()=>MG.submit({id:crypto.randomUUID(),kind:'sat-topic',exam:'Offline test',started:new Date().toISOString(),submitted:new Date().toISOString(),mode:'practice',summary:{},items:[{id:'q'}]}));assert.equal(await p.evaluate(()=>MG.read('mg-pending',[]).length),1);failInsert=false;await p.evaluate(()=>MG.sync());assert.equal(await p.evaluate(()=>MG.read('mg-pending',[]).length),0);assert.equal(rows.length,4);await p.evaluate(()=>MG.sync());assert.equal(rows.length,4);console.log('PASS offline queue + retry + idempotency');
const bc=await context(B);const bp=await open(bc,'mock.html');await bp.locator('.cards .card').first().waitFor();assert.equal(await bp.evaluate(()=>MG.read('sat-mock-history-v1',[]).length),0);const baccount=await open(bc,'account.html?view=teacher');await baccount.locator('#records').waitFor();assert.equal(await baccount.locator('#filter-student').count(),0);assert.ok(!(await baccount.locator('#records').innerText()).includes('A26'));console.log('PASS student cannot enter teacher UI or see another account history');
const tc=await context(T,true);const tp=await open(tc,'account.html?view=teacher');await tp.locator('[data-row]').first().waitFor();assert.equal(await tp.locator('[data-row]').count(),4);assert.ok((await tp.locator('#stats').innerText()).includes('4'));await tp.locator('[data-row]').first().click();await tp.locator('#attempt-detail table').waitFor();assert.equal(await tp.locator('#attempt-detail tbody tr').count(),5);await tp.locator('#attempt-detail button').first().click();await tp.locator('#attempt-detail').evaluate(e=>e.scrollTop=0);await tp.screenshot({path:require('node:path').join(process.env.MG_TEST_OUTPUT||require('node:os').tmpdir(),'mg-teacher-mobile.png'),fullPage:true});assert.ok(await tp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));console.log('PASS teacher list + item detail + mobile width');
await tp.selectOption('#filter-kind','act-mock');await tp.click('#refresh');await tp.waitForTimeout(150);assert.equal(await tp.locator('[data-row]').count(),1);const downloadPromise=tp.waitForEvent('download');await tp.click('#export');const download=await downloadPromise;assert.equal(download.suggestedFilename(),'MG-practice-records.csv');console.log('PASS filters + CSV export');
// Reflections use real exam review UI, with the service mocked here; SQL permissions have a separate test.
await mp.evaluate(()=>Mock.review(0));await mp.locator('textarea[name="reasoning"]').waitFor();
await mp.locator('textarea[name="mistake"]').fill('I guessed <script>alert(1)</script>');
await mp.locator('textarea[name="reasoning"]').fill('I should compare each choice with the text.');
failReflection=true;await mp.getByRole('button',{name:'提交思路给教师'}).click();await mp.waitForFunction(()=>document.querySelector('.reflection-status').textContent.includes('提交失败'));assert.equal(reflections.length,0);
failReflection=false;await mp.getByRole('button',{name:'提交思路给教师'}).click();await mp.waitForFunction(()=>document.querySelector('.reflection-status').textContent.includes('思路已提交'));assert.equal(reflections.length,1);
await mp.evaluate(()=>Mock.review(1));await mp.locator('textarea[name="reasoning"]').waitFor();await mp.locator('textarea[name="reasoning"]').fill('Unsaved draft');await mp.evaluate(()=>Mock.review(0));await mp.evaluate(()=>Mock.review(1));await mp.waitForFunction(()=>document.querySelector('textarea[name="reasoning"]')?.value==='Unsaved draft');
await ap.evaluate(()=>ACTLab.review(0,0));await ap.locator('textarea[name="reasoning"]').fill('I checked sentence boundaries.');await ap.getByRole('button',{name:'提交思路给教师'}).click();await ap.waitForFunction(()=>document.querySelector('.reflection-status').textContent.includes('思路已提交'));assert.equal(reflections.length,2);
await tp.selectOption('#filter-kind','sat-mock');await tp.click('#refresh');await tp.locator('[data-row]').first().click();await tp.locator('[data-reasoning]').first().click();await tp.locator('textarea[name="feedback"]').waitFor();assert.ok((await tp.locator('.reflection-text').first().innerText()).includes('<script>'));
await tp.locator('textarea[name="feedback"]').fill('Explain which phrase rules out your original answer.');assert.equal(feedback.length,0);await tp.getByRole('button',{name:'发布反馈给学生'}).click();await tp.waitForFunction(()=>document.querySelector('.reflection-status').textContent.includes('反馈已发布'));assert.equal(feedback.length,1);
await mp.evaluate(()=>Mock.review(0));await mp.locator('.reflection-feedback').waitFor();assert.ok((await mp.locator('.reflection-feedback').innerText()).includes('Explain which phrase'));
await mp.locator('textarea[name="reasoning"]').fill('A revised explanation with evidence.');await mp.getByRole('button',{name:'提交思路给教师'}).click();await mp.waitForFunction(()=>document.querySelector('.reflection-feedback').textContent.includes('旧版'));
assert.equal(await tp.locator('[data-export]').count(),0);assert.equal(await tp.getByRole('button',{name:'刷新分析与反馈'}).count(),1);assert.ok(await tp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await tp.locator('#attempt-detail').evaluate(e=>e.scrollTop=0);await tp.screenshot({path:require('node:path').join(process.env.MG_TEST_OUTPUT||require('node:os').tmpdir(),'mg-reflection-mobile.png'),fullPage:false});await tp.setViewportSize({width:1440,height:1000});await tp.locator('#attempt-detail').evaluate(e=>e.scrollTop=0);await tp.screenshot({path:require('node:path').join(process.env.MG_TEST_OUTPUT||require('node:os').tmpdir(),'mg-reflection-desktop.png'),fullPage:false});
console.log('PASS SAT/ACT reflection submission, offline preservation, per-question drafts, escaped student text, teacher publication, student feedback, old-version label, simplified feedback UI, mobile width');
await tp.locator('#attempt-detail').evaluate(e=>e.close());
const progressRow={...rows.find(r=>r.kind==='sat-mock'),id:crypto.randomUUID(),submitted:new Date(Date.now()+10000).toISOString()};
progressRow.items=progressRow.items.slice(0,7).map((x,i)=>({...x,correct:i===5,scored:i!==6}));rows.unshift(progressRow);
for(const i of [0,5,6])reflections.push({student_id:progressRow.student_id,attempt_id:progressRow.id,question_id:progressRow.items[i].id,revision:1,reasoning:'Submitted'});
await tp.click('#refresh');await tp.waitForFunction(()=>document.querySelector('[data-progress="0"]')?.textContent==='1/5');
await tp.locator('[data-wrong="0"]').click();await tp.waitForFunction(()=>document.querySelector('#attempt-detail')?.textContent.includes('已提交错题分析 · 1 道'));
assert.equal(await tp.locator('#attempt-detail [data-reasoning]').count(),1);
console.log('PASS wrong analysis progress 1/5 excludes correct/unscored questions; submitted-only wrong analysis entry');
await tp.locator('#attempt-detail').evaluate(e=>e.close());
await tp.waitForFunction(()=>document.getElementById('review-queue')?.textContent.includes('4 题未提交 · 1 题待反馈 · 0 题已反馈'));
assert.ok((await tp.locator('#review-queue').innerText()).includes('1 题待反馈'));
await tp.setViewportSize({width:390,height:844});
assert.ok(await tp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await tp.waitForFunction(()=>{const table=document.querySelector('#records table');return table&&getComputedStyle(table).display==='block'});
await tp.screenshot({path:require('node:path').join(process.env.MG_TEST_OUTPUT||require('node:os').tmpdir(),'workspace-teacher-mobile.png'),fullPage:true});
await tp.setViewportSize({width:1440,height:1000});await tp.screenshot({path:require('node:path').join(process.env.MG_TEST_OUTPUT||require('node:os').tmpdir(),'workspace-teacher-desktop.png'),fullPage:true});
await tp.goto(ROOT+'account.html');await tp.locator('.learning-shortcuts').waitFor();
assert.equal(await tp.locator('.learning-shortcuts a').count(),3);
console.log('PASS review workspace status, mobile record cards, student shortcuts');
assert.deepEqual(errors,[]);console.log('PASS no browser JavaScript errors');await Promise.all(browser.contexts().map(c=>c.close()));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
