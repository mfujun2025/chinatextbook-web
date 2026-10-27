# -*- coding: utf-8 -*-
import subprocess, json, re, os
from collections import Counter

repo = os.path.join(os.path.dirname(__file__), '..', '.ctb_repo')
os.chdir(repo)

out = subprocess.check_output(['git', 'ls-tree', '-r', '-z', 'master'])
entries = [e for e in out.split(b'\0') if e]

books = []
for e in entries:
    meta, path = e.split(b'\t', 1)
    parts = meta.split()
    type_ = parts[1] if len(parts) > 1 else b''
    p = path.decode('utf-8')
    if type_ != b'blob':
        continue
    if not (p.endswith('.pdf') or re.search(r'\.pdf\.\d+$', p)):
        continue
    pp = p.split('/')
    if len(pp) < 4:
        continue
    stage = pp[0]
    subject = pp[1] if len(pp) > 1 else ''
    version = pp[2] if len(pp) > 2 else ''
    grade = pp[3] if len(pp) > 3 else ''
    fname = '/'.join(pp[4:]) if len(pp) > 4 else pp[-1]
    books.append({
        'stage': stage, 'subject': subject, 'version': version,
        'grade': grade, 'file': fname, 'path': p,
    })

print('total pdf files:', len(books))

shard_groups = {}
complete = []
for b in books:
    m = re.match(r'^(.*)\.pdf\.(\d+)$', b['file'])
    if m:
        base = m.group(1)
        key = (b['stage'], b['subject'], b['version'], b['grade'], base)
        shard_groups.setdefault(key, []).append(b)
    else:
        complete.append(b)

catalog = []
for b in complete:
    catalog.append({
        'stage': b['stage'], 'subject': b['subject'], 'version': b['version'],
        'grade': b['grade'], 'name': b['file'].rsplit('.pdf', 1)[0],
        'file': b['file'], 'sharded': False,
    })

for key, shards in shard_groups.items():
    shards_sorted = sorted(shards, key=lambda x: int(re.search(r'\.pdf\.(\d+)$', x['file']).group(1)))
    catalog.append({
        'stage': key[0], 'subject': key[1], 'version': key[2], 'grade': key[3],
        'name': key[4], 'file': key[4] + '.pdf', 'sharded': True,
        'shards': [s['file'] for s in shards_sorted],
    })

seen = set()
unique = []
for c in catalog:
    if c['file'] in seen:
        continue
    seen.add(c['file'])
    unique.append(c)

with open(os.path.join('..', 'data', 'catalog.json'), 'w', encoding='utf-8') as f:
    json.dump(unique, f, ensure_ascii=False, indent=1)

print('catalog entries:', len(unique))
print('sharded books:', len(shard_groups))
stages = Counter(c['stage'] for c in unique)
print('stages:', dict(stages))
subjects = Counter(c['subject'] for c in unique)
print(f'subjects: {len(subjects)}')
for s in sorted(subjects):
    print('  ', s, subjects[s])
