# Bennett's AI Editor

**A simple AI-assisted editor for short-form video.** Built for Bennett Legacy students who want to turn a talking-head recording into a clean vertical post with cuts, captions, title cards and a few sound effects.

Open this folder in Claude Code or Codex, give it your footage, and describe the edit. The assistant writes an edit plan; Remotion renders it into a 1080 × 1920 MP4.

## What you get

- A simple, editable JSON timeline
- Hard cuts between the parts of your recording you want to keep
- Phrase captions and basic animated title cards
- SRT caption import that follows your cuts
- Per-clip zoom and framing controls
- Quick 540 × 960 draft renders before the full export
- Bennett Legacy monochrome styling
- Seven bundled CC0 sound effects
- Optional background music you provide, with automatic fade-in/out
- A synthetic demo to test your setup without filming anything

This is a starter template. It does not automatically transcribe recordings, detect faces, pick B-roll, build custom platform demos, or post to social media.

## Start here

Install **Node.js 22 LTS or newer** and **FFmpeg** (including `ffprobe`). On macOS, `brew install node@22 ffmpeg` is one option; make sure `node`, `npm`, `ffmpeg` and `ffprobe` are available in your terminal. On Windows/Linux, install them using your system's package manager or their official installers.

```bash
git clone https://github.com/Bennettxai/bennetts-ai-editor.git
cd bennetts-ai-editor
npm ci
npm run demo
```

The demo creates synthetic footage and renders a short video. No API key or personal footage is required. Remotion may download its browser on the first render, so keep an internet connection available for setup.

To use your own recording:

```bash
npm run init -- my-first-video --input "/absolute/path/to/video.mp4"
```

Then open the repo in your coding assistant and ask:

> Read AGENTS.md and the edit-video skill. Help me edit my-first-video. Keep it simple: remove the false start, keep my complete sentences, add short captions and two title cards, then show me the edit plan before rendering.

Provide a timestamped transcript or help the assistant review the footage. If it has a transcription tool available, it can use that separately; this repo does not bundle or configure one. It should never invent your spoken words.

If you have an SRT transcript, import it with `npm run captions -- my-first-video --srt "/path/to/transcript.srt"`. This writes a proposal for review; add `--apply` to replace project captions. See the [editing guide](docs/EDITING.md) for details.

After editing `projects/my-first-video/edit.json`:

```bash
npm run validate -- my-first-video
npm run draft -- my-first-video
npm run render -- my-first-video
```

The fast draft is written to `output/drafts/my-first-video.mp4`. Your finished video is written to `output/my-first-video.mp4`. Review the whole video with sound before publishing.

## How the files fit together

```text
.agents/skills/edit-video/   Basic Codex editing instructions
.claude/skills/edit-video/   Same instructions for Claude Code
branding/                   Bennett Legacy palette notes
src/                        Simple Remotion composition
scripts/                    Project setup, validation and rendering
projects/<slug>/edit.json    Your edit decisions (created by init)
public/projects/<slug>/     Your recording (created by init)
public/sfx/                 Seven sounds and their licenses
output/                     Finished videos
```

Project names use lowercase letters, numbers and hyphens, such as `my-first-video`. Source media, project data and renders are ignored by Git so they stay out of your public copy by default.

## Editing basics

`clips` use timestamps from the **original recording**. Captions, cards and sounds use timestamps from the **finished edit**. If you shorten a cut, move everything that follows on the finished timeline.

For example, keeping original seconds 2–6 and 10–14 produces an eight-second video. A caption for original second 11 belongs at finished second 5.

Keep captions short, avoid covering your face, and use sound effects sparingly. Background music is optional and is not included. Choose music you have permission to use, then place it inside `public/` and reference it with a public-relative path.

See [the editing guide](docs/EDITING.md) for the JSON format and a sample assistant prompt.

## Customize it

The default branding is Bennett Legacy: off-white text, dark backgrounds and simple motion. See [branding](branding/README.md). Change the label, colors and composition for your own style.

## Check the installation

```bash
npm test
npm run typecheck
```

If rendering fails, verify `ffmpeg -version` and `ffprobe -version`, run `npm ci`, and confirm your media file exists. Run commands from the repository root. Large recordings and 1080p rendering can take time; start with the short demo.

## Licenses

Starter code: [MIT](LICENSE). Sound effects: [CC0 with sources included](public/sfx/README.md). Remotion has separate licensing terms; see [third-party notices](THIRD_PARTY_NOTICES.md) before commercial/team use.
