'use strict';
// Source: SAT分数换算-机考SAT版-经验修正版.xlsx; 换算器!E4:G6 and 经验区间.
// Source SHA-256: 543352ece48caded646290b5bd6e330142cbc9b40585439e45d00443ee4b30bf
const SatScore=(()=>{
const version='experience-20260925-v1';
const tables={"rw":[[790,800,800],[770,780,790],[750,760,780],[740,750,770],[720,740,750],[710,730,740],[690,710,730],[670,710,720],[670,710,720],[640,670,700],[640,670,700],[600,630,670],[600,630,670],[600,630,670],[570,600,640],[570,600,640],[570,600,640],[520,560,610],[520,560,610],[520,560,610],[520,560,610],[470,520,570],[470,520,570],[470,520,570],[470,520,570],[420,470,520],[420,470,520],[420,470,520],[420,470,520],[350,410,470],[350,410,470],[350,410,470],[350,410,470],[350,410,470],[350,410,470],[260,340,410],[260,340,410],[260,340,410],[260,340,410],[260,340,410],[260,340,410],[260,340,410],[260,340,410],[260,340,410],[260,340,410],[200,260,330],[200,260,330],[200,260,330],[200,260,330],[200,260,330],[200,260,330],[200,260,330],[200,260,330],[200,260,330],[200,260,330]],"math":[[800,800,800],[780,790,800],[760,780,790],[740,760,780],[720,740,780],[700,730,750],[690,710,740],[670,690,720],[670,690,720],[640,670,700],[640,670,700],[600,630,670],[600,630,670],[600,630,670],[600,630,670],[550,590,630],[550,590,630],[550,590,630],[550,590,630],[500,540,580],[500,540,580],[500,540,580],[500,540,580],[440,490,540],[440,490,540],[440,490,540],[440,490,540],[380,440,490],[380,440,490],[380,440,490],[380,440,490],[300,370,430],[300,370,430],[300,370,430],[300,370,430],[300,370,430],[300,370,430],[200,280,360],[200,280,360],[200,280,360],[200,280,360],[200,280,360],[200,280,360],[200,280,360],[200,280,360]]};
function section(name,m1Wrong,m2Wrong){
 const count=name==='rw'?27:name==='math'?22:null;
 if(!count||![m1Wrong,m2Wrong].every(n=>Number.isInteger(n)&&n>=0&&n<=count))return null;
 const base=tables[name][m1Wrong+m2Wrong];
 const adjustment=m1Wrong<=2?0:m1Wrong<=(name==='rw'?5:4)?-10:m1Wrong<=(name==='rw'?9:7)?-40:-80;
 const low=Math.max(200,base[0]+adjustment),center=Math.max(200,base[1]+adjustment);
 const cap=m1Wrong>=(name==='rw'?10:8)?(name==='rw'?600:620):800;
 const high=Math.max(low,Math.min(cap,base[2]+adjustment));
 return {low,center,high,m1Wrong,m2Wrong};
}
function fromModules(modules){
 if(!Array.isArray(modules)||modules.length!==4)return null;
 const map=new Map();
 for(const row of modules){
  if(!row||!Number.isInteger(row.module)||row.module<0||row.module>5||map.has(row.module))return null;
  const total=row.module<3?27:22;
  if(row.total!==total||!Number.isInteger(row.correct)||row.correct<0||row.correct>total)return null;
  map.set(row.module,row.total-row.correct);
 }
 if(!map.has(0)||!map.has(3)||map.has(1)===map.has(2)||map.has(4)===map.has(5))return null;
 const rw=section('rw',map.get(0),map.get(1)??map.get(2)),math=section('math',map.get(3),map.get(4)??map.get(5));
 return {version,rw,math,total:{low:rw.low+math.low,center:rw.center+math.center,high:rw.high+math.high}};
}
return Object.freeze({version,section,fromModules});
})();
