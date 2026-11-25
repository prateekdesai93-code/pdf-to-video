"""Parser for the 'Video Edition' layout: one card per scene with hook, three big numbers,
what/why, what-you-can-do, a written voice-over, a visual cue and sources."""
import re, datetime
import pdfplumber

HDR = re.compile(r'SCENE\s+(\d+)\s*\|\s*(.+?)(?:\s+TOP-\d+ CUT)?\s*\|?\s*~?(\d+)\s*SEC ON SCREEN\s+(CONFIRMED|REPORTED)\s*-?\s*(.*)')


def _fix(s):
    return re.sub(r'\s+', ' ', s.replace(' ', ' ')).strip()


def is_edition(path):
    with pdfplumber.open(path) as pdf:
        t = pdf.pages[0].extract_text() or ''
        return 'VIDEO EDITION' in t.upper() and any('SCENE 01' in (p.extract_text() or '') for p in pdf.pages[:3])


def _lines(page, x0=0, x1=None, top=0, bottom=None):
    box = page.crop((x0, top, x1 or page.width, bottom or page.height))
    ws = box.extract_words(extra_attrs=['size', 'fontname'], keep_blank_chars=False)
    rows = {}
    for w in ws:
        rows.setdefault(round(w['top'] / 3), []).append(w)
    out = []
    for k in sorted(rows):
        r = sorted(rows[k], key=lambda w: w['x0'])
        out.append({'text': ' '.join(w['text'] for w in r), 'size': round(r[0]['size'], 1), 'font': r[0]['fontname'], 'x0': r[0]['x0'], 'words': r, 'top': r[0]['top']})
    return out


def _date(txt):
    m = re.search(r'((?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day),?\s+(\d{1,2})\s+([A-Z][a-z]+)\s+(\d{4})', txt)
    if not m: return ''
    try:
        d = datetime.datetime.strptime(f'{m.group(2)} {m.group(3)} {m.group(4)}', '%d %B %Y')
        return f'{m.group(1)}, {d.strftime("%B")} {d.day}, {d.year}'
    except Exception:
        return ' '.join(m.groups())


def parse_edition(path):
    out = {'brand': 'THE 3AM EDGE', 'date': '', 'tagline': '', 'stories': [], 'also': [], 'closing': '', 'footer': '', 'edition': True}
    with pdfplumber.open(path) as pdf:
        p1 = pdf.pages[0]
        L1 = _lines(p1)
        out['date'] = _date(' '.join(l['text'] for l in L1[:4]))
        hero = [l['text'] for l in L1 if l['size'] >= 40]
        if hero:
            ACR = {'ceo', 'ai', 'us', 'uk', 'ipo', 'gdp', 'cpi', 'fed', 'etf', 'eu', 'un', 'nato', 'cfo'}
            def sent(h):
                h = h.capitalize() if h.isupper() else h
                return ' '.join(w.upper() if re.sub(r'\W', '', w).lower() in ACR else w for w in h.split())
            out['tagline'] = ' '.join(sent(h) for h in hero)
        m = re.search(r'^(.*?)\s*\|\s*VIDEO EDITION', L1[0]['text'])
        if m: out['brand'] = _fix(m.group(1))
        for page in pdf.pages:
            L = _lines(page)
            heads = [(i, l) for i, l in enumerate(L) if l['size'] == 7.4 and l['text'].startswith('SCENE ')]
            foot = [l['top'] for l in L if l['size'] <= 6.6 and l['text'].startswith(('THE 3AM', out['brand']))]
            fb = min(foot) if foot else page.height
            for k, (i, h) in enumerate(heads):
                m = HDR.match(h['text'])
                if not m: continue
                top = h['top'] - 1
                bot = heads[k + 1][1]['top'] - 1 if k + 1 < len(heads) else fb - 1
                out['stories'].append(_scene(page, m, top, bot))
            if any(l['text'].startswith('BEFORE YOU GO') for l in L):
                _closing(page, L, out)
    out['stories'].sort(key=lambda s: s['n'])
    return out


def _scene(page, m, top, bot):
    s = {'n': int(m.group(1)), 'cat': _fix(m.group(2)), 'sec': int(m.group(3)), 'tag': m.group(4), 'tagnote': _fix(m.group(5)),
         'headline': '', 'tagline': '', 'what': '', 'why': '', 'do': '', 'source': '', 'vo': '', 'cue': '', 'nums': []}
    L = _lines(page, top=top, bottom=bot)
    nums = [[], [], []]; labs = [[], [], []]
    mode = None
    def bin_(x): return 0 if x < 211 else 1 if x < 384 else 2
    for l in L[1:]:
        t, sz = l['text'], l['size']
        if sz >= 15 and 'Bold' in l['font'] and not s['headline']: s['headline'] = _fix(t); continue
        if 9.5 <= sz <= 10.5 and 'Italic' in l['font'] and not s['tagline']: s['tagline'] = _fix(t); continue
        if sz >= 24:
            for w in l['words']: nums[bin_(w['x0'])].append(w['text'])
            continue
        if 6.0 <= sz <= 6.4 and 'Bold' in l['font']:
            for w in l['words']: labs[bin_(w['x0'])].append(w['text'])
            continue
        if sz == 6.9 and 'Bold' in l['font']:
            if t.startswith('WHAT HAPPENED'): mode = 'what'
            elif t.startswith('WHAT YOU CAN DO'): mode = 'do'
            elif t.startswith('VOICE-OVER'): mode = 'vo'
            continue
        if t.startswith('SOURCE') and sz <= 6.8:
            s['source'] = _fix(re.sub(r'^SOURCES?\s*', '', t)); mode = None; continue
        if mode in ('what', 'vo'):
            split = 260 if mode == 'what' else 325
            left = ' '.join(w['text'] for w in l['words'] if w['x0'] < split)
            right = ' '.join(w['text'] for w in l['words'] if w['x0'] >= split)
            a, b = ('what', 'why') if mode == 'what' else ('vo', 'cue')
            s[a] = _fix(s[a] + ' ' + left); s[b] = _fix(s[b] + ' ' + right)
        elif mode == 'do':
            s['do'] = _fix(s['do'] + ' ' + t)
    s['vo'] = s['vo'].strip('“”" ')
    s['nums'] = [{'v': _fix(' '.join(nums[i])), 'k': _fix(' '.join(labs[i]))} for i in range(3) if nums[i]]
    return s


def _closing(page, L, out):
    mode = None
    for l in L:
        t, sz = l['text'], l['size']
        if t.startswith('ALSO WATCHING'): mode = 'also'; continue
        if t.startswith('ONE-LINE TAKEAWAY'): mode = 'close'; continue
        if t.startswith('VIDEO CUT SHEET'): mode = None; continue
        if mode == 'also' and sz <= 9.2:
            if t.startswith('•'): out['also'].append(_fix(t.lstrip('• ')))
            elif out['also']: out['also'][-1] = _fix(out['also'][-1] + ' ' + t)
        elif mode == 'close' and sz >= 11: out['closing'] = _fix(out['closing'] + ' ' + t)
