---
name: lyria
description: >
  Generate 44.1 kHz stereo music, full songs with lyrics, and instrumental
  game soundtracks from text prompts or reference images using Google Lyria
  models (lyria-3.5, lyria-3-clip-preview, lyria-3-pro-preview) via the
  game-studio MCP music_generate tool. Bakes .wav or .mp3 audio for //go:embed
  playback in Ebitengine.
license: Apache-2.0
metadata:
  category: media
  tags: "music, audio, soundtrack, generative-ai, vertex-ai, gemini-api"
  author: Daniela Petruzalek (daniela@danicat.dev)
  version: "0.6.0"
---

# Lyria music generation (`music_generate`)

Generate 44.1 kHz stereo music, full songs with structured lyrics, and instrumental soundtracks from text prompts or reference images using Google's **Lyria** models (`lyria-3.5`, `lyria-3-clip-preview`, and `lyria-3-pro-preview`) via the **`game-studio` MCP tool `music_generate`**.

> [!CAUTION]
> **Strict fail-fast authentication policy**:
> `music_generate` requires valid **Vertex AI / Gemini Enterprise** Application Default Credentials (`gcloud auth application-default login`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION="global"`, `GOOGLE_GENAI_USE_ENTERPRISE="true"`, or `enterprise: true` with `project` / `location`) OR a **Gemini API key** (`GEMINI_API_KEY` or `GOOGLE_API_KEY`). If `music_generate` fails on credentials or validation, **stop immediately**, report the exact error to the user, and ask them to configure credentials or fix arguments. Never synthesize placeholder audio files or silently switch models.

---

## Trigger conditions

Activate this skill when the user asks to:
- Generate songs, background music, orchestral/vocal soundtracks, or short 30-second audio clips from text prompts.
- Compose musical themes inspired by concept art, illustrations, title screens, or screenshots (up to 10 `inputImages`).
- Create multi-minute structured tracks with verses, choruses, timestamps, and optional lyrics saved via `outLyricsPath`.
- Synthesize clean instrumental tracks (`"Instrumental only, no vocals"`).

---

## `music_generate` MCP tool parameters

Invoke `music_generate` on the `game-studio` MCP server with these exact parameter names:

| Parameter | Type & Required | Valid Values & Rules |
| :--- | :--- | :--- |
| **`prompt`** | `string` (**required**) | Text prompt describing style, genre, instrumentation, BPM, key, and optional timestamp structure or lyrics. |
| **`outPath`** | `string` (**required**) | Output audio file path (`.mp3` or `.wav`). Parent directories are created automatically. |
| **`model`** | `string` | `lyria-3.5` (default, alias `3.5`), `lyria-3-clip-preview` (`lyria-3-clip`, `clip`, `lyria-clip`), `lyria-3-pro-preview` (`lyria-3-pro`, `pro`, `lyria-pro`). Rejects retired `lyria-002` and `lyria-realtime-exp`. |
| **`format`** | `string` | `mp3` or `wav`. Inferred from `outPath` extension when omitted (`wav` if `.wav`, else `mp3`). Extension mismatches fail fast. **`wav` requires `model: "lyria-3.5"` AND `apiMode: "interactions"`**. |
| **`apiMode`** | `string` | `interactions` (default) or `models`. |
| **`inputImages`** | `[]string` | Up to 10 local reference image paths (`.png`, `.jpg`, `.jpeg`, `.webp`, `.heic`, `.heif`) for image-to-music mood guidance. |
| **`outLyricsPath`** | `string` | Optional file path to save returned lyrics and arrangement structure text. |
| **`enterprise`** | `bool` | Force Vertex AI / Gemini Enterprise Application Default Credentials. |
| **`project`** | `string` | Google Cloud Project ID for Vertex AI / Gemini Enterprise (overrides `GOOGLE_CLOUD_PROJECT`). |
| **`location`** | `string` | Google Cloud location for Vertex AI / Gemini Enterprise (defaults to `global`). |

---

## Model selection and comparison matrix

| Model | Model ID | Aliases | Primary Use Case | Duration | Audio Format | Reference Guide |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Lyria 3.5 (Default)** | `lyria-3.5` | `lyria-3.5`, `3.5` | Flagship: full songs, expressive vocals, multi-section arrangements, game/film scoring | Controllable (up to about 3 minutes) | MP3, WAV (`interactions`) | [lyria-3-5.md](references/lyria-3-5.md) |
| **Lyria 3 Clip** | `lyria-3-clip-preview` | `lyria-3-clip`, `clip`, `lyria-clip` | Short 30-second clips, ambient beds, rapid style prototyping | Fixed 30 seconds | MP3 only | [lyria-3-clip.md](references/lyria-3-clip.md) |
| **Lyria 3 Pro** | `lyria-3-pro-preview` | `lyria-3-pro`, `pro`, `lyria-pro` | Full-length preview endpoint with explicit timestamp controls | Up to 184 seconds | MP3 only | [lyria-3-pro.md](references/lyria-3-pro.md) |

### Format rules and fail-fast policy
- **Full song and WAV production**: Use **`lyria-3.5`** (default) with `apiMode: "interactions"` whenever you need uncompressed `.wav` output (`format: "wav"` or `.wav` extension on `outPath`).
- **MP3-only preview models**: `lyria-3-clip-preview` (30s) and `lyria-3-pro-preview` (up to 184s) output MP3 only. Requesting `.wav` on those models or with `apiMode: "models"` fails fast.
- **Zero silent fallbacks**: `music_generate` never swaps models or falls back across providers. Missing credentials, retired models (`lyria-002`, `lyria-realtime-exp`), extension/format mismatches, unsupported image extensions, or more than 10 `inputImages` return a clear error immediately.

---

## Deep technical references

Consult the reference cards in `references/` for model limits, timing controls, and optional application-backend SDK examples:

- **[references/lyria-3-5.md](references/lyria-3-5.md)**: Flagship specifications for multi-minute songs, WAV/MP3 output, vocals, and section timestamps (`lyria-3.5`).
- **[references/lyria-3-clip.md](references/lyria-3-clip.md)**: Specifications for 30-second MP3 clips and fast style iteration (`lyria-3-clip-preview`).
- **[references/lyria-3-pro.md](references/lyria-3-pro.md)**: Specifications for the full-length preview endpoint (`lyria-3-pro-preview`).
- **[references/README.md](references/README.md)**: Musical composition prompt reference and index.

---

## Core MCP workflows

### 1. Uncompressed `.wav` game soundtrack via `lyria-3.5` (Vertex AI / Enterprise)

```json
{
  "tool": "music_generate",
  "arguments": {
    "prompt": "Atmospheric synthwave exploration theme at 110 BPM in D minor with warm analog pads and clean low-end. Instrumental only, no vocals.",
    "outPath": "internal/assets/music/stage_theme.wav",
    "model": "lyria-3.5",
    "format": "wav",
    "apiMode": "interactions",
    "enterprise": true,
    "project": "your-gcp-project-id",
    "location": "global"
  }
}
```

### 2. Full song with lyrics saved via `outLyricsPath`

```json
{
  "tool": "music_generate",
  "arguments": {
    "prompt": "An energetic indie rock title theme with driving drums and soaring vocals at 128 BPM in G Major",
    "outPath": "internal/assets/music/title_anthem.mp3",
    "model": "lyria-3.5",
    "outLyricsPath": "assets/music/title_anthem_lyrics.txt"
  }
}
```

### 3. Short 30-second prototype clip (`lyria-3-clip-preview`)

```json
{
  "tool": "music_generate",
  "arguments": {
    "prompt": "An energetic 8-bit chiptune arcade melody at 140 BPM in C major. Instrumental only, no vocals.",
    "outPath": "assets/music/chiptune_proto.mp3",
    "model": "lyria-3-clip-preview"
  }
}
```

### 4. Multimodal image-to-music from concept art (`inputImages`)

```json
{
  "tool": "music_generate",
  "arguments": {
    "prompt": "Ambient relaxing soundscape matching the mood of this landscape. Instrumental only, no vocals.",
    "inputImages": ["assets/art/concept_landscape.png"],
    "outPath": "internal/assets/music/landscape_theme.mp3",
    "model": "lyria-3-pro-preview"
  }
}
```

---

## Baking, `//go:embed`, and Ebitengine integration

Bake final `.wav` or `.mp3` files into `internal/assets/music/` using `music_generate` and embed them into your Go binary via `//go:embed`. Keep two Ebitengine rules in mind:

- **Prefer `.wav` (`lyria-3.5` + `interactions`) for gapless loops**: MP3 encoding introduces priming padding (`~1,152` samples) that can click at loop seams, whereas `.wav` decodes cleanly for sample-exact `audio.NewInfiniteLoop`. Reserve `.mp3` for title themes, one-off boss intros, or endings (or trim decoded PCM before looping).
- **Enforce 4-byte PCM alignment (`&^ 3`)**: Share a single `44100` Hz `*audio.Context`, decode embedded `.wav` (`ebiten/v2/audio/wav`) or `.mp3` (`ebiten/v2/audio/mp3`) once at `Boot`, and mask byte lengths and seek offsets with `&^ 3`:

```go
//go:embed assets/music/stage_theme.wav
var stageThemeWAV []byte

// Decode once at Boot, align length to 4-byte stereo frame boundary (&^ 3)
stream, err := wav.DecodeWithSampleRate(audioCtx.SampleRate(), bytes.NewReader(stageThemeWAV))
if err != nil {
	return fmt.Errorf("audio: decode stage_theme.wav: %w", err)
}
pcm, err := io.ReadAll(stream)
if err != nil {
	return fmt.Errorf("audio: read stage_theme PCM: %w", err)
}
aligned := int64(len(pcm)) &^ 3
loop := audio.NewInfiniteLoop(bytes.NewReader(pcm[:aligned]), aligned)
player, err := audioCtx.NewPlayer(loop)
```

---

## Prompting best practices

1. **Genre and subgenre**: Name the style explicitly (`synthwave`, `delta blues`, `chamber orchestra`, `lo-fi hip-hop`, `symphonic metal`).
2. **Instrumentation and mix space**: Specify lead and rhythm instruments (`Fender Rhodes`, `TR-808 drums`, `nylon-string guitar`, `cello section`). For gameplay beds, ask for warm or sparse textures so `procedural-sfx` cues stay clear.
3. **Tempo and key**: Include BPM and musical key (`120 BPM`, `in A Minor`) to keep tracks consistent with scene pacing.
4. **Vocal control**: Add `"Instrumental only, no vocals"` when you want a clean backing track, or provide bracketed section lyrics (`[Verse]`, `[Chorus]`) for songs with singing.
5. **Timestamp arrangements**: For `lyria-3.5` and `lyria-3-pro-preview`, use bracketed timestamps (`[0:00 - 0:15] Intro`, `[0:15 - 1:30] Main theme`) to structure section transitions.
