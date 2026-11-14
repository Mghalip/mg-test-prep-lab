from fontTools.cffLib import CFFFontSet
from fontTools.fontBuilder import FontBuilder
from fontTools.ttLib import TTFont,newTable
from fontTools.pens.recordingPen import RecordingPen
from io import BytesIO
import hashlib

def font_bytes(doc,xref,cmap):
 name,ext,typ,data=doc.extract_font(xref)
 if ext in ['ttf','otf']:
  ft=TTFont(BytesIO(data));order=ft.getGlyphOrder()
  # Some embedded symbol fonts expose only a symbol cmap; use the PDF's Unicode mapping.
  mappings={u:order[g] for u,g in cmap.items() if 0<=g<len(order) and u>=32}
  from fontTools.ttLib.tables._c_m_a_p import CmapSubtable
  sub=CmapSubtable.newSubtable(4);sub.platformID=3;sub.platEncID=1;sub.language=0;sub.cmap={u:g for u,g in mappings.items() if u<65536};ft['cmap']=newTable('cmap');ft['cmap'].tableVersion=0;ft['cmap'].tables=[sub]
 else:
  cff=CFFFontSet();cff.decompile(BytesIO(data),None);top=cff.topDictIndex[0];order=top.charset
  fb=FontBuilder(1000,isTTF=False);fb.setupGlyphOrder(order);fb.setupCharacterMap({u:order[g] for u,g in cmap.items() if 0<=g<len(order) and u>=32})
  metrics={}
  for g in order:
   cs=top.CharStrings[g];cs.draw(RecordingPen());metrics[g]=(round(cs.width),0)
  fb.setupHorizontalMetrics(metrics);fb.setupHorizontalHeader(ascent=1000,descent=-300)
  fb.setupNameTable({'familyName':name,'styleName':'Regular','uniqueFontIdentifier':name,'fullName':name,'psName':name})
  fb.setupOS2(sTypoAscender=1000,sTypoDescender=-300,usWinAscent=1200,usWinDescent=400);fb.setupPost();fb.setupMaxp()
  table=newTable('CFF ');table.cff=cff;fb.font['CFF ']=table;ft=fb.font
 if 'post' not in ft:FontBuilder(font=ft).setupPost()
 ft.flavor='woff';o=BytesIO();ft.save(o);return o.getvalue()
