# Changelog

## 2.0.0

- **Transcribe** locally with whisper.cpp (`npm run transcribe`), or import Whisper / WhisperX / whisper.cpp JSON. Word times are corrected against the silences measured in your audio.
- **Cut dead air** automatically (`npm run cut`). It only cuts real silence, measured against your room's noise floor, and keeps 0.15 s after and 0.1 s before speech. Every decision is logged, and fillers, repeats, moved words and sound without transcript words are flagged. `--apply` after review cuts inside your existing clips and keeps their framing.
- **Word-by-word captions** (`npm run captions -- <slug> --words`) that follow your cuts. `captionStyle: "word"` pops each word on in bold caps.
- **Split-screen motion graphics** (`visuals`): the footage slides into the bottom 60 % while a scene plays on top. Scenes: headline, number, list, bars, quote, image (with highlight) and your own custom React scenes. Reveals sync to spoken words (`npm run words`).
- **Mastered audio**: final renders are normalised to −14 LUFS with a −1 dBTP ceiling (two-pass, static).
- **Reels safe zone** layout, plus `npm run draft -- <slug> --guides`.
- **Review** (`npm run review`): measured checks (size, frames, loudness, stereo, black first frame, frozen stretches), a contact sheet, a report, and a review-video critic skill.
- **Craft warnings** from `npm run validate` and the craft rules in `taste/PRINCIPLES.md`.
- Default music volume raised to 0.18 (about 10 dB under a voice). Cards that open a video no longer fade up from black.

Edit files from 1.x still work. Every new field is optional.

## 1.1.0

- Import source-timed SRT captions and map them through your selected cuts. Review a proposal before applying it.
- Set a modest zoom and horizontal/vertical crop position on each clip.
- Fade optional background music in and out at the edit boundaries.
- Render a smaller 540 × 960 draft before exporting the full 1080 × 1920 video.

Existing 1.0 edit files still work. Speech transcription, face tracking, custom scene generation and social posting are not included.

## 1.0.0

Initial starter: explicit cut lists, phrase captions, title cards, optional music and seven bundled CC0 sound effects.
