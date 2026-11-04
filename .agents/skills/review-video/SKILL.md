---
name: review-video
description: Critique a rendered video from this repository as a fresh reviewer that did not build it - measure it against taste/PRINCIPLES.md and return ranked problems ending in "ship" or "one more pass". Use after every full render, or when the user asks whether a video is ready.
---

# Review a video

The builder never judges its own work. If you edited this video in this conversation, **spawn a fresh subagent** with this skill and only the project slug. Don't pass on your opinion of the video. If you are that subagent, continue.

## Gather evidence yourself

1. Read `taste/PRINCIPLES.md` and `projects/<slug>/edit.json`.
2. `npm run review -- <slug>` (or `--draft`) and read `output/review/<slug>/report.md`. Any failed check is automatically a top problem.
3. Look at `output/review/<slug>/contact.jpg` (2 frames per second, 8 per row, red box = safe zone). Read it with the sound off: does each panel make sense on its own?
4. Pull frames around every visual: its start, its start + 0.3 s, each `at` time, and 0.2 s before its end:
   `ffmpeg -v error -ss <t> -i output/<slug>.mp4 -frames:v 1 -vf scale=540:960 /tmp/<slug>-<t>.png`
5. `npm run words -- <slug>` and compare each `at` reveal with the time of the word it illustrates: off by more than 1 frame (0.033 s) is a problem.
6. Check `transcript.json` against the captions for misheard words.

## Judge against the principles

For each visual and the video as a whole:

- **Reads with the sound off?** One idea, 3–6 words, readable at phone size?
- **Timing:** lands on its word, holds at least 1 s, hook (first 3 s) not given away?
- **Layout:** inside the safe zone, nothing colliding with captions or the speaker's face, consistent alignment?
- **Motion:** eased, no stutter or bounce, no repeated layout back to back, nothing frozen?
- **Truth:** every number and claim on screen is said in the transcript or supplied by the user?
- **Cuts:** any join that lands mid-word or leaves a double word in the captions?
- **Audio:** report the measured numbers. If you can't listen, say so and leave the listening pass to the user.

## Report

Return a ranked list, worst first. For each problem give the time, what's wrong, the evidence (frame path or measurement) and the specific fix in `edit.json` terms. Keep it to what matters: at most 8 items.

End with exactly one line: `ship` or `one more pass`.

The builder fixes the top items, re-renders and asks a **new** critic. Stop after 3 rounds and hand the remaining list to the user.
