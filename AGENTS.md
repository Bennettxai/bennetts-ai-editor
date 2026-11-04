# Bennett's AI Editor

An AI-assisted editor for short-form talking-head video. Read README.md, docs/EDITING.md, taste/PRINCIPLES.md and .agents/skills/edit-video/SKILL.md before editing a recording. After every full render, review it with .agents/skills/review-video/SKILL.md, using a fresh reviewer that didn't build the video.

Workflow: init → transcribe → cut (show the plan, get approval, apply) → word captions → plan graphics from `npm run words` (show the plan, get approval) → visuals in edit.json → validate → draft with --guides → review → render → review + critic → deliver the MP4.

Never guess dialogue or claim you listened to media you haven't reviewed. If transcription isn't available, ask for a transcript. Show the cut plan before applying cuts to speech. Don't overwrite source footage or remove complete words to make a cut shorter. Put nothing on screen that the speaker doesn't say or the user doesn't supply.

All clip timestamps use the source recording; all captions, cards, visuals and sfx use the finished edit. After changing cuts, rerun `npm run words` and re-time everything that follows. Only reference files inside public/ with public-relative paths. Don't put credentials in files. Don't commit student media, project files, transcripts, models or outputs.

Keep additions in the starter's existing style. For code changes, write the failing test first, then run `npm test` and `npm run typecheck`. Validate edit.json before rendering, inspect the exported video and the review report, and report any checks you couldn't perform.

No social posting is configured. Deliver a local MP4 for the student to review and upload.

The cut tool proposes; a person decides. It never cuts sound it has no transcript for, and it doesn't choose between takes. Per-clip zoom/focus is manual framing, not face tracking.
