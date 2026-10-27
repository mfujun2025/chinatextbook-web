# -*- coding: utf-8 -*-
"""Merge file sizes from tree_full.json into catalog.json"""
import json, os, re

base = os.path.dirname(__file__)
data_dir = os.path.join(base, '..', 'data')

with open(os.path.join(data_dir, 'tree_full.json'), 'r', encoding='utf-8') as f:
    tree = json.load(f)

# build path -> size map
size_map = {}
for e in tree:
    if e['type'] == 'blob':
        size_map[e['path']] = e.get('size', 0)

with open(os.path.join(data_dir, 'catalog.json'), 'r', encoding='utf-8') as f:
    catalog = json.load(f)

for book in catalog:
    if book['sharded'] and book.get('shards'):
        # sum shard sizes
        total = 0
        for shard in book['shards']:
            # shard is relative filename within grade dir
            # need full path
            full = f"{book['stage']}/{book['subject']}/{book['version']}/{book['grade']}/{shard}"
            total += size_map.get(full, 0)
        book['size'] = total
    else:
        full = f"{book['stage']}/{book['subject']}/{book['version']}/{book['grade']}/{book['file']}"
        book['size'] = size_map.get(full, 0)

with open(os.path.join(data_dir, 'catalog.json'), 'w', encoding='utf-8') as f:
    json.dump(catalog, f, ensure_ascii=False, indent=1)

print(f'Updated {len(catalog)} books with sizes')
print('Sample sizes:')
for b in catalog[:3]:
    print(f"  {b['name']}: {b['size']/1048576:.1f} MB" if b['size'] else f"  {b['name']}: no size")
