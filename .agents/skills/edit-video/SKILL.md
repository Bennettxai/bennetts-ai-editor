---
name: edit-video
description: Make a simple vertical talking-head edit with cuts, phrase captions, title cards and optional sound effects using this repository.
---

# Edit a video

1. Read README.md and docs/EDITING.md. Identify the project and the user's requested changes. If it is new, use `npm run init -- <slug> --input "<path>"`.
2. Review the recording and transcript if available. If you cannot inspect or transcribe speech, ask for a timestamped transcript. Never invent a transcript.
3. Propose a short cut list. Keep complete thoughts, remove obvious false starts and long empty gaps, and preserve the source. Get the user's approval before applying dialogue cuts.
4. Edit `projects/<slug>/edit.json`. Use source-clock clip ranges and final-edit-clock overlays. Add short phrase captions and at most a few title cards. Use the basic Bennett Legacy composition.
5. Optionally add a few sounds from public/sfx/README.md. Keep them below the speaker's voice. Use background music only when the user supplies a licensed track.
6. Run `npm run validate -- <slug>` and fix any errors. Run `npm run render -- <slug>`.
7. Review the exported video for complete speech, readable captions, framing and audio balance. If you cannot hear or view the result, say so. Give the user the output path and make requested revisions.

Keep this workflow straightforward. Custom scenes, automatic posting and external account setup are outside this starter.
