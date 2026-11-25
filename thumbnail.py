"""YouTube thumbnail (1280x720) made from the PDF's hook and two real frames of the finished video."""
import re, shutil, subprocess, html
from pathlib import Path

TPL = """<!doctype html><meta charset=utf-8><style>
*{box-sizing:border-box;margin:0}body{width:1280px;height:720px;background:#05070d;font-family:Inter,Roboto,'DejaVu Sans',sans-serif;color:#fff;position:relative;overflow:hidden}
.bg{position:absolute;inset:0;background:radial-gradient(900px 500px at 15% 10%,%ACC%33 0,#05070d 60%),radial-gradient(700px 500px at 100% 100%,#0b2a55 0,transparent 60%)}
.grid{position:absolute;inset:0;background-image:linear-gradient(#ffffff08 1px,transparent 1px),linear-gradient(90deg,#ffffff08 1px,transparent 1px);background-size:48px 48px}
.p{position:absolute;width:400px;height:237px;border-radius:26px;background-size:cover;background-position:center;border:3px solid %ACC%;box-shadow:0 0 50px %ACC%66,0 20px 60px #000a}
.p1{right:360px;top:340px;background-image:url(f1.png);transform:rotate(-3deg)}
.p2{right:48px;top:300px;background-image:url(f2.png);border-color:#35e08a;box-shadow:0 0 50px #35e08a55,0 20px 60px #000a;transform:rotate(3deg)}
.t{position:absolute;left:56px;top:112px;font-weight:900;line-height:.92;letter-spacing:-3px;text-shadow:0 8px 40px #000;white-space:nowrap}
.a{color:%ACC%}.r{color:#ff5a5a}
.brand{position:absolute;left:56px;top:48px;font-weight:800;font-size:30px;letter-spacing:9px}.brand i{display:inline-block;width:14px;height:14px;background:%ACC%;border-radius:50%;margin-right:14px;box-shadow:0 0 14px %ACC%}
.pill{position:absolute;left:56px;bottom:44px;background:%ACC%;color:#1a1200;font-weight:900;font-size:%PS%px;padding:12px 30px;border-radius:16px;letter-spacing:-1px;max-width:900px;white-space:nowrap}
.n{position:absolute;left:56px;bottom:150px;display:flex;gap:14px}
.n b{background:#0b1222cc;border:2px solid #ffffff30;border-radius:16px;padding:10px 20px;font-size:40px;font-weight:900}.n small{display:block;font-size:15px;letter-spacing:3px;color:#9aa3b8;font-weight:700}
</style><div class=bg></div><div class=grid></div>
<div class=brand><i></i>%BRAND%</div><div class="p p1"></div><div class="p p2"></div>
<div class=t style="font-size:%FS%px"><div class=a>%L1%</div><div class=r style="margin-top:12px">%L2%</div></div>
%PILL%<div class=n>%NUMS%</div>"""


def _short(h, n=4):
    w = re.split(r'\s[—–]\s|;|:', h)[0].split()
    return ' '.join(w[:n]).rstrip('.,')


def make(parsed, story, jd, out, cfg):
    jd = Path(jd); stories = [s for s in story['scenes'] if s['type'] == 'story']
    if not stories: return None
    acc = (cfg.get('theme') or {}).get('accent', '#ffb400')
    sents = [x.strip() for x in re.split(r'(?<=[.!?])\s+', parsed.get('tagline', '')) if x.strip()]
    if len(sents) >= 2:
        l1, l2 = sents[0], sents[1]; pill = sents[2] if len(sents) > 2 else ''
    else:
        l1, l2 = _short(stories[0]['headline']), _short(stories[1]['headline']) if len(stories) > 1 else ''
        pill = _short(stories[2]['headline'], 5) if len(stories) > 2 else ''
    l1, l2, pill = l1.upper(), l2.upper(), pill.upper().rstrip('.')
    fs = int(min(112, 1000 / (0.64 * max(len(l1), len(l2), 8))))
    for i in (1, 2):                       # two frames from the middle of story 1 and 2
        s = stories[min(i - 1, len(stories) - 1)]
        mp4 = jd / 'scenes' / f'{s["id"]}.mp4'
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', f'{s["dur"] * 0.55:.2f}', '-i', str(mp4), '-frames:v', '1', '-vf', 'crop=1080:640:0:500', str(jd / f'f{i}.png')], check=True)
    nums = ''.join(f'<b>{html.escape(s["cards"][0]["v"])}<small>{html.escape(s["cat"].upper())}</small></b>' for s in stories[:2] if s.get('cards') and s['cards'][0]['k'] != 'WHAT YOU CAN DO')
    brand = (parsed.get('brand') or 'BRIEFING').upper()
    h = (TPL.replace('%ACC%', acc).replace('%FS%', str(fs)).replace('%PS%', '54' if len(pill) < 22 else '40').replace('%BRAND%', html.escape(brand))
         .replace('%L1%', html.escape(l1)).replace('%L2%', html.escape(l2)).replace('%NUMS%', nums)
         .replace('%PILL%', f'<div class=pill>{html.escape(pill)}</div>' if pill else ''))
    (jd / 'thumb.html').write_text(h, encoding='utf-8')
    from playwright.sync_api import sync_playwright
    chrome = next((shutil.which(c) for c in ('google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser') if shutil.which(c)), None)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])
        pg = b.new_page(viewport={'width': 1280, 'height': 720})
        pg.goto((jd / 'thumb.html').resolve().as_uri()); pg.wait_for_timeout(400)
        pg.screenshot(path=str(out)); b.close()
    return out
