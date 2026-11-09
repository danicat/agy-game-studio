---
name: gemini-omni
description: >
  Expressive speech synthesis (single-speaker TTS, character voice acting, and
  multi-speaker dialogue), conversational video generation, multimodal video
  editing, first-and-last-frame interpolation, and video extension using Gemini
  Omni Flash 1.2 (gemini-omni-flash-1.2-preview and gemini-omni-flash-1.2) and
  Gemini Omni 1.1 Flash (gemini-omni-1.1-flash) via uv run scripts/omni.py, the
  gemini-api CLI, and Google Gen AI SDKs. Supports first-class Vertex AI /
  Gemini Enterprise (ADC) and Gemini API Key authentication, 24 kHz RIFF WAV
  speech wrapping, 360p to 4K video with synchronized audio, and Ebitengine 2D
  game voice integration. Activate when generating character voice lines,
  narrator audio, multi-speaker dialogue, or conversational video clips.
license: Apache-2.0
metadata:
  category: media
  tags: "tts, speech, voice-acting, dialogue, video-generation, video-editing, multimodal, generative-ai, gemini-api, vertex-ai, game-dev"
  author: Daniela Petruzalek (daniela@danicat.dev)
  version: "0.2.0"
  catalog: https://skills.danicat.dev
---

# Gemini Omni Speech, Dialogue & Video Generation Skill (`gemini-omni`)

Synthesize expressive single-speaker narration, character voice acting, and multi-speaker dialogue (`24,000 Hz` 16-bit mono WAV), or generate, edit, interpolate, and extend high-coherence video with native synchronized audio (`360p` to `4k` MP4) using **Gemini Omni Flash 1.2** (`gemini-omni-flash-1.2-preview` and `gemini-omni-flash-1.2`) and **Gemini Omni 1.1 Flash** (`gemini-omni-1.1-flash`). Execute workflows via **`uv run scripts/omni.py`** (with first-class **Vertex AI / Gemini Enterprise** and **Gemini Developer API** support), the **`gemini-api` CLI** (`gemini-api tts` and `gemini-api video`), or the **Google Gen AI SDKs**.

> [!CAUTION]
> **Strict Fail-Fast Authentication Policy (Never Go Rogue)**:
> **Never go rogue if `gemini-api` or `scripts/omni.py` fails.**
> - If `gemini-api` fails, is not installed, or lacks Vertex AI authentication, run `uv run scripts/omni.py` (or `uv run skills/gemini-omni/scripts/omni.py`) with Vertex AI / Application Default Credentials (`GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, and `gcloud auth application-default login`) or `GEMINI_API_KEY`.
> - If authentication still fails in `scripts/omni.py`, **stop immediately**, report the exact authentication error message to the user, and ask them to configure their credentials (`gcloud auth application-default login` + `export GOOGLE_CLOUD_PROJECT=...` or `export GEMINI_API_KEY=...`).
> - Never attempt unauthorized workarounds, never generate silent or mock `.wav` or `.mp4` files, never silently substitute procedural beeps when the user asked for Gemini Omni voice acting, and never probe local credential stores outside standard environment variables and ADC.

---

## Available Scripts

- **[scripts/omni.py](scripts/omni.py)**: PEP 723 standalone Python CLI (`uv run scripts/omni.py`) supporting **Gemini Omni Flash 1.2** (`gemini-omni-flash-1.2-preview`, `gemini-omni-flash-1.2`, and aliases `omni-flash-1.2`, `flash-1.2`, `1.2`), `gemini-omni-1.1-flash` (`gemini-omni-1.1`), `gemini-omni-flash-1.1-preview`, `gemini-3.8-flash-tts`, and `gemini-3.1-flash-tts-preview`. Handles single-speaker TTS (`--voice`), multi-speaker dialogue (`--speaker Name=Voice`), automatic `24 kHz` 16-bit mono PCM-to-WAV RIFF wrapping, conversational video generation (`--mode video`), and both **Vertex AI / Gemini Enterprise** (`--vertexai`, `--project`, `--location`) and **Gemini Developer API** (`GEMINI_API_KEY`) authentication.
- **[scripts/test_omni.py](scripts/test_omni.py)**: Automated unit and CLI test suite verifying Omni Flash 1.2 model alias resolution, Vertex AI vs. API key client initialization, fail-fast missing credential errors, single-speaker and multi-speaker `SpeechConfig` construction, and RIFF WAV header wrapping.

---

## Prerequisites: `uv` + `python3` (`scripts/omni.py`) & `gemini-api` CLI Setup

You can run Gemini Omni workflows using either the bundled PEP 723 Python script (`uv run scripts/omni.py`, recommended whenever using **Vertex AI / Gemini Enterprise** or `uv`) or the `gemini-api` CLI binary.

### Option A: `uv` + `python3` (`scripts/omni.py`) with Vertex AI or Gemini API Key

`scripts/omni.py` declares inline PEP 723 metadata (`requires-python = ">=3.10"`, `dependencies = ["google-genai>=1.68.0", "google-auth>=2.0.0"]`) so `uv run` resolves dependencies automatically in an isolated environment.

```bash
# 1a. Authenticate with Vertex AI / Gemini Enterprise (Application Default Credentials)
gcloud auth application-default login
export GOOGLE_CLOUD_PROJECT="your-gcp-project-id"
export GOOGLE_CLOUD_LOCATION="us-central1"
export GOOGLE_GENAI_USE_VERTEXAI="true"

# 1b. Or authenticate with the Gemini Developer API
export GEMINI_API_KEY="your-api-key"

# 2. Verify CLI flags and run the unit test suite
uv run scripts/omni.py --help
uv run pytest scripts/test_omni.py
```

### Option B: `gemini-api` CLI Setup

The `gemini-api` CLI is a zero-dependency binary for speech (`gemini-api tts`) and video (`gemini-api video`) generation that writes output files directly to disk and prints only the file path to `stdout`.

```bash
# 1. Verify or install gemini-api CLI on macOS and Linux
command -v gemini-api >/dev/null 2>&1 || (curl -fsSL https://raw.githubusercontent.com/google-gemini/gemini-api-cli/main/scripts/install.sh | bash)
# Windows (PowerShell): iwr -useb https://raw.githubusercontent.com/google-gemini/gemini-api-cli/main/scripts/install.ps1 | iex

# 2a. Authenticate with a Gemini API Key (environment variable or OS keychain)
export GEMINI_API_KEY="your-api-key"
# Or store credentials in the OS keychain:
gemini-api configure --api-key "your-api-key"

# 2b. Or authenticate with a Google Cloud Project / ADC (OAuth2 bearer token)
# Note: For direct Vertex AI / Gemini Enterprise ADC support without manual token export,
# use 'uv run scripts/omni.py --vertexai --project your-gcp-project-id' instead.
gcloud auth application-default login \
  --scopes="https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/generative-language"
export GEMINI_ACCESS_TOKEN="$(gcloud auth application-default print-access-token)"
export GEMINI_USER_PROJECT="your-gcp-project-id"

# 3. Verify credentials and inspect CLI schemas offline
gemini-api whoami
gemini-api models
gemini-api tts --help
gemini-api video --help
gemini-api video --schema
```

---

## Trigger Conditions

Activate this skill whenever the user asks to:
- Synthesize single-speaker narration, announcer callouts, or expressive character voice acting (`--voice Kore`, `Puck`, `Zephyr`, `Charon`, `Fenrir`, `Aoede`, `Leda`, `Orus`).
- Generate multi-speaker dialogue or cutscene conversations between named characters (`--speaker Alice=Kore --speaker Bob=Puck`).
- Generate video clips with synchronized audio, dialogue, music, or sound effects from text prompts (`--mode video` or `gemini-api video`).
- Animate a starting image (`<FIRST_FRAME>`) or interpolate smoothly between a starting frame and an ending frame (`<FIRST_FRAME> <LAST_FRAME>`), including seamless loops.
- Generate videos guided by multiple character, object, or style reference images (`<IMAGE_REF_0>`) or reference video clips (`<VIDEO_REF_0>`).
- Edit an existing video conversationally across multiple turns (`--previous-interaction-id`) or extend a video clip in 10-second increments up to 40 seconds total.

---

## Companion Skills & Game Dev Studio Integration

In `agy-game-studio`, `gemini-omni` serves as the character voice acting, narrator dialogue, and cutscene media engine alongside the companion game development skills:

- **`vibe-game-developer` & `game-design` (`GDD.md`)**:
  - During game co-creation, `game-design` defines character vocal personas, narrator tone, and cutscene scripts in `GDD.md`, while `vibe-game-developer` routes voice acting and dialogue generation tasks to `gemini-omni`.
- **`gemini-omni` + `procedural-sfx` + `procedural-music` + `lyria` (Complete Game Audio Stack)**:
  - Use **`gemini-omni`** for spoken character lines, boss taunts, tutorial narration, and two-speaker dialogue scenes (`.wav`).
  - Use **`procedural-sfx`** (`.sfx` DSL) for low-latency gameplay sound effects (jumps, impacts, lasers, UI clicks) and retro speech-synth bleeps.
  - Use **`procedural-music`** (`.music` DSL) or **`lyria`** (`.wav` / `.mp3`) for background music (BGM) and adaptive level soundtracks.
- **`ebitengineer` & `game-dev-studio` Integration (`44.1 kHz` Stereo & 4-Byte `&^ 3` Alignment)**:
  - `gemini-omni` outputs `24,000 Hz` 16-bit mono RIFF `.wav` files by default, while Ebitengine games share a single `audio.Context` at `44,100 Hz` stereo (4 bytes per sample frame: 2 bytes Left + 2 bytes Right).
  - Convert voice lines to `44,100 Hz` stereo `.wav` with `ffmpeg` (`ffmpeg -y -i line_24k.wav -ar 44100 -ac 2 -c:a pcm_s16le line.wav`) or decode with `wav.DecodeWithSampleRate(44100, r)` at asset load time (never inside `Update()` or `Draw()`), and always mask PCM buffer lengths with `&^ 3` to guarantee 4-byte frame alignment.
  - Preview and audition generated voice lines alongside game BGM and SFX in the Game Dev Studio side panel (`[Game Dev Studio](sidecar://agy-game-studio/studio)`).

---

## Model Specifications (`gemini-omni-flash-1.2-preview` & `gemini-omni-1.1-flash`)

| Feature / Parameter | Gemini Omni Flash 1.2 (`scripts/omni.py` default) | Gemini Omni 1.1 Flash & Dedicated TTS |
| :--- | :--- | :--- |
| **Canonical Model IDs** | `gemini-omni-flash-1.2-preview`, `gemini-omni-flash-1.2` | `gemini-omni-1.1-flash`, `gemini-omni-flash-1.1-preview`, `gemini-3.8-flash-tts`, `gemini-3.1-flash-tts-preview` |
| **CLI Short Aliases** | `omni-flash-1.2`, `flash-1.2`, `1.2`, `gemini-omni-1.2-flash`, `omni-1.2` | `gemini-omni-1.1`, `omni-1.1`, `1.1`, `tts`, `3.8-tts`, `3.1-tts`, `tts-lite` |
| **Speech & Dialogue Output** | `response_modalities=["AUDIO"]` with `SpeechConfig` / `VoiceConfig` / `MultiSpeakerVoiceConfig` (`24 kHz` 16-bit mono RIFF WAV) | Supported on `gemini-3.8-flash-tts`, `gemini-3.8-flash-lite-tts`, `gemini-3.1-flash-tts-preview`, and Omni Flash |
| **Video Generation & Editing** | Interactions API (`360p`, `720p`, `1080p`, `4k`; `16:9` or `9:16`; `3s` to `10s`, extendable to `40s`) | Default in `gemini-api video` (`gemini-omni-1.1-flash`) |
| **Input Context Window** | `1,048,576` tokens (Text, Image, Audio, Video inputs) | `1,048,576` tokens |
| **Safety & Provenance** | Invisible **SynthID** watermark in audio and video | Invisible **SynthID** watermark in audio and video |
| **Reference Guides** | [gemini-omni-flash-1-2.md](references/gemini-omni-flash-1-2.md) | [gemini-omni-1-1-flash.md](references/gemini-omni-1-1-flash.md) |

> [!IMPORTANT]
> **Deterministic Fail-Fast Rules**:
> - Never fall back to the deprecated `gemini-omni-flash-preview` model (shut down October 22, 2026); `scripts/omni.py` rejects it immediately with a validation error. Always use `gemini-omni-flash-1.2-preview`, `gemini-omni-flash-1.2`, or `gemini-omni-1.1-flash`.
> - Use `uv run scripts/omni.py ... --dry-run` or `gemini-api video ... --dry-run -o json` to validate request parameters offline before running live API calls.

---

## Deep Technical References

Consult the `references/` directory for complete API schemas, voice configuration patterns, media role tags, and SDK examples:

- **[references/gemini-omni-flash-1-2.md](references/gemini-omni-flash-1-2.md)**: Complete reference for **Gemini Omni Flash 1.2** (`gemini-omni-flash-1.2-preview` / `gemini-omni-flash-1.2`), single-speaker and multi-speaker `SpeechConfig` recipes, PCM-to-WAV RIFF wrapping, Vertex AI / Gemini Enterprise ADC setup, and Ebitengine 2D game audio integration.
- **[references/gemini-omni-1-1-flash.md](references/gemini-omni-1-1-flash.md)**: Full specification for `gemini-omni-1.1-flash`, media role binding tags (`<FIRST_FRAME>`, `<LAST_FRAME>`, `<IMAGE_REF_N>`, `<VIDEO_REF_N>`, `[# Sources ...]`), URI delivery polling, `ffmpeg` pre-processing, and SDK code samples.
- **[references/README.md](references/README.md)**: Index and quick reference for all Gemini Omni workflows.

---

## Core Execution Workflows

### 1. Python CLI Execution via `uv run scripts/omni.py` (Primary for Vertex AI & Omni Flash 1.2)

Use `uv run scripts/omni.py` for single-speaker voice acting, multi-speaker dialogue, and conversational video generation across both Vertex AI / Gemini Enterprise and the Gemini Developer API:

```bash
# 1. Single-Speaker Character Voice Line (Gemini Omni Flash 1.2 default)
uv run scripts/omni.py \
  --model "gemini-omni-flash-1.2-preview" \
  --voice "Kore" \
  --prompt "Speak in a crisp, urgent tactical voice: Shields are down to twenty percent! Reroute auxiliary power now!" \
  --output "./assets/audio/tactical_alert.wav"

# 2. Multi-Speaker Cutscene Dialogue (--speaker Name=Voice)
uv run scripts/omni.py \
  --model "omni-flash-1.2" \
  --speaker "Knight=Fenrir" \
  --speaker "Oracle=Aoede" \
  --prompt "Knight: The citadel gates are sealed. Oracle: Only the starlight key can awaken the ancient mechanism." \
  --output "./assets/audio/citadel_dialogue.wav"

# 3. Vertex AI / Gemini Enterprise Execution with Explicit Project & Location
uv run scripts/omni.py \
  --vertexai \
  --project "$GOOGLE_CLOUD_PROJECT" \
  --location "us-central1" \
  --model "gemini-omni-flash-1.2" \
  --voice "Puck" \
  --prompt "Cheerful shopkeeper greeting: Welcome, traveler! Take a look at my rare potions." \
  --output "./assets/audio/shopkeeper_hello.wav"

# 4. Conversational Video Generation via scripts/omni.py (--mode video)
uv run scripts/omni.py \
  --mode video \
  --model "gemini-omni-flash-1.2-preview" \
  --resolution "1080p" \
  --aspect-ratio "16:9" \
  --duration "10s" \
  --prompt "A slow camera move through a sunlit woodworking workshop, sawdust floating in warm lightbeams, soft acoustic guitar background music" \
  --output "./assets/video/workshop.mp4"

# 5. Offline Validation (--dry-run, zero network calls)
uv run scripts/omni.py \
  --model "flash-1.2" \
  --speaker "Alice=Kore" \
  --speaker "Bob=Puck" \
  --prompt "Alice: Ready? Bob: Always." \
  --output "test.wav" \
  --dry-run
```

---

### 2. CLI Execution via `gemini-api tts` & `gemini-api video`

Use `gemini-api tts` for quick terminal speech synthesis and `gemini-api video` for Interactions API video generation, multi-reference synthesis, and stateful multi-turn video editing:

```bash
# 1. Single-Speaker & Multi-Speaker TTS via gemini-api tts
gemini-api tts "Welcome to the arena, challenger!" --voice "Fenrir" --out "./assets/audio/announcer.wav"
gemini-api tts "Alice: Systems green. Bob: Launching now." --multi-speaker "Alice=Kore,Bob=Puck" --out "./assets/audio/launch.wav"

# 2. Text-to-Video (1080p landscape with native synchronized audio)
gemini-api video \
  "A slow camera move through a sunlit woodworking workshop, sawdust floating in warm lightbeams, soft acoustic guitar background music and gentle chiseling sounds" \
  --resolution "1080p" \
  --aspect-ratio "16:9" \
  --out "./assets/workshop.mp4"

# 3. Custom Duration (5s clip at 4K resolution via --body response_format)
gemini-api video \
  "Macro shot of rain droplets hitting a neon-lit puddle in slow motion, crisp water splash sound effects" \
  --resolution "4k" \
  --aspect-ratio "16:9" \
  --body '{"response_format":{"type":"video","duration":"5s","resolution":"4k","aspect_ratio":"16:9"}}' \
  --poll-timeout 15m \
  --out "./assets/rain_4k.mp4"

# 4. First-Frame-to-Video (animate a starting image)
gemini-api video \
  "<FIRST_FRAME> The camera slowly pushes in as the character looks up from the desk and smiles warmly. Use this image as the starting frame." \
  -i "start_frame.jpg" \
  --resolution "1080p" \
  --out "./assets/animated_intro.mp4"

# 5. First-and-Last-Frame Interpolation
gemini-api video \
  "<FIRST_FRAME> <LAST_FRAME> A smooth cinematic transition from a lush green forest at sunrise to a snowy forest under a starry night sky." \
  -i "forest_sunrise.jpg" \
  -i "forest_winter.jpg" \
  --resolution "1080p" \
  --out "./assets/season_transition.mp4"

# 6. Seamless Looping Video (same image bound as both first and last frame)
gemini-api video \
  "[# Sources <FIRST_FRAME>@Image1 <LAST_FRAME>@Image1] Cozy pixel-art campfire crackling gently in the wind at night. Use this image as the first frame and the last frame." \
  -i "campfire.png" \
  --resolution "720p" \
  --out "./assets/campfire_loop.mp4"

# 7. Multi-Reference Generation (combine character, object, and style anchors)
gemini-api video \
  "[# References <IMAGE_REF_0>@Image1 <IMAGE_REF_1>@Image2] In the ink painting style of <IMAGE_REF_0>, the character shown in <IMAGE_REF_1> walks across a misty wooden bridge. Use the given images as references for video generation. The images should not be used as literal initial frames." \
  -i "ink_style.png" \
  -i "character_sheet.png" \
  --resolution "1080p" \
  --out "./assets/bridge_scene.mp4"

# 8. Stateful Multi-Turn Video Editing & Extension (--previous-interaction-id)
TURN1_ID=$(gemini-api video \
  "A violinist performing outdoors in an autumn park, expressive solo violin melody" \
  --resolution "720p" \
  --out "violin_v1.mp4" \
  --jq '.response_id')

# Edit the generated video while preserving unmentioned elements
gemini-api video \
  "Change the autumn trees to blooming cherry blossoms in spring. Keep everything else the same." \
  --previous-interaction-id "$TURN1_ID" \
  --out "violin_spring.mp4"

# Extend the video by +10 seconds
gemini-api video \
  "Extend this video: the camera pans up to reveal a stone pavilion as the violin melody builds into a crescendo." \
  --previous-interaction-id "$TURN1_ID" \
  --out "violin_extended.mp4"
```

---

### 3. Pre-Processing & Audio Replacement Rules (`ffmpeg`)

When resampling voice lines for Ebitengine or editing existing local video files (`-i source.mp4`), apply these deterministic `ffmpeg` rules:

1. **Resample 24 kHz Mono Voice WAVs to 44.1 kHz Stereo for Ebitengine**:
   ```bash
   ffmpeg -y -i ./assets/audio/tactical_alert.wav -ar 44100 -ac 2 -c:a pcm_s16le ./assets/audio/tactical_alert_44k.wav
   ```
2. **Preserve vs. Regenerate Video Audio (`ffmpeg -an`)**:
   - By default, Gemini Omni preserves the original audio of an input video during edits unless you explicitly prompt for audio changes.
   - To force the model to **synthesize a brand-new audio track from scratch** matching your visual edits, strip the audio stream before passing `-i`:
     ```bash
     ffmpeg -y -i source.mp4 -c:v copy -an source_silent.mp4
     gemini-api video \
       "[# Sources <VIDEO_0>@Video1] Transform the daytime street into a rainy cyberpunk night with neon reflections, heavy rain sound effects, distant thunder, and synth ambient music. Keep everything else the same." \
       -i "source_silent.mp4" \
       --out "cyberpunk_edit.mp4"
     ```
3. **Optimize Oversized Source Videos**:
   - Trim source videos for editing to `<=10s` and downscale to `<=1080p` before uploading. Keep `<VIDEO_REF_N>` reference clips around `3 seconds` (at most 3 video references per request).

---

### 4. Prompt Role Tags & Multi-Input Binding

When passing multiple images or videos via `-i` or the Interactions API `input` list, bind each media item to its exact role using inline tags or explicit header declarations:

| Role Tag / Header | Purpose | Example Prompt Snippet |
| :--- | :--- | :--- |
| `<FIRST_FRAME>` | Use image as the literal starting frame | `<FIRST_FRAME> A woman walks through a sunlit courtyard. Use this image as the starting frame.` |
| `<FIRST_FRAME> <LAST_FRAME>` | Interpolate smoothly from Image 1 to Image 2 | `<FIRST_FRAME> <LAST_FRAME> Smooth camera pan transitioning from dawn to dusk.` |
| `<IMAGE_REF_0>`, `<IMAGE_REF_1>` | Bind images as character, object, or style references (0-indexed) | `In the watercolor style of <IMAGE_REF_0>, the fox in <IMAGE_REF_1> leaps over a stream.` |
| `<VIDEO_REF_0>` | Bind an input video (~3s) as a motion/character reference (0-indexed) | `The person in <VIDEO_REF_0> is playing the violin on stage.` |
| `[# Sources <FIRST_FRAME>@Image1 <LAST_FRAME>@Image1]` | Loop a single image as both first and last frame | `[# Sources <FIRST_FRAME>@Image1 <LAST_FRAME>@Image1] Gentle ocean waves lapping at the shore. Use this image as the first frame and the last frame.` |
| `[# Sources <FIRST_FRAME>@Image1] [# References <IMAGE_REF_0>@Image2]` | Combine a literal starting frame with a reference image | `[# Sources <FIRST_FRAME>@Image1] [# References <IMAGE_REF_0>@Image2] The character <IMAGE_REF_0> enters the room. Use Image1 as the starting frame. Use Image2 as a reference for video generation.` |

---

### 5. SDK Integration Patterns (Application Backends)

For production services in Python, use `client.models.generate_content` with `SpeechConfig` for speech synthesis and `client.interactions.create` for conversational video generation:

```python
import base64
from google import genai
from google.genai import types
from scripts.omni import wrap_pcm_as_wav

client = genai.Client()

# 1. Single-Speaker Voice Synthesis with Gemini Omni Flash 1.2
speech_res = client.models.generate_content(
    model="gemini-omni-flash-1.2-preview",
    contents="Speak in a calm British accent: All systems are nominal.",
    config=types.GenerateContentConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Kore")
            )
        ),
    ),
)
raw_pcm = speech_res.candidates[0].content.parts[0].inline_data.data
with open("nominal.wav", "wb") as f:
    f.write(wrap_pcm_as_wav(raw_pcm, sample_rate=24000))

# 2. Conversational Video Generation & Multi-Turn Edit
turn1 = client.interactions.create(
    model="gemini-omni-flash-1.2-preview",
    input="A cinematic tracking shot of a rover driving across rust-red Martian dunes at sunset, low rumbling mechanical treads and whistling wind.",
    response_format={
        "type": "video",
        "resolution": "1080p",
        "aspect_ratio": "16:9",
        "duration": "10s",
    },
)

if turn1.output_video and turn1.output_video.data:
    with open("mars_rover.mp4", "wb") as f:
        f.write(base64.b64decode(turn1.output_video.data))
```

---

## Prompting Best Practices
1. **Direct Vocal Delivery & Audio Explicitly**: For speech and dialogue, specify emotion, pacing, accent, and vocal persona directly in the prompt (`"Speak in a hushed, suspenseful tone:"`). For video, specify background music genre, ambient soundscapes, and exact quoted dialogue (`"No dialogue"` when you want instrumental/ambient sound only).
2. **Format Multi-Speaker Scripts Cleanly**: Prefix every turn in a multi-speaker prompt with the exact speaker name bound in `--speaker Name=Voice` (`"Captain: Status report! Engineer: Warp core is stable."`).
3. **Use Timecodes for Multi-Shot Video Sequences**: Structure 10-second video clips with bracketed timestamps (`[0-3s] Wide establishing shot... [3-7s] Cut to medium close-up... [7-10s] Slow pull-back...`).
4. **Surgical Video Edits**: When editing an existing video, end your prompt with `"Keep everything else the same"` to lock background geometry, lighting, and unmentioned subjects.
