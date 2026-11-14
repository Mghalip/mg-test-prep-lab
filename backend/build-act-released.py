"""Import J08/J01 released scored-item booklets; preserve existing four tests."""
import pymupdf as fitz,re,json,html,hashlib,xml.etree.ElementTree as ET
from pathlib import Path
ROOT=Path('/Users/MahpratGhalip/Documents/ACT/files')
OUT=Path(__file__).resolve().parent.parent/'act-data';OUT.mkdir(exist_ok=True)
WORK=Path(__file__).parent
SPECS=[('english',40,28),('math',41,45.5),('reading',27,30),('science',34,34)]
def lines(page):
 return [{'text':''.join(s['text'] for s in l['spans']).strip(),'box':list(l['bbox']),'spans':l['spans']} for b in page.get_text('dict')['blocks'] for l in b.get('lines',[]) ]
def col(l):return int(l['box'][0]>305)
def markers(doc,start,end):
 ls={i:lines(doc[i]) for i in range(start,end)};candidates=[];passages=[]
 for i,rows in ls.items():
  for l in rows:
   x,y,x1,y1=l['box'];m=re.match(r'^(\d+)\.(?:\s|$)',l['text'])
   if m and (abs(x-42)<2 or abs(x-318)<7) and 68<y<730:
    candidates.append({'n':int(m[1]),'page':i,'col':col(l),'y':y,'line':l})
   if re.fullmatch(r'PASSAGE [IVX]+|Passage [IVX]+',l['text']):passages.append({'page':i,'col':col(l),'y':y,'title':l['text']})
 good=[]
 for c in candidates:
  endy=min([v['y'] for v in candidates+passages if v['page']==c['page'] and v['col']==c['col'] and v['y']>c['y']+1]+[740])
  opts=[]
  for l in ls[c['page']]:
   m=re.match(r'^([ABCDFGHJ])\.(?:\s|$)',l['text'])
   if m and col(l)==c['col'] and c['y']-1<l['box'][1]<endy and (abs(l['box'][0]-(60+276*c['col']))<2 or (150+276*c['col'])<=l['box'][0]<300+276*c['col']):opts.append({'letter':m[1],'y':l['box'][1],'line':l})
  if len(opts)==4:c['options']=sorted(opts,key=lambda o:'ABCDFGHJ'.index(o['letter']));good.append(c)
 return ls,sorted(good,key=lambda c:c['n']),passages,candidates
NS='http://www.w3.org/2000/svg';ET.register_namespace('',NS);ET.register_namespace('xlink','http://www.w3.org/1999/xlink')
from importlib.machinery import SourceFileLoader
fontmod=SourceFileLoader('actfonts',str(WORK/'act-fonts.py')).load_module()
def preserve_symbol_glyphs(page,root,texts):
 # Distinct PDF font subsets can share a family name but use different glyph IDs.
 # Preserve their original vector outlines instead of merging incompatible cmaps.
 if not texts:return
 import copy
 vector=ET.fromstring(page.get_svg_image(text_as_path=True));uses={}
 for use in vector.iter('{'+NS+'}use'):
  values=list(map(float,re.findall(r'[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?',use.get('transform',''))))
  if len(values)==6:
   key=(use.get('data-text'),round(values[4],2),round(values[5],2));uses.setdefault(key,[]).append(use)
 group=ET.Element('{'+NS+'}g',{'data-original-symbols':'true'});needed=set()
 for text in texts:
  values=list(map(float,re.findall(r'[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?',text.get('transform','')))) or [1,0,0,1,0,0]
  a,b,c,d,e,f=values
  for span in text:
   xs=list(map(float,span.get('x','').split()));ys=list(map(float,span.get('y','').split()))
   assert len(xs)==len(span.text or ''),(page.number,span.text,xs)
   for j,char in enumerate(span.text or ''):
    x,y=xs[j],ys[min(j,len(ys)-1)];key=(char,round(a*x+c*y+e,2),round(b*x+d*y+f,2))
    matched=uses.get(key,[])
    if not matched and char.isspace():continue
    assert matched,(page.number,key)
    use=copy.deepcopy(matched[0]);group.append(use);needed.add(use.get('{http://www.w3.org/1999/xlink}href')[1:])
  # Keep source text for selection / auditing, but render the true PDF outlines.
  text.set('fill-opacity','0')
 defs=ET.Element('{'+NS+'}defs')
 for element in vector.iter():
  if element.get('id') in needed:defs.append(copy.deepcopy(element))
 assert len(defs)==len(needed)
 root.insert(0,defs);root.append(group)

def make_pages(doc,exam,start,end):
 folder=OUT/exam;folder.mkdir(exist_ok=True);fontdir=OUT/'fonts';fontdir.mkdir(exist_ok=True)
 for i in range(start,end):
  p=doc[i];root=ET.fromstring(p.get_svg_image(text_as_path=False));cmaps={}
  for trace in p.get_texttrace():
   for u,g,*_ in trace['chars']:cmaps.setdefault(trace['font'],{})[u]=g
  css=[];aliases={}
  for ref,ext,typ,name,*_ in p.get_fonts(full=True):
   short=name.split('+')[-1]
   if any(k in short for k in ['Times','Helvetica','Arial','Montserrat','Calibri','Minion']):continue
   if short in aliases:continue
   cmap=cmaps.get(short,{})
   if not cmap:continue
   data=fontmod.font_bytes(doc,ref,cmap);filename=hashlib.sha256(data).hexdigest()[:16]+'.woff';(fontdir/filename).write_bytes(data)
   alias=exam+'p'+str(i)+'_'+re.sub(r'\W','',short);aliases[short]=alias
   css.append(f'@font-face{{font-family:"{alias}";src:url("act-data/fonts/{filename}") format("woff");font-display:block}}')
  symbol_texts=[t for t in root.iter('{'+NS+'}text') if not any(k in t.get('font-family','') for k in ['Times','Helvetica','Arial','Montserrat','Calibri','Minion'])]
  for t in root.iter('{'+NS+'}text'):
   fam=t.get('font-family','');t.set('font-family',aliases.get(fam,'Arial' if any(x in fam for x in ['Helvetica','Arial','Montserrat','Calibri']) else 'Times New Roman'))
   if any(x in fam for x in ['Italic','Obl']):t.set('font-style','italic')
   if any(x in fam for x in ['Bold','Blk']):t.set('font-weight','bold')
  style=ET.Element('{'+NS+'}style');style.text=''.join(css);root.insert(0,style)
  preserve_symbol_glyphs(p,root,symbol_texts)
  (folder/f'p{i+1}.svg').write_text(ET.tostring(root,encoding='unicode'))

def segment(doc,exam,p,c,y0,y1):
 # Use actual content bounds to remove blank paper margins, while retaining vector figures.
 x0=38+276*c;x1=300+276*c;y0=max(68,y0);y1=min(740,y1)
 bottoms=[l['box'][3] for l in lines(doc[p]) if x0-1<=l['box'][0]<x1 and y0-1<=l['box'][1]<y1 and l['box'][3]<=y1+2]
 for dr in doc[p].get_drawings():
  rr=dr['rect']
  if x0<=rr.x0 and rr.x1<=x1 and y0<=rr.y0 and rr.y1<=y1:bottoms.append(rr.y1)
 if bottoms:y1=min(y1,max(bottoms)+5)
 return {'file':f'act-data/{exam}/p{p+1}.svg','box':[x0,round(y0,2),x1-x0,round(y1-y0,2)],'page':p+1}


def released_scoring(doc):
 result={}
 for i,(name,total,minutes) in enumerate(SPECS):
  text=doc[42+i].get_text();text=text.split('The '+('mathematics' if name=='math' else name)+' test contained')[0]
  matches=list(re.finditer(r'(?m)^([0-9]+)\s*\n([ABCDFGHJ])\s*\n',text));key={}
  for j,m in enumerate(matches):
   tail=text[m.end():matches[j+1].start() if j+1<len(matches) else len(text)]
   key[int(m[1])]={'answer':m[2],'scored':True,'category':tail.strip().split('Math')[0].strip().replace('\n',' ')}
  assert set(key)==set(range(1,total+1)),(name,len(key))
  result[name]={'key':key,'curve':{}}
 # Read the conversion table spatially: the PDF text stream contains stray footer numerals.
 rows=lines(doc[47]);scales=[l for l in rows if 70<l['box'][0]<100 and l['box'][1]>100 and re.fullmatch(r'\d+',l['text'])]
 assert {int(l['text']) for l in scales}==set(range(1,37))
 for row in scales:
  cells=[l for l in rows if abs(l['box'][1]-row['box'][1])<1 and l['box'][0]>110]
  cells.sort(key=lambda l:l['box'][0]);assert len(cells)==4,(row,cells)
  for (name,total,_),cell in zip(SPECS,cells):
   value=cell['text'].strip()
   if value=='—':continue
   nums=[int(v) for v in re.split('[–-]',value)];assert len(nums) in (1,2),value
   for raw in range(nums[0],nums[-1]+1):
    assert raw not in result[name]['curve'];result[name]['curve'][raw]=int(row['text'])
 for name,total,_ in SPECS:
  curve=result[name]['curve'];assert set(curve)==set(range(total+1)),(name,curve)
  assert all(curve[n]<=curve[n+1] for n in range(total))
 return result

def trim_footers(data,doc):
 parts=[q['visual'] for s in data['sections'] for q in s['questions']]+[p for g in data['passages'].values() for p in g['parts']]
 for part in parts:
  box=part['box'];ys=[l['box'][1] for l in lines(doc[part['page']-1]) if re.match(r'^(END OF TEST|STOP!|GO ON TO THE NEXT PAGE)',l['text'])]
  if ys and box[1]+box[3]>min(ys)-4:box[3]=round(min(ys)-4-box[1],2)
  assert box[3]>0
 for s in data['sections']:
  for q in s['questions']:
   box=q['visual']['box']
   for o in q['options']:
    ob=o['box'];ob[3]=min(ob[3],round(box[1]+box[3]-ob[1],2));assert ob[3]>0

def repair_released_crops(data,doc):
 def question(sec,n):return next(s for s in data['sections'] if s['id']==sec)['questions'][n-1]
 def top(q,value):
  b=q['visual']['box'];bottom=b[1]+b[3];b[1]=value;b[3]=round(bottom-value,2)
 def bottom(q,value):
  b=q['visual']['box'];b[3]=round(value-b[1],2)
  for o in q['options']:
   ob=o['box'];ob[3]=min(ob[3],round(value-ob[1],2));assert ob[3]>0
 if data['form']=='J08':
  # The final words of Q26 extend into the former Q27 crop.
  bottom(question('science',26),263);top(question('science',27),263)
  # No passage text continues onto this page; it only contains Q30 and a divider.
  data['passages']['english-3']['parts'].pop()
 if data['form']=='J01':
  data['passages']['english-4']['parts'].pop()
  top(question('math',30),623)
  bottom(question('math',38),316.55);top(question('math',39),316.55)
  bottom(question('science',27),574);top(question('science',28),574)
  # A shared whole-passage header crosses the paper gutter; show it with both questions.
  prompt=next(l for l in lines(doc[7]) if l['text'].startswith('Questions 24 and 25 ask'))
  for n in (24,25):question('english',n)['introduction']=prompt['text']
  part=data['passages']['english-3']['parts'][2];part['box'][3]=round(397-part['box'][1],2)
  cropfix=SourceFileLoader('actenglishcrops',str(WORK/'act-english-crops.py')).load_module()
  cropfix.compact_english_passages(data,doc)

def generate():
 manifest=json.loads((OUT/'manifest.json').read_text());audit=[]
 for idx,code in [(5,'J08'),(6,'J01')]:
  src=next(ROOT.glob('*Form-'+code+'.pdf'));doc=fitz.open(src);keys=released_scoring(doc);exam=f'act{idx}'
  make_pages(doc,exam,2,42)
  data={'id':exam,'title':f'ACT Practice Test {idx}','form':code,'version':1,'format':'released-scored','sections':[],'passages':{}}
  for (sec,num,minutes),start,end in zip(SPECS,[2,12,24,30],[12,24,30,42]):
   ls,qs,ps,cands=markers(doc,start,end);assert len(qs)==num and {q['n'] for q in qs}==set(range(1,num+1)),(code,sec)
   qs.sort(key=lambda q:q['n']);ps.sort(key=lambda g:(g['page'],g['col'],g['y']))
   section={'id':sec,'title':{'english':'English','math':'Mathematics','reading':'Reading','science':'Science'}[sec],'minutes':minutes,'curve':keys[sec]['curve'],'questions':[]}
   for j,g in enumerate(ps):
    # English passages run down the left column; other sections flow left to right.
    nxt=ps[j+1] if j+1<len(ps) else {'page':end,'col':0,'y':68}
    pid=sec+'-'+str(j+1);g['id']=pid;chunks=[]
    if sec=='english':
     for pn in range(g['page'],min(nxt['page']+1,end)):
      top=g['y']-4 if pn==g['page'] else 78
      bottom=nxt['y']-8 if pn==nxt['page'] else 740
      leftq=[q['y']-8 for q in qs if q['page']==pn and q['col']==0 and top<q['y']<bottom]
      if leftq:bottom=min(leftq)
      if bottom>top+4:chunks.append(segment(doc,exam,pn,0,top,bottom))
    else:
     firstq=min([q for q in qs if (q['page'],q['col'],q['y'])>(g['page'],g['col'],g['y'])],key=lambda q:(q['page'],q['col'],q['y']))
     for pn in range(g['page'],firstq['page']+1):
      for c in range(2):
       if (pn,c)<(g['page'],g['col']) or (pn,c)>(firstq['page'],firstq['col']):continue
       top=g['y']-4 if (pn,c)==(g['page'],g['col']) or (j==0 and pn==start) else 78
       bottom=firstq['y']-8 if (pn,c)==(firstq['page'],firstq['col']) else 740
       if bottom>top+4:chunks.append(segment(doc,exam,pn,c,top,bottom))
     # A table/figure crossing the paper gutter must stay intact.
     if sec=='science':
      for pn in sorted({ch['page']-1 for ch in chunks}):
       group=[ch for ch in chunks if ch['page']==pn+1]
       wide=any(v['rect'].x0<300 and v['rect'].x1>314 and v['rect'].y0>(g['y'] if pn==g['page'] else 78) and v['rect'].y1<740 for v in doc[pn].get_drawings())
       if wide:
        lo=min(ch['box'][1] for ch in group);hi=max(ch['box'][1]+ch['box'][3] for ch in group)
        rights=[l['box'][2] for l in ls[pn] if lo<=l['box'][1]<hi and not any(q['col']==col(l) and l['box'][1]>q['y']-8 for q in qs if q['page']==pn)]
        rx=min(576,max(rights+[300])+4)
        merged={'file':group[0]['file'],'box':[38,lo,round(rx-38,2),round(hi-lo,2)],'page':pn+1,'regions':[[ch['box'][0],ch['box'][1],ch['box'][2],ch['box'][3]] for ch in group],'wide':True}
        # Retain cross-gutter vectors/text in the full passage area, remove any question region.
        exclusions=[q for q in qs if q['page']==pn]
        merged['exclude']=[[38+276*q['col'],q['y']-8,262,740-(q['y']-8)] for q in exclusions if q['y']>lo]
        pos=chunks.index(group[0]);chunks=[ch for ch in chunks if ch not in group];chunks.insert(pos,merged)
    data['passages'][pid]={'title':g['title'].title(),'parts':chunks}
   for q in qs:
    pn,c,y=q['page'],q['col'],q['y'];n=q['n'];bottom=min([other['y']-8 for other in qs+ps if other['page']==pn and other['col']==c and other['y']>y+1]+[740])
    # Tighten the bottom to content, including all option diagrams.
    coords=[l['box'][3] for l in ls[pn] if col(l)==c and y-6<=l['box'][1]<bottom and l['box'][1]<730]
    for dr in doc[pn].get_drawings():
     rr=dr['rect']
     if 38+276*c<=rr.x0 and rr.x1<=300+276*c and y<=rr.y0<bottom and rr.y1<bottom:coords.append(rr.y1)
    if coords:bottom=min(bottom,max(coords)+5)
    group=None
    if ps:
     if sec=='english':group=max((g for g in ps if (g['page'],g['y'])<=(pn,y+8)),key=lambda g:(g['page'],g['y']))
     else:group=max((g for g in ps if (g['page'],g['col'],g['y'])<=(pn,c,y)),key=lambda g:(g['page'],g['col'],g['y']))
    meta=keys[sec]['key'][n];part=segment(doc,exam,pn,c,y-8,bottom)
    opts=[]
    for o in q['options']:
     ox=o['line']['box'][0];oy=o['y'];samecol=[other for other in q['options'] if abs(other['line']['box'][0]-ox)<5 and other['y']>oy+2]
     endy=min([o2['y']-1 for o2 in samecol]+[bottom]);right=min([o2['line']['box'][0]-3 for o2 in q['options'] if o2['line']['box'][0]>ox+20]+[300+276*c])
     opts.append({'letter':o['letter'],'box':[ox-3,oy-2,right-(ox-3),endy-(oy-2)]})
    section['questions'].append({'id':f'{exam}-{sec}-{n}','number':n,'passage':group['id'] if group else None,'visual':part,'options':opts,**meta})
   data['sections'].append(section)
   audit.append({'exam':exam,'section':sec,'questions':num,'scored':sum(q['scored'] for q in section['questions']),'passages':len(ps),'source':str(src)})
  cropfix=SourceFileLoader('actenglishcrops',str(OUT.parent/'backend'/'act-english-crops.py')).load_module()
  cropfix.repair_english_crops(data,doc)
  trim_footers(data,doc)
  repair_released_crops(data,doc)
  (OUT/f'{exam}.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
  manifest=[t for t in manifest if t['id']!=exam]
  manifest.append({'id':exam,'title':data['title'],'form':code,'questions':142,'format':'released-scored','counts':[40,41,27,34],'minutes':[28,45.5,30,34]})
 (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));(WORK/'released-import-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2));print('Built',len(manifest),'tests /',sum(x['questions'] for x in audit),'questions')

if __name__=='__main__':generate()
