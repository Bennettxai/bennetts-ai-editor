# Local transcription or imported words

`npm run transcribe` either invokes local [whisper.cpp](https://github.com/ggml-org/whisper.cpp) or reads an existing timed JSON. The editor does not upload audio and requires no transcription API key. Run commands from the repository root after `npm run init -- <slug> --input <video>`.

## Check readiness

```bash
npm run doctor
```

Required Node/FFmpeg/ffprobe/Remotion checks are separate from optional whisper/model readiness. A missing optional ASR dependency does not block imported JSON. Doctor verifies a readable model file, not its content or compatibility; a real transcription checks that. It also does not launch the render browser.

## Option A: local whisper.cpp

On macOS, `brew install whisper-cpp` is one installation option. On Linux or Windows, follow the official project's build instructions and put `whisper-cli` on PATH. The editor checks `whisper-cli`, `whisper-cpp`, then the historical `main` executable for full-JSON/model support.

Download a compatible ggml model into the ignored `models/` directory. For example, an English model:

```bash
mkdir -p models
curl -fL -o models/ggml-small.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin
npm run doctor -- --model models/ggml-small.en.bin
npm run transcribe -- first-post --model models/ggml-small.en.bin
```

Choose a model appropriate to the language and machine. Model lookup order is explicit `--model`, `WHISPER_MODEL`, `models/`, then `~/.whisper-models/`. An explicitly selected missing file is reported instead of silently falling back. Models remain local and uncommitted.

## Option B: import timed JSON

```bash
npm run transcribe -- first-post --json "/path/to/words.json"
```

Supported forms include Whisper/WhisperX word timestamps, whisper.cpp full JSON, and a plain object:

```json
{"words":[{"text":"Actual","start":0.2,"end":0.5},{"text":"speech","start":0.5,"end":0.9}]}
```

These example words are only a schema illustration. Supply actual recognized/reviewed words on the **imported source recording's clock**, not edited output times or estimated script timings. SRT is phrase timing and belongs to the separate captions command. JSON import needs neither a model nor whisper.cpp; do not combine `--json` and `--model`.

## Inspect the result

Both routes measure silences in the imported audio with FFmpeg and write `projects/<slug>/transcript.json`: `clock:"source"`, `engine`, `silenceThreshold`, `silences`, refined `words`, and `heard` (the original recognizer/import timings). Silence-based refinement can move word boundaries. It is an estimate, not proof that quiet consonants, noise or false starts were handled correctly.

Compare against the source recording, especially names, numbers, jargon and words stretched over breaths/throat clears. Correct text only when justified; keep timing unless actual source inspection supports a timing correction. Preserve complete phonemes. `cut` flags are not an exhaustive noise audit; follow [DIALOGUE.md](DIALOGUE.md).

Transcribing again replaces the working source transcript. Back up a version you want to keep first. Before a first dialogue revision, corrected words require a newly generated and reviewed cut plan. After a revision exists, even a text correction invalidates the exact transcript hash. Follow [RECOVERY.md](RECOVERY.md): adopt an intentional correction with `dialogue --snapshot`, clear/rebuild dependent output timing, then generate and review a new plan. Never edit hashes to force an old reviewed plan through.

`npm run words -- <slug>` produces the mapped **output-clock** words after cuts. Do not replace the canonical source transcript with that file.

## Test coverage

The optional ASR integration test uses a locally available speech fixture, whisper.cpp and a compatible model. It reports a named skip if a prerequisite is missing; that does not prove transcription worked. Imported-JSON workflows are exercised without ASR, including bounded real-render tests. Models and personal recordings are never test fixtures committed to the repository.
