# Your first edit

Initialize a project before writing the timeline:

```bash
npm run init -- first-post --input "/path/to/your-recording.mp4"
```

This copies your recording into `public/projects/first-post/` and creates `projects/first-post/edit.json`. It never edits the original file. Existing project names are rejected; use a new name for another edit.

## Timeline example

Replace the generated timeline with your own decisions. This example needs an original recording at least 14 seconds long:

```json
{
  "title": "One idea, clearly explained",
  "source": "projects/first-post/input.mp4",
  "clips": [
    {"start": 2, "end": 6},
    {"start": 10, "end": 14}
  ],
  "captions": [
    {"start": 0.2, "end": 2.4, "text": "Your first spoken phrase"},
    {"start": 4.2, "end": 6.8, "text": "Your next spoken phrase"}
  ],
  "cards": [
    {"start": 0, "end": 1.5, "text": "ONE SIMPLE IDEA"}
  ],
  "sfx": [
    {"src": "sfx/pop.ogg", "start": 0, "volume": 0.18},
    {"src": "sfx/whoosh-1.wav", "start": 4, "volume": 0.12}
  ]
}
```

The captions above are placeholders, not a transcript. Replace them with what you actually say, at the times you actually say it. Remove an overlay instead of inventing speech to fill it.

### Two clocks

- **clips**: source-recording seconds. The example keeps 2–6 and 10–14 from the original file.
- **captions/cards/sfx/music**: the finished edit. The example output lasts eight seconds; the second clip begins at output second 4.
- Times are rounded to the 30fps frame grid for rendering. Keep cut boundaries clear of spoken syllables and check the exported result.
- Clips must be positive-length, chronological and non-overlapping. Overlay ranges must fit the final video. Keep text short enough to read comfortably. Captions are limited to 100 characters and cards to 120; ranges within either collection cannot overlap.
- Word-by-word captions come from `npm run captions -- <slug> --words` (see below); hand-written captions are phrase-level.

The `title` is project metadata. Put visible titles in `cards`. Cards cover the footage while the underlying speech keeps playing; captions appear above cards if they share a time range.

## Add your own music

Copy a licensed track to `public/music/background.mp3` and add this top-level field:

```json
"music": {"src": "music/background.mp3", "volume": 0.18}
```

Use a public-relative path, without `public/` at the beginning. A volume value is a linear multiplier, not decibels; the default 0.18 usually sits around 10 dB under a voice, which is where music belongs: felt, not followed. If the track still fights the voice, pick a calmer track rather than turning it down until it vanishes. Music starts with the edit and loops if it is shorter than the video. It fades in and out over half a second at each boundary; it does not duck under speech. No song or license for a song is included.

## Work with your assistant

> Edit first-post using the existing starter. Here is my timestamped transcript: [paste it]. Keep these two complete thoughts: [describe them]. Propose the source-time cuts first. After I approve, update edit.json, add short phrase captions, use at most two title cards and three quiet sound effects, validate and render. Do not invent dialogue or add unsupported claims.

If your assistant can transcribe your local video, it may use its own transcription tool. Review that transcript before using it for captions. The starter itself does not require a transcription service or an API key.

## Validate, render, review

```bash
npm run validate -- first-post
npm run render -- first-post
```

Open `output/first-post.mp4`. Check the beginning and end of every cut, caption spelling, face framing, and music/SFX balance. Check the entire video with headphones or speakers before posting. Rendering again replaces that project's output MP4, so copy a version you want to keep first.

The default layout is designed for a single speaker. Horizontal footage is cropped to fill the vertical video region. Use the framing controls below to position the speaker; this is manual framing, not face tracking.

## Demo and privacy

`npm run demo` generates a short color-pattern recording with a quiet test tone, then adds a card, captions and two sound cues. It is a setup check, not an example of a completed talking-head edit. If the demo already exists, use `npm run render -- demo` to render it again.

Personal media and project files stay local and are ignored by Git. Keep footage under `public/projects/<slug>/` and music under `public/music/` so that protection applies automatically. Files you place elsewhere under `public/` can be committed unless you add them to `.gitignore`.


## Import captions from SRT

Use an SRT transcript timed to the **original recording**, not a previously edited export:

```bash
npm run captions -- first-post --srt "/path/to/transcript.srt"
```

The importer drops cues in removed sections and maps the remaining cues to the final timeline. It writes `projects/first-post/captions.proposed.json` for review and leaves your edit unchanged. Once reviewed:

```bash
npm run captions -- first-post --srt "/path/to/transcript.srt" --apply
```

This replaces the caption list in `edit.json`; keep a copy if you want to preserve hand-edited captions. The tool does not transcribe audio. Export SRT from a transcription service/editor you already use and check the text yourself.

A cue crossing a cut is shortened or split, retaining its full phrase in each kept fragment. SRT has phrase timing, not exact word timing: review split phrases, especially around cuts that remove spoken words. Overlapping, malformed or overly long cues are rejected rather than silently merged. Keep cues under 100 characters.

After changing cuts, re-import captions from the original SRT. Existing title cards and SFX still need their output times checked manually.

## Set zoom and framing

Each clip accepts optional `zoom`, `focusX` and `focusY` fields:

```json
{"start": 10, "end": 14, "zoom": 1.15, "focusX": 50, "focusY": 20}
```

`zoom` ranges from 1 to 1.5 (default 1). `focusX` and `focusY` range from 0 to 100 and control the crop position and zoom origin. Defaults are 50 and 0: centered horizontally, aligned to the top. Values describe placement within the available crop, not detected face coordinates. A modest static punch-in on the next clip can emphasize a new thought. Avoid zooming so far that you cut off your head.

## Render a fast draft

```bash
npm run draft -- first-post
```

This exports `output/drafts/first-post.mp4` at 540 × 960 using the same timing and framing. Use it for cut and caption review, then `npm run render -- first-post` for the full 1080 × 1920 export. Each command replaces only its corresponding output file.


# v2: the full workflow

```text
init → transcribe → cut (review the log, then --apply) → words → visuals → validate → draft --guides → render → review
```

## Transcribe

`npm run transcribe -- <slug>` writes `projects/<slug>/transcript.json`: every word with source-clock times, plus the silences measured in your audio. Setup and import options: [TRANSCRIBE.md](TRANSCRIBE.md). Fix misheard words in the file's `text` fields; keep the times.

## Cut the dead air

```bash
npm run cut -- <slug>                     # proposal only
npm run cut -- <slug> --max-pause 0.25    # tighter
npm run cut -- <slug> --remove-fillers    # also cut um/uh
npm run cut -- <slug> --apply             # write the clips into edit.json
```

The proposal only cuts where the audio is actually quiet. Each pause longer than `--max-pause` (default 0.35 s) is tightened to 0.25 s: 0.15 s is kept after the last word so consonant tails and breaths finish, and 0.1 s before the next word so its attack is not clipped. The lead-in and trailing silence are trimmed.

Every decision is logged in `projects/<slug>/cuts.proposed.json` with a reason (`CUT` or `KEEP`). It also flags things only a person can judge:

- **filler**: um, uh. Kept unless you pass `--remove-fillers`.
- **repeat**: the same word twice in a row, usually a restart. Keep it only if it was deliberate.
- **unworded**: sound the transcript has no words for: a missed word, a breath, a noise. Always kept. Listen to it.
- **moved**: the recogniser placed a word inside a pause that is being cut, and its time was corrected onto the speech next to it. Usually that's right, because recognisers drift. Listen to make sure no quiet word is being cut.

The tool doesn't pick between takes. If you said a line twice, choose the better take and remove the other one by editing `clips` yourself. Listen to every join before you approve.

`--apply` cuts **inside the clips you already have**: takes you removed by hand stay removed, and each piece keeps its clip's zoom and focus. It then rebuilds word captions. It refuses to run if cards, visuals or sounds would end up past the new end of the video (re-time them first), or if the project has phrase captions (add `--replace-captions` to switch to word captions). Anything that survives still needs checking, because every output time after a cut moves.

Silence is measured against your recording's own noise floor, so a quiet room and a noisy one both work. If nothing gets cut, the room noise is probably too close to your voice; check `silenceThreshold` in `transcript.json`.

## Word captions

```bash
npm run captions -- <slug> --words              # one word at a time (proposal)
npm run captions -- <slug> --words --group 3    # up to 3 words a page
npm run captions -- <slug> --words --apply
```

Word captions pop on at each word's onset in bold caps and switch instantly to the next word during speech. Each stays up at least 0.18 s, and the screen goes blank in pauses longer than 0.18 s. There are no fades: if a caption looks late, fix the word's time rather than adding animation. With `"captionStyle": "word"` they sit in the lower middle of the frame when the footage is full screen, and on the seam when a graphic is up.

## Find the time of any word

`npm run words -- <slug>` prints the finished-edit time of every word and saves `words.output.json`. Use these times for `visuals`, their `at` reveal times, and `sfx`, so graphics land on the word that says them.

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

## Custom scenes

Write a React component in `src/scenes/custom/index.tsx` that takes `SceneProps` (`visual`, `stage`, `durationInFrames`), wrap it in `SceneFrame` and register it in `customScenes`. Then use `{"scene":"custom","component":"YourName","props":{…}}`. Compute everything from `useCurrentFrame()`: no timers, CSS transitions or `Math.random()`, or renders will flicker. Stay inside `stage` (the safe area of the top zone) and use `tokens`/`fonts` from `kit.tsx`. Preview with `npm run studio`.

## Safe zone

Instagram crops the feed preview to 4:5 and puts buttons over the edges, so everything that matters stays inside x 60–950, y 290–1630 of the 1080 × 1920 frame. Scenes are laid out inside it automatically. `npm run draft -- <slug> --guides` draws it (red) and the split seam (blue) on the draft so you can check captions and custom scenes.

## Render and master

`npm run render` exports the full video and then masters the audio in two passes: it measures the mix, then applies one static gain correction to −14 LUFS integrated with a −1 dBTP ceiling. A static correction doesn't pump the way a live compressor does. Use `--no-master` to skip it. Drafts are not mastered.

## Review

```bash
npm run review -- <slug>          # the final render
npm run review -- <slug> --draft  # the draft
```

The review writes `output/review/<slug>/report.md` and `contact.jpg`. It checks size, fps and frame count against the edit, loudness and true peak, that both stereo channels carry sound, that frame 1 isn't black, and that nothing freezes for more than 1 s per 30 s. The contact sheet shows 2 frames per second, 8 per row, with the safe zone in red. Read it with the sound off: each panel should make sense on its own.

The numbers can't judge taste. Ask your assistant to run the **review-video** skill: a fresh reviewer that didn't build the video measures it against `taste/PRINCIPLES.md` and ends with `ship` or `one more pass`.
