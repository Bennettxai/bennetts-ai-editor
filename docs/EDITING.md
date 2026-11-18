# Editing guide

Run commands from the repository root. Start with the [README walkthrough](../README.md), then use [DIALOGUE.md](DIALOGUE.md) before editing speech and [RECOVERY.md](RECOVERY.md) for revisions. All JSON examples illustrate structure; use real reviewed speech, facts and timing for your own recording.

## Initialize and choose a format

```bash
npm run doctor
npm run init -- first-post --input "/path/to/recording.mp4"
# Alternative explicit output choices, using a new project name:
npm run init -- first-post-1080 --input "/path/to/recording.mp4" --resolution 1080p --fps 30000/1001
```

Import copies the file to `public/projects/<slug>/input.<extension>` without changing the original, and writes `projects/<slug>/edit.json` plus `source.probe.json`. Existing names are rejected. Supported containers are MP4, MOV, M4V and WebM; actual codecs must be decodable by the installed tools. New projects default to `format: {"fps":"<source rational>","resolution":"4k"}`. Missing `format` in an old edit retains 30/1 and 1080p. Do not remove format metadata when modifying a generated edit.

### Format and source limits

- Final resolution is 2160 × 3840 (`4k`) or 1080 × 1920 (`1080p`). Graphics use a logical 1080 × 1920 canvas, rendered by the supported CLI at scale 2 for 4K. Drafts always use 540 × 960. Studio shows the logical canvas; raw Remotion invocations must set the appropriate scale themselves.
- `--fps` accepts exact integer/rational values from 1–120, including `24000/1001`, `30000/1001` and `60000/1001`. Decimal `29.97` is rejected; `2997/100` is a different exact rate from `30000/1001`. An override changes the output timeline rate, while the source probe preserves native fps separately.
- Import reads every decoded frame timestamp to check cadence. This can be slow for long footage and has a 64 MiB probe-output limit. It does not infer CFR solely from nominal/average fps.
- VFR or nonzero video timestamp origins are refused before project directories are created. The error prints a shell-quoted FFmpeg command for a distinct `.working-cfr.mp4`, with `-n` to avoid overwrites. Run it only as an explicit normalization decision. It shifts tracks together, fills an initial picture gap with the first frame, and pads initial audio silence to preserve relative timing. Review sync and the added lead-in before editing.
- Preserve the original file. After making a working copy, keep `projects/<slug>/source-provenance.md` with original/working-copy paths and SHA256 hashes, the exact executed command, reasons, and sync review. The imported copy becomes this project's source; `source.probe.json` has `normalization:null` and does **not** reconstruct pre-import history. Do not claim an automatic mapping to original VFR frame indexes.
- Footage is read directly from the selected source for final rendering; no 1080 intermediate is made. Final H.264 uses CRF 10. Cropping or enlarging a smaller source still loses apparent detail; 4K output does not invent detail.

## The two clocks

`clips` use source seconds; captions, cards, visuals, reveals and SFX use **edited output seconds**. Music begins on the output timeline. Shared timing uses the selected fps. Reviewed clip boundaries must lie on integer frames; they are not arbitrary rounded decimal seconds. The manifest labels source-time indexes at output fps explicitly; native source fps is recorded separately.

After the approved cut:

```bash
npm run words -- first-post
```

This prints the mapped word times and writes `projects/first-post/words.output.json`. Use these times for reveals and cues. When cuts/transcript change, follow the snapshot/plan recovery workflow and rebuild timing even if old numbers still fit within the video. `--clear-overlays` archives and clears cards/visuals/SFX affected by a cut or transcript revision. It does not automatically retime their meaning.

## Timeline fields

Retain generated `source` and `format`. At 30fps, a reviewed eight-second timeline could contain:

```json
{
  "title": "One idea, clearly explained",
  "source": "projects/first-post/input.mp4",
  "format": {"fps": "30/1", "resolution": "4k"},
  "clips": [{"start": 2, "end": 6}, {"start": 10, "end": 14}],
  "captionStyle": "word",
  "captions": [{"start": 0.2, "end": 0.6, "text": "Example"}],
  "cards": [],
  "visuals": [],
  "sfx": []
}
```

This requires at least 14 source seconds and actual speech matching the selected ranges. Use the saved-plan workflow for reviewed speech cuts. For deliberate manual clip changes in an existing revision, adopt with `dialogue --snapshot` as documented in RECOVERY.md before downstream commands.

Clips must be positive, chronological and non-overlapping. A card covers the footage while speech continues; captions can appear above it. `title` is project metadata, not an automatic title overlay. Captions allow up to 100 characters, cards 120; ranges within each collection cannot overlap and must fit the output.

Optional per-clip framing:

```json
{"start":10,"end":14,"zoom":1.1,"focusX":50,"focusY":20}
```

`zoom` is 1–1.5, `focusX`/`focusY` are 0–100 (defaults 1, 50, 0). This is manual crop placement, not face tracking. Framing is part of cut-plan identity, so changing it after plan review requires reconciliation before application.

## Transcription and captions

Use [TRANSCRIBE.md](TRANSCRIBE.md) for local ASR or timed JSON import; source-clock words must be reviewed against the recording. Applying a cut rebuilds word captions. To regenerate/review a grouping:

```bash
npm run captions -- first-post --words --group 2
npm run captions -- first-post --words --group 2 --apply
```

Groups support 1–5 words. Caption proposals are saved to `captions.proposed.json`; `--apply` regenerates that caption proposal and applies it. This differs from `cut --apply`, which reads an existing exact saved plan. Word captions switch with speech, use a minimum dwell target of 0.18 seconds where possible, and clear during longer gaps. Their position follows full-screen versus split-screen layout.

For phrase captions, set `"captionStyle":"phrase"` in `edit.json`, then import SRT timed to the **source recording**. The importer preserves the existing caption style:

```bash
npm run captions -- first-post --srt "/path/to/source.srt"
npm run captions -- first-post --srt "/path/to/source.srt" --apply
```

Cues in removed sections drop out; crossing cues shorten/split while retaining their phrase in each fragment. Inspect those joins: SRT is not word alignment. Keep a copy of hand-edited captions before replacing them. A later dialogue apply/snapshot with existing phrase captions requires explicit `--replace-captions` to rebuild word captions. Any caption/edit change makes prior render receipts stale; rerender/review.

## Split-screen visuals

Add a `visuals` list. While a visual is on, the footage slides into the bottom part of the frame and the scene plays above it; between visuals the footage returns to full screen. Visuals less than half a second apart stay split instead of bouncing.

```json
"layout": {"visualHeight": 768},
"visuals": [
  {"scene": "number", "start": 0.95, "end": 2.85, "value": 3, "suffix": " hrs", "label": "lost to busy work", "at": [1.3]},
  {"scene": "list", "start": 3.9, "end": 8.2, "title": "The fix", "items": ["Write the one thing", "Do it first", "Before email"], "at": [3.97, 5.97, 6.6]}
]
```

`start`/`end` are finished-edit seconds. A visual must last at least 0.7 s and visuals can't overlap. `layout.visualHeight` (600–1000 px, default 768 = 40 %) sets the size of the top zone. Every scene accepts an optional `kicker`: a small uppercase label above it.

| Scene | Fields | What it does |
|---|---|---|
| `headline` | `text` (≤ 80 chars), optional `at` (one time per word), `emphasis` (word index) | Big statement; words land on their spoken times, the emphasised word gets an underline |
| `number` | `value`, optional `from`, `prefix`, `suffix`, `label`, `decimals`, `at` (one time: when the count lands) | Counts up to the number |
| `list` | `items` (1–5, ≤ 40 chars), optional `title`, `at` (one time per item) | Numbered steps; the newest is bright, earlier ones dim |
| `bars` | `bars` (2–6 `{label, value}`), optional `title`, `unit`, `highlight` (index), `at` | Horizontal bar chart that grows in |
| `quote` | `text` (≤ 90 chars), optional `attribution` | Serif payoff line. Use it once |
| `image` | `src` (image inside `public/`), optional `fit` (`cover`/`contain`), `highlight` `{x,y,w,h,at}` in % of the image | Screenshot with a slow push and a highlight box that dims the rest |
| `custom` | `component`, optional `props` | Your own React scene from `src/scenes/custom/index.tsx` (see `ProgressExample`) |

Put screenshots under `public/projects/<slug>/` so they stay out of Git. `npm run validate` checks every field and prints craft warnings (too many words, a reveal held under 1 s, the same scene twice in a row, a sound in the first 3 s) without blocking the render.

## Custom scenes and native-rate timing

A custom component in `src/scenes/custom/index.tsx` takes `SceneProps` (`visual`, `stage`, `durationInFrames`), uses `SceneFrame`, and is registered in `customScenes`. The included `ProgressExample` is a working example. To use it, add this object to `visuals` at a valid reviewed output range:

```json
{"scene":"custom","component":"ProgressExample","start":3,"end":5,"props":{"percent":75,"label":"Progress"}}
```

Use `useTiming()` from `src/scenes/kit.tsx`. Its `frame` is the current project frame; `m(12)` converts a duration authored as 12 frames at 30fps to the current rate. `relative(visual, seconds)` maps an output time into this scene, and `reveal(visual, index)` uses its `at` values. Pure `relFrame`/`revealAt` helpers also accept fps; their omitted-fps default is legacy 30. Existing custom code hard-coding 30fps is not automatically repaired.

Compute animation from frames, with no timers, CSS transitions or `Math.random()`. Stay within `stage`, use shared `tokens`/`fonts`, and run `npm run typecheck`. Preview with `npm run studio`. The preserved internal composition ID is `BennettsEditor` for compatibility; it does not render a personal label or watermark.

## Music, SFX and guides

Copy a licensed track to `public/music/background.mp3`, then add:

```json
"music": {"src":"music/background.mp3","volume":0.18}
```

All assets use public-relative paths (omit the leading `public/`). Music loops if shorter than the output, fades over half a second at the ends, and does not duck automatically. Volume is a linear multiplier; listen to its balance with the actual voice. Included SFX and their licenses are listed in `public/sfx/README.md`; a cue is `{"src":"sfx/pop.ogg","start":3.2,"volume":0.18}` in `sfx`. No music license is supplied.

The default safe region is x 60–950, y 290–1630 on the logical canvas. It is a conservative layout guide, not a guarantee for every platform's changing interface. `npm run draft -- first-post --guides` draws the safe zone red and split seam blue. Contact-sheet guide marks are review annotations, not an export watermark. Check custom scene and caption collisions with the speaker too.

## Render, measure and review

```bash
npm run validate -- first-post
npm run draft -- first-post --guides
npm run review -- first-post --draft
npm run render -- first-post
npm run review -- first-post
npm run status -- first-post
```

Drafts are unmastered. Final rendering measures the mix then applies a static audio gain targeting −14 LUFS integrated with a −1 dBTP ceiling, copying the encoded video without re-encoding. `--no-master` skips that audio pass. Verify the result's measured levels. Rendering replaces its conventional output file; copy old MP4s you want to preserve first.

Reviews produce `output/review/<slug>/report.json`, `report.md` and `contact.jpg` (draft folder: `<slug>-draft`). Checks include selected dimensions/fps/frame count, audio presence/stereo, first-frame blackness and freezes; final checks include loudness/true peak. The sheet samples two frames per second. Review single frames around reveals/joins as well. A successful status command or current report does not mean all its measurements passed.

Use the [review-video skill](../.agents/skills/review-video/SKILL.md) for independent visual judgment, and [DIALOGUE.md](DIALOGUE.md) to record take/gap/listening evidence. Listening must cover the exact exported file; replacing its file or receipt expires prior evidence and reports even without a filename change. Pending human checks stay visible. Receipts do not cover every external asset/scene implementation: rerender and review after changes to those too.

## Sharing and local privacy

Projects, source assets under `public/projects/`, models, outputs and music under `public/music/` are ignored by Git. Other locations may be committed. Keep ledgers and review notes inside the ignored project. The editor has no external upload or publishing workflow. Review final audio/video before sharing it yourself.
