"""Turn parsed PDF stories into a video script (story.json) and narration audio."""
import re, json, os
import numpy as np

SR = 24000
MONTHS = {'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April', 'Jun': 'June', 'Jul': 'July', 'Aug': 'August',
          'Sep': 'September', 'Sept': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December'}
PRONOUNCEABLE = {'NATO', 'OPEC', 'NASA', 'FIFA', 'COVID', 'UNESCO', 'ASEAN', 'BRICS', 'FAA', 'SEC', 'FED'}
SLIDE = re.compile(r'slid|slip|dip|fall|fell|drop|plung|sink|tumbl|lower|low\b|lows|crack|loss|slump|decline|sell-?off|below', re.I)
RISE = re.compile(r'jump|surge|rall|soar|climb|gain|rise|rose|high|record|up to', re.I)


def clean(t):
    t = re.sub(r'\s+', ' ', t).strip()
    return t


def sentences(t):
    t = clean(t)
    if not t: return []
    return [s.strip() for s in re.split(r'(?<=[.!?])\s+(?=[A-Z“"\'(\d$~])', t) if s.strip()]


def cap_words(t, n):
    w = t.split()
    if len(w) <= n: return t
    cut = w[:n]
    for i in range(len(cut) - 1, int(n * .55), -1):
        if re.search(r'[,;:—–]$', cut[i]):
            cut = cut[:i + 1]; break
    s = ' '.join(cut).rstrip(',;:—– ')
    return s + '.'


def drop_parens(t):
    return clean(re.sub(r'\s*\([^)]*\)\s*$', '', t))


def norm_tts(t):
    t = t.replace('’', "'").replace('“', '"').replace('”', '"')
    t = re.sub(r'\b(%s)\b\.?' % '|'.join(MONTHS), lambda m: MONTHS[m.group(1)], t)
    def money(m):
        num = m.group(1); suf = (m.group(2) or '').lower(); per = m.group(3) or ''
        words = {'m': ' million', 'b': ' billion', 'bn': ' billion', 'k': ' thousand', 't': ' trillion'}.get(suf, '')
        per_w = {'/oz': ' an ounce', '/year': ' a year', '/person/year': ' per person per year', '/month': ' a month'}.get(per.lower(), '')
        return f"{num}{words} dollars{per_w}"
    t = re.sub(r'\$(\d[\d,]*(?:\.\d+)?)\s?(bn|[MBKT])?\b(/person/year|/oz|/year|/month)?', money, t)
    t = re.sub(r'(dollars(?: an ounce| a year| per person per year| a month)?)(?=\w)', r'\1 ', t)
    t = re.sub(r'(\d)\s?%', r'\1 percent', t)
    t = t.replace('~', 'about ').replace('&', ' and ').replace('—', ', ').replace('–', ' to ')
    t = re.sub(r'(\d+)\(k\)', lambda m: {'401': 'four oh one k', '403': 'four oh three b'}.get(m.group(1), m.group(1) + ' k'), t)
    t = re.sub(r'\b(\d{1,2})\s?AM\b', lambda m: m.group(1) + ' A M', t)
    t = re.sub(r'\b(\d{1,2})\s?PM\b', lambda m: m.group(1) + ' P M', t)
    t = re.sub(r'(\w)\.gov\b', r'\1 dot gov', t)
    t = re.sub(r'TreasuryDirect', 'Treasury Direct', t)
    def acr(m):
        w = m.group(0)
        return w if w in PRONOUNCEABLE or w == 'I' else ' '.join(w)
    t = re.sub(r'\b[A-Z]{2,5}\b', acr, t)
    t = re.sub(r'(\d)-(\w)', r'\1 \2', t)
    t = re.sub(r'\s+', ' ', t)
    return t.strip()


FIG = re.compile(r'~?\$\d[\d,]*(?:\.\d+)?\s?(?:bn|billion|million|trillion|[MBKT])?(?:/oz|/year|/person/year)?|~?\d[\d,]*(?:\.\d+)?\s?%')


def figures(text, n=2):
    out = []
    for m in FIG.finditer(text):
        v = m.group(0).strip().replace('~', '≈')
        if re.fullmatch(r'(19|20)\d\d', v): continue
        if v in [o[0] for o in out]: continue
        sent = next((s for s in sentences(text) if m.group(0) in s), text)
        out.append((v, cap_words(drop_parens(sent), 18)))
        if len(out) == n: break
    return out


def kind_for(s):
    head = (s['headline'] + ' ' + s['tagline']).lower()
    what = (s['headline'] + ' ' + s['what'] + ' ' + s['tagline'] + ' ' + s.get('cue', '')).lower()
    allt = what + ' ' + s['why'].lower()
    p = {}
    if re.search(r'\bgold|silver|bullion|precious metal', head): kind = 'metals'
    elif re.search(r'nvidia|\bchips?\b|gpu|semiconductor|data cent', head) or re.search(r'nvidia|gpu|semiconductor', what): kind = 'chip'
    elif re.search(r'tanker|\bships?\b|strait|hormuz|navy|naval|warship|vessel|corvette|maritime|shipping', what): kind = 'ships'
    elif re.search(r'\bipo\b|shares|\bstocks?\b|nasdaq|nyse|s&p|\bdow\b|\betf|bitcoin|crypto|earnings|market cap|valuation', head): kind = 'candles'
    elif re.search(r'bond|401|\bira\b|\brates?\b|\btax|saving|\braises?\b|salary|interest|inflation|retire|treasury|loan|mortgage|income|wealth|\bcash\b|invest', head + ' ' + s['tagline'].lower()) or 'MONEY' in s['cat']: kind = 'coins'
    else: kind = 'globe'
    down = len(SLIDE.findall(s['headline'] + ' ' + s['tagline'])) > len(RISE.findall(s['headline'] + ' ' + s['tagline']))
    p['down'] = bool(down)
    p['strikes'] = bool(re.search(r'strike|mine|drone|missile|attack|explo|struck|hit\b|hits\b', what))
    p['cyber'] = bool(re.search(r'cyber|hack|breach', what))
    p['alarm'] = bool(re.search(r'apolog|scandal|probe|investigat|ousted|resign|fraud|lawsuit|crisis|mistake', allt))
    p['gavel'] = bool(re.search(r'congress|testif|senate|court|lawsuit|sec\b|hearing|subpoena', allt))
    p['ipo'] = bool(re.search(r'\bipo\b', what))
    p['dollar'] = bool(re.search(r'dollar|fed\b|rate hike|yield', allt))
    return kind, p


def _chunks3(sents):
    """Split voice-over sentences into <=3 contiguous groups with balanced word counts."""
    S = [x for x in sents if x.strip()]
    if len(S) > 3:
        best = None
        for a in range(1, len(S) - 1):
            for b in range(a + 1, len(S)):
                g = [' '.join(S[:a]), ' '.join(S[a:b]), ' '.join(S[b:])]
                m = max(len(x.split()) for x in g)
                if best is None or m < best[0]: best = (m, g)
        return best[1]
    if len(S) < 3 and S:                     # split the longest at a clause break
        while len(S) < 3:
            i = max(range(len(S)), key=lambda k: len(S[k].split()))
            parts = re.split(r'(?<=,)\s+|;\s+|\s+(?:and|but|while|as)\s+', S[i], maxsplit=1)
            if len(parts) < 2 or not parts[0].strip() or not parts[1].strip(): break
            S[i:i + 1] = [parts[0].strip(), S[i][len(parts[0]):].lstrip(' ,;')]
    return S


def story_lines(s, style):
    head = clean(s['headline']).rstrip('.')
    if s.get('vo'):                           # written voice-over from the PDF: narrate it as written
        return [head + '.'] + _chunks3(sentences(clean(s['vo'])))
    what = sentences(s['what']); why = sentences(s['why']); do = clean(s['do'])
    L = [head + '.']
    if style == 'short':
        L.append(cap_words(' '.join(what[:1]) or s['tagline'], 26))
        L.append(cap_words(' '.join(why[:1]) or (what[1] if len(what) > 1 else ''), 20))
        L.append(cap_words(do, 24))
    else:
        w1 = what[0] if what else s['tagline']
        L.append(cap_words(w1, 34))
        rest = ' '.join(what[1:]) if len(what) > 1 else (why[0] if why else '')
        L.append(cap_words(rest, 30))
        L.append(cap_words(do, 36))
    L = [l for l in L if l]
    while len(L) < 4: L.append(L[-1] if len(L) < 2 else '')
    # drop empties by merging into previous so we always keep 4 narrated lines
    out = []
    for l in L:
        if l.strip(): out.append(l)
    while len(out) < 4: out.append(out[-1])
    return out[:4]


def build_story(parsed, cfg):
    style = cfg.get('style', 'full')
    scenes = []
    brand = parsed['brand'] or 'THE 3AM EDGE'
    date = parsed['date'] or ''
    spoken_brand = norm_tts((brand.title() if brand.isupper() else brand).replace('3Am', '3AM'))
    intro_t = f"It's three A M. Here's what moved the world while you slept." if re.search(r'3\s?AM', brand, re.I) else f"{spoken_brand}. {norm_tts(date)}."
    intro_d = "It's 3AM. Here's what moved the world while you slept." if re.search(r'3\s?AM', brand, re.I) else f"{brand.title()}. {date}."
    def short_h(h):
        return cap_words(re.split(r'\s[—–]\s|;|:', h)[0].strip(), 7).rstrip('.')
    tz = [short_h(s['headline']) for s in parsed['stories'][:3]]
    lines0 = [{'text': intro_t, 'disp': intro_d}]
    if len(tz) >= 2:
        td = 'Coming up: ' + ', '.join(tz[:-1]) + ', and ' + tz[-1] + '.'
        lines0.append({'text': norm_tts(td), 'disp': td})
    scenes.append({'id': 's0', 'type': 'intro', 'brand': brand, 'date': date, 'tagline': parsed['tagline'], 'teasers': tz, 'lines': lines0})
    N = len(parsed['stories'])
    for i, s in enumerate(parsed['stories']):
        kind, params = kind_for(s)
        disp = story_lines(s, style)
        fig = [(n['v'], cap_words(n['k'], 8)) for n in s.get('nums', [])] or figures(s['headline'] + '. ' + s['what'])
        act = clean(s['do']); acts = sentences(act); a_s = ''
        for x in acts:
            if len((a_s + ' ' + x).split()) > 30 and a_s: break
            a_s = (a_s + ' ' + x).strip()
        a_s = cap_words(a_s, 32); a_v = 'Your move'
        cards = []
        if fig: cards.append({'line': 1, 'k': 'KEY FIGURE', 'v': fig[0][0], 's': fig[0][1]})
        if len(fig) > 1: cards.append({'line': 2, 'k': 'ALSO', 'v': fig[1][0], 's': fig[1][1]})
        cards.append({'line': min(3, len(disp) - 1), 'k': 'WHAT YOU CAN DO', 'v': a_v, 's': a_s, 'small': True})
        if len(disp) < 4:
            for c in cards: c['line'] = min(c['line'], len(disp) - 1)
        src = re.sub(r'^Sources?:\s*', '', s['source']).strip()
        scenes.append({'id': f's{i+1}', 'type': 'story', 'n': i + 1, 'total': N, 'cat': s['cat'] or 'NEWS', 'headline': s['headline'], 'tagline': s['tagline'],
                       'kind': kind, 'params': params, 'cards': cards, 'tag': s.get('tag', ''), 'tagnote': s.get('tagnote', ''), 'source': ' · '.join([x.strip() for x in re.split(r'\s*\|\s*', src) if x.strip()][:2]).rstrip('.') if src else '',
                       'lines': [{'text': norm_tts(d), 'disp': d} for d in disp]})
    also = [a for a in parsed['also'] if a]
    if also:
        lines = []
        for a in also:
            d = cap_words(drop_parens(a), 30); lines.append({'text': norm_tts(d), 'disp': d})
        scenes.append({'id': f's{N+1}', 'type': 'also', 'bullets': [l['disp'] for l in lines], 'lines': lines})
    close = clean(parsed['closing']) or 'Check the plan, not the ticker.'
    cs = sentences(close)
    big = cs[-1] if cs else close
    brand_t = (brand.title() if brand.isupper() else brand).replace('3Am', '3AM')
    lines = [{'text': norm_tts(close), 'disp': close}, {'text': norm_tts(f"This was {brand_t}. Informational only, not financial advice."), 'disp': f"This was {brand_t}. Not financial advice."}]
    scenes.append({'id': f's{len(scenes)}', 'type': 'outro', 'big': big, 'brand': brand, 'lines': lines})
    return {'brand': brand, 'date': date, 'scenes': scenes}


_K = None


def _kokoro():
    global _K
    if _K is None:
        from kokoro_onnx import Kokoro
        mdir = os.environ.get('KOKORO_DIR', '/tmp/voices')
        _K = Kokoro(os.path.join(mdir, 'kokoro-v1.0.onnx'), os.path.join(mdir, 'voices-v1.0.bin'))
    return _K


def _synth_scene(args):
    sc, outdir, cfg = args
    import soundfile as sf
    k = _kokoro()
    FPS = int(cfg.get('fps', 30))
    if True:
        parts = []; t = .25; pad = np.zeros(int(SR * .32), np.float32)
        for ln in sc['lines']:
            a, _ = k.create(ln['text'], voice=cfg.get('voice', 'af_heart'), speed=float(cfg.get('speed', 1.0)), lang='en-us')
            a = a.astype(np.float32); parts += [a, pad]
            ln['start'] = round(t, 3); ln['dur'] = round(len(a) / SR, 3); t += len(a) / SR + .32
        tail = .9 if sc['type'] == 'outro' else .5
        audio = np.concatenate([np.zeros(int(SR * .25), np.float32)] + parts + [np.zeros(int(SR * tail), np.float32)])
        frames = int(np.ceil(len(audio) / SR * FPS)); n = int(frames / FPS * SR)
        audio = np.concatenate([audio, np.zeros(max(0, n - len(audio)), np.float32)])[:n]
        sf.write(os.path.join(outdir, sc['id'] + '.wav'), audio, SR)
        sc['dur'] = frames / FPS; sc['frames'] = frames
    return sc


def synth(story, outdir, cfg, workers=1):
    os.makedirs(outdir, exist_ok=True)
    jobs = [(sc, outdir, cfg) for sc in story['scenes']]
    if workers > 1:
        from concurrent.futures import ProcessPoolExecutor
        with ProcessPoolExecutor(max_workers=workers) as ex:
            story['scenes'] = list(ex.map(_synth_scene, jobs))
    else:
        story['scenes'] = [_synth_scene(j) for j in jobs]
    return story
