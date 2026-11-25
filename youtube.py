"""Copy-paste YouTube pack: titles, description with chapters, sources, disclosure, tags, Shorts titles."""
import re, datetime
from narrate import cap_words


def _mmss(t):
    return f'{int(t) // 60:02d}:{int(t) % 60:02d}'


def _short(h, n=6):
    return cap_words(re.split(r'\s[—–]\s|;|:', h)[0].strip(), n).rstrip('.')


def pack(parsed, story, starts):
    stories = [s for s in story['scenes'] if s['type'] == 'story']
    brand = parsed['brand'].title() if parsed['brand'].isupper() else parsed['brand']
    d = parsed.get('date') or ''
    try:
        dt = datetime.datetime.strptime(d.split(', ', 1)[1], '%B %d, %Y'); dshort = dt.strftime('%b %d').replace(' 0', ' ')
    except Exception:
        dshort = d
    h = [_short(s['headline']) for s in stories[:3]]
    titles = [f'{h[0]}, {h[1]} & more | {brand} {dshort}' if len(h) > 1 else f'{h[0]} | {brand} {dshort}',
              f'{brand} {dshort}: {h[0]}' + (f' + {len(stories) - 1} more stories' if len(stories) > 1 else ''),
              f'What happened overnight: {h[0]}' + (f', {h[1]}' if len(h) > 1 else '')]
    titles = [t[:98] for t in titles]
    chap = []
    for i, sc in enumerate(story['scenes']):
        t = starts[i]
        if chap and t - chap[-1][0] < 10: continue
        label = sc.get('headline') or {'intro': 'Intro', 'also': 'Also watching', 'outro': 'Wrap-up'}.get(sc['type'], sc['id'])
        if i == len(story['scenes']) - 1 and sc['dur'] < 10: continue
        chap.append((t, cap_words(label, 9).rstrip('.') if sc.get('headline') else label))
    chap[0] = (0, chap[0][1])
    srcs = []
    for s in stories:
        if s.get('source'): srcs.append(f'- {s["headline"][:70]}: {s["source"]}')
    cats = sorted({s['cat'].lower().replace(' & ', ' ').replace(' ', '') for s in stories})
    lines = ['TITLE OPTIONS (pick one)', *[f'{i + 1}. {t}' for i, t in enumerate(titles)], '', 'DESCRIPTION', '-----------',
             f'{brand} for {d}: ' + '; '.join(h) + '.', f'{len(stories)} stories, the key figures and what you can do about them.', '',
             'CHAPTERS', *[f'{_mmss(t)} {l}' for t, l in chap], '', 'SOURCES', *srcs, '',
             'Narration, music and 3D visuals are generated with AI from the sources above. Informational only, not financial, legal or investment advice.', '',
             '#news #dailybriefing ' + ' '.join('#' + c for c in cats[:4]), '',
             'TAGS', ', '.join(['daily news briefing', 'news today', brand.lower(), 'markets', 'world news', *[c for c in cats]]), '',
             'SHORTS TITLES (one clip per story, add #Shorts)', *[f'{s["n"]}. {s["headline"][:78]} #Shorts' for s in stories], '',
             'CHECKLIST BEFORE PUBLISHING', '- Skim every claim against the source line shown on screen.',
             '- Turn on the "altered or synthetic content" disclosure if YouTube asks.',
             '- Add a short pinned comment with your own take: original commentary is what viewers (and YouTube) value.',
             '- Upload at the same time every day so viewers learn when to expect it.']
    return '\n'.join(lines).replace('3Am', '3AM') + '\n'
