# Revision and render recovery

Back up the project before recovery, including manual ledgers, proposals, revisions and any output MP4s you want to retain. Restore unintended changes; deliberately adopt intended changes. Never repair freshness by editing identity hashes, receipts or immutable version snapshots.

## Corrected transcript or changed timeline

`words`, captions, validate, draft, render and review reject stale versioned source/transcript/clip/fps dependencies. Even a transcript text correction changes its exact file hash. Source replacement cannot be adopted with `--snapshot`: restore the imported source bytes or initialize a new project for the replacement.

If a reviewed plan was manually refined and the transcript later changed:

1. Preserve that reviewed plan under a separate filename plus your existing edit/transcript/ledger evidence. Do not run proposal generation over the only copy. `--apply` must reject its old identity.
2. Check the transcript correction against the recording. If it was unintended, restore the exact prior source transcript and matching base edit instead. If intended and the project already has a revision, adopt it with a fresh snapshot:

   ```bash
   npm run dialogue -- talk --snapshot --clear-overlays --replace-captions
   ```

   `--clear-overlays` explicitly archives/clears cards, visuals and SFX affected by changed cuts/transcript, even when in bounds. `--replace-captions` allows existing phrase captions to become rebuilt word captions. These flags are unnecessary when there are no corresponding overlays/phrase captions. This resets all human gates. If current clips now intersect corrected word boundaries, first preserve whole words or supply reviewed exact-range exceptions via `--exceptions projects/talk/exceptions.json`; use the [exception schema](DIALOGUE.md#whole-words-and-exact-exceptions).
3. Generate a fresh plan against the adopted base into a **new** file:

   ```bash
   npm run cut -- talk --plan projects/talk/cuts.after-correction.json
   ```

   Reconcile the preserved reviewed `clips` against the corrected words and new base ranges; carry across the intended selection only when still valid, and review every changed boundary/exception. Keep the new generated identity intact. Do not silently accept the newly generated rough selection as the user's prior decision. If a preserved range crosses a base gap, explicitly restore the intended source range in `edit.json`, review it and snapshot that timeline before generating the new plan.
4. Apply only the newly reviewed file, then rebuild output timing:

   ```bash
   npm run cut -- talk --apply --plan projects/talk/cuts.after-correction.json
   npm run words -- talk
   npm run dialogue -- talk
   ```

   Recreate visuals, cards and SFX around the new words; rebuild/review captions and all approval evidence, then rerender and review. There is no automatic semantic retiming.

Before a first revision, a transcript correction needs a new generated/reviewed proposal but no prior revision adoption. A direct manual timeline edit can be deliberately adopted using `dialogue --snapshot`; this is a new selection and requires the same take, gap and listening review. Do not silently recut an already approved legacy project.

## Stale or unverified exports

Run `npm run status -- talk` (or `npm run --silent status -- talk --json`). Artifacts can be `missing`, `unverified`, `current` or `stale`. Exit 0 means no detected invalid/stale dependencies, **not** delivery approval: files can be missing, legacy output unverified, human gates pending or measured technical checks failed.

An output's `<file>.receipt.json` binds source, transcript, complete edit, dialogue revision and actual output SHA256. A technical report's receipt also binds the exact measured video and its render receipt. Changing either invalidates the report. Replacing the exact heard media/receipt makes effective listening pending without erasing historical evidence. Render the current edit, rerun `npm run review`, inspect the report/frames, and repeat actual listening before resubmitting evidence for that file.

Receipts **do not hash every custom scene file, external image/SFX/music asset or toolchain binary**. Status can remain current after those change. Deliberately rerender and re-review when any of them changes. Old outputs with no receipt remain unverified. Legacy technical review is allowed with a warning; a versioned dialogue project needs a current render receipt.

## Interrupted revision or leftover lock

The CLI has no automatic unlock/rollback command. Revisions stage complete files, rename the revision into place, atomically replace working files, and publish `dialogue/current.json` last. This protects ordinary failures but is not a filesystem-wide transaction or power-loss guarantee. An interrupted operation or failed rollback leaves `dialogue/.lock` and fails closed.

1. Read `projects/talk/dialogue/.lock` (`pid`, `startedAt`). Check whether that exact process is still running. Do not remove an active lock or race another editor. Copy the project directory to a recovery backup before changing anything.
2. Inspect `current.json`, complete revision `receipt.json` files and their before/after snapshots. The current pointer is the last commit marker; do not select a revision merely because its directory has the largest number. If a valid current revision exists, restore working `edit.json` from its `edit.after.json` and working `transcript.json` from its `transcript.source.json`, preserving later manual work in the backup. If the first revision failed before a current pointer existed, a complete orphan's `edit.before.json` and source transcript can restore the pre-application state; preserve the orphan for inspection.
3. Preserve partial `words.output.json`, `captions.proposed.json` and `.render-props.json` before clearing/rebuilding them. Verify the chosen revision's snapshot hashes and current receipt agree. If evidence is incomplete or contradictory, stop recovery and retain the backup rather than inventing a pointer. Only after reconciling files and confirming the owner is inactive, remove that stale `.lock`.
4. Run:

   ```bash
   npm run dialogue -- talk
   npm run words -- talk
   npm run validate -- talk
   npm run status -- talk
   ```

   These verify revision identity and regenerate current output words. If intended manual corrections were recovered, adopt them as a new `--snapshot`, explicitly clearing dependent overlays as required. Restore unintended media changes. Rerender stale output and renew review evidence.

Malformed `review.json` gates fail closed too. Preserve the damaged file and restore valid gate evidence from `reviews/` or a known backup; never invent passes. A well-formed previous listening record can still become effectively pending when its media is no longer current.
