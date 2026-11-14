"""Keep English whole-passage prompts with their question; omit paper-only footers.

Called after build-act.py generates metadata. Can also repair a single existing
test: python act-english-crops.py path/to/test.json path/to/original.pdf
Never rewrites PDF/SVG text, punctuation, answer keys, or another section.
"""
import json
import re
import sys
from pathlib import Path


def compact_english_passages(data, doc):
    """Describe whitespace-only bands to omit, keeping original PDF coordinates."""
    changes = []
    for key, passage in data['passages'].items():
        if not key.startswith('english-'):
            continue
        for part in passage['parts']:
            part.pop('bands', None)
            x, y, w, h = part['box']
            page = doc[part['page'] - 1]
            rows, occupied = [], []
            for block in page.get_text('dict')['blocks']:
                for line in block.get('lines', []):
                    b = line['bbox']
                    if not (x <= b[0] < x+w and y <= b[1] < y+h):
                        continue
                    if any(s['size'] > 24 for s in line['spans']):
                        continue
                    occupied.append((b[1], b[3]))
                    spans = [s for s in line['spans'] if 9 <= s['size'] <= 16]
                    if spans:
                        rows.append((min(s['origin'][1] for s in spans), b[0], b[1], b[3]))
            for drawing in page.get_drawings():
                b = drawing['rect']
                if x <= b.x0 and b.x1 <= x+w and y <= b.y0 < y+h:
                    occupied.append((b.y0, b.y1))
            rows.sort()
            if not rows:
                continue
            left = min(r[1] for r in rows)
            cuts = []
            for prev, nxt in zip(rows, rows[1:]):
                delta = nxt[0] - prev[0]
                if delta < 30:
                    continue
                # Indented new paragraphs retain a blank line; continuations use normal leading.
                target = 40 if nxt[1] > left+8 else 20
                intervals = sorted((max(a, prev[3]), min(b, nxt[2])) for a, b in occupied
                                   if b > prev[3] and a < nxt[2])
                cursor, blanks = prev[3], []
                for a, b in intervals:
                    if a > cursor:
                        blanks.append((cursor, a))
                    cursor = max(cursor, b)
                if nxt[2] > cursor:
                    blanks.append((cursor, nxt[2]))
                if not blanks:
                    continue
                a, b = max(blanks, key=lambda gap: gap[1]-gap[0])
                remove = min(delta-target, b-a-4)
                if remove > 8:
                    start = (a+b-remove)/2
                    cuts.append((round(start, 3), round(start+remove, 3)))
            if cuts:
                bands, cursor = [], y
                for start, end in cuts:
                    bands.append([x, cursor, w, round(start-cursor, 3)])
                    cursor = end
                bands.append([x, cursor, w, round(y+h-cursor, 3)])
                part['bands'] = bands
                changes.append(f'{key} page {part["page"]}: compact {len(cuts)} paper-layout gaps')
    return changes


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
    return changes + compact_english_passages(data, doc)


if __name__ == '__main__':
    import pymupdf
    target, source = map(Path, sys.argv[1:])
    data = json.loads(target.read_text())
    changes = repair_english_crops(data, pymupdf.open(source))
    target.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')))
    print('\n'.join(changes) or 'Already correct')
