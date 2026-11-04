# Bennett's AI Editor

**An AI-assisted editor for short-form talking-head video.** Built for Bennett Legacy students. Drop in a recording, and your coding assistant transcribes it, tightens the pauses, adds word-by-word captions and animated split-screen graphics timed to what you say, then renders and checks a finished 1080 × 1920 MP4.

Open this folder in Claude Code or Codex, give it your footage, and describe the video you want. Everything runs on your computer. No API keys, no accounts.

## What you get

- **Local transcription** with word-level timings (whisper.cpp), or import a Whisper/WhisperX JSON you already have
- **Automatic rough cut** that removes dead air using the real silences in your audio, never cutting a sound it can't account for, and flags filler words, repeats and anything it couldn't transcribe
- **Word-by-word captions** that pop on with each spoken word and follow your cuts (phrase captions and SRT import still work)
- **Split-screen motion graphics**: when a graphic is on, your footage slides into the bottom 60 % and a scene plays on top, then slides back
- **Seven scenes ready to use**: headline, number counter, list/steps, bar chart, quote, screenshot with highlight, and your own custom React scenes
- **Sync to speech**: every reveal can land on the word that says it (`npm run words` prints the times)
- **Mastered audio**: every final render is normalised to −14 LUFS with a −1 dBTP ceiling, the level Reels and TikTok expect
- **Reels safe zone** built into the layout, with a `--guides` overlay for drafts
- **Automatic review**: size, frame count, loudness, stereo, black/frozen frames and a contact sheet for a sound-off read, plus a critic skill for a second opinion
- **Craft rules** in [`taste/PRINCIPLES.md`](taste/PRINCIPLES.md) that the assistant follows
- Bennett Legacy monochrome styling, seven CC0 sound effects, optional music you provide

It does not post to social media, track faces or generate B-roll. You still review every cut and caption before publishing.

## Start here

Install **Node.js 22 LTS or newer** and **FFmpeg** (including `ffprobe`). On macOS: `brew install node@22 ffmpeg`. For transcription also install whisper.cpp and download one model; see [docs/TRANSCRIBE.md](docs/TRANSCRIBE.md) (about two minutes).

```bash
git clone https://github.com/Bennettxai/bennetts-ai-editor.git
cd bennetts-ai-editor
npm ci
npm run demo
```

The demo renders a short split-screen video from a generated test pattern so you can check your setup without filming anything. Remotion may download its browser on the first render.

## Edit your first video

Open the repo in your coding assistant and say:

> Read AGENTS.md and the edit-video skill. Make a video from /path/to/my-recording.mp4 called my-first-video. Tighten the pauses, add word captions and two or three graphics that land on what I say. Show me the cut and the graphics plan before the final render.

Or run the steps yourself:

```bash
npm run init -- my-first-video --input "/absolute/path/to/video.mp4"
npm run transcribe -- my-first-video        # word timings + silences → transcript.json
npm run cut -- my-first-video               # proposal + log; add --apply when happy
npm run words -- my-first-video             # finished-edit time of every word
# add "visuals" to projects/my-first-video/edit.json (see docs/EDITING.md)
npm run validate -- my-first-video
npm run draft -- my-first-video --guides    # fast 540×960 check with the safe zone drawn
npm run render -- my-first-video            # full 1080×1920, mastered audio
npm run review -- my-first-video            # measured checks + contact sheet
```

The final video is `output/my-first-video.mp4`; the review is in `output/review/my-first-video/`. Watch the whole thing with sound before posting.

## How the files fit together

```text
.claude/skills/ .agents/skills/   edit-video (the workflow) and review-video (the critic)
taste/PRINCIPLES.md               craft rules the assistant follows
branding/                         Bennett Legacy palette notes
src/                              Remotion composition, scenes and the timing/layout logic
src/scenes/custom/                your own scenes
scripts/                          the editor command line and the review tool
projects/<slug>/                  edit.json, transcript.json, cut and caption proposals
public/projects/<slug>/           your recording (copied, never changed)
public/sfx/                       seven sounds and their licenses
output/                           finished videos, drafts and reviews
```

Your footage, transcripts, projects, models and renders are ignored by Git, so they stay out of your public copy.

## Two clocks

`clips` use times from the **original recording**. Captions, cards, visuals and sounds use times from the **finished edit**. `npm run words` prints the finished-edit time of every word, so graphics can land on the words they illustrate. After changing cuts, run it again and re-time anything that follows.

See [the editing guide](docs/EDITING.md) for the full JSON format, every scene and its options, and tips.

## Customize it

Colours and fonts live in `src/scenes/kit.tsx` (`tokens`, `fonts`) and the default branding is Bennett Legacy: off-white type on near-black. See [branding](branding/README.md). Add your own scenes in `src/scenes/custom/index.tsx`.

## Check the installation

```bash
npm test
npm run typecheck
```

If rendering fails, check `ffmpeg -version` and `ffprobe -version`, run `npm ci`, and confirm your media file exists. Run commands from the repository root.

## Licenses

Starter code: [MIT](LICENSE). Sound effects: [CC0 with sources included](public/sfx/README.md). whisper.cpp and its models are separate downloads under their own licenses (MIT). Remotion has separate licensing terms; see [third-party notices](THIRD_PARTY_NOTICES.md) before commercial/team use.
