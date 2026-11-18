# AI Video Editor

A local, AI-assisted editor for vertical talking-head video. Use Claude Code or Codex to select complete takes, review dialogue cuts, add timed captions and split-screen graphics, and render a measured final MP4. New projects export at **2160 × 3840** using the supported source frame rate; drafts are 540 × 960.

Media processing runs on your computer with Node, FFmpeg, optional whisper.cpp and Remotion. No paid API or account is required by the editor. Your coding assistant has its own access/privacy terms. The editor does not upload media, publish posts, choose takes autonomously or certify listening.

## Install and check

Install **Node.js 22 or newer** and **FFmpeg**, including `ffprobe`, on PATH. On macOS, one option is `brew install node@22 ffmpeg`; follow Homebrew's PATH instructions for the selected Node version. On Linux/Windows use the respective Node and FFmpeg installation instructions.

```bash
git clone https://github.com/Bennettxai/bennetts-ai-editor.git
cd bennetts-ai-editor
npm ci
npm run doctor
```

Doctor checks required command/package readiness and reports optional local transcription separately. It does not launch Chromium or load a model. A first render may download Remotion's browser; `npx remotion browser ensure` installs it explicitly. Linux needs the browser's normal system libraries. `npm run demo` generates and renders a short color-pattern setup check without personal media or ASR; it is not a speech edit.

For local transcription, [install whisper.cpp and a model](docs/TRANSCRIBE.md). You can instead import timed JSON without either dependency.

## Edit a recording

Open this repository in your coding assistant and say:

> Read AGENTS.md and the edit-video skill. Edit /path/to/recording.mp4 as my-first-video. Compare complete takes, audit every gap and join, preserve whole speech, and show me the concrete cut plan and graphics plan before applying them. Keep review evidence honest about playback.

Or follow the same workflow manually from the repository root:

```bash
npm run init -- my-first-video --input "/absolute/path/to/recording.mp4"
# Choose ONE transcription route:
npm run transcribe -- my-first-video --model "/absolute/path/to/ggml-small.en.bin"
# Or: npm run transcribe -- my-first-video --json "/absolute/path/to/words.json"

npm run cut -- my-first-video
# Review the recording, take/gap ledgers, transcript and cuts.proposed.json.
# Edit the saved plan's clips to the approved selection; preserve its identity.
npm run cut -- my-first-video --apply --plan projects/my-first-video/cuts.proposed.json
npm run dialogue -- my-first-video
npm run words -- my-first-video
# Word captions are rebuilt on apply. To change grouping after reviewing:
npm run captions -- my-first-video --words --group 2 --apply
# Add approved visuals to edit.json using the output word times (see docs/EDITING.md).
npm run validate -- my-first-video
npm run draft -- my-first-video --guides
npm run review -- my-first-video --draft
# Inspect frames, listen, fix and redraft as needed.
npm run render -- my-first-video
npm run review -- my-first-video
npm run status -- my-first-video
```

The final is `output/my-first-video.mp4`; measurements and contact sheet are in `output/review/my-first-video/`. Final rendering masters audio toward −14 LUFS with a −1 dBTP ceiling and copies the encoded video during that audio pass. Read the measured result rather than assuming the target was met.

[The dialogue guide](docs/DIALOGUE.md) explains exact plans, complete-word exceptions, versioned manifests, and `dialogue --review` JSON. Record take selection, exhaustive cut coverage and actual listening separately; technical checks cannot fill them in. A draft pass does not approve the final's audio. Review and listen to the exact final file before describing it as fully reviewed. If playback was unavailable, say so and label it a diagnostic preview.

## What is included

- Local word-timed ASR or imported Whisper/WhisperX/whisper.cpp/plain word JSON.
- Rough pause proposals plus flags for fillers, repeats and unworded sound; manual acoustic review remains necessary.
- Identity-checked saved cut plans, version snapshots, source-to-output frame maps and separate review gates.
- Word or phrase captions; source-timed SRT import.
- Headline, number, list, bars, quote and image scenes, plus registered custom React scenes. [Editing guide](docs/EDITING.md).
- Manual crop/zoom, optional licensed music you provide, and seven included CC0 sound effects.
- Draft guides, technical media measurements, contact sheets, status and recovery instructions.

## Format and revision rules

New projects default to 4K and supported native CFR fps. `init --resolution 1080p` selects 1080 output; `--fps 30000/1001` explicitly changes the output clock. Rates must be exact integers or ratios from 1–120 fps: use `30000/1001`, not `29.97`. Legacy edits without `format` retain 1080 × 1920 at 30 fps. A low-resolution source does not acquire new detail when exported at 4K.

VFR and nonzero video timestamp origins are rejected with a local FFmpeg working-copy command. Normalization is explicit and can add initial picture/audio padding. Preserve the original and record the working copy's provenance yourself; import does not reconstruct that history. See [format limits](docs/EDITING.md#format-and-source-limits).

Clips use source seconds. Captions, graphics and sound cues use edited output seconds. Changed cuts/transcripts require a new revision and rebuilt timing, even if old cues remain in bounds. A changed file or render receipt invalidates the corresponding listening evidence and technical report. Follow [RECOVERY.md](docs/RECOVERY.md) for transcript corrections, stale plans, source changes and interrupted locks. Receipts do not cover every custom scene or external asset; changes to those require deliberate rerendering/review.

## Local files

```text
.agents/skills/  .claude/skills/  synchronized editing, dialogue and review instructions
taste/PRINCIPLES.md               visual craft guide
src/scenes/custom/               custom frame-driven scenes
projects/<slug>/                 edit, source transcript, plans, ledgers and dialogue revisions
public/projects/<slug>/          copied source and project images
public/sfx/                      included sounds and licenses
models/  public/music/           local optional models and licensed music
output/                         drafts, finals, receipts and technical reviews
```

Media, projects, transcripts, models and outputs in these locations are ignored by Git. Files placed elsewhere may be committed; check before sharing. Original footage is copied without modification. Rendering replaces the conventional output filename, so copy versions you want to retain. No personal watermark is added. Customize scene tokens/fonts in `src/scenes/kit.tsx`; see [branding notes](branding/README.md).

## Developer checks

```bash
npm test
npm run typecheck
npm audit
node --test --test-concurrency=1 tests/format-render.mjs tests/dialogue-render.mjs
```

The last command runs bounded real renders: native-rate 4K/mastering plus 60000/1001 multi-cut word/audio mapping. CI runs it with Node 22 and FFmpeg. Optional ASR integration explicitly skips when its local speech fixture, whisper.cpp or model is missing; a skip is not transcription coverage. Models and generated media are never committed. There is no required Superpowers dependency for using the packaged skills.

## Licenses

Starter code: [MIT](LICENSE). Sounds: [CC0 with sources](public/sfx/README.md). whisper.cpp and models are separate downloads with their own licenses. Remotion has separate licensing terms; see [third-party notices](THIRD_PARTY_NOTICES.md) before commercial/team use.
