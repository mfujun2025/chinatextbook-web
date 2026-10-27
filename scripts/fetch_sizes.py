# -*- coding: utf-8 -*-
"""Fetch full recursive tree with sizes via GitHub API (retry on failure).
Output: tree_full.json
"""
import urllib.request, json, time, os

BASE = 'https://api.github.com/repos/mfujun2025/ChinaTextbook'
OUT = os.path.join(os.path.dirname(__file__), '..', 'data', 'tree_full.json')

def api_get(url, retries=10):
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/vnd.github+json',
            })
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.load(r)
        except Exception as e:
            last = e
            wait = 3 * (i + 1)
            print(f'  retry {i+1}: {e}', flush=True)
            time.sleep(wait)
    raise last

repo = api_get(BASE)
branch = repo['default_branch']
print('branch:', branch)

data = api_get(f'{BASE}/git/trees/{branch}?recursive=1')
tree = data.get('tree', [])
print(f'entries: {len(tree)}, truncated: {data.get("truncated")}')

with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(tree, f, ensure_ascii=False)
print(f'saved {OUT}')
