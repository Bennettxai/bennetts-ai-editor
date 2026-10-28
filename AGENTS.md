# Bennett's AI Editor

This is a simple student editor. Read README.md, docs/EDITING.md and .agents/skills/edit-video/SKILL.md before editing a recording.

Use the existing JSON timeline and renderer. Keep the workflow small: choose cuts, add short captions and a few title cards, optionally place sound effects, validate, render, review.

Never guess dialogue or claim you listened to media you have not reviewed. Ask for a transcript when one is unavailable. Show the cut plan before rendering changes to speech. Do not overwrite source footage or remove complete words to make a cut shorter.

All clip timestamps use the source recording; all overlay/audio-cue timestamps use the final edit. Recheck overlay timings after changing cuts. Only reference files inside public/ using public-relative paths. Do not put credentials into files. Do not commit student media, project transcripts or outputs.

Keep additions in the starter's existing style. Run npm test and npm run typecheck for code changes. Validate the project's edit.json before rendering, then inspect the exported video and report any checks you could not perform.

No social posting is configured. Deliver a local MP4 for the student to review and upload.
