---
name: edit-video
description: Use when a user supplies a recording or requests a complete vertical talking-head edit, captions, split-screen graphics or a revision in AI Video Editor.
---

# Edit a video

Read [README.md](../../../README.md), [EDITING.md](../../../docs/EDITING.md) and [taste/PRINCIPLES.md](../../../taste/PRINCIPLES.md). Run commands from the repository root. Preserve source footage and use only supported local commands.

## 1. Prepare the dialogue

Run `npm run doctor`. Initialize with `npm run init -- <slug> --input "<path>"`, or inspect the existing project/status. New projects use 4K and supported native CFR fps; legacy format defaults remain 1080p/30. Diagnose unsupported sources using EDITING.md, preserving originals and normalization provenance.

**Use the edit-dialogue skill** in `.agents/skills/edit-dialogue/SKILL.md` for transcription, complete-take selection, exhaustive head/tail/gap/join/noise review, exact saved-plan application and revision evidence. Read its linked DIALOGUE.md and RECOVERY.md. Do not substitute the rough silence proposal for acoustic review or silently recut an approved project. Confirm the concrete selection unless already authorized.

## 2. Captions and graphics plan

Apply rebuilds word captions. For a reviewed grouping change, use `npm run captions -- <slug> --words --group 2 --apply`. Phrase/SRT alternatives are in EDITING.md. Correct source transcript mistakes through the documented recovery flow, not by patching identity hashes.

Run `npm run words -- <slug>` for the current **output clock**. Propose 2–5 useful graphic moments, each with range, scene, short on-screen wording and the exact word for every reveal. Use only supported claims. Favor a visual explanation over repeating subtitles. Show the concrete plan and obtain approval unless already authorized.

## 3. Build

Write approved `visuals` in `edit.json`. Use built-in scenes or register a custom component in `src/scenes/custom/index.tsx`; use `useTiming()` for native-rate timing and run `npm run typecheck`. Keep artwork in its stage and reference project assets under `public/projects/<slug>/`. Music requires a supplied licensed track; SFX belong on meaningful events.

Run `npm run validate -- <slug>`. Resolve errors and inspect craft warnings. Changed dialogue requires explicitly archived clearing/rebuilding of captions, cards, visuals and SFX, even when old timestamps fit. There is no automatic semantic retiming.

## 4. Review the export

Run `npm run draft -- <slug> --guides`, then `npm run review -- <slug> --draft`. Inspect contact sheets/frames, listen when available, fix and redraft. Pending human gates permit a diagnostic preview.

Run `npm run render -- <slug>`, then `npm run review -- <slug>` and use the review-video skill for independent evidence. Fix significant defects and rerender/review. Every replacement media/receipt can expire old listening evidence and technical reports, even under the same filename. Review the final's actual mix; a draft listening pass is insufficient.

Run `npm run status -- <slug>`. Deliver the MP4 and report with technical results, take/gap/listening states and unresolved limitations. Without playback, say “I have not listened to this export”; do not call it fully reviewed. No posting is configured.
