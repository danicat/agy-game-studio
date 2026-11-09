# Gemini Omni Flash 1.2 (`gemini-omni-flash-1.2-preview` / `gemini-omni-flash-1.2`) Technical Reference

**Gemini Omni Flash 1.2** (`gemini-omni-flash-1.2-preview` and `gemini-omni-flash-1.2`) is Google's next-generation multimodal foundation model for expressive single-speaker text-to-speech (TTS), multi-speaker dialogue synthesis, character voice acting, and high-coherence conversational video generation and editing.

---

## 1. Technical Specifications

| Property | Value |
| :--- | :--- |
| **Primary Model IDs** | `gemini-omni-flash-1.2-preview` (default in `scripts/omni.py`), `gemini-omni-flash-1.2` |
| **CLI Aliases (`scripts/omni.py`)** | `omni-flash-1.2`, `flash-1.2`, `1.2`, `gemini-omni-1.2-flash`, `omni-1.2` |
| **Companion Models** | `gemini-omni-1.1-flash` (`gemini-omni-1.1`), `gemini-omni-flash-1.1-preview`, `gemini-3.8-flash-tts`, `gemini-3.1-flash-tts-preview` |
| **Supported Inputs** | Text, Image (`image/jpeg`, `image/png`, `image/webp`), Audio, Video (`video/mp4`) |
| **Speech & Dialogue Output** | `AUDIO` modality (`24,000 Hz`, 16-bit mono linear PCM wrapped in standard RIFF `.wav`) |
| **Prebuilt Voices** | `Kore`, `Puck`, `Zephyr`, `Charon`, `Fenrir`, `Aoede`, `Leda`, `Orus`, `Callirrhoe`, `Autonoe`, `Enceladus`, `Iapetus`, `Umbriel`, `Algieba`, `Despina` |
| **Multi-Speaker Support** | `MultiSpeakerVoiceConfig` with named speaker-to-voice bindings (`--speaker Alice=Kore --speaker Bob=Puck`) |
| **Video Output** | `video/mp4` (`24 FPS`) at `360p`, `720p`, `1080p`, or `4k` in `16:9` or `9:16` (`3s` to `10s`, extendable up to `40s`) |
| **Authentication** | Vertex AI / Gemini Enterprise (ADC + `GOOGLE_CLOUD_PROJECT`) and Gemini Developer API (`GEMINI_API_KEY`) |
| **Watermarking** | Invisible SynthID watermark embedded in generated audio and video streams |

---

## 2. Vertex AI / Gemini Enterprise vs. Gemini Developer API Authentication

`scripts/omni.py` supports first-class authentication for both enterprise Google Cloud environments and standalone developer keys:

### Option A: Vertex AI / Gemini Enterprise (Application Default Credentials)
```bash
gcloud auth application-default login
export GOOGLE_CLOUD_PROJECT="your-gcp-project-id"
export GOOGLE_CLOUD_LOCATION="us-central1"
export GOOGLE_GENAI_USE_VERTEXAI="true"

# Run with environment variables or explicit CLI flags:
uv run scripts/omni.py \
  --vertexai \
  --project "your-gcp-project-id" \
  --location "us-central1" \
  --model "gemini-omni-flash-1.2-preview" \
  --voice "Kore" \
  --prompt "Say in a calm, heroic voice: All orbital relays are synchronized." \
  --output "relay_status.wav"
```

### Option B: Gemini Developer API (`GEMINI_API_KEY`)
```bash
export GEMINI_API_KEY="your-api-key"

uv run scripts/omni.py \
  --model "omni-flash-1.2" \
  --voice "Fenrir" \
  --prompt "Say in a gravelly dungeon boss voice: You dare enter the obsidian vault?" \
  --output "boss_intro.wav"
```

> [!CAUTION]
> **Fail-Fast Authentication Rule**:
> If credentials are missing or invalid, `scripts/omni.py` exits immediately with code `1` and prints remediation steps. Calling agents must **never** attempt rogue workarounds, synthesize placeholder audio buffers, or silently substitute procedural beeps when the user specifically requested Gemini Omni voice or video generation.

---

## 3. Single-Speaker Voice Acting & Multi-Speaker Dialogue Recipes

### Expressive Character Voice Acting (`--voice`)
Direct vocal persona, pacing, emotion, and accent inside the prompt text while selecting a prebuilt base voice:

```bash
uv run scripts/omni.py \
  --model "gemini-omni-flash-1.2-preview" \
  --voice "Aoede" \
  --language "en-US" \
  --prompt "Speak in a warm, mysterious storyteller cadence with a slight whisper: Long before the stars went silent, the clockwork citadel drifted above the sea of clouds." \
  --output "./assets/audio/narrator_opening.wav"
```

### Multi-Speaker Cutscene Dialogue (`--speaker Name=Voice`)
Format the prompt as a script where each line starts with `SpeakerName:` matching the `--speaker` flags:

```bash
uv run scripts/omni.py \
  --model "gemini-omni-flash-1.2-preview" \
  --speaker "Pilot=Zephyr" \
  --speaker "Commander=Charon" \
  --prompt "Pilot: Radar contact bearing two-seven-zero! Commander: Hold your fire until we confirm their transponder code." \
  --output "./assets/audio/bridge_cutscene.wav"
```

---

## 4. Python SDK (`google-genai`) Patterns for Gemini Omni Flash 1.2

### Single-Speaker & Multi-Speaker Speech with RIFF WAV Wrapping
```python
import io
import os
import wave
from google import genai
from google.genai import types


def wrap_pcm_as_wav(pcm_bytes: bytes, sample_rate: int = 24000) -> bytes:
    if pcm_bytes[:4] == b"RIFF" and pcm_bytes[8:12] == b"WAVE":
        return pcm_bytes
    aligned = pcm_bytes[: len(pcm_bytes) - (len(pcm_bytes) % 2)]
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(aligned)
    return buf.getvalue()


# Initialize for Vertex AI (when GOOGLE_GENAI_USE_VERTEXAI=true) or Gemini Developer API
client = genai.Client()

response = client.models.generate_content(
    model="gemini-omni-flash-1.2-preview",
    contents="Archivist: The ancient seal is broken. Scout: Then we move at dawn.",
    config=types.GenerateContentConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            multi_speaker_voice_config=types.MultiSpeakerVoiceConfig(
                speaker_voice_configs=[
                    types.SpeakerVoiceConfig(
                        speaker="Archivist",
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Kore")
                        ),
                    ),
                    types.SpeakerVoiceConfig(
                        speaker="Scout",
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Puck")
                        ),
                    ),
                ]
            )
        ),
    ),
)

raw_audio = response.candidates[0].content.parts[0].inline_data.data
wav_data = wrap_pcm_as_wav(raw_audio, sample_rate=24000)
with open("cutscene_dialogue.wav", "wb") as f:
    f.write(wav_data)
```

---

## 5. Ebitengine (`ebitengineer`) 2D Game Audio Integration

Gemini Omni TTS outputs `24,000 Hz` 16-bit mono WAV files, whereas Ebitengine games typically run a single shared `audio.Context` at `44,100 Hz` stereo (16-bit signed little-endian PCM, 4 bytes per stereo frame).

To integrate generated voice lines into an Ebitengine game cleanly:
1. **Resample to 44.1 kHz Stereo Offline (`ffmpeg`) or Decode & Resample at Asset Load**:
   ```bash
   ffmpeg -y -i narrator_opening.wav -ar 44100 -ac 2 -c:a pcm_s16le narrator_opening_44k_stereo.wav
   ```
2. **Enforce 4-Byte Frame Alignment (`&^ 3`)**:
   When decoding `.wav` streams with `wav.DecodeWithSampleRate(44100, r)` or slicing byte buffers in Go, always align the byte length to a multiple of 4 (`alignedLen := len(pcm) &^ 3`) before creating Ebitengine players or loops.
