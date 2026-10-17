(()=>{'use strict';
const G={'μ':'\\mu','σ':'\\sigma','α':'\\alpha','β':'\\beta','χ':'\\chi','ρ':'\\rho','θ':'\\theta','Σ':'\\sum','∑':'\\sum','π':'\\pi','∞':'\\infty','ȳ':'\\bar{y}','ŷ':'\\hat{y}','Ȳ':'\\bar{Y}'};
const subs={'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9','ₐ':'a','ᵢ':'i','ⱼ':'j','ₙ':'n','ₓ':'x','ᵧ':'y','ₚ':'p'};
const supers={'ᶜ':'c','ⁿ':'n','ᵀ':'T','⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁻':'-','⁺':'+'};
const funcs=new Set(['P','E','Var','SD','SE','Cov','SSE','SSR','SST','min','max']);
const names=new Set(['np','pn','df','SE','SD','ME','MOE','Var','Cov','SSE','SSR','SST','RF','CV','B','N','X','Y','Z','T','D','S','H','I','P','E','A','C','F','R','O','n','p','x','y','z','t','s','r','b','a','c','i','j','k','v','u','e','d']);
const ops={'−':'-','–':'-','×':'\\times','·':'\\cdot','÷':'/','≤':'\\le','≥':'\\ge','≠':'\\ne','≈':'\\approx','±':'\\pm','→':'\\to','⇒':'\\Longrightarrow','∩':'\\cap','∪':'\\cup','⋯':'\\cdots','…':'\\ldots','∝':'\\propto'};
function lex(s){let a=[],i=0;while(i<s.length){let c=s[i],start=i;if(/\s/.test(c)){i++;continue;}let number=s.slice(i).match(/^\d+(?:\.\d+)?(?:,\d{3})*/);if(number){a.push({k:'atom',v:number[0],start,end:i+=number[0].length});continue;}
let word=s.slice(i).match(/^[A-Za-z]+/);if(word){let v=word[0];i+=v.length;let allowed=names.has(v);a.push({k:allowed?'atom':'word',v,start,end:i});continue;}
if(G[c]){a.push({k:c==='Σ'||c==='∑'?'sum':'atom',v:G[c],start,end:++i});continue;}
if(c==='\u0304'||c==='\u0302'){a.push({k:'accent',v:c==='\u0304'?'bar':'hat',start,end:++i});continue;}
if(subs[c]){let v='';while(subs[s[i]])v+=subs[s[i++]];a.push({k:'sub',v,start,end:i});continue;}
if(supers[c]){let v='';while(supers[s[i]])v+=supers[s[i++]];a.push({k:'sup',v,start,end:i});continue;}
if(c==='_'&&s[i+1]==='_'){while(s[i]==='_')i++;a.push({k:'stop',v:s.slice(start,i),start,end:i});continue;}if(c==='_'||c==='^'){i++;let v='';if(s[i]==='{'){let d=1;i++;while(i<s.length&&d){if(s[i]==='{')d++;if(s[i]==='}')d--;if(d)v+=s[i];i++;}}else {v=s[i++]||'';}a.push({k:c==='_'?'sub':'sup',v,start,end:i});continue;}
if(c==='√'){a.push({k:'root',v:c,start,end:++i});continue;}
if('()[]{}'.includes(c)){a.push({k:'()[]{'.includes(c)&&!')]}'.includes(c)?'open':'close',v:c,start,end:++i});continue;}
if(c==='%'||c==="′"||c==="'"||c==='*'){a.push({k:'post',v:c==='%'?'\\%':c==='*'?'^{*}':'^{\\prime}',start,end:++i});continue;}
if(ops[c]||'=+-/<>|,:!'.includes(c)){a.push({k:'op',v:ops[c]||c,start,end:++i});continue;}
a.push({k:'stop',v:c,start,end:++i});}return a;}
function texTokens(a){let pos=0;
function atom(){let t=a[pos++];if(!t)return '';let v='';if(t.k==='root'){let x=atom();v='\\sqrt{'+ungroup(x)+'}';}
else if(t.k==='open'){let close={'(' : ')','[':']','{':'}'}[t.v],start=pos,d=1;while(pos<a.length&&d){if(a[pos].k==='open')d++;if(a[pos].k==='close')d--;if(d)pos++;}let inside=texTokens(a.slice(start,pos));if(a[pos]?.k==='close')pos++;v='\\left'+(t.v==='{'?'\\{':t.v)+inside+'\\right'+(close==='}'?'\\}':close);}
else if(t.k==='sum')v='\\sum ';else if(t.k==='word')v='\\text{'+t.v+' }';else if(t.k==='op')v=t.v;else {v=t.v;if(funcs.has(v)){v=['P','E'].includes(v)?'\\operatorname{'+v+'}':'\\operatorname{'+v+'}';if(a[pos]?.k==='open')v+=atom();}else if(v==='df')v='\\mathrm{df}';}
while(pos<a.length&&['accent','sub','sup','post'].includes(a[pos].k)){let q=a[pos++];if(q.k==='accent')v='\\'+q.v+'{'+v+'}';else if(q.k==='sub'||q.k==='sup')v+=(q.k==='sub'?'_':'^')+'{'+texTokens(lex(q.v))+'}';else v+=q.v;}return v;}
function ungroup(x){return x.replace(/^\\left[([]([\s\S]*)\\right[)\]]$/,'$1');}
let out='',term='';function flush(){out+=term;term='';}
while(pos<a.length){let t=a[pos];if(t.k==='close'){pos++;continue;}if(t.k==='op'&&t.v==='/'){pos++;const den=atom();term='\\frac{'+ungroup(term||'1')+'}{'+ungroup(den)+'}';}
else if(t.k==='op'){flush();out+=' '+t.v+' ';pos++;}else term+=atom()+' ';}flush();return out.trim();}
function isMath(a){let raw=a.map(t=>t.v).join('');if(a.some(t=>['sum','root','sub','sup','accent'].includes(t.k)))return true;if(a.some(t=>t.k==='atom'&&t.v.startsWith('\\')))return true;if(a.some(t=>t.k==='op'&&!['|',',',':'].includes(t.v))&&a.some(t=>t.k==='atom'))return true;if(a.length===1&&a[0].k==='atom'&&/^(?:[npxyztsr]|df|SE|SD|ME)$/.test(raw))return true;return false;}
function chunks(s){const ts=lex(s),groups=[];let run=[];function finish(){while(run.length&&['op','post'].includes(run[run.length-1].k))run.pop();while(run.length&&run[0].k==='op'&&!['-','+'].includes(run[0].v))run.shift();if(run.length&&isMath(run)){// Avoid consuming unmatched sentence parentheses.
let balance=0;for(let i=0;i<run.length;i++){if(run[i].k==='open')balance++;if(run[i].k==='close'){if(balance)balance--;else{run=run.slice(0,i);break;}}}
while(balance>0&&run.length){let ix=run.map(t=>t.k).lastIndexOf('open');if(ix<0)break;run=run.slice(0,ix);balance--;}
if(run.length&&isMath(run))groups.push({start:run[0].start,end:run.at(-1).end,tex:texTokens(run)});}run=[];}
for(let i=0;i<ts.length;i++){const t=ts[i];if(t.k==='atom'&&funcs.has(t.v)&&ts[i+1]?.k==='open'){let d=0,j=i+1;for(;j<ts.length;j++){if(ts[j].k==='open')d++;if(ts[j].k==='close')d--;if(d===0)break;}if(j<ts.length){run.push(...ts.slice(i,j+1));i=j;continue;}}if(t.k==='stop'||t.k==='word'){finish();continue;} // phrases inside P/E handled separately through manual TeX where needed
if(run.length&&t.k==='atom'&&run.at(-1).k==='atom'&&t.start-run.at(-1).end>0&&/^\d/.test(t.v)&&/^\d/.test(run.at(-1).v)){finish();}
run.push(t);}finish();return groups;}
const skip='script,style,textarea,input,select,option,svg,.katex,.math-tex,.math-inline,.tag,.foot,.lvl,.exhead,.simband,#ui,#toc,#notes,.review-home,[contenteditable]';
function renderTex(el,tex,display=false){try{katex.render((!display&&tex.includes('\\frac')?'\\displaystyle ':'')+tex,el,{throwOnError:true,displayMode:display,strict:'ignore',trust:false,output:'htmlAndMathml'});el.dataset.tex=tex;el.classList.add(display?'math-display':'math-inline');}catch(e){el.textContent=el.dataset.original||tex;window.mathFailures.push({text:el.textContent,tex,error:String(e)});}}
function walk(root){if(!root||root.nodeType!==1||root.matches(skip))return;root.querySelectorAll('[data-math-tex]:not([data-typeset])').forEach(el=>{el.dataset.typeset='1';renderTex(el,el.dataset.mathTex,true);});
const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.parentElement.closest(skip)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});let nodes=[],n;while(n=w.nextNode())nodes.push(n);
for(const node of nodes){const s=node.nodeValue.replace(/p̂c/g,'p̂_{c}');if(!s.trim())continue;let parts=chunks(s);const label=node.parentElement;if(!parts.length&&/^[ABCDS]$/.test(s.trim())&&label.matches('button,b,strong,th,td')&&label.textContent.trim()===s.trim()){parts=[{start:s.indexOf(s.trim()),end:s.indexOf(s.trim())+1,tex:s.trim()}];}if(!parts.length)continue;let frag=document.createDocumentFragment(),last=0;for(const part of parts){if(part.start<last)continue;frag.append(document.createTextNode(s.slice(last,part.start)));const el=document.createElement('span');el.dataset.original=s.slice(part.start,part.end);renderTex(el,part.tex);frag.append(el);last=part.end;}frag.append(document.createTextNode(s.slice(last)));node.replaceWith(frag);}}
window.mathFailures=[];window.apMath={lex,texTokens,chunks,walk};
function init(){walk(document.getElementById('stage')||document.body);const observer=new MutationObserver(ms=>{observer.disconnect();const roots=new Set();for(const m of ms){if(m.target.nodeType===1&&!m.target.closest(skip))roots.add(m.target);else if(m.target.nodeType===3&&!m.target.parentElement?.closest(skip))roots.add(m.target.parentElement);}roots.forEach(walk);observer.observe(document.getElementById('stage')||document.body,{subtree:true,childList:true,characterData:true});});observer.observe(document.getElementById('stage')||document.body,{subtree:true,childList:true,characterData:true});window.mathReady=true;}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
