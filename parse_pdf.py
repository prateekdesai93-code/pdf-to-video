"""Parse a "3AM Edge"-style briefing PDF into structured stories.

Layout is detected from font + size (works for the reportlab card layout the daily brief uses).
If no numbered stories are found, a generic paragraph-based fallback is used so a build never crashes.
"""
import re, subprocess
import pdfplumber

SECTIONS = {'WHAT HAPPENED': 'what', 'WHY IT HAPPENED': 'why', 'WHAT YOU CAN DO': 'do'}
DATE_RE = re.compile(r'((?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day,?\s+[A-Z][a-z]+\s+\d{1,2},?\s+\d{4})')


def _line_info(line):
    chars = [c for c in line['chars'] if c['text'].strip()]
    if not chars:
        return None
    text = line['text']
    sym = ''.join(c['text'] for c in line['chars'] if 'Symbol' in c['fontname'])
    if sym and text.lstrip().startswith(sym):
        text = text.lstrip()[len(sym):]
    bullet = bool(re.match(r'^\s*\(cid:\d+\)', text))
    text = re.sub(r'\(cid:\d+\)\s*', '', text).strip()
    text = re.sub(r'^(fi|\u2192)\s+', '', text)
    if not text:
        return None
    main = [c for c in chars if 'Symbol' not in c['fontname']] or chars
    return {'text': text, 'size': round(main[0]['size'], 1), 'font': main[0]['fontname'].split('+')[-1], 'bullet': bullet}


def _fix(s):
    return re.sub(r'\s+', ' ', s.replace(' ', ' ')).strip()


def parse(path):
    try:
        from parse_edition import is_edition, parse_edition
        if is_edition(path):
            return parse_edition(path)
    except ImportError:
        pass
    return parse_classic(path)


def parse_classic(path):
    out = {'brand': 'THE 3AM EDGE', 'date': '', 'tagline': '', 'stories': [], 'also': [], 'closing': '', 'footer': ''}
    cur = None; section = None; mode = 'head'; cat = ''
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            for raw in page.extract_text_lines(return_chars=True):
                li = _line_info(raw)
                if not li:
                    continue
                t, sz, font = li['text'], li['size'], li['font']
                bold = 'Bold' in font; obl = 'Oblique' in font or 'Italic' in font
                if sz >= 22 and bold:                       # masthead
                    m = DATE_RE.search(t)
                    out['date'] = m.group(1) if m else out['date']
                    b = _fix(DATE_RE.sub('', t))
                    if b: out['brand'] = b
                    continue
                if mode == 'head' and sz < 10 and not bold and not out['tagline']:
                    out['tagline'] = _fix(t); continue
                if sz < 9 and bold and t.isupper() and len(t) < 30 and t not in SECTIONS and not li['bullet']:
                    cat = t; continue                        # category chip
                if sz >= 18 and bold and t.isdigit():        # story number
                    cur = {'n': int(t), 'cat': cat, 'headline': '', 'tagline': '', 'what': '', 'why': '', 'do': '', 'source': ''}
                    out['stories'].append(cur); section = None; mode = 'story'; continue
                if t.upper().startswith('ALSO WATCHING'):
                    mode = 'also'; cur = None; continue
                if mode == 'story' and cur is not None:
                    if 12 <= sz <= 15 and bold and section is None:
                        cur['headline'] = _fix(cur['headline'] + ' ' + t); continue
                    if obl and 9 <= sz < 10.2 and not cur['tagline'] and section is None:
                        cur['tagline'] = _fix(t); continue
                    if t in SECTIONS:
                        section = SECTIONS[t]; continue
                    if t.startswith('Source') and obl:
                        cur['source'] = _fix(t); section = None; continue
                    if section:
                        cur[section] = _fix(cur[section] + ' ' + t); continue
                    # closing line (bold oblique, bigger) ends the story list
                    if 'BoldOblique' in font or (obl and sz >= 10):
                        out['closing'] = _fix(out['closing'] + ' ' + t); mode = 'close'; continue
                    continue
                if mode == 'also':
                    if 'BoldOblique' in font or (obl and sz >= 10):
                        out['closing'] = _fix(out['closing'] + ' ' + t); mode = 'close'; continue
                    if li['bullet'] or not out['also']:
                        out['also'].append(_fix(t))
                    else:
                        out['also'][-1] = _fix(out['also'][-1] + ' ' + t)
                    continue
                if mode == 'close':
                    if t.startswith('Built') or sz < 8:
                        out['footer'] = _fix(t)
                    else:
                        out['closing'] = _fix(out['closing'] + ' ' + t)
    out['stories'] = [s for s in out['stories'] if s['headline']]
    if not out['stories']:
        out = _fallback(path, out)
    return out


def _fallback(path, out):
    txt = subprocess.run(['pdftotext', '-layout', path, '-'], capture_output=True, text=True).stdout
    paras = [_fix(p) for p in re.split(r'\n\s*\n', txt) if len(_fix(p)) > 60]
    m = DATE_RE.search(txt)
    if m: out['date'] = m.group(1)
    n = 0
    for i in range(0, min(len(paras), 24), 3):
        chunk = paras[i:i + 3]
        sents = re.split(r'(?<=[.!?])\s+', chunk[0])
        n += 1
        out['stories'].append({'n': n, 'cat': 'NEWS', 'headline': sents[0][:110], 'tagline': '',
                               'what': ' '.join(sents[1:]) or chunk[0], 'why': chunk[1] if len(chunk) > 1 else '',
                               'do': chunk[2] if len(chunk) > 2 else '', 'source': ''})
    return out


if __name__ == '__main__':
    import sys, json
    print(json.dumps(parse(sys.argv[1]), indent=1, ensure_ascii=False))
