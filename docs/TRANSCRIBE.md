# Set up transcription

`npm run transcribe` uses [whisper.cpp](https://github.com/ggml-org/whisper.cpp), which runs on your computer. Nothing is uploaded and there is no API key.

## 1. Install whisper.cpp

- **macOS:** `brew install whisper-cpp`
- **Windows / Linux:** follow the build instructions in the whisper.cpp README, then make sure `whisper-cli` is on your PATH.

Check it: `whisper-cli --help`

## 2. Download one model

Make a `models/` folder in this repo (it is ignored by Git) and download a model into it. `small.en` is a good balance of speed and accuracy for English:

```bash
mkdir -p models
curl -L -o models/ggml-small.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin
```

Use `ggml-base.en.bin` for a faster, smaller download, or `ggml-small.bin` / `ggml-medium.bin` for other languages. The editor looks in `models/` and `~/.whisper-models/`, or you can pass `--model /path/to/model.bin` or set `WHISPER_MODEL`.

## 3. Transcribe

```bash
npm run transcribe -- my-first-video
```

This writes `projects/my-first-video/transcript.json` with every word and its start and end time on the original recording's clock, plus the silences measured from your audio.

Whisper's word times tend to drift into pauses. The editor corrects that by measuring where your audio is actually quiet (relative to how loud your recording is) and moving words back onto the speech they belong to. Word *order and text* come from Whisper; *where speech is* comes from your audio.

## Already have a transcript?

Import a JSON with word timestamps from OpenAI Whisper (`--word_timestamps True`), WhisperX, whisper.cpp (`-ojf`) or `{"words":[{"text","start","end"}]}`:

```bash
npm run transcribe -- my-first-video --json /path/to/transcript.json
```

## Check it

Read the transcript against the recording. Names, numbers, brand names and jargon are the usual mistakes. Fix the `text` of a word in `transcript.json` and keep its times. Then rerun `npm run cut` and `npm run captions -- <slug> --words` so the fixes flow through.
