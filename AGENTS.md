# AI Video Editor

Read README.md, docs/EDITING.md, taste/PRINCIPLES.md and .agents/skills/edit-video/SKILL.md before editing. For speech selection or revisions, use .agents/skills/edit-dialogue/SKILL.md and docs/DIALOGUE.md. After a full render, use .agents/skills/review-video/SKILL.md; a fresh reviewer should inspect evidence independently. These skills are self-contained; no external skill pack is required.

Workflow: doctor → init → local ASR or timed JSON import → complete-take/gap audit → concrete reviewed cut plan → exact saved-plan apply → captions → output-clock graphics plan → validate → draft/review → final/review/listening → status and delivery. Honor existing user authorization; otherwise present cut/graphics decisions for approval before applying them.

Preserve original footage. Never invent dialogue or claim listening without playback. The cut tool proposes pauses; it does not select takes or certify that every noise/gap is safe. Record candidate take decisions and all retained heads/tails/gaps/joins, including untranscribed sounds. Preserve complete phonemes and meaning. Technical revision checks, measured export checks, take selection, gap coverage and listening are distinct evidence.

New projects default to 4K with supported source CFR fps. Exact integer/rational output rates are 1–120 fps; missing format keeps legacy 1080p/30. VFR/nonzero video origins require the diagnostic's explicit working copy, preserved originals and a provenance note. Do not label resampled source-time indexes as native decoded frames.

Clips use source seconds; captions, cards, visuals and SFX use output seconds. Apply the reviewed saved plan with --plan; never patch identity hashes. Changed transcript/cuts/fps require deliberate snapshot recovery, archived clearing of dependent overlays and rebuilt output timing even when timestamps remain in bounds. Follow docs/RECOVERY.md for stale files and interrupted locks; never remove an active lock.

Inspect the manifest and status. Human gates begin pending; actual evidence goes through dialogue --review. Listening binds the heard file and render receipt. Rerendering at the same path can expire listening and technical reports; renew both. Receipts do not cover every scene source/external asset, so rerender/review after those changes. Pending or failed reviews are not a fully reviewed delivery. Give the user the MP4, report and honest limits.

Only reference public assets with public-relative paths. Keep footage/images in public/projects/<slug>/ and music in public/music/. Do not commit media, projects, transcripts, models, outputs or credentials. No external uploading or social posting is configured.

For production code changes, write a failing behavior test first, implement minimally, then run relevant tests and typecheck. Use actual renders for media behavior and independent scenarios for skill behavior. Keep .agents/skills/ canonical and matching .claude/skills/ copies synchronized. Preserve legal notices and the compatibility composition ID; no permanent export watermark.
