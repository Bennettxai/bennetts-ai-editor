# Unbranded AI Video Editor v3

## Intent

Upgrade the existing local Claude Code/Codex editor into a complete, reusable editing workflow. Add a portable dialogue-editing skill, preserve source quality, make revisions auditable, and remove personal branding from the product. Publish the verified update to the existing GitHub repository. Keep the original checkout's unpublished branding/reference files untouched.

## Approach

Extend the existing Node, FFmpeg, whisper.cpp and Remotion project. A skill-only copy would leave missing commands and quality limits. Importing an entire private production pipeline would introduce unrelated services, credentials and personal conventions. A new web editor would replace the workflow the user requested. Keep local operation, the existing JSON timeline, and no required paid API or hosted service.

## Product contract

### Media and timing

- New projects default to 2160×3840 final export and preserve a supported source frame rate (including 24000/1001, 30000/1001 and 60000/1001). Use rational rate metadata and frame-indexed boundaries; one timing policy serves cuts, captions, graphics, audio and review.
- Use a 1080×1920 logical graphics canvas, rendered at scale 2 for 4K. Drafts stay 540×960. Final H.264 uses CRF 10 or better, with video stream copy during audio mastering. No 1080 intermediate for a 4K source.
- Existing projects without format metadata retain their 1080×1920/30 fps behavior. Explicit output format options allow 1080p or 4K. Validate rates, dimensions and all timeline inputs before rendering.
- Probe frame rate, dimensions, stream starts and duration during import. VFR inputs need an explicit, documented CFR working copy or an actionable diagnostic; never label VFR native-frame exact. Preserve the original media and record any normalization.
- Real export review checks the selected dimensions, frame rate, frame count and existing audio targets rather than hard-coded 30fps/1080p values.

### Dialogue editing and revision integrity

- Add `.agents/skills/edit-dialogue/SKILL.md` with a matching Claude adapter. Adapt the procedure to commands that actually exist here. No private paths, creator rules, account setup, brands or proprietary assets.
- The skill covers complete-take selection, false starts, accidental repeats, head/tail and intra-line gap audits, untranscribed sounds, explicit rejection reasons, frame-exact cuts, source/output clocks, and honest listening evidence. Silence detection proposes candidates; it does not certify semantic or acoustic quality.
- Applying a cut must apply the reviewed proposal, not silently regenerate a different plan. Support a selected proposal file. Verify its source/transcript/edit identity before mutation, validate ranges, and refuse unsafe intersections or partial-word cuts unless explicitly recorded as reviewed exceptions.
- Keep versioned dialogue revisions under `projects/<slug>/dialogue/vNNN/`: original and resulting edit snapshots, source/transcript hashes, a contiguous source-to-output frame manifest, decisions/flags, and output-clock transcript. No source overwrites.
- Keep technical integrity, take selection, cut coverage and actual listening as separate states. Automated checks may only certify technical facts. Pending or failed human/acoustic checks remain visible.
- Changing cuts invalidates output-clock assets even when their timestamps still fit the shorter duration. Archive previous work and require explicit clearing/rebuilding of cards, visuals and sound cues. Rebuild word captions from the matching transcript. Rendering must detect stale source/transcript/cut dependencies rather than silently use them.
- Existing legacy projects remain usable; the new skill adopts the versioned workflow for new dialogue edits.

### Usability and portability

- Neutral product title, welcome screen, demo, colors, documentation and skills. No personal logo, watermark, brand palette, business links, creator rules or reference pack. Retain legal attribution and the existing repository address.
- Provide a doctor command with actionable Node/FFmpeg/ffprobe/Remotion/whisper/model diagnostics; missing optional transcription support must distinguish imported-transcript workflows from local transcription readiness.
- Expose truthful project status: imported, transcript available, dialogue revision/gates, draft/final/review availability and stale dependencies. Document exact commands from import through reviewed delivery.
- No automatic publishing, external media uploads, voice cloning or claims of autonomous take selection. Users/agents review speech and visual decisions.

## Verification and release

Use TDD for behavior changes. Retain the existing suite and add tests for fractional/high frame rates, 4K output, cut identity/mutation safety, timing invalidation, versioned receipts, missing tools/media and legacy compatibility. Run real synthetic media through import, transcript import, cut, captions, graphics, render and review. Verify an actual short 4K render and a fractional-rate render with ffprobe. Test skills through independent task scenarios rather than text-grep assertions. Add GitHub CI for unit/integration checks, types and a bounded real-render smoke test. An independent final review must clear significant defects before pushing. Do not include generated media, private data, model binaries or credentials in Git.

## Implementation choices

Keep the existing dependencies pinned unless a demonstrated compatibility issue requires a change. Use platform-neutral Node filesystem/process APIs. Use short generated fixtures to make real-media tests affordable. The implementation plan may settle internal module boundaries and command spelling, but must preserve these behaviors. The user authorized the upgrade and GitHub push and confirmed the dialogue-editing skill; implementation choices are delegated to this session.
