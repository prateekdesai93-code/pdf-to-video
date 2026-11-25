"""Voice + warm generated music bed + soft chimes -> one wav, sample-aligned to scene video lengths.
Designed for pleasant listening: no drums, slow pad, gentle plucks, strong ducking under the voice."""
import os, numpy as np, soundfile as sf
SR = 24000


def _whoosh(rng, dur=.6):
    n = int(SR * dur); x = rng.standard_normal(n); tt = np.arange(n) / n
    c = .02 + .45 * np.sin(np.pi * tt); y = np.zeros(n); a = 0.0
    for i in range(n):
        a += c[i] * (x[i] - a); y[i] = a
    return (y * np.sin(np.pi * tt) ** 2 * 1.4).astype(np.float32)


def _boom(rng, dur=.9, f0=70):
    n = int(SR * dur); tt = np.arange(n) / SR
    return (np.sin(2 * np.pi * (f0 + 90 * np.exp(-tt * 18)) * tt) * np.exp(-tt * 5) * .8 + rng.standard_normal(n) * np.exp(-tt * 14) * .1).astype(np.float32)


def _bell(f=880, dur=1.4):
    n = int(SR * dur); tt = np.arange(n) / SR
    y = sum(a * np.sin(2 * np.pi * f * m * tt) * np.exp(-tt * d) for m, a, d in ((1, 1, 3.2), (2.76, .35, 5), (5.4, .15, 8)))
    return (y * .35 * np.minimum(1, tt / .004)).astype(np.float32)


def _music(N, rng):
    # Am9 - Fmaj7 - Cmaj7 - G6, 8 s each, slow pads + soft pentatonic plucks
    chords = [[110, 220, 261.63, 329.63, 392], [87.31, 174.61, 220, 261.63, 329.63], [130.81, 196, 261.63, 329.63, 392], [98, 196, 246.94, 293.66, 329.63]]
    pent = [440, 523.25, 587.33, 659.25, 783.99, 880]
    out = np.zeros(N, np.float32); span = 8 * SR
    for k in range(N // span + 2):
        s = k * span; e = min(N, s + span + SR * 2)
        if s >= N: break
        tt = np.arange(e - s) / SR
        env = np.minimum(1, tt / 2.5) * np.minimum(1, np.clip(10 - tt, 0, None) / 2.5)
        for f in chords[k % 4]:
            for det in (1.0, 1.004):
                out[s:e] += (np.sin(2 * np.pi * f * det * tt) + .3 * np.sin(2 * np.pi * f * 2 * det * tt)) * env * .022
        out[s:e] += np.sin(2 * np.pi * chords[k % 4][0] * .5 * tt) * env * .05
    step = int(SR * 60 / 72 / 2)          # 72 bpm eighth-note plucks, sparse
    for k in range(N // step):
        if rng.random() < .55: continue
        f = pent[rng.integers(len(pent))]; d = int(SR * 1.1); s = k * step
        if s + d >= N: break
        tt = np.arange(d) / SR
        out[s:s + d] += np.sin(2 * np.pi * f * tt) * np.exp(-tt * 4.5) * np.minimum(1, tt / .006) * .03
    return out


def mix(story, jobdir, out, music_vol=1.0):
    rng = np.random.default_rng(5)
    voice = []; starts = []; off = 0
    for sc in story['scenes']:
        a, _ = sf.read(os.path.join(jobdir, 'audio', sc['id'] + '.wav'), dtype='float32')
        starts.append(off / SR); voice.append(a); off += len(a)
    V = np.concatenate(voice); N = len(V)
    music = _music(N, rng)
    k = int(SR * .12); env = np.convolve(np.abs(V), np.ones(k) / k, 'same'); w = int(SR * .5); env = np.convolve(env, np.ones(w) / w, 'same')
    music = music * (1 - .72 * np.clip(env / .1, 0, 1)) * music_vol
    fade = np.ones(N, np.float32); fi = int(SR * 2); fo = int(SR * 3)
    fade[:fi] = np.linspace(0, 1, fi); fade[-fo:] = np.linspace(1, 0, fo); music *= fade
    sfx = np.zeros(N, np.float32)
    def put(x, at):
        s = int(at * SR); e = min(N, s + len(x))
        if 0 <= s < N: sfx[s:e] += x[:e - s]
    wh = _whoosh(rng); b1, b2 = _bell(880), _bell(1318.5)
    for i, sc in enumerate(story['scenes']):
        t0 = starts[i]; L = sc['lines']
        put(wh * .3, max(0, t0 - .05))
        if sc['type'] == 'story': put(b1 * .7, t0 + .25); put(b2 * .5, t0 + .45)     # story chime
        if sc['type'] != 'story': continue
        p = sc.get('params', {}); kind = sc['kind']
        if kind == 'ships' and p.get('strikes'):
            sd = min(.8, L[1]['dur'] / 6)
            for q in range(4): put(_boom(rng, 1.0, 60) * .35, t0 + L[1]['start'] + .35 + q * sd)
        if kind == 'chip' and p.get('alarm'): put(_boom(rng, .8, 90) * .3, t0 + L[1]['start'])
        if kind == 'chip' and p.get('gavel'):
            for q in (.3, 1.6, 2.9): put(_boom(rng, .3, 160) * .3, t0 + L[3]['start'] + q)
        if kind == 'coins': put(_bell(1568, 1.0) * .4, t0 + L[1]['start'] + .3)
        if kind == 'candles' and p.get('down'): put(_boom(rng, 1.0, 50) * .35, t0 + L[1]['start'] + .8)
    m = V * 1.0 + music + sfx
    m /= max(1, np.abs(m).max() / .95)
    sf.write(out, m, SR)
    return N / SR, starts
