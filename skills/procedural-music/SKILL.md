---
name: procedural-music
description: >
  Pure-code procedural music composition guide and .music DSL using the
  game-studio MCP server. Uses sound_presets, music_validate, and
  music_synthesize (SEGA Mega Drive YM2612 4-op FM + PolyBLEP SN76489 PSG or
  macOS CoreAudio apple: true) to bake sample-exact 4-byte aligned 44.1 kHz
  stereo .wav loops for //go:embed in Ebitengine.
license: Apache-2.0
metadata:
  category: game-dev
  tags: "bgm, music, ym2612, chiptune, synthesis, ebitengine"
  author: Daniela Petruzalek (daniela@danicat.dev)
  version: "0.4.0"
---

# Procedural music: Original composition guide and dual-engine DSL

`procedural-music` compiles readable `.music` scores into 16-bit `44.1 kHz` stereo `.wav` soundtracks and per-track stems via the **`game-studio` MCP server**, supporting two synthesis engines:

1. **Default pure-Go (`apple: false`, default)**: SEGA Mega Drive **YM2612 (OPN2)** 4-operator FM + band-limited **PolyBLEP SN76489 PSG** + exponential-decay percussion with zero OS dependencies.
2. **Apple Real Instruments (`apple: true` on macOS)**: Native `AudioToolbox` CoreAudio renderer backed by Apple's built-in Roland GS / General MIDI bank (`gs_instruments.dls`).

- **Full `.music` DSL grammar, attributes, and tie syntax**: [`references/dsl_spec.md`](references/dsl_spec.md)
- **Music theory, arranging, and 16-bit study archetypes**: [`references/music_theory_and_arranging.md`](references/music_theory_and_arranging.md)

Compose original soundtracks with bespoke palettes instead of stamping templates:
- Match instrumentation to setting (`8` to `12+` independent channels, `30s` to `150s+` for full BGM loops).
- Tie sustained notes across barlines with `~` (`C3:1~1`, `F5:8~ | :16`) while keeping syncopated stabs crisp with `R:16` release gaps.
- Anchor sub-bass in `C1` to `C2` (`32 Hz` to `130 Hz`) so `50%` to `75%` of spectral energy stays below `260 Hz`.

---

## Companion skills

| Skill | When to pair it with `procedural-music` |
| :--- | :--- |
| **`lyria`** | Choose `procedural-music` for sample-exact gapless `.wav` loops, tiny `5 KB` to `20 KB` `.music` source scores, and 1:1 channel stem mixing. Choose `lyria` (`music_generate`) for AI-generated orchestral, vocal, or recorded ambient soundtracks. |
| **`procedural-sfx`** | Share one `44,100 Hz` `audio.Context` across `.music` loops and `.sfx` cues; keeping BGM bass below `260 Hz` leaves mid and high headroom for SFX. |
| **`vibe-game-developer` & `game-design`** | Assign each scene state (title, stage, boss, fanfare, game over) its own tempo, mode, palette, and looped vs. one-off playback mode. |
| **`ebitengineer`** | Embed baked `.wav` loops via `//go:embed` (`embed.FS`), decode at boot (never inside `Update()` or `Draw()`), and mask buffer lengths and `Seek()` offsets with `&^ 3`. |

---

## Bundled `game-studio` MCP music tools

Use these three `game-studio` MCP tools for preset inspection, theory validation, and WAV synthesis (no external scripts needed):

| MCP Tool | Arguments | Purpose |
| :--- | :--- | :--- |
| **`sound_presets`** | *(none)* | Returns `musicPresets` (`waveTypes`, `ym2612Presets`, and classical `tempoMarkings`) plus `sfxPresets`. |
| **`music_validate`** | `dsl`, `filePath`, `minChannels` (default `8`), `minDurationSec` (default `30`) | Checks `.music` scores against barline timing, consonance, harmonic voice-leading, channel count, and duration rules. Override `minChannels` / `minDurationSec` for short stingers or fanfares. |
| **`music_synthesize`** | `dsl`, `filePath`, `apple`, `soloTracks`, `muteTracks`, `outWavPath`, `outStemsPath` | Synthesizes inline `dsl` or `filePath` to 16-bit 44.1 kHz stereo WAV (`outWavPath`) and optional packed per-track binary stems (`outStemsPath`), returning acoustic QA metrics (`lowFreqEnergyPct`, `peakDBFS`, `rmsDBFS`, `boundaryClean`, `tracks`, `issues`). |

---

## Core architecture and mix guarantees

- **Dual synthesis and soft-knee limiter**: Cumulative rational-time rounding (`int(math.Round(cursorSec * 44100))`) eliminates beat drift across `:16`, `:8t`, and `:4t` tuplets. A $C^1$-continuous soft limiter compresses multi-track peaks above `85%` full scale without hard clipping.
- **Per-track stem isolation (`1:1` channel rule)**: Give each declared `inst` one dedicated `track` so `soloTracks`, `muteTracks`, and `outStemsPath` isolate every voice cleanly (`vol=0` mutes both melodic and drum channels).
- **Mandatory 4-byte PCM alignment (`&^ 3`)**: Each `44.1 kHz` 16-bit little-endian stereo frame is `4` bytes (`176,400` bytes/sec). Mask buffer lengths and `Seek()` offsets with `&^ 3` (`aligned := len(pcm) &^ 3`) to prevent Ebitengine panics.

---

## Quick-start `.music` DSL and MCP workflow

See [`references/dsl_spec.md`](references/dsl_spec.md) for all waveforms, Italian tempo markings, `~` / `~ |` ties, `(...):dur` groups, and `@` dynamics.

```text
title "Stage 1 - Ruined Spire"
type song
tempo allegro 132
time 4/4

inst lead  wave=ym2612_brass      pan=-0.15
inst bass  wave=ym2612_slap_bass  pan=0.00
inst drums wave=kick              vol=0.28 pan=0.00

pattern p_lead  = E5:2 C5:4 G4:4 | A4:2. G4:4 |
pattern p_bass  = (C2 C2 C3 C2):8*2 | (A1 A1 A2 A1):8*2 |
pattern p_drums = kick:8 hat:8 snare:8 hat:8 kick:8 hat:8 snare:8 (tom_hi*2):16 |

track ch01 lead:  p_lead*2
track ch02 bass:  p_bass*2
track ch03 drums: p_drums*2
```

1. **Discover palettes**: Call `sound_presets` to view all `waveTypes`, `ym2612Presets`, and `tempoMarkings`.
2. **Validate theory and duration**: Save your score (for example `assets/music/stage1.music`) and call `music_validate`:

```json
{
  "tool": "music_validate",
  "arguments": {
    "filePath": "assets/music/stage1.music",
    "minChannels": 8,
    "minDurationSec": 30
  }
}
```

For short fanfares or game-over stingers, pass lower thresholds such as `"minChannels": 6, "minDurationSec": 5`.

3. **Synthesize and bake `.wav` audio**: Call `music_synthesize` to bake the final `.wav` (plus optional `outStemsPath` or `apple: true` on macOS):

```json
{
  "tool": "music_synthesize",
  "arguments": {
    "filePath": "assets/music/stage1.music",
    "outWavPath": "internal/assets/music/stage1.wav"
  }
}
```

Check `passed`, `lowFreqEnergyPct`, `peakDBFS`, `boundaryClean`, and `issues` in the returned `SynthReport`.

---

## Quality checklist for original compositions

Review full voice-leading rules in [`references/music_theory_and_arranging.md`](references/music_theory_and_arranging.md) before finalizing any `.music` score:

1. **Pick a distinct tempo, mode, and palette first** (`70` to `175 BPM`) matched to the scene rather than reusing a template.
2. **Layer `8` to `12+` tracks over `30s` to `150s+`** with a clear macro-form (intro, verse, chorus/climax, bridge/turnaround, fade).
3. **Preserve phrasing continuity**: Tie held notes across barlines (`~` or `~ |`), articulate repeated chord stabs with `R:16`, and verify every bar with `|` barlines.
4. **Anchor `C1` to `C2` bass** so `50%` to `75%` of spectral energy lives under `260 Hz` without stationary noise on drums or leads.
5. **Pass `music_validate`** (`passed: true`) with clean diatonic/modal voice-leading (no sustained minor seconds, flat ninths, or simultaneous `G` vs. `G#`).
6. **Bake to `.wav` and pre-decode at startup** with `&^ 3` aligned lengths and seek offsets.

---

## Baking, `//go:embed`, and sample-exact Ebitengine loops

MP3 encoders insert priming and padding silence (`~1,152` samples) that creates audible pops at loop boundaries. Baking `.music` scores via `music_synthesize` to uncompressed `44.1 kHz` `.wav` files and embedding them via `//go:embed` gives sample-exact gapless loops on both desktop and WebAssembly with zero runtime synth code:

```go
package audio

import (
	"bytes"
	_ "embed"
	"fmt"
	"io"

	ebitaudio "github.com/hajimehoshi/ebiten/v2/audio"
	"github.com/hajimehoshi/ebiten/v2/audio/wav"
)

//go:embed assets/music/stage1.wav
var stage1WAV []byte

type AudioBank struct {
	audioCtx     *ebitaudio.Context
	stage1Player *ebitaudio.Player
}

func NewAudioBank(audioCtx *ebitaudio.Context) (*AudioBank, error) {
	if audioCtx == nil {
		return nil, fmt.Errorf("audio: nil audio.Context")
	}
	stream, err := wav.DecodeWithSampleRate(audioCtx.SampleRate(), bytes.NewReader(stage1WAV))
	if err != nil {
		return nil, fmt.Errorf("audio: decode stage1.wav: %w", err)
	}
	pcm, err := io.ReadAll(stream)
	if err != nil {
		return nil, fmt.Errorf("audio: read stage1.wav PCM: %w", err)
	}
	// Enforce mandatory 4-byte frame alignment (&^ 3)
	alignedLen := int64(len(pcm)) &^ 3
	if alignedLen < 4 {
		return nil, fmt.Errorf("audio: stage1.wav produced empty aligned PCM")
	}
	loopStream := ebitaudio.NewInfiniteLoop(bytes.NewReader(pcm[:alignedLen]), alignedLen)
	player, err := audioCtx.NewPlayer(loopStream)
	if err != nil {
		return nil, fmt.Errorf("audio: create stage1 player: %w", err)
	}
	return &AudioBank{
		audioCtx:     audioCtx,
		stage1Player: player,
	}, nil
}
```

- Pause and rewind (`player.Pause()`, `player.Rewind()`) or step `player.SetVolume()` smoothly across scene transitions, and share the same `audio.Context` with `procedural-sfx` (`PlaySFX` cooldowns `30ms` to `60ms`).
