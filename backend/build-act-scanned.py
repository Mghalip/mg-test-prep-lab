"""Import the three supplied 25MC scanned papers without retypesetting their content.
Run after reviewed OCR/answer metadata is prepared in MG后台验证/act-25mc234.
OCR supplies geometry only; the visible question is always the original PDF image.
"""
from pathlib import Path
import json,re,hashlib
import pymupdf as fitz
from PIL import Image,ImageChops
ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT.parent/'MG后台验证/act-25mc234'
OUT=ROOT/'act-data'
layout=json.loads((WORK/'layout.json').read_text());keys=json.loads((WORK/'keys.json').read_text())
manifest=json.loads((OUT/'manifest.json').read_text());audit=[]

def words(code,p):return [w for folder in ['ocr','ocr6','vision'] for w in json.loads((WORK/folder/f'{code}-p{p}.json').read_text())]
def ink(im,box):
 x,y,w,h=box;a,b,c,d=[round(v*3) for v in (x,y,x+w,y+h)]
 crop=im.crop((a,b,c,d)).convert('L');bb=crop.point(lambda v:255 if v<175 else 0).getbbox()
 return [a/3+bb[0]/3,b/3+bb[1]/3,(bb[2]-bb[0])/3,(bb[3]-bb[1])/3] if bb else None
for code,secs in layout.items():
 exam=f'act{int(code[-1])+5}';src=Path(f'/Users/MahpratGhalip/Documents/ACT/files/ACT-Test-{code}.pdf');doc=fitz.open(src)
 folder=OUT/exam;folder.mkdir(exist_ok=True);images={}
 for p in range(2,48):
  pg=doc[p-1];pix=pg.get_pixmap(matrix=fitz.Matrix(3,3));images[p]=Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
  (folder/f'p{p}.svg').write_text(pg.get_svg_image())
 def part(p,c,top,bottom,x0=None,x1=None):
  x0=(103 if c==0 else 314) if x0 is None else x0;x1=(313 if c==0 else 534) if x1 is None else x1
  box=[x0,top,x1-x0,bottom-top];bb=ink(images[p],box)
  if not bb:return None
  # Preserve horizontal layout; remove empty vertical space only.
  lo=max(top,bb[1]-3);hi=min(bottom,bb[1]+bb[3]+3)
  return {'file':f'act-data/{exam}/p{p}.svg','box':[round(x0,2),round(lo,2),round(x1-x0,2),round(hi-lo,2)],'page':p,'raster':True}
 data={'id':exam,'title':f'ACT Practice Test {int(code[-1])+5}','form':code,'version':1,'format':'scanned-practice','scoringSource':f'https://www.prepsharp.com/pdf/AKSC/{code}SC.pdf','sections':[],'passages':{}}
 for si,(sec,meta) in enumerate(secs.items()):
  qs=meta['questions'];ps=meta['passages'];end=[14,26,34,48][si]
  for j,g in enumerate(ps):
   g['id']=pid=f'{sec}-{j+1}';chunks=[];nxt=ps[j+1] if j+1<len(ps) else {'p':end,'c':0,'y':130}
   if sec=='english':
    for p in range(g['p'],min(nxt['p']+1,end)):
     top=g['y']-4 if p==g['p'] else (115 if p<=5 else 132);bottom=nxt['y']-6 if p==nxt['p'] else 638
     bottom=min([z['y']-6 for z in qs if z['p']==p and z['c']==0 and top<z['y']<bottom]+[bottom])
     if bottom>top+5:
      ch=part(p,0,top,bottom)
      if ch:chunks.append(ch)
   else:
    first=min((q for q in qs if (q['p'],q['c'],q['y'])>(g['p'],g['c'],g['y'])),key=lambda q:(q['p'],q['c'],q['y']))
    for p in range(g['p'],first['p']+1):
     for c in range(2):
      if not (g['p'],g['c'])<=(p,c)<=(first['p'],first['c']):continue
      top=g['y']-4 if (p,c)==(g['p'],g['c']) or (j==0 and p==g['p']) else (147 if sec=='science' and code=='25MC2' and p<46 else 132);bottom=first['y']-6 if (p,c)==(first['p'],first['c']) else 638
      if bottom>top+5:
       ch=part(p,c,top,bottom)
       if ch:chunks.append(ch)
   if sec=='science':
    for p in sorted({ch['page'] for ch in chunks}):
     group=[ch for ch in chunks if ch['page']==p];lo=min(ch['box'][1] for ch in group);hi=max(ch['box'][1]+ch['box'][3] for ch in group)
     # Only artwork can occupy the empty gutter between these printed columns.
     bridge=ink(images[p],[310,lo,8,hi-lo])
     if bridge and bridge[3]>2 and len(group)>1:
      merged=part(p,0,lo,hi,x0=103,x1=534);merged['wide']=True
      merged['exclude']=[[103 if z['c']==0 else 314,z['y']-6,210 if z['c']==0 else 220,638-z['y']+6] for z in qs if z['p']==p and z['y']>lo]
      position=chunks.index(group[0]);chunks=[ch for ch in chunks if ch not in group];chunks.insert(position,merged)
   data['passages'][pid]={'title':'Passage '+str(j+1),'parts':chunks}
  headers={
   '25MC2':[(4,1,294,10,10),(10,1,135,35,35)],
   '25MC3':[(5,1,116,15,15),(8,1,418,30,30),(11,0,136,39,40),(11,1,136,39,40)],
   '25MC4':[(5,1,321,15,15),(10,1,135,35,35),(12,1,249,45,45)]
  }
  section={'id':sec,'title':['English','Mathematics','Reading','Science'][si],'minutes':[35,50,40,40][si],'curve':keys[code][sec]['curve'],'questions':[]}
  for q in qs:
   p,c,y=q['p'],q['c'],q['y'];x=q['box'][0];bottom=q['bottom']-3;ws=words(code,p)
   if sec=='english':bottom=min([hy for hp,hc,hy,first,last in headers[code] if p==hp and c==hc and hy>y]+[bottom])
   # The final paper STOP notice is not part of the question.
   footer=[w['box'][1]-5 for w in ws if w['text'].upper()=='END' and w['box'][1]>y+10  and any(v['text'].upper()=='TEST' and abs(v['box'][1]-w['box'][1])<5 for v in ws)]
   if footer:bottom=min(bottom,min(footer))
   if sec in ['english','reading']:
    rows=[w['box'][1]+w['box'][3] for w in ws if x-2<=w['box'][0]<(534 if c else 312) and y-4<=w['box'][1]<bottom-2]
    if rows:bottom=min(bottom,max(max(rows),max(o['letterBox'][1]+o['letterBox'][3] for o in q['options']))+4)
   visual=part(p,c,y-4,bottom,x0=x-4,x1=534 if c else 312)
   assert visual,(code,sec,q['n'])
   opts=[]
   for o in q['options']:
    bx,by,bw,bh=o['letterBox'];ref=ink(images[p],[bx-1,by-1,min(bw,7)+1,bh+2])
    assert ref,(code,sec,q['n'],o)
    oy=ref[1]-(4 if sec=='math' else 2);ox=ref[0]-2;anchor=ref[1]+ref[3]/2
    same=[z['letterBox'][1]-2 for z in q['options'] if abs(z['letterBox'][0]-bx)<15 and z['letterBox'][1]>by+4]
    right=min([z['letterBox'][0]-7 for z in q['options'] if z['letterBox'][0]>bx+30]+[visual['box'][0]+visual['box'][2]])
    endy=min(same+[visual['box'][1]+visual['box'][3]])
    opts.append({'letter':o['letter'],'box':[round(ox,2),round(oy,2),round(right-ox,2),round(endy-oy,2)],'anchorY':round(anchor,2),'printedLetterBox':[round(v,2) for v in ref]})
   # Normalize adjacent rows once, eliminating tiny OCR-boundary overlaps.
   for o in opts:
    o['box'][3]=round(min([z['box'][1]-o['box'][1] for z in opts if z['box'][1]>o['box'][1]+3 and abs(z['box'][0]-o['box'][0])<15]+[o['box'][3]]),2)
    assert o['box'][2]>0 and o['box'][3]>0,(code,sec,q['n'],opts)
   group=None
   if ps:
    eligible=[g for g in ps if (g['p'],g['y'])<=(p,y+10)] if sec=='english' else [g for g in ps if (g['p'],g['c'],g['y'])<=(p,c,y)]
    group=max(eligible,key=lambda g:(g['p'],g['c'],g['y']))
   key=keys[code][sec]['key'][str(q['n'])]
   introduction='This question asks about the preceding passage as a whole.' if sec=='english' and any(first<=q['n']<=last for _,_,_,first,last in headers[code]) else None
   section['questions'].append({'introduction':introduction,'id':f'{exam}-{sec}-{q["n"]}','number':q['n'],'passage':group['id'] if group else None,'visual':visual,'options':opts,**key})
  data['sections'].append(section)
 (OUT/f'{exam}.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
 manifest=[m for m in manifest if m['id']!=exam]+[{'id':exam,'title':data['title'],'form':code,'questions':171,'format':'scanned-practice','counts':[50,45,36,40],'minutes':[35,50,40,40]}]
 audit.append({'id':exam,'form':code,'source':str(src),'sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'questions':171,'passages':len(data['passages'])})
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));(WORK/'import-audit.json').write_text(json.dumps(audit,indent=2));print('Built',len(manifest),'tests; 513 new questions')
