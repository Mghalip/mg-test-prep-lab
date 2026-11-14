"""Reproducible, source-verified Science crop repairs for Practice Test 3 (26MC2).

Only changes crop / option hit-area metadata; never changes source text or keys.
Run: python act-science-crops.py test.json original.pdf
"""
import json
import re
import sys
from pathlib import Path


def repair_science_crops(data, doc):
    if data.get('form') != '26MC2':
        return []
    questions = next(s for s in data['sections'] if s['id'] == 'science')['questions']
    changes = []
    by_number = {q['number']: q for q in questions}
    q38, q39 = by_number[38], by_number[39]
    assert q38['visual']['page'] == q39['visual']['page'] == 49
    lines = [l for b in doc[48].get_text('dict')['blocks'] for l in b.get('lines', [])]
    # The original next-question-minus-8 crop cuts the final H2O subscript.
    tail = next(l for l in lines if ''.join(s['text'] for s in l['spans']) == 'H2O.'
                and l['bbox'][0] > 314 and 260 < l['bbox'][1] < 280)
    heading = next(l for l in lines if re.match(r'\s*39\. Atmospheric', ''.join(s['text'] for s in l['spans'])))
    boundary = round((tail['bbox'][3] + heading['bbox'][1]) / 2, 2)
    b38, b39 = q38['visual']['box'], q39['visual']['box']
    old_bottom = b39[1] + b39[3]
    if b38[1] + b38[3] != boundary or b39[1] != boundary:
        b38[3] = round(boundary - b38[1], 2)
        b39[1], b39[3] = boundary, round(old_bottom - boundary, 2)
        last = q38['options'][-1]['box']
        last[3] = round(boundary - last[1], 2)
        changes.append('Q38/39: preserve complete H2O subscript within Q38')
    for q in questions:
        part = q['visual']
        footers = [l['bbox'][1] for b in doc[part['page']-1].get_text('dict')['blocks']
                   for l in b.get('lines', [])
                   if re.match(r'^(END OF TEST|STOP!|GO ON TO THE NEXT PAGE)',
                               ''.join(s['text'] for s in l['spans']))]
        box = part['box']
        if footers and box[1] + box[3] > min(footers)-4:
            box[3] = round(min(footers)-4-box[1], 2)
            changes.append(f'Q{q["number"]}: omit paper-only footer')
        for option in q['options']:
            ob = option['box']
            ob[3] = min(ob[3], round(box[1]+box[3]-ob[1], 2))
            assert ob[3] > 0
    return changes


if __name__ == '__main__':
    import pymupdf
    path = Path(sys.argv[1])
    data = json.loads(path.read_text())
    changes = repair_science_crops(data, pymupdf.open(sys.argv[2]))
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')))
    print('\n'.join(changes) or 'No changes needed')
