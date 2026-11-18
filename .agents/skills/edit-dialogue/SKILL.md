---
name: edit-dialogue
description: Use when editing talking-head speech, selecting takes, removing false starts or pauses, auditing noisy joins, or revising an existing dialogue cut in AI Video Editor.
---

# Edit dialogue

Make deliberate speech decisions on an identified source, then apply that exact reviewed plan. Read [DIALOGUE.md](../../../docs/DIALOGUE.md) for the commands, schema and evidence format; use [RECOVERY.md](../../../docs/RECOVERY.md) when dependencies change. No extra plugin is required.

## Select and audit

1. Run `npm run doctor` and initialize or inspect the project. Use local ASR or import timed JSON as described in [TRANSCRIBE.md](../../../docs/TRANSCRIBE.md). Preserve the original. Keep source and output clocks separate; default output fps matches the supported native source. An output-rate override changes the manifest's frame grid.
2. Compare complete performances across the recording. A spoken “use this one” cue normally selects the preceding complete usable take, not its false starts. Preserve explicit user choices; resolve ambiguous cues. Record **every candidate's ID, source frame range, wording, cue, KEEP/REJECT decision and reason** in a take ledger.
3. Audit every retained sentence, head, tail, join and intra-line gap, including small gaps and untranscribed sounds. Inspect/listen around throat clears, broken words and recognizer timestamps stretched across noise. Silence detection and ASR flags only suggest candidates. Maintain an exhaustive gap/join ledger with **ID, range, CUT/KEEP/PENDING, acoustic reason and evidence**; reconcile its coverage counts. Record sub-frame gaps as not independently removable on the chosen frame grid.
4. Preserve whole phonemes, attacks, releases and tails. Remove accidental repetitions; keep deliberate meaning. No blanket padding or silence threshold certifies completeness. Do not overlap adjacent speech. The CLI has no semantic take selector or exhaustive acoustic auditor: perform those reviews using available playback/waveform tools, or leave the corresponding gate pending.

## Apply the reviewed selection

```bash
npm run cut -- talk
# Review/edit clips in projects/talk/cuts.proposed.json; retain its identity.
npm run cut -- talk --apply --plan projects/talk/cuts.proposed.json
npm run dialogue -- talk
npm run words -- talk
npm run draft -- talk
npm run review -- talk --draft
```

Show the concrete selection and obtain approval unless already authorized. Apply reads the saved file; never combine it with proposal-generation options. Preserve complete transcript words. A verified recognizer boundary error may use a reviewer/reason exception bound to the exact clip/word/frame range documented in DIALOGUE.md; it is not permission to clip speech. Changed transcript, cuts or fps require deliberate recovery, not edited identity hashes.

## Record and hand off

Inspect the new version's manifest and output transcript. Submit separate `takeSelection`, `cutCoverage` and `listening` evidence with `dialogue --review`; technical integrity is computed separately. Without actual playback, record listening pending and say **“I have not listened to this export.”** Technical measurements never supply human evidence.

Build captions, visuals and sound cues on the output clock only. Changed cuts/transcripts require archived clearing and rebuilding even when old timestamps fit. New revisions reset human gates. Rerendering the same filename expires its old listening evidence and technical report when media/receipt changes. Review the exact new file before delivery; unresolved gates mean a diagnostic preview, not a fully reviewed edit.
