"""Keep English whole-passage prompts with their question; omit paper-only footers.

Called after build-act.py generates metadata. Can also repair a single existing
test: python act-english-crops.py path/to/test.json path/to/original.pdf
Never rewrites PDF/SVG text, punctuation, answer keys, or another section.
"""
import json
import re
import sys
from pathlib import Path


def repair_english_crops(data, doc):
    questions = next(s for s in data['sections'] if s['id'] == 'english')['questions']
    changes = []
    for q in questions:
        part = q['visual']
        page = doc[part['page'] - 1]
        for block in page.get_text('dict')['blocks']:
            for line in block.get('lines', []):
                text = ''.join(s['text'] for s in line['spans'])
                if not re.match(rf'^Question {q["number"]} asks about the preceding passage', text):
                    continue
                x, y, x1, y1 = line['bbox']
                frames = [d['rect'] for d in page.get_drawings()
                          if d['rect'].x0 <= x and d['rect'].x1 >= x1
                          and d['rect'].y0 <= y and d['rect'].y1 >= y1]
                assert frames, f'Missing whole-passage frame for {q["id"]}'
                top = round(min(r.y0 for r in frames) - 3, 2)
                old_bottom = part['box'][1] + part['box'][3]
                if part['box'][1] != top:
                    part['box'][1], part['box'][3] = top, round(old_bottom - top, 2)
                    changes.append(f'Q{q["number"]}: include own whole-passage header')
                prev = next((p for p in questions if p['number'] == q['number'] - 1), None)
                if prev and prev['visual']['page'] == part['page']:
                    b = prev['visual']['box']
                    if b[1] + b[3] > top:
                        b[3] = round(top - b[1] - 2, 2)
                        # The final choice hit area must stop before the next question's header.
                        for option in prev['options']:
                            ob = option['box']
                            ob[3] = min(ob[3], round(b[1] + b[3] - ob[1], 2))
                        changes.append(f'Q{prev["number"]}: remove following header')
    parts = [q['visual'] for q in questions]
    parts += [p for key, passage in data['passages'].items()
              if key.startswith('english-') for p in passage['parts']]
    for p in parts:
        page = doc[p['page'] - 1]
        footers = [l['bbox'][1] for b in page.get_text('dict')['blocks']
                   for l in b.get('lines', [])
                   if re.match(r'^(END OF TEST|STOP!|GO ON TO THE NEXT PAGE)',
                               ''.join(s['text'] for s in l['spans']))]
        if footers and p['box'][1] + p['box'][3] > min(footers) - 4:
            p['box'][3] = round(min(footers) - 4 - p['box'][1], 2)
            changes.append(f'Page {p["page"]}: exclude paper-only footer')
    for q in questions:
        b = q['visual']['box']
        for option in q['options']:
            ob = option['box']
            ob[3] = min(ob[3], round(b[1] + b[3] - ob[1], 2))
            assert ob[3] > 0, f'Invalid choice crop: {q["id"]}'
    return changes


if __name__ == '__main__':
    import pymupdf
    target, source = map(Path, sys.argv[1:])
    data = json.loads(target.read_text())
    changes = repair_english_crops(data, pymupdf.open(source))
    target.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')))
    print('\n'.join(changes) or 'Already correct')
