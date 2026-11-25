# PDF → Video studio

Drop a briefing PDF into `pdfs/`. GitHub Actions turns it into a vertical 3D news video **and** a listen-only audio edition, commits them to `videos/`, and the page (`index.html`, served by GitHub Pages) lets you watch, listen and download.

## Set up once (2 minutes)
1. Create a repo and push this folder.
2. **Settings → Pages →** Deploy from branch `main`, folder `/ (root)`.
3. **Settings → Actions → General → Workflow permissions →** *Read and write permissions*.
4. Upload a PDF into `pdfs/` (the **Add a PDF** button on the page opens the upload screen).

The page is at `https://<you>.github.io/<repo>/`.

## What it does with a PDF
`tools/parse_pdf.py` reads the numbered stories (category, headline, tagline, what happened, why, what you can do, source), the "Also watching" bullets and the closing line. **Every story in the PDF becomes a scene — there is no cap**, so a 12-story report makes a 12-story video.
`tools/narrate.py` writes the narration, normalises numbers for speech (`$14.7B` → "14.7 billion dollars"), and picks a 3D scene from the story's content:

| Story is about… | 3D scene |
|---|---|
| gold / silver | gold & silver bars (fall or rise with the news) |
| Nvidia, chips, GPUs | glowing chip (alarm / gavel when scandal or Congress) |
| ships, tankers, navy, strikes | night-sea scene (strike blasts, cyber network) |
| IPOs, stocks, shares, crypto | candlestick chart (up or down) |
| bonds, rates, tax, retirement, money | padlock + growing coin stacks |
| anything else | holographic globe with data arcs |

## Same look every time
All videos share one template: the intro clock, category colour system, headline + accent bar, count-up key figures, "what you can do" card, story progress bar, news ticker, wipe transitions, bloom glow, chime on each story, warm music bed and the sign-off. Change look-and-feel in one place (`config.json` → `theme`, and the files in `tools/web/`) and every future video follows.

## Speed
| preset | fps | use |
|---|---|---|
| `fast` (default) | 24 | quickest; good for daily briefs |
| `quality` | 30 | smoother; about 1.5× slower |

Run manually with a preset: **Actions → PDF to video → Run workflow**. Locally: `PRESET=quality python tools/build.py --force`.

## Files
- `pdfs/` your inputs · `videos/` outputs (`.mp4`, `.m4a`, `.jpg`, `manifest.json`)
- `config.json` voice, speed, preset, theme · `tools/` the pipeline

## Limits
- GitHub rejects files over 100 MB; the builder re-encodes to stay under `max_mb` (90).
- Voice: Kokoro (open model, runs on the Actions runner, no API key). Change `voice` in `config.json` (`af_heart`, `af_bella`, `am_michael`, `bf_emma`, `bm_george`).
- Videos are informational and generated from the PDF text only; the stock charts are illustrative.


## Audio edition, Shorts, 16:9 and YouTube pack

Every build also produces, next to the main video:

- **Audio edition** (`.m4a`): the same briefing as a listen-only file.
- **One Short per story** (vertical, under a minute) and a **16:9 edition** (blurred sides). These are attached to a GitHub Release for the build so the repo stays small. Open the **Releases** tab to download them.
- **YouTube pack** (`<name>_youtube.txt`): three title options, a description with chapter timestamps, sources, an AI-disclosure line, hashtags, tags, Shorts titles and a pre-publish checklist.

Both PDF layouts are read automatically: the classic daily card layout and the "Video Edition" layout (it uses the voice-over, the three big numbers and the CONFIRMED / REPORTED tag written in the PDF).

### Uploading to YouTube

Nobody can promise subscribers. What helps: a consistent upload time, a strong first 3 seconds (the intro previews the top stories), Shorts for discovery, and your own commentary in the pinned comment. YouTube's monetization rules target mass-produced, templated content, so add something of yours each time (a take, a correction, a local angle), keep the AI disclosure on, and check every claim against the source line before you publish.

### Speed

Measured on a 2-core machine, fast preset: about 20 minutes for a 3.4-minute video including all Shorts and the 16:9 edition. GitHub's runners are faster (4 cores), so expect roughly 10 to 12 minutes.
