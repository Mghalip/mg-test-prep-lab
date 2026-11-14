const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=process.env.OUTPUT_DIR||path.resolve(root,'../MG后台验证/act-j08-j01/browser');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1500}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.goto((process.env.BASE_URL||'http://127.0.0.1:8771')+'/act.html');await page.waitForFunction(()=>document.querySelectorAll('.test-card').length===9);assert.equal(await page.evaluate(()=>!!MG.user),false);await page.screenshot({path:path.join(out,'home.png'),fullPage:true});
for(const id of ['act5','act6']){
 const d=JSON.parse(fs.readFileSync(path.join(root,'act-data',id+'.json'))),seen=new Set();
 assert.deepEqual(await page.evaluate(async id=>(await fetch('act-data/'+id+'.json?v=20261114-released-forms')).json(),id),d);
 await page.evaluate(async id=>{await ACTLab.start(id,'full',true,'timed');ACTLab.begin()},id);
 for(let si=0;si<4;si++){
  if(si===2){assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem(MG.key('mg-act-draft-v1'))).phase),'break');await page.evaluate(()=>ACTLab.skipBreak());assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem(MG.key('mg-act-draft-v1'))).phase),'break');await page.evaluate(async()=>{const k=MG.key('mg-act-draft-v1'),s=JSON.parse(localStorage.getItem(k));s.breakDeadline=Date.now()-1;localStorage.setItem(k,JSON.stringify(s));await ACTLab.resume()})}
  const sec=d.sections[si];const st=await page.evaluate(()=>JSON.parse(localStorage.getItem(MG.key('mg-act-draft-v1'))));assert.equal(st.section,si);assert.equal(st.deadline-st.sectionStarted,sec.minutes*60000);
  await page.evaluate(()=>ACTLab.showQuestions());
  for(let n=0;n<sec.questions.length;n++){
   const q=sec.questions[n];await page.evaluate(n=>ACTLab.jump(n),n);await page.waitForFunction(()=>document.querySelectorAll('.choice-area').length===4);
   await page.locator('.source-part[data-area=question]').screenshot({path:path.join(out,q.id+'.png')});
   if(q.introduction)assert.equal(await page.locator('.question-introduction').innerText(),q.introduction);
   if(q.passage&&!seen.has(q.passage)){seen.add(q.passage);const parts=page.locator('.source-part[data-area=passage]');for(let j=0;j<await parts.count();j++)await parts.nth(j).screenshot({path:path.join(out,id+'-'+q.passage+'-part'+j+'.png')})}
   await page.evaluate(a=>ACTLab.answer(a),q.answer);
  }
  for(let raw=0;raw<=sec.questions.length;raw++){
   const answers=Object.fromEntries(sec.questions.map((q,i)=>[q.id,i<raw?q.answer:q.options.find(o=>o.letter!==q.answer).letter]));const score=await page.evaluate(({sec,answers})=>ACTLab.scoreSection(sec,answers),{sec,answers});assert.equal(score.raw,raw);assert.equal(score.scale,sec.curve[raw]);
  }
  await page.evaluate(()=>ACTLab.submitSection());
 }
 await page.waitForSelector('.score-box');await page.screenshot({path:path.join(out,id+'-scores.png'),fullPage:true});const history=await page.evaluate(()=>JSON.parse(localStorage.getItem(MG.key('mg-act-history-v1'))));assert.equal(history[0].summary.composite,36);assert(history[0].summary.sections.every(s=>s.scale===36));console.log(id,'142 screenshots, all curves, timed sections, mandatory break and full score PASS');
}
await page.setViewportSize({width:390,height:844});await page.evaluate(async()=>{await ACTLab.start('act6','math',false,'practice');ACTLab.begin();ACTLab.showQuestions();ACTLab.jump(38)});await page.locator('.choice-area').first().waitFor();await page.locator('.choice-area').last().click();await page.waitForFunction(()=>document.querySelector('.choice-area.selected'));await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});assert.deepEqual(errors,[]);await browser.close()})().catch(e=>{console.error(e);process.exit(1)});
