#!/usr/bin/env python3
"""PDF -> video pipeline. Usage: python tools/build.py [--force] [--only NAME]
Reads pdfs/*.pdf, writes videos/<name>.mp4 + videos/<name>.jpg and updates videos/manifest.json."""
import os, sys, re, json, shutil, subprocess, threading, functools, http.server, socketserver, datetime, time, urllib.request, traceback
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent if HERE.name == 'tools' else HERE   # works in a tools/ folder or flat at the repo root
TOOLS = HERE
WEB = 'web/' if (HERE / 'web').is_dir() else ''
sys.path.insert(0, str(TOOLS))


def log(*a): print(*a, flush=True)


def ensure_models():
    d = Path(os.environ.get('KOKORO_DIR', '/tmp/voices')); d.mkdir(parents=True, exist_ok=True)
    base = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/'
    for f in ('kokoro-v1.0.onnx', 'voices-v1.0.bin'):
        if not (d / f).exists() or (d / f).stat().st_size < 10_000_000:
            log('downloading', f); urllib.request.urlretrieve(base + f, d / f)
    os.environ['KOKORO_DIR'] = str(d)


def serve():
    class H(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    handler = functools.partial(H, directory=str(TOOLS))
    srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), handler); srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv.server_address[1]


def render_scene(args):
    port, job, idx, frames, out, q, crf, fps, bloom = args
    FPS = fps
    from playwright.sync_api import sync_playwright
    chrome = next((shutil.which(c) for c in ('google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser') if shutil.which(c)), None)
    tmp = out.replace('.mp4', '.tmp.mp4')
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'])
        pg = b.new_page(viewport={'width': 1080, 'height': 1920})
        pg.on('pageerror', lambda e: log('PAGEERROR', e))
        pg.goto(f'http://127.0.0.1:{port}/{WEB}page.html?job={job}&i={idx}&q={q}&bloom={bloom}')
        pg.wait_for_function('window.READY===true', timeout=180000)
        ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', str(FPS), '-c:v', 'mjpeg', '-i', '-',
                               '-vf', 'format=yuv420p', '-c:v', 'libx264', '-crf', str(crf), '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', str(FPS), tmp], stdin=subprocess.PIPE)
        t0 = time.time()
        for f in range(frames):
            pg.evaluate(f'renderAt({f / FPS})')
            ff.stdin.write(pg.screenshot(type='jpeg', quality=92))
            if f % 150 == 0: log(f'  scene {idx}: {f}/{frames} ({time.time() - t0:.0f}s)')
        ff.stdin.close(); rc = ff.wait(); b.close()
    if rc != 0: raise RuntimeError(f'ffmpeg failed for scene {idx}')
    os.rename(tmp, out)
    return idx


def probe_dur(path):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path)], capture_output=True, text=True).stdout.strip())


def out_name(stem):
    if re.search(r'\d{4}-\d{2}-\d{2}', stem): return stem
    return f"{stem}_{datetime.datetime.utcnow():%Y-%m-%d_%H%M}UTC"


def build_one(pdf, cfg, port, workers):
    from parse_pdf import parse
    from narrate import build_story, synth
    from audio_mix import mix
    stem = pdf.stem; name = out_name(stem)
    job = re.sub(r'[^A-Za-z0-9_.-]', '_', stem)
    jd = TOOLS / 'jobs' / job
    if jd.exists(): shutil.rmtree(jd)
    (jd / 'scenes').mkdir(parents=True)
    log(f'=== {pdf.name} -> {name}.mp4')
    parsed = parse(str(pdf))
    log(f'parsed {len(parsed["stories"])} stories, {len(parsed["also"])} quick hits')
    if not parsed['stories']: raise RuntimeError('no stories found in PDF')
    story = build_story(parsed, cfg)
    story['theme'] = cfg.get('theme', {})
    story = synth(story, str(jd / 'audio'), cfg, workers)
    json.dump(story, open(jd / 'story.json', 'w'), ensure_ascii=False, indent=1)
    total = sum(s['dur'] for s in story['scenes'])
    log(f'{len(story["scenes"])} scenes, {total:.0f}s of video')
    q = cfg.get('webgl_scale', 0.6); crf = cfg.get('crf', 22); fps = int(cfg.get('fps', 30)); bloom = cfg.get('bloom', 0.5)
    jobs = [(port, job, i, sc['frames'], str(jd / 'scenes' / f'{sc["id"]}.mp4'), q, crf, fps, bloom) for i, sc in enumerate(story['scenes'])]
    jobs.sort(key=lambda j: -j[3])
    with ProcessPoolExecutor(max_workers=workers) as ex:
        for r in ex.map(render_scene, jobs): pass
    lst = jd / 'list.txt'; lst.write_text(''.join(f"file 'scenes/{sc['id']}.mp4'\n" for sc in story['scenes']))
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', str(lst), '-c', 'copy', str(jd / 'video.mp4')], check=True)
    _, starts = mix(story, str(jd), str(jd / 'mix.wav'))
    master = 'highpass=f=70,acompressor=threshold=-20dB:ratio=3:attack=8:release=160,loudnorm=I=-16:TP=-1.5:LRA=9'
    (ROOT / 'videos').mkdir(exist_ok=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(jd / 'mix.wav'), '-af', master, '-ar', '44100', str(jd / 'master.wav')], check=True)
    audio_out = ROOT / 'videos' / f'{name}.m4a'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(jd / 'master.wav'), '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', str(audio_out)], check=True)
    (ROOT / 'videos').mkdir(exist_ok=True)
    final = ROOT / 'videos' / f'{name}.mp4'; tmp = ROOT / 'videos' / f'{name}.tmp.mp4'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(jd / 'video.mp4'), '-i', str(jd / 'master.wav'), '-map', '0:v', '-map', '1:a',
                    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', str(tmp)], check=True)
    dur = probe_dur(tmp); max_mb = cfg.get('max_mb', 90)
    if tmp.stat().st_size > max_mb * 1e6:   # GitHub rejects files over 100 MB: re-encode to fit
        vb = int((max_mb * 0.92 * 8e6 / dur) - 160_000)
        log(f'file {tmp.stat().st_size / 1e6:.0f}MB > {max_mb}MB, re-encoding at {vb // 1000}k')
        t2 = ROOT / 'videos' / f'{name}.fit.mp4'
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(tmp), '-c:v', 'libx264', '-b:v', str(vb), '-maxrate', str(int(vb * 1.3)), '-bufsize', str(vb * 2),
                        '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', str(t2)], check=True)
        t2.replace(tmp)
    tmp.replace(final)
    poster = ROOT / 'videos' / f'{name}.jpg'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', '2.5', '-i', str(final), '-frames:v', '1', '-vf', 'scale=540:960', '-q:v', '3', str(poster)], check=True)
    extras = make_extras(name, story, jd, starts, final, parsed, cfg)
    update_manifest(name, parsed, story, pdf, dur, final, extras)
    shutil.rmtree(jd, ignore_errors=True)
    log(f'DONE {final.name} {final.stat().st_size / 1e6:.1f}MB {dur:.0f}s')


def make_extras(name, story, jd, starts, final, parsed, cfg):
    """YouTube-ready extras: one Short per story, a 16:9 edition, and a copy-paste YouTube pack."""
    from youtube import pack
    out = ROOT / 'out'; out.mkdir(exist_ok=True)
    repo = os.environ.get('GITHUB_REPOSITORY'); tag = 'v-' + re.sub(r'[^A-Za-z0-9._-]', '-', name)
    def url(f): return f'https://github.com/{repo}/releases/download/{tag}/{f}' if repo else f'out/{f}'
    extras = []; files = []
    if cfg.get('shorts', True):
        for i, sc in enumerate(story['scenes']):
            if sc['type'] != 'story': continue
            f = f'{name}_short_{sc["n"]:02d}.mp4'
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', f'{starts[i]:.3f}', '-t', f'{sc["dur"]:.3f}', '-i', str(jd / 'master.wav'),
                            '-i', str(jd / 'scenes' / f'{sc["id"]}.mp4'), '-map', '1:v', '-map', '0:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', str(out / f)], check=True)
            extras.append({'label': f'Short {sc["n"]}: {sc["headline"][:60]}', 'file': f, 'url': url(f), 'kind': 'short'}); files.append(f)
    if cfg.get('landscape', True):
        f = f'{name}_16x9.mp4'
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(final), '-filter_complex',
                        '[0:v]split[a][b];[b]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,boxblur=40:6,eq=brightness=-0.12[bg];[a]scale=-2:1080[fg];[bg][fg]overlay=(W-w)/2:0,format=yuv420p[v]',
                        '-map', '[v]', '-map', '0:a', '-c:v', 'libx264', '-crf', '27', '-preset', 'veryfast', '-c:a', 'copy', '-movflags', '+faststart', str(out / f)], check=True)
        extras.append({'label': '16:9 landscape edition (blurred sides)', 'file': f, 'url': url(f), 'kind': 'landscape'}); files.append(f)
    if cfg.get('thumbnail', True):
        try:
            from thumbnail import make as make_thumb
            make_thumb(parsed, story, jd, ROOT / 'videos' / f'{name}_thumbnail.png', cfg)
        except Exception as e:
            log('thumbnail skipped:', e)
    txt = pack(parsed, story, starts)
    (ROOT / 'videos' / f'{name}_youtube.txt').write_text(txt, encoding='utf-8')
    if files and repo:
        rel = json.load(open(out / 'releases.json')) if (out / 'releases.json').exists() else []
        rel = [r for r in rel if r['tag'] != tag]
        rel.append({'tag': tag, 'title': f'{parsed["brand"].title() if parsed["brand"].isupper() else parsed["brand"]} {parsed["date"]}', 'files': files, 'notes': 'Shorts and 16:9 edition for upload to YouTube. Generated from the PDF in pdfs/.'})
        json.dump(rel, open(out / 'releases.json', 'w'), indent=1)
    return extras


def update_manifest(name, parsed, story, pdf, dur, final, extras=()):
    mp = ROOT / 'videos' / 'manifest.json'
    items = json.load(open(mp)) if mp.exists() else []
    items = [i for i in items if i['name'] != name]
    titles = [s['headline'] for s in parsed['stories']]
    items.append({'name': name, 'title': f"{parsed['brand'].title() if parsed['brand'].isupper() else parsed['brand']}", 'date': parsed['date'],
                  'pdf': f'pdfs/{pdf.name}', 'video': f'videos/{name}.mp4', 'poster': f'videos/{name}.jpg', 'audio': f'videos/{name}.m4a', 'youtube': f'videos/{name}_youtube.txt', 'thumbnail': f'videos/{name}_thumbnail.png', 'extras': list(extras), 'duration': round(dur, 1),
                  'size_mb': round(final.stat().st_size / 1e6, 1), 'stories': len(titles), 'headlines': titles,
                  'created': datetime.datetime.utcnow().isoformat(timespec='seconds') + 'Z',
                  'chapters': [{'t': round(sum(s['dur'] for s in story['scenes'][:i]), 2), 'label': (sc.get('headline') or {'intro': 'Intro', 'also': 'Also watching', 'outro': 'Sign-off'}.get(sc['type'], sc['id']))} for i, sc in enumerate(story['scenes'])]})
    items.sort(key=lambda i: i['created'], reverse=True)
    json.dump(items, open(mp, 'w'), indent=1, ensure_ascii=False)


def main():
    force = '--force' in sys.argv or os.environ.get('FORCE') == '1'
    only = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else None
    cfg = json.load(open(ROOT / 'config.json')) if (ROOT / 'config.json').exists() else {}
    preset = os.environ.get('PRESET') or cfg.get('preset', 'fast')
    cfg.update(cfg.get('presets', {}).get(preset, {}))
    log('preset:', preset, {k: cfg.get(k) for k in ('fps', 'webgl_scale', 'crf', 'bloom')})
    pdfs = sorted((ROOT / 'pdfs').glob('*.pdf'))
    todo = []
    for p in pdfs:
        if only and only not in p.name: continue
        if not force and (ROOT / 'videos' / f'{out_name(p.stem)}.mp4').exists() and re.search(r'\d{4}-\d{2}-\d{2}', p.stem): continue
        todo.append(p)
    if not todo: log('nothing to build'); return 0
    ensure_models(); port = serve()
    workers = int(cfg.get('workers') or max(1, min(4, os.cpu_count() or 2)))
    bad = 0
    for p in todo:
        try: build_one(p, cfg, port, workers)
        except Exception: traceback.print_exc(); bad += 1
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
