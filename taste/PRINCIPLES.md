# Craft rules

These rules come from editing a lot of short-form talking-head video. The assistant follows them, and the review-video critic measures against them. Change them if your style differs, but change them here, deliberately, not one video at a time.

## The voice carries, the visuals reinforce

- The speaker is the video. Graphics show the one thing the words can't: the number, the steps, the screenshot.
- **One idea per graphic.** A viewer should get it in a one-second glance.
- **3–6 words per line on screen.** Never put a sentence on screen that is also being said.
- No graphic just because there's a gap. Full-screen footage is a fine default; the split panel shows only when it has something on it.
- Every claim on screen must be something the speaker actually says or can source. Never invent numbers.

## Timing

- Key words land **on the frame they are spoken** (`npm run words`). Loosely timed text feels cheap.
- Once a reveal lands, hold it **at least 1 s** (1.2 s for long words or the payoff). Text on screen for less than 0.7 s can't be read.
- **The first 3 seconds are the hook.** Don't give away the payoff, and no sound effects or flashy moves in them.
- **Frame 1 is a finished picture.** Never fade up from black.
- Holds keep a little motion going (the scenes drift slowly). Nothing should sit frozen.

## Motion

- Never linear. **Arrive slow, leave fast**: things ease out into place and ease in on the way out.
- One lead movement; secondary elements follow 2–4 frames behind it.
- Don't repeat the same layout in back-to-back beats. Alternate number, list, headline, image.
- Transitions are made of content (the footage sliding, a list growing), not decorative wipes.
- **Banned:** zoom/punch-in stutters, glitch effects, bouncy entrances, spinning text, emoji, hype words, stock AI imagery, and two-panel "before vs after" comparisons (they read as clutter at phone size).

## Cutting dialogue

- Cut dead air between and within thoughts. "Natural pacing" isn't a reason to keep a gap.
- Never clip a word: keep consonant tails and the breath-in before a word (the editor's padding handles this; listen anyway).
- Use the best complete take. Remove false starts and accidental repeats, but keep deliberate rhetorical repetition.
- Never speed up the voice, and never invent or synthesise words.
- Listen to every join at normal speed with headphones before calling it done. If you didn't listen, say so.

## Captions

- One word at a time, bold caps, popping on with the word. No fades or bounces.
- If a caption looks late, the timing is wrong. Fix the transcript, not the animation.
- Captions stay inside the safe zone and never cover the speaker's mouth.

## Sound

- The voice is the master track. Music sits about 10 dB under it; if it fights the voice, change the track rather than burying it.
- Sound effects only for real on-screen events (a step appearing, a number landing), quiet, and never in the hook.
- Final mix: −14 LUFS integrated, true peak ≤ −1 dBTP, sound in both ears. `npm run render` and `npm run review` handle and check this.
- Don't run denoise, gate or de-ess on a clean recording. Over-processing makes a voice sound like it's in a tunnel.

## Layout

- 1080 × 1920, 30 fps. Graphics in the top 40 %, the speaker in the bottom 60 % while split.
- Everything important inside the Reels safe zone: x 60–950, y 290–1630.
- Content fills its zone without bleeding off the edge. Parallel items share one alignment and one style.

## Quality bar (what review-video measures)

- Exact size, fps and frame count; frame 1 is a finished picture.
- −14 LUFS ± 1, true peak ≤ −1 dBTP, both channels.
- No still stretch over 0.5 s beyond 1 s per 30 s.
- Every reveal within 1 frame of its word.
- Text readable at phone size (contrast at least 4.5:1), nothing outside the safe zone, nothing colliding.
- The contact sheet reads with the sound off.
