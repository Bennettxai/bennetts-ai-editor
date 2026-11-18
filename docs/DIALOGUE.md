# Reviewed dialogue cuts

The cut command proposes ranges; it does not choose takes, hear consonants or certify exhaustive gap removal. Use the [edit-dialogue skill](../.agents/skills/edit-dialogue/SKILL.md) for those decisions. These commands run from the repository root with a project named `talk`; substitute your slug.

## Source, clocks and take decisions

`projects/talk/transcript.json` contains source-clock words. Read it against the source recording before cutting. Recognizers can miss false starts, throat clears and breaths, or stretch a word over noise. Inspect the sound between and within recognized words, not only flagged silences. There is no built-in playback, waveform editor, burst auditor or automatic complete-take selector.

Keep these manually authored notes under the ignored project directory:

| File | Required fields per row |
|---|---|
| `take-ledger.md` | Candidate ID, source `[in_frame,out_frame)`, wording, production cue, KEEP/REJECT/PENDING, reason, review evidence |
| `gap-ledger.md` | ID, sentence/head/tail/gap/join/untranscribed-sound category, source and applicable output range, CUT/KEEP/PENDING, specific acoustic reason, evidence |

Compare the entire recording's alternative performances. A “use this one” cue normally points to the preceding completed usable performance; it does not validate preceding partial restarts. Remove production cues from the intended speech. Preserve explicit user selections and meaningful rhetorical repetition. Search for another complete take when a line is weak. Keep source order: plans must be chronological and cannot overlap.

The audit covers every retained sentence, both ends of each clip, all joins and every intra-line gap. Reconcile counts/IDs against the retained segments; the generated `decisions` and `flags` lists are not exhaustive coverage. Preserve consonant attacks/releases, aspirates, fricatives and full tails. Record gaps shorter than one frame as not independently removable at that grid. Do not use “natural pacing” alone to justify dead space, or uniform padding to replace acoustic decisions. When playback is unavailable, preserve uncertain sounds and leave take/acoustic coverage and listening pending wherever evidence is missing.

`source.probe.json` records the native source fps separately from selected `outputFrameRate`. With the default matching fps, source frame indexes use the native CFR grid. With `--fps` override, indexes mean **source time sampled at output fps**, not original decoded frame numbers. For `60000/1001`, frame 30 is `30 * 1001 / 60000 = 0.5005` seconds. Use exact integer frame boundaries and divide by the selected rational rate; do not round to milliseconds. See [format and normalization limits](EDITING.md#format-and-source-limits).

## Generate, review and apply

```bash
npm run cut -- talk
# Optional: write to a separate plan file instead of overwriting the default proposal.
npm run cut -- talk --plan projects/talk/cuts.reviewed.json
```

Review and edit the saved plan's `clips`, then show the user the selection and reasons. Honor existing authorization; otherwise obtain approval for the concrete selection before applying speech cuts. Retain the ledgers beside the reviewed plan, and reference them in review evidence.

The rough proposal uses measured silences when available. Its defaults trigger on pauses above 0.35 seconds, leaving approximately 0.15 seconds after speech and 0.10 before the next word, rounded outward to frames. `--max-pause` changes the proposal threshold (0.1–3 seconds); `--remove-fillers` proposes removing recognized fillers. These are starting points, not an acoustic quality bar. Review flags for `filler`, `repeat`, `unworded` and `moved`; sounds hidden inside stretched word timestamps can remain unflagged. Tighter manual ranges still need whole-word validation and actual acoustic review.

A generated plan has this structure (illustrative values, not a usable identity):

```json
{
  "schemaVersion": 1,
  "kind": "dialogue-cut-plan",
  "identity": {
    "source": "projects/talk/input.mp4",
    "sourceSha256": "GENERATED_SOURCE_HASH",
    "transcriptSha256": "GENERATED_EXACT_TRANSCRIPT_FILE_HASH",
    "baseClipsSha256": "GENERATED_CLIPS_AND_FRAMING_HASH",
    "fps": "60000/1001"
  },
  "sourceDuration": 3.003,
  "clips": [{"start": 0, "end": 0.5005}, {"start": 1.001, "end": 1.5015}],
  "partialWordExceptions": [],
  "decisions": [],
  "flags": [],
  "options": {},
  "removedSeconds": 2.002
}
```

Keep the generated identity and source facts intact. `clips` are the applied selection; the proposal's descriptive fields do not automatically update after manual changes. Update the decision notes to match your selected ranges. Each range must have positive length, lie within one existing base clip, remain within the source, and use the selected output-frame grid. You cannot bridge a base-clip gap or restore an already removed take through a proposal; deliberate timeline restoration uses [snapshot recovery](RECOVERY.md).

```bash
npm run cut -- talk --apply --plan projects/talk/cuts.reviewed.json
```

`--apply` reads exactly that saved JSON. Without `--plan`, it reads `projects/talk/cuts.proposed.json`. Missing, anonymous or stale plans fail. Apply never regenerates the plan, and rejects `--max-pause` or `--remove-fillers` alongside `--apply`. Current source bytes, exact transcript bytes, base clip boundaries/framing and fps must match. Do not replace hashes to bypass a mismatch.

When changing cuts with cards, visuals or SFX already present, explicitly use `--clear-overlays` to archive and clear them, even if every old timestamp remains within bounds. Word captions rebuild automatically. Existing phrase captions require `--replace-captions` to switch to word captions. Rebuild all dependent timing from the new `npm run words -- talk` output.

## Whole words and exact exceptions

Application rejects a range that retains only part of a transcript word. Usually preserve the entire word or correct the verified source timing and follow transcript recovery. If actual inspection proves the recognizer included non-speech within a word's range, record a narrowly reviewed exception in the plan's `partialWordExceptions` array:

```json
[{"clipIndex":0,"wordIndex":0,"sourceStartFrame":12,"sourceEndFrame":30,"reviewer":"Reviewer name","reason":"Describe the actual playback evidence for this exact edge."}]
```

Indices are zero based: `clipIndex` refers to the proposed retained clip, `wordIndex` to the full source transcript's `words`. Frame bounds identify the **whole selected clip range**, at the selected output fps. At `60000/1001`, this example requires clip bounds `0.2002` and `0.5005`. The exception becomes invalid if that clip range changes. It is not a blanket bypass or evidence of listening by itself. Partial intersections remain in output words/captions with `partial:true`. Inspect those words in the export.

## Versioned output

Each successful apply or `dialogue --snapshot` creates `projects/talk/dialogue/vNNN/`:

| Artifact | Meaning |
|---|---|
| `edit.before.json`, `edit.after.json`, `plan.json` | Prior and resulting edit; exact saved plan or manual-snapshot record |
| `transcript.source.json`, `transcript.output.json` | Exact source transcript bytes; mapped output-clock words with source-word/clip indexes |
| `manifest.json` | Half-open source/output frame intervals; output starts at zero and is contiguous |
| `receipt.json` | Revision, input identity and immutable snapshot hashes |
| `review.json`, `reviews/` | Current gate evidence and appended review submissions |
| `archive/` | Previous derived word/caption/props files, review reports and render receipts |

The manifest names its clock `source-time-at-output-fps`, with `fps`, `nativeSourceFps`, `totalFrames` and `clips` containing `sourceStartFrame`, `sourceEndFrame`, `outputStartFrame`, `outputEndFrame`. Each retained interval has equal source/output frame length. `dialogue/current.json` identifies the active revision and hashes its receipt. Do not edit immutable snapshots. The tool checks their identity before use.

Old MP4 bytes are **not** copied into revision archives. Copy any export you want to preserve before rendering again. Keep manually written ledgers and evidence for each revision; they are not generated or completeness-checked by the CLI.

## Four separate review gates

```bash
npm run dialogue -- talk
npm run status -- talk
npm run draft -- talk
npm run review -- talk --draft
```

`technical` in the dialogue revision certifies identity, frame/range/word checks and manifest structure. It is **not** the later export's measured technical review. `npm run review` measures the actual rendered file and writes a separate report. Neither supplies semantic, acoustic or creator approval.

`takeSelection`, `cutCoverage` and `listening` begin `pending`. Submit reviewer evidence using `npm run dialogue -- talk --review projects/talk/dialogue-review.json`. This valid pending example makes no review claim; replace the revision/name/time with actual values:

```json
{
  "revision": "v001",
  "reviewer": "Reviewer name",
  "reviewedAt": "2026-11-18T12:00:00Z",
  "gates": {
    "takeSelection": {"state": "pending"},
    "cutCoverage": {"state": "pending"},
    "listening": {"state": "pending"}
  }
}
```

Allowed states are `pending`, `pass`, `fail`. A pass or fail requires a specific `evidence` string. Take evidence should cite candidate decisions; cut coverage should cite reconciled head/tail/gap/join/noise IDs and counts. Update only the gates actually reviewed. The command rejects manual technical-gate overrides.

After actual normal-speed playback of the entire current export, submit listening evidence bound to the file heard:

```json
{
  "revision": "v001",
  "reviewer": "Reviewer name",
  "reviewedAt": "2026-11-18T12:30:00Z",
  "gates": {
    "listening": {
      "state": "pass",
      "evidence": "REPLACE with what was actually heard and checked, including joins and final speech tail.",
      "media": {"path": "output/talk.mp4", "sha256": "REPLACE_WITH_ACTUAL_FILE_SHA256"}
    }
  }
}
```

To obtain the SHA256 in bounded chunks without loading a large 4K file into memory, run from the repository root:

```bash
node --input-type=module -e 'import {fileSha256} from "./src/dialogue.mjs"; console.log(fileSha256(process.argv[1]))' output/talk.mp4
```

The file needs a current render receipt. The tool captures that receipt's hash too. Replacing the file **or its receipt**, even at the same filename and dialogue revision, makes effective listening pending and the old technical report stale. Historical submissions remain. Rerun technical review and listen to the new file before recording new evidence. A draft listening pass does not certify the final's changed audio mix; review/listen to the final itself for delivery.

If playback did not occur, leave listening pending and report **“I have not listened to this export.”** A synthetic signal test, clean transcript, contact sheet, successful render or user's request for a fully reviewed label cannot substitute for actual listening. Known take/gap defects require correction. Pending work can be delivered as a clearly labeled diagnostic preview. Local evidence is an attestation; software cannot prove that a human listened.
