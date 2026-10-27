const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..','mock-data'),read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const regions=read('math-option-regions.json');let count=0;
for(const entry of read('manifest.json'))for(const m of read(entry.id+'.json').modules.filter(m=>m.section==='math'))for(const q of m.questions){
 if(q.kind!=='choice'||q.mathHtml)continue;count++;
 const rs=regions[q.id];assert.ok(rs,q.id);assert.deepEqual([...new Set(rs.map(r=>r.letter))].sort(),[...'ABCD'],q.id);
 for(const [i,a] of rs.entries()){
  const p=q.visual.find(p=>p.file===a.file);assert.ok(p,q.id);const [x,y,w,h]=a.box,[X,Y,W,H]=p.box;
  assert.ok(w>0&&h>0&&x>=X-.01&&y>=Y-.01&&x+w<=X+W+.01&&y+h<=Y+H+.01,q.id+' bounds');
  for(const b of rs.slice(i+1)){if(a.file!==b.file||a.letter===b.letter)continue;const [u,v,s,t]=b.box;assert.ok(Math.min(x+w,u+s)-Math.max(x,u)<=.01||Math.min(y+h,v+t)-Math.max(y,v)<=.01,q.id+' overlapping choices')}
 }
}
assert.equal(Object.keys(regions).length,count);console.log(count+' mathematical choice questions: full coverage, bounded and non-overlapping regions');
