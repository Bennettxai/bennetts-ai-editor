---
name: edit-video
description: Turn a talking-head recording into a finished vertical short with this repository - transcribe, cut dead air, word captions, split-screen motion graphics synced to speech, mastered audio and a measured review. Use when the user gives a recording or asks to edit, cut, caption or animate a video.
---

# Edit a video

Read `README.md`, `docs/EDITING.md` and `taste/PRINCIPLES.md` first. The rules in PRINCIPLES are the quality bar.

## 1. Set up

- New recording: `npm run init -- <slug> --input "<path>"`. Existing project: open `projects/<slug>/edit.json`.
- Ask what the video is about and who it's for if that isn't clear, in one question. Otherwise proceed.

## 2. Transcribe

- `npm run transcribe -- <slug>`. If whisper.cpp or a model is missing, point the user to `docs/TRANSCRIBE.md` or ask for a transcript JSON (`--json`). **Never invent a transcript.**
- Read `transcript.json`. Fix obvious misrecognitions in `text` (names, numbers, jargon) and tell the user what you changed. Keep the times.

## 3. Cut (needs approval)

- `npm run cut -- <slug>` and read `cuts.proposed.json`.
- Go through the flags: decide on each `repeat` (restart or deliberate?), `filler` and `unworded` region. If a line was said twice, pick the better complete take and adjust `clips` by hand.
- Show the user a short cut plan: what goes, why, and the new length. **Get approval before applying dialogue cuts**, then `npm run cut -- <slug> --apply` (plus your manual clip edits).

## 4. Captions

- After applying cuts the word captions are already built. Otherwise run `npm run captions -- <slug> --words --apply`. Use `--group 2` or `3` only if the user prefers pages.

## 5. Plan the graphics (needs approval)

- `npm run words -- <slug>` for the finished-edit time of every word.
- Pick 2–5 moments where a graphic shows something the voice can't: a number, steps, a comparison of sizes (bars), a screenshot the user supplied, the one payoff line (quote). Skip the first 3 s unless the hook needs a visual.
- For each moment write: time range, scene, on-screen words (3–6), and the word each reveal lands on. Vary scenes; never two of the same in a row. Only use numbers and claims the speaker says or the user provides.
- Show the plan as a short table and wait for approval or changes.

## 6. Build

- Write `visuals` into `edit.json` using the scenes in `docs/EDITING.md`, with `at` times from `npm run words`. A scene the built-ins can't do goes in `src/scenes/custom/index.tsx` (frame-driven only, inside `stage`, using `tokens`); run `npm run typecheck`.
- Optional: a few quiet sounds from `public/sfx/README.md` on real on-screen events (never in the first 3 s), and music only if the user supplies a licensed track.
- `npm run validate -- <slug>` and fix every error. Treat warnings as problems unless there's a reason.

## 7. Draft, review, fix

- `npm run draft -- <slug> --guides` then `npm run review -- <slug> --draft`. Look at `output/review/<slug>-draft/contact.jpg`: anything outside the red box, colliding or unreadable?
- Fix the worst problem first and redraft. Pull single frames with ffmpeg when you need a closer look.

## 8. Final

- `npm run render -- <slug>` then `npm run review -- <slug>`. All measured checks must pass.
- Run the **review-video** skill: hand a fresh subagent the video path and nothing else from your reasoning. Fix what it ranks worst, re-render, and review again with a new critic. Stop after 3 rounds or when it says `ship`.
- Give the user `output/<slug>.mp4`, the review report, and an honest list of what you could and couldn't check. **If you didn't listen to the audio, say so.** Ask them to watch it in full with sound before posting.

Never overwrite source footage, commit media, projects or transcripts, or post anywhere.
