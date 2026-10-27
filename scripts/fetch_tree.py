# -*- coding: utf-8 -*-
"""Fetch the full tree of mfujun2025/ChinaTextbook via per-directory git trees API.
DFS traversal with retry + incremental checkpoint so it can resume after failures.
Output: tree_entries.json (list of {path, type, size, sha})
"""
import urllib.request, json, time, os, sys

BASE = 'https://api.github.com/repos/mfujun2025/ChinaTextbook'
OUT = 'tree_entries.json'
CKPT = 'tree_ckpt.json'

entries = {}   # path -> {type,size,sha}
done = set()   # tree paths already traversed

def load():
    global entries, done
    if os.path.exists(OUT):
        with open(OUT, 'r', encoding='utf-8') as f:
            entries = json.load(f)
    if os.path.exists(CKPT):
        with open(CKPT, 'r', encoding='utf-8') as f:
            done = set(json.load(f))
    print(f'resume: entries={len(entries)}, traversed={len(done)}', flush=True)

def save():
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(entries, f, ensure_ascii=False)
    with open(CKPT, 'w', encoding='utf-8') as f:
        json.dump(sorted(done), f, ensure_ascii=False)

def api_get(url, retries=6):
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/vnd.github+json',
            })
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r)
        except Exception as e:
            last = e
            wait = 2 * (i + 1)
            print(f'  retry {i+1} after error: {e}', flush=True)
            time.sleep(wait)
    raise last

def list_dir(path, sha):
    """Return list of {path,type,size,sha} for one directory."""
    url = f'{BASE}/git/trees/{sha}'
    data = api_get(url)
    out = []
    for e in data.get('tree', []):
        full = e['path'] if path == '' else path + '/' + e['path']
        out.append({'path': full, 'type': e['type'], 'size': e.get('size', 0), 'sha': e['sha']})
    return out

def main():
    load()
    root = api_get(f'{BASE}/git/trees/master')
    # find root sha
    root_sha = None
    for e in root.get('tree', []):
        if e['type'] == 'tree':
            root_sha = e['sha']
            break
    # actually we need the master branch commit; use contents API to get root dir listing
    root_listing = api_get(f'{BASE}/contents/')
    stack = [('', e['path'], e['sha']) for e in root_listing if e['type'] == 'dir']
    print(f'root dirs: {len(stack)}', flush=True)

    while stack:
        path, sha = stack.pop()
        if path in done:
            continue
        try:
            children = list_dir(path, sha)
        except Exception as e:
            print(f'FAIL dir {path}: {e}', flush=True)
            # leave not-done so it retries next run; but continue others
            continue
        for c in children:
            entries[c['path']] = {'type': c['type'], 'size': c['size'], 'sha': c['sha']}
        done.add(path)
        # push subdirs
        for c in children:
            if c['type'] == 'tree':
                stack.append((c['path'], c['sha']))
        if len(done) % 20 == 0:
            save()
            print(f'progress: {len(entries)} entries, {len(done)} dirs', flush=True)

    save()
    print(f'DONE: entries={len(entries)}, dirs={len(done)}', flush=True)

if __name__ == '__main__':
    main()
