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
- Captions are phrase-level; there is no automatic word-by-word transcription or highlighting.

The `title` is project metadata. Put visible titles in `cards`. Cards cover the footage while the underlying speech keeps playing; captions appear above cards if they share a time range.

## Add your own music

Copy a licensed track to `public/music/background.mp3` and add this top-level field:

```json
"music": {"src": "music/background.mp3", "volume": 0.08}
```

Use a public-relative path, without `public/` at the beginning. Start quietly, listen, then adjust. A volume value is a linear multiplier, not decibels. Music starts with the edit and loops if it is shorter than the video. No song or license for a song is included.

## Work with your assistant

> Edit first-post using the existing starter. Here is my timestamped transcript: [paste it]. Keep these two complete thoughts: [describe them]. Propose the source-time cuts first. After I approve, update edit.json, add short phrase captions, use at most two title cards and three quiet sound effects, validate and render. Do not invent dialogue or add unsupported claims.

If your assistant can transcribe your local video, it may use its own transcription tool. Review that transcript before using it for captions. The starter itself does not require a transcription service or an API key.

## Validate, render, review

```bash
npm run validate -- first-post
npm run render -- first-post
```

Open `output/first-post.mp4`. Check the beginning and end of every cut, caption spelling, face framing, and music/SFX balance. Check the entire video with headphones or speakers before posting. Rendering again replaces that project's output MP4, so copy a version you want to keep first.

The default layout is designed for a single speaker. Horizontal footage is cropped to fill the vertical video region; if the speaker is off-center, adjust the composition or prepare a better-framed source first.

## Demo and privacy

`npm run demo` generates a short color-pattern recording with a quiet test tone, then adds a card, captions and two sound cues. It is a setup check, not an example of a completed talking-head edit. If the demo already exists, use `npm run render -- demo` to render it again.

Personal media and project files stay local and are ignored by Git. Keep footage under `public/projects/<slug>/` and music under `public/music/` so that protection applies automatically. Files you place elsewhere under `public/` can be committed unless you add them to `.gitignore`.
