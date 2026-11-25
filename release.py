"""Publish out/* extras (Shorts + 16:9) as GitHub Release assets so the repo itself stays small."""
import json, subprocess, os, sys, tempfile
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
f = ROOT / 'out' / 'releases.json'
if not f.exists(): print('nothing to release'); sys.exit(0)
for r in json.load(open(f)):
    subprocess.run(['gh', 'release', 'delete', r['tag'], '-y', '--cleanup-tag'], capture_output=True)
    with tempfile.NamedTemporaryFile('w', suffix='.md', delete=False) as t: t.write(r['notes']); notes = t.name
    cmd = ['gh', 'release', 'create', r['tag'], *[str(ROOT / 'out' / x) for x in r['files']], '--title', r['title'], '--notes-file', notes]
    print(' '.join(cmd[:5]), '...', flush=True); subprocess.run(cmd, check=True)
