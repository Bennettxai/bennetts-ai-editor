---
name: review-video
description: Use after a full render, after replacing a rendered file, or when judging whether an AI Video Editor project is ready for delivery.
---

# Review a video

Use a fresh reviewer who did not build the edit, when available. Give that reviewer the project slug and this skill, without the builder's verdict. If independent review is unavailable, disclose that limit. Never infer playback from a transcript, waveform or technical pass.

Read [DIALOGUE.md](../../../docs/DIALOGUE.md) for evidence schemas and [RECOVERY.md](../../../docs/RECOVERY.md) for stale artifacts. Read `taste/PRINCIPLES.md`, `projects/<slug>/edit.json`, the take/gap ledgers and current revision manifest/output transcript. An initial dialogue `technical:pass` validates revision structure; it does not measure export quality.

## Gather current evidence

1. Run `npm run status -- <slug>` and `npm run dialogue -- <slug>`. Preserve stale evidence and follow recovery before review. Missing human evidence stays pending. Legacy projects lack structured gates; say so.
2. Run `npm run review -- <slug>` (or `--draft`). Read `output/review/<slug>/report.json`, `report.md` and `contact.jpg`; draft reports use `<slug>-draft`. A current report can contain failed checks. Rank any failed measurement as a problem.
3. Inspect the contact sheet and frames at each visual's start, start + 0.3 s, reveal times and end − 0.2 s. Example: `ffmpeg -v error -ss <seconds> -i output/<slug>.mp4 -frames:v 1 -vf scale=540:960 /tmp/review-frame.png`.
4. Run `npm run words -- <slug>`. Compare reveals with the intended word within one **selected output frame** (`1/fps`, not a fixed 0.033 s). Check caption text/order and source-to-output joins. Inspect all take/gap ledger decisions, including tiny gaps and untranscribed noises; a clean transcript alone is insufficient.
5. With playback, hear the entire current export at normal speed, checking whole phonemes, accidental double words, all joins, final speech tail and voice/music/SFX balance. Without playback, state “I have not listened to this export” and keep listening pending.

Judge readability, useful visual meaning, timing/hold, safe-zone/face/caption collisions, motion and supported claims. Record technical measurements separately from semantic/acoustic judgments. Use `dialogue --review <json>` only for gates actually reviewed, with revision/reviewer/time/evidence; listening pass/fail must identify the heard file and SHA256 with a current render receipt. Keep missing checks pending; software cannot prove the attestation.

## Return this report

- Exact export/revision inspected; technical measurements and their failed checks.
- Take selection, cut coverage, listening, visual inspection and independent-review status, each with evidence or an explicit limitation.
- At most eight ranked defects: output/source time, observed problem, frame/measurement/playback evidence and concrete fix.
- Verdict: `ship` only when the current final has passed required technical, take, coverage, listening and visual reviews; otherwise `one more pass` with remaining work.

A rerender can change the file or receipt while retaining its name/revision. Old listening becomes effectively pending and the old measured report stale; inspect status, rerun review and listen to the replacement. A draft's listening evidence does not approve the final mix. After three critique rounds, hand unresolved items to the user rather than concealing them.
