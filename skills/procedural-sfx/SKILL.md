---
name: procedural-sfx
description: >
  Pure-code procedural game sound effect (SFX) design and synthesis via the
  game-studio MCP server (.sfx DSL). Uses sound_presets and sfx_synthesize
  with PolyBLEP anti-aliasing, 18 archetype presets, duty and SVF filter
  sweeps, Galois LFSR chiptune noise, 2-op FM, and acoustic QA validation to
  bake 4-byte aligned 16-bit 44.1 kHz stereo .wav cues for //go:embed in
  Ebitengine.
license: Apache-2.0
metadata:
  category: game-dev
  tags: "sfx, audio, dsp, synthesis, chiptune, ebitengine"
  author: Daniela Petruzalek (daniela@danicat.dev)
  version: "0.4.0"
---

# Procedural sound effects: SFX DSL and MCP synthesis

`procedural-sfx` turns plain-text `.sfx` scripts into `44.1 kHz`, 16-bit signed little-endian stereo `.wav` sound cues via the **`game-studio` MCP server**, ready to embed directly into Go Ebitengine games with `//go:embed`.

- **Complete `.sfx` DSL grammar and 18-preset reference**: [`references/sfx_dsl.md`](references/sfx_dsl.md)

---

## Companion skills

| Skill | Role in the audio pipeline |
| :--- | :--- |
| **`procedural-music`** | Multi-track background music (`.music` DSL) sharing the single `44.1 kHz` Ebitengine `audio.Context`. Keeping BGM bass below `260 Hz` leaves mid and high headroom for SFX. |
| **`lyria`** | Pair `procedural-sfx` for fast, predictable gameplay cues (lasers, hits, jumps, UI ticks) with `lyria` (`music_generate`) when a game calls for AI studio soundtracks. |
| **`game-design` and `vibe-game-developer`** | Map each player verb, hitstop, screen shake, and UI transition to a distinct sound silhouette so actions feel physical without muddying the mix. |
| **`ebitengineer`** | Embed baked `.wav` cues via `//go:embed`, decode to **4-byte aligned** stereo PCM (`len(pcm) &^ 3`) during `Boot`, and enforce per-cue cooldowns inside `Update()`. |

---

## Bundled `game-studio` MCP SFX tools

Run preset discovery, synthesis, acoustic QA validation, and `.wav` export directly through the `game-studio` MCP server (no external scripts needed):

| MCP Tool | Arguments | Purpose |
| :--- | :--- | :--- |
| **`sound_presets`** | *(none)* | Lists all 18 built-in SFX archetype presets (`sfxPresets`) with their exact waveform, sweep, filter, ADSR, and gain defaults. |
| **`sfx_synthesize`** | `dsl`, `filePath`, `outWavPath` | Compiles inline `.sfx` `dsl` (or `filePath` on disk when `dsl` is omitted), runs acoustic QA validation, and writes a 16-bit 44.1 kHz stereo WAV file when `outWavPath` is provided. |

### Example MCP workflow

1. Call `sound_presets` to inspect exact parameters for the 18 built-in archetypes.
2. Call `sfx_synthesize` to validate and bake a `.sfx` cue to `internal/assets/sfx/explosion.wav`:

```json
{
  "tool": "sfx_synthesize",
  "arguments": {
    "dsl": "title \"Deep Cinematic Explosion\"\ntype sfx\ninst transient wave=noise noise_filter=0.90 vol=0.32 adsr=0.001,0.04,0.00,0.04 hpf=800\ninst rumble preset=explosion_deep vol=0.40 adsr=0.005,0.25,0.25,0.55\ntrack punch transient: transient:80ms R:720ms\ntrack boom rumble: 120Hz->20Hz:800ms\n",
    "outWavPath": "internal/assets/sfx/explosion.wav"
  }
}
```

Check `passed`, `durationSec`, `peakDBFS`, `rmsDBFS`, `dcOffset`, `boundaryClean`, and `issues` in the returned `SynthReport`.

---

## Core DSP architecture

1. **PolyBLEP anti-aliasing**: Applies polynomial band-limited step correction around phase wraps and pulse-width transitions on `square` and `sawtooth` waves so high pitches avoid aliasing buzz above Nyquist (`22,050 Hz`).
2. **16-bit Galois LFSR noise (`wave=psg_noise`)**: Uses maximal-period taps (`x^16 + x^14 + x^13 + x^11 + 1`) clocked from target pitch for classic console explosions and metallic textures.
3. **Dynamic Chamberlin SVF filters (`lpf`, `hpf`, `q`)**: Interpolates cutoff frequency per sample (`lpf=3500->400 q=2.2`) for organic energy blasts and filtered booms.
4. **Pulse-width sweeps (`duty=start->end`)**: Sweeps duty cycle (`0.50 -> 0.125`) across a note for animated lasers and synth tones.
5. **Pitch trajectories (`curve=exp|lin|hyper`)**: `exp` sweeps musical intervals cleanly for lasers and jumps; `lin` drives crisp UI ticks; `hyper` snaps rapidly from transient to bass body for punches.
6. **Dynamic 2-operator FM (`fm`, `mod_ratio`, `mod_freq`, `mod_index`)**: Produces coins, crystals, and inharmonic sword clangs (`mod_ratio=2.76` or `mod_freq=620Hz`).
7. **$C^1$ smooth soft-clipping**: Passes amplitude up to `0.75` linearly and compresses peaks toward `1.0` (`0 dBFS`) so multi-track stacks never wrap or clip harsh edges.
8. **Anti-click boundary fades**: Applies a `44`-frame (`~1ms`) raised-cosine fade-in from zero and fade-out to zero on every cue.

---

## Quick-start `.sfx` DSL syntax

Layer synchronized `track` stems starting at `t = 0`, chain inline `seq` events, or trigger single-line `step` cues. See [`references/sfx_dsl.md`](references/sfx_dsl.md) for all attributes and the 18 built-in `preset=` options.

```text
title "Deep Cinematic Explosion"
type sfx

inst transient wave=noise noise_filter=0.90 vol=0.32 adsr=0.001,0.04,0.00,0.04 hpf=800
inst rumble    preset=explosion_deep vol=0.40 adsr=0.005,0.25,0.25,0.55

track punch transient: transient:80ms R:720ms
track boom  rumble:    120Hz->20Hz:800ms
```

- Single-channel sequences: `seq: laser(950Hz->120Hz):150ms R:100ms | coin(B5):70ms coin(E6):220ms`
- One-line cues: `step preset=arcade_laser dur=140ms`
- Built-in presets (`preset=`): `arcade_laser`, `plasma_gun`, `explosion_arcade`, `explosion_deep`, `coin_pickup`, `gem_shimmer`, `jump_arcade`, `jump_spring`, `sword_clash`, `shield_deflect`, `hit_punch`, `hit_damage`, `powerup_fanfare`, `ui_select`, `ui_confirm`, `ui_error`, `footstep_stone`, `engine_thruster`.

---

## Acoustic envelope and multi-layer sound design

Convincing impacts model three distinct physical stages:

```text
Amplitude
  1.0 |    /\   <- 1. Transient (1 to 15 ms: sharp high-frequency snap)
      |   /  \
  0.5 |  /    \______  <- 2. Body (15 to 150 ms: pitch sweep & fundamental weight)
      | /            \________
  0.0 +-----------------------\---> Time (ms)
                               '-> 3. Tail (150 to 600 ms: filtered decay & ring)
```

1. **Transient (`1ms` to `15ms`)**: Initial crack or spark using fast attack (`0.001` to `0.004` sec) and high-passed noise (`hpf=800` to `2200`) or bright FM modulation so cues cut through background music.
2. **Body (`15ms` to `150ms`)**: Core pitch drop carrying mass (`curve=hyper` for impacts, `curve=exp` for lasers and jumps).
3. **Tail (`150ms` to `600ms`)**: Room decay (`lpf=1200->150`, `mod_index=5.5->0.2`) settling cleanly to silence.

---

## Production validation (`sfx_synthesize`)

Every `.sfx` cue returned by `sfx_synthesize` must pass `passed: true`:

- **Duration**: `10ms` (`0.01s`) to `5.0s`.
- **Non-silent energy**: Peak above `-60 dBFS` and RMS above `-70 dBFS`.
- **True peak headroom**: At or below `-0.1 dBFS` (`0.988` linear).
- **DC offset**: Mean bias within `+/-0.05` (`5%`) per channel.
- **Click-free edges (`boundaryClean: true`)**: First and last stereo frames within `+/-300` (`16-bit PCM`).

---

## Baking, `//go:embed`, and zero-allocation Ebitengine playback

Save your `.sfx` source script alongside the game and bake the final `.wav` cue via `sfx_synthesize` (`outWavPath`) into `internal/assets/sfx/`. Embed the baked `.wav` via `//go:embed`, decode it once during `Boot` into a **4-byte aligned** stereo PCM buffer (`len(pcm) &^ 3`), and enforce per-cue cooldowns (`30ms` to `60ms`) in `Update()`:

```go
package audio

import (
	"bytes"
	_ "embed"
	"fmt"
	"io"
	"time"

	ebitaudio "github.com/hajimehoshi/ebiten/v2/audio"
	"github.com/hajimehoshi/ebiten/v2/audio/wav"
)

//go:embed assets/sfx/laser.wav
var laserWAV []byte

type SoundManager struct {
	audioCtx *ebitaudio.Context
	sounds   map[string][]byte
	lastPlay map[string]time.Time
}

func DecodeEmbeddedWAV(audioCtx *ebitaudio.Context, wavBytes []byte, label string) ([]byte, error) {
	stream, err := wav.DecodeWithSampleRate(audioCtx.SampleRate(), bytes.NewReader(wavBytes))
	if err != nil {
		return nil, fmt.Errorf("sfx: decode WAV %s: %w", label, err)
	}
	pcm, err := io.ReadAll(stream)
	if err != nil {
		return nil, fmt.Errorf("sfx: read PCM %s: %w", label, err)
	}
	aligned := len(pcm) &^ 3
	if aligned < 4 {
		return nil, fmt.Errorf("sfx: %s produced empty aligned PCM", label)
	}
	return pcm[:aligned], nil
}

func NewSoundManager(audioCtx *ebitaudio.Context) (*SoundManager, error) {
	if audioCtx == nil {
		return nil, fmt.Errorf("sfx: nil audio.Context")
	}
	laserPCM, err := DecodeEmbeddedWAV(audioCtx, laserWAV, "laser.wav")
	if err != nil {
		return nil, err
	}
	return &SoundManager{
		audioCtx: audioCtx,
		sounds:   map[string][]byte{"laser": laserPCM},
		lastPlay: make(map[string]time.Time, 8),
	}, nil
}

func (sm *SoundManager) PlaySFX(name string, cooldown time.Duration) error {
	pcm, ok := sm.sounds[name]
	if !ok {
		return fmt.Errorf("sfx: unknown cue %q", name)
	}
	now := time.Now()
	if last, exists := sm.lastPlay[name]; exists && now.Sub(last) < cooldown {
		return nil
	}
	sm.lastPlay[name] = now
	player := sm.audioCtx.NewPlayerFromBytes(pcm[:len(pcm)&^3])
	player.Play()
	return nil
}
```
