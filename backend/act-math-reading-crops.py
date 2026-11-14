"""Source-derived Math/Reading paper-footer crops for ACT 26MC2."""
import json
import re
import sys
from pathlib import Path


def repair_math_reading_crops(data, doc):
    if data.get('form') != '26MC2':
        return []
    changes = []
    for section in data['sections']:
        if section['id'] not in ('math', 'reading'):
            continue
        for question in section['questions']:
            visual = question['visual']
            footers = [line['bbox'][1]
                       for block in doc[visual['page'] - 1].get_text('dict')['blocks']
                       for line in block.get('lines', [])
                       if re.match(r'^(END OF TEST|STOP!|GO ON TO THE NEXT PAGE)',
                                   ''.join(span['text'] for span in line['spans']))]
            box = visual['box']
            if not footers or box[1] + box[3] <= min(footers) - 4:
                continue
            box[3] = round(min(footers) - 4 - box[1], 2)
            assert box[3] > 0
            for option in question['options']:
                ob = option['box']
                if ob[1] + ob[3] > box[1] + box[3]:
                    ob[3] = round(box[1] + box[3] - ob[1], 2)
                assert ob[3] > 0
            changes.append(f'{section["id"]} Q{question["number"]}: omit paper-only footer')
    return changes


if __name__ == '__main__':
    import pymupdf
    path = Path(sys.argv[1])
    data = json.loads(path.read_text())
    changes = repair_math_reading_crops(data, pymupdf.open(sys.argv[2]))
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')))
    print('\n'.join(changes) or 'No changes needed')
