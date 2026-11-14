"""Source-geometry regression checks for scanned ACT answer labels.
The five anchors below were measured on the original PDF, not generated output.
They catch stem/diagram letters misidentified as answer labels.
"""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
fixtures={('act7','math',6,'G'):(119,426.5),('act7','math',35,'A'):(119.3,595.5),('act9','math',17,'A'):(119,162.8),('act9','math',37,'B'):(119.3,280.5),('act9','math',45,'C'):(119.7,465.8)}
count=0
for id in ['act7','act8','act9']:
 d=json.loads((ROOT/'act-data'/f'{id}.json').read_text())
 for s in d['sections']:
  for q in s['questions']:
   opts=q['options'];left=min(o['box'][0] for o in opts);x=q['visual']['box'][0]
   assert 5<left-x<30,(q['id'],'wrong option column')
   for o in opts:
    assert sum(abs(o['box'][0]-v['box'][0])<12 for v in opts)>=2,(q['id'],'isolated label column')
    source=fixtures.get((id,s['id'],q['number'],o['letter']))
    if source:
     assert abs(o['printedLetterBox'][0]-source[0])<2,(q['id'],o)
     assert abs(o['anchorY']-source[1])<1.5,(q['id'],o)
   order=sorted(opts,key=lambda o:(round((o['box'][0]-left)/30),o['anchorY']))
   assert [o['letter'] for o in order]==[o['letter'] for o in opts],(q['id'],'wrong answer order')
   count+=1
print(f'PASS {count} option-column/order checks and {len(fixtures)} independently measured PDF anchors')
