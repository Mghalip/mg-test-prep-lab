// Complete A-series catalog (Bluebook equivalents intentionally excluded).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),data=path.join(root,'mock-data');
const manifest=JSON.parse(fs.readFileSync(path.join(data,'manifest.json')));
const expected=Array.from({length:55},(_,i)=>i+1).filter(n=>n>10&&n!==51);
assert.deepEqual(manifest.map(x=>x.number),expected);
const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(root,'mock-routing.js'),'utf8')+';globalThis.routing=MockRouting;',ctx);
let count=0;
for(const entry of manifest){
 const exam=JSON.parse(fs.readFileSync(path.join(data,entry.id+'.json')));assert.equal(exam.id,entry.id);assert.equal(exam.modules.length,6);
 const routing=ctx.routing.create(entry.id);ctx.routing.validate(routing,entry.id);
 for(const [mi,m] of exam.modules.entries()){
  assert.equal(m.section,mi<3?'rw':'math');assert.equal(m.branch,['routing','easier','harder'][mi%3]);assert.equal(m.questions.length,mi<3?27:22);
  for(const [i,q] of m.questions.entries()){
   count++;assert.equal(q.id,`${entry.id}-${mi}-${i+1}`);assert.equal(q.number,i+1);assert.ok(q.answer);
   if(q.kind==='choice')assert.match(q.answer,/^[ABCD]$/);
   if(mi<3){assert.deepEqual(q.options.map(o=>o.letter),['A','B','C','D']);assert.ok(q.passage||q.passageVisual?.length);assert.ok(q.stem);}
   if(mi>=3)assert.ok(q.mathHtml||q.visual?.length);
   for(const v of [...(q.visual||[]),...(q.passageVisual||[])]){assert.ok(fs.existsSync(path.join(data,v.file)),q.id);assert.ok(v.box[2]>0&&v.box[3]>0);}
  }
 }
 for(const section of ['rw','math']){const total=section==='rw'?27:22;assert.equal(ctx.routing.next(routing,section,routing[section],total),'harder');assert.equal(ctx.routing.next(routing,section,routing[section]-1,total),'easier');}
}
const q=(id,m,n)=>JSON.parse(fs.readFileSync(path.join(data,id+'.json'))).modules[m].questions[n-1];
assert.equal(q('A13',3,3).answer,'A');assert.equal(q('A13',3,5).answer,'40');assert.equal(q('A38',3,2).answer,'24');assert.equal(q('A38',4,7).answer,'300');assert.equal(q('A41',5,21).kind,'number');assert.equal(q('A41',5,21).answer,'17.6 or 88/5');assert.equal(q('A11',4,8).answer,'.0023');
console.log(`PASS ${manifest.length} exams, ${count} questions, resources, answer types, branch thresholds and revised-key regressions`);
