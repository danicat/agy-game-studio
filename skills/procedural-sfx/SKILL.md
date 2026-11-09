---
name: procedural-sfx
description: >
  Pure-code procedural game sound effect (SFX) design, synthesis engine, and
  SFX DSL for Ebitengine. Synthesizes 4-byte aligned 16-bit 44.1 kHz stereo PCM
  sound cues in memory with PolyBLEP anti-aliasing, 18 built-in archetype presets,
  dynamic duty cycle sweeps, State Variable Filter (SVF) sweeps, 16-bit Galois LFSR
  chiptune noise, dynamic FM sweeps, C1 soft-clipping, anti-click boundary micro-fades,
  and production quality validation.
license: Apache-2.0
metadata:
  category: game-dev
  tags: "audio, sfx, sound-effects, dsp, synthesis, procedural-audio, sfx-dsl, ebiten, gamedev, go, chiptune"
  author: Daniela Petruzalek (daniela@danicat.dev)
  version: "0.3.0"
  catalog: https://skills.danicat.dev
---

# Procedural Sound Effects: SFX DSL and Synthesis Engine Guide

This skill provides an **SFX Composition DSL**, a pure-Go synthesis engine, 18 archetype presets, and an automated production quality validator. It compiles `.sfx` scripts directly into 44.1 kHz, 16-bit signed Little-Endian stereo PCM byte buffers (`[]byte`) in memory.

Sound cues need zero external audio files, load instantly at startup, and add almost nothing to binary size.

---

## Companion Skills and Studio Workflow

`procedural-sfx` works standalone from the command line or alongside the rest of the game development suite:

- **`game-dev-studio` (Sound tab in Game Dev Studio / Sound Editor)**: Whenever you create, edit, or review a `.sfx` file in the IDE, surface a pill in chat to open **Game Dev Studio** with the **Sound tab** (**Sound Editor**) in focus (`[Sound Editor](sidecar://agy-game-studio/studio/sound)` or file-scoped `[laser_arcade.sfx](sidecar://agy-game-studio/studio/sound?file=/abs/path/to/laser_arcade.sfx)`). The Sound Editor provides the standardized **Open File**, **Open Artifact**, **Save**, and **Export** menu (scoped to `.sfx` when `SFX` mode is selected, with `.wav` reserved for **Export**), action buttons to toggle **GUI** vs. **Text** mode and **Wave** vs. **Spectrum** (`< 260 Hz` FFT) visualizers, WebAudio auditioning, per-track solo/mute controls, a production scorecard, and `.wav` export. In headless or CLI sessions, run the Go CLI commands in `scripts/` directly without the side panel.
- **`procedural-music`**: Companion skill for multi-track background music (`.music` DSL). While both compile to 44.1 kHz 16-bit stereo PCM, `.sfx` and `.music` are distinct DSLs kept strictly separated by the `Song` (`.music`) and `SFX` (`.sfx`) mode toggle in the Sound Editor: `.sfx` focuses on 18 SFX archetypes, dynamic SVF filter sweeps, pitch curves (`exp`, `lin`, `hyper`), and Galois LFSR noise, whereas `.music` focuses on multi-bar MML/tracker patterns, 1:1 instrument-to-channel mixing, and dual YM2612 FM or macOS CoreAudio `gs_instruments.dls` synthesis.
- **`lyria`**: Use `procedural-sfx` for low-latency, deterministic gameplay cues (lasers, hits, jumps, UI ticks) while pairing with `lyria` when a project requests AI-generated musical stems or ambient beds via Google DeepMind Lyria 3.
- **`game-design` and `vibe-game-developer`**: Map every player verb, combat hitstop, screen shake, and UI state transition to a distinct acoustic silhouette. Layer transient snap, pitch-swept body, and filtered tail so actions feel physical without muddying the mix.
- **`ebitengineer`**: Pre-compile `.sfx` scripts into `[]byte` buffers once during initialization, mask buffer lengths and seek offsets with `&^ 3` for 4-byte stereo frame alignment, and enforce per-cue cooldowns inside the 60 TPS `Update()` loop.

---

## Available Scripts and Curated SFX Library

- `scripts/sound.go`: Complete DSL lexer, parser (`ParseDSL`, `CompileDSL`, `LoadDSLFile`), preset dictionary (`GetSFXPreset`, `ListSFXPresets`), synthesis engine (`SynthesizeScore`), DSP post-filters, production validator (`ValidateProductionSFX`, `ValidateScore`), and WAV exporter (`ExportWAV`).
- `scripts/play.go`: CLI runner supporting real-time playback (`play`, `demo`), quality auditing (`validate`), preset listing (`presets`, `presets-json`), Sound Editor JSON synthesis (`synth-json`), and WAV export (`export`).
- `scripts/sound_test.go`: Automated tests verifying DSP building blocks, PolyBLEP anti-aliasing, soft-clipping headroom, LFSR noise, and all 18 curated sound effects.
- **Curated Production SFX Library (`scripts/*.sfx`)**:
  - `laser_arcade.sfx`: Fast arcade laser blaster with a PolyBLEP square wave and duty sweep.
  - `plasma_gun.sfx`: Heavy plasma bolt with a sweeping low-pass filter and sawtooth grit.
  - `explosion_arcade.sfx`: Classic retro chiptune explosion using 16-bit Galois LFSR noise.
  - `explosion_deep.sfx`: Heavy cinematic explosion stacking a sub-bass sine drop, high-passed noise transient, and rumble.
  - `coin_pickup.sfx`: Bright two-tone arcade coin pickup (`B5` to `E6`).
  - `gem_shimmer.sfx`: Shimmering crystal gem pickup with a dynamic FM modulation sweep.
  - `jump_arcade.sfx`: Snappy platformer upward pitch sweep.
  - `jump_spring.sfx`: Rubbery spring jump using a triangle wave with pitch vibrato.
  - `sword_clash.sfx`: Sharp metallic blade collision combining inharmonic FM and high-passed spark noise.
  - `shield_deflect.sfx`: Resonant energy shield deflection with an inharmonic FM clang.
  - `hit_punch.sfx`: Heavy melee punch with a hyperbolic pitch drop and noise transient.
  - `hit_damage.sfx`: Sharp player damage crunch with a downward sawtooth sweep.
  - `powerup_fanfare.sfx`: Uplifting four-note major arpeggio (`C5 E5 G5 C6`) for stage clear or level up.
  - `ui_select.sfx`: Clean, non-fatiguing 50 ms sine tick for menu cursor movement.
  - `ui_confirm.sfx`: Positive ascending two-tone confirmation chime.
  - `ui_error.sfx`: Low dual sawtooth buzz signaling invalid input or blocked actions.
  - `footstep_stone.sfx`: Short textured boot impact on stone or gravel.
  - `engine_thruster.sfx`: Pulsing rocket thruster rumble using periodic LFSR noise.

---

## 1. Core Architecture and DSP Building Blocks

### 1.1 PolyBLEP Band-Limited Anti-Aliasing
Naive digital square and sawtooth waves jump instantaneously at phase edges, creating harmonics above the Nyquist limit (`22,050 Hz`). Those frequencies fold back into the audible range as harsh, metallic aliasing buzz.

The synthesis engine applies polynomial band-limited step correction (`polyBLEP`) around every phase wrap (`t = 0`) and pulse-width transition (`t = duty`). This smooths sharp discontinuities across adjacent samples, keeping high-pitched lasers and arcade leads crisp without digital hiss.

### 1.2 16-Bit Galois LFSR Chiptune Noise (`wave=psg_noise`)
Standard white noise (`rand.Float64()`) sounds like static hiss rather than classic console explosions. Vintage sound chips (SEGA Master System, Mega Drive SN76489, Game Boy, NES) used Linear Feedback Shift Registers (LFSR) clocked at audible frequencies.

The engine includes a 16-bit Galois LFSR generator (`wave=psg_noise`):
- Uses maximal-period taps (`x^16 + x^14 + x^13 + x^11 + 1`).
- Clocks the shift register at a rate proportional to the note's target frequency.
- Produces gritty metallic drones at steady pitches and crunchy retro explosions when swept downward.

### 1.3 Dynamic State Variable Filter Sweeps (`lpf`, `hpf`, `q`)
Static filters sound flat on explosions and energy weapons. Each voice runs through a Chamberlin State Variable Filter (SVF) with per-sample cutoff interpolation:
- Supports low-pass (`lpf=start->end`), high-pass (`hpf=start->end`), and resonance (`q=0.1..20.0`).
- Sweeps cutoffs smoothly across the note duration (for example, `lpf=3500->400 q=2.2`).
- Clamps internal filter coefficients for stability across rapid sweeps.

### 1.4 Dynamic Duty Cycle Sweeps (`duty=start->end`)
Square and pulse wave timbre changes with pulse width:
- `0.50`: Hollow, woody retro square wave.
- `0.25`: Punchy, nasal arcade lead.
- `0.125`: Thin, reedy bite.

Sweeping the duty cycle over a note (`duty=0.50->0.125`) adds organic pulse-width modulation (PWM) motion to lasers and sci-fi beams without extra effects processors.

### 1.5 Pitch Curves (`curve=exp|lin|hyper`)
Pitch trajectories control the perceived weight and speed of a sound cue:
- `exp` (Exponential, default): Sweeps pitch in equal musical intervals per unit of time. Best for lasers, jumps, and sirens.
- `lin` (Linear): Sweeps pitch at a constant Hz-per-millisecond rate. Best for short UI ticks and mechanical slides.
- `hyper` (Hyperbolic): Drops rapidly during the initial transient and flattens into a low bass body. Essential for heavy punches, kick drums, and physical impacts.

### 1.6 Dynamic 2-Operator FM Sweeps (`fm`, `mod_ratio`, `mod_freq`, `mod_index`)
Two-operator frequency modulation synthesizes bells, coins, crystals, and clashing steel:
- Set harmonic overtones with integer ratios (`mod_ratio=2.0`) or metallic, inharmonic overtones with irrational ratios (`mod_ratio=1.414`, `2.76`, or `3.1415`) or a fixed modulator frequency (`mod_freq=620Hz`).
- Sweep modulation depth from bright impact to pure ring (`mod_index=5.5->0.2` or `fm=2.76,2.2->0.2`).

### 1.7 C1 Smooth Soft-Clipping Master Bus (`SoftClip`)
Stacking multiple tracks (such as a transient crack, mid crunch, and sub-bass drop) can push peaks past digital full scale (`1.0`). Instead of hard clipping, the mixer uses a $C^1$-continuous soft-knee limiter:
- Signals up to `0.75` amplitude pass through unchanged.
- Signals above `0.75` compress smoothly (`0.75 + 0.25 * tanh((|x| - 0.75) / 0.25)`), never exceeding `1.0` (`0 dBFS`).

### 1.8 Anti-Click Boundary Micro-Fades
Starting or ending a buffer on a non-zero sample causes an audible speaker pop. Every rendered cue receives a 44-frame (~1 ms) raised-cosine fade-in from exact zero at frame 0 and fade-out to exact zero at the final frame.

---

## 2. Procedural SFX DSL Specification

An `.sfx` script consists of header directives, instrument definitions (`inst`), optional reusable patterns (`pattern`), and one or more tracks (`track`, `seq`, or `step`).

### 2.1 Header Directives

```text
title "Heavy Grenade Explosion"
type sfx
bpm 120
time 4/4
filter lpf 0.35
bitcrush 8 2
loop 50ms 950ms
```

- Comments start with `#` (at the start of a line or after whitespace) or `//`.
- `title "<name>"`: Human-readable cue name used in logs and validation reports.
- `type sfx`: Marks the score as a sound effect cue.
- `bpm <1..1000>`: Reference tempo when using musical beat durations (`:4`, `:8`, `:16`). Defaults to `120`.
- `time <num>/<den>`: Optional time signature (defaults to `4/4`).
- `filter <lpf|hpf> <alpha>`: Optional master bus single-pole filter using a smoothing coefficient `alpha` in `(0.0, 1.0]`.
- `bitcrush <bits> <downsample>`: Optional master bus lo-fi decimation (`bits` from `1` to `16`, `downsample >= 1`).
- `loop <startDur> <endDur>`: Optional loop slice window using durations such as `50ms 950ms` or `0.05s 0.95s`.

### 2.2 Instrument Definitions (`inst`)

Instruments define reusable synth patches. Each instrument must specify either `preset=<name>` or `wave=<type>`, and can override any parameter:

```text
inst <name> [preset=<preset_name>] [wave=<type>] [vol=<0..1>] [pan=<-1..1>]
            [duty=<val|start->end>] [adsr=<A>,<D>,<S>,<R>]
            [freq=<pitchOrSweep>] [curve=<exp|lin|hyper>]
            [lpf=<Hz|start->end>] [hpf=<Hz|start->end>] [q=<0.1..20>]
            [fm=<ratioOrHz>,<index|start->end>] [mod_ratio=<val>] [mod_freq=<Hz>] [mod_index=<val|start->end>]
            [noise=<filterCoeff>,<blend>] [noise_filter=<(0..1]>] [noise_blend=<0..1>]
            [vib=<rateHz>,<depthHz>] [bitcrush=<bits>,<downsample>]
```

#### Waveforms (`wave=`)
- `square` (or `pulse`, `sq`): PolyBLEP band-limited pulse wave with variable duty cycle.
- `sawtooth` (or `saw`): PolyBLEP band-limited sawtooth wave.
- `triangle` (or `tri`): Warm low-harmonic triangle wave for jumps, kicks, and punches.
- `sine` (or `sin`): Pure fundamental tone for sub-bass drops and clean UI ticks.
- `noise` (or `white_noise`): Filtered white noise for impacts, wind, and footsteps.
- `psg_noise` (or `periodic_noise`, `psg`): 16-bit Galois LFSR chiptune noise.
- `fm`: 2-operator frequency modulation synthesizer.

#### Instrument Attribute Reference
- `preset=<name>` (or `template=`, `archetype=`): Copies baseline parameters from one of the 18 built-in presets before applying any attributes that follow on the same line.
- `vol=<0.0..1.0>`: Voice gain multiplier (default `0.20`). Keep individual tracks around `0.18` to `0.42` so multi-track sums stay inside the linear headroom zone.
- `pan=<-1.0..1.0>`: Constant-power stereo panning (`-1.0` full left, `0.0` center, `+1.0` full right).
- `duty=<val>` or `duty=<start->end>`: Pulse width in `(0.0, 1.0)` (for example, `duty=0.50->0.125`).
- `adsr=<A>,<D>,<S>,<R>`: Envelope Attack, Decay, Sustain level (`0..1`), and Release. Attack, Decay, and Release accept seconds (`0.04`) or duration suffixes (`40ms`). You can also override individual stages with `attack=`, `decay=`, `sustain=`, and `release=`.
- `freq=<pitchOrSweep>` (or `sweep=`, `pitch=`): Default pitch or sweep when the instrument is triggered without an explicit note (for example, `freq=950Hz->110Hz`).
- `curve=<exp|lin|hyper>`: Pitch sweep curve (`exp` default).
- `lpf=<val|start->end>` and `hpf=<val|start->end>`: Per-voice SVF filter cutoff in Hz (`lpf=3500->400` or `hpf=800Hz`) or alpha coefficient (`<= 1.0`).
- `q=<0.1..20.0>` (or `res=`, `resonance=`): SVF filter resonance factor (`0.707` Butterworth default).
- `fm=<ratioOrHz>,<index|start->end>`: Shorthand setting both modulator frequency/ratio and modulation index (`fm=2.76,2.2->0.2` or `fm=620Hz,5.5->0.5`). You can also set `mod_ratio=`, `mod_freq=`, and `mod_index=` individually.
- `noise=<filterCoeff>,<blend>`: Sets both the single-pole noise low-pass coefficient in `(0.0, 1.0]` and oscillator-to-noise blend in `[0.0, 1.0]`. You can also set `noise_filter=` and `noise_blend=` separately.
- `vib=<rateHz>,<depthHz>`: Pitch vibrato LFO speed and depth in Hz (`vib=18,25`).
- `bitcrush=<bits>,<downsample>`: Per-instrument bitcrusher (`bitcrush=6,4`).

### 2.3 Events, Pitch Sweeps, and Durations

Track events pair a pitch, sweep, chord, instrument trigger, or rest with a `:duration` suffix:
- **Frequency Sweep**: `950Hz->110Hz:140ms` or scientific pitch glide `C5->C2:180ms`
- **Fixed Pitch**: `440Hz:80ms`, `B5:75ms`, or `E6:240ms`
- **Instrument Trigger with Pitch**: `laser(950Hz->110Hz):140ms` or `coin(B5):70ms`
- **Preset Default Trigger**: `roar:450ms` or `:450ms` (uses the instrument's `DefaultStartFreq` and `DefaultEndFreq`)
- **Chord**: `[C5 E5 G5]:200ms` or `horn[C5 E5 G5]:200ms`
- **Rest**: `R:150ms` (or `r`, `_`, `.`)
- **Grouping, Repeats, and Transposition**: `(B5:60ms E6:120ms)*2` or `pattern_name@+12`

Durations accept milliseconds (`80ms`), seconds (`0.4s`), beats (`2b`), or musical subdivisions (`:4`, `:8`, `:16`, `:16.`, `:8t`). If a token omits `:duration`, it inherits the previous token's duration on that track.

### 2.4 Tracks (`track`), Sequences (`seq`), and Steps (`step`)

Use `track <track_name> <default_inst>:` to layer multiple synchronized stems in parallel. Every track starts at `t = 0` and mixes into the stereo master bus:

```text
title "Deep Cinematic Explosion"
type sfx

inst transient wave=noise noise_filter=0.90 vol=0.32 adsr=0.001,0.04,0.00,0.04 hpf=800
inst rumble    preset=explosion_deep vol=0.40 adsr=0.005,0.25,0.25,0.55

track punch transient: transient:80ms R:720ms
track boom  rumble:    120Hz->20Hz:800ms
```

For single-channel sequences that switch instruments inline, use `seq:` with `inst(pitch):dur` tokens, or bind a default instrument with `seq <default_inst>:`:

```text
seq:
  laser(950Hz->120Hz):150ms R:100ms |
  coin(B5):70ms coin(E6):220ms
```

For quick one-line cues without a separate `inst` declaration, use `step` with `dur=<duration>`:

```text
step preset=arcade_laser dur=140ms
```

---

## 3. Built-in SFX Archetype Presets

Reference any of the 18 built-in archetypes via `preset=<name>` (inspect all parameters anytime with `go run . presets`):

| Preset Name | Wave | Default Sweep | Filter / Modulation | Curve | Typical Game Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `arcade_laser` | `square` | `950->110 Hz` | `duty=0.50->0.15` | `exp` | Retro sci-fi blasters, laser cannons |
| `plasma_gun` | `sawtooth` | `1200->180 Hz` | `lpf=3500->400`, `q=2.2` | `exp` | Heavy sci-fi energy weapons |
| `explosion_arcade` | `psg_noise` | `180->25 Hz` | `lpf=1200->150`, `q=1.8` | `exp` | Classic 8-bit and 16-bit explosions |
| `explosion_deep` | `sine` | `120->24 Hz` | `noise=0.15,0.45` | `exp` | Heavy bomb detonations, boss slams |
| `coin_pickup` | `square` | `988->1319 Hz` | `duty=0.50`, snappy ADSR | `exp` | Coins, score pickups, collectibles |
| `gem_shimmer` | `fm` | `1568->1568 Hz` | `mod_ratio=2.76`, `mod_index=2.2->0.2` | `exp` | Rare crystals, magic chimes, loot |
| `jump_arcade` | `square` | `160->620 Hz` | `duty=0.50`, upward sweep | `exp` | Platformer character jumps |
| `jump_spring` | `triangle` | `120->480 Hz` | `vib=18,25` | `exp` | Bouncy springs, bumpers, trampolines |
| `sword_clash` | `fm` | `520->210 Hz` | `mod_freq=620Hz`, `mod_index=5.5->0.5`, `noise=0.60,0.25` | `exp` | Blade parries, weapon collisions |
| `shield_deflect` | `fm` | `880->440 Hz` | `mod_ratio=3.1415`, `mod_index=4.0->0.2` | `exp` | Energy shields, armor ricochets |
| `hit_punch` | `triangle` | `180->45 Hz` | `noise=0.45,0.30` | `hyper` | Melee punches, body impacts |
| `hit_damage` | `sawtooth` | `220->65 Hz` | `noise=0.30,0.38` | `exp` | Player hurt or enemy hit crunch |
| `powerup_fanfare` | `square` | `523->1047 Hz` | `duty=0.35`, bright sustain | `exp` | Level-up arpeggios, stage clear |
| `ui_select` | `sine` | `880->1100 Hz` | Ultra-short `1ms` attack | `lin` | Menu cursor hover and navigation |
| `ui_confirm` | `square` | `659->1319 Hz` | `duty=0.50`, bright chime | `exp` | Button press, dialog confirmation |
| `ui_error` | `sawtooth` | `150->110 Hz` | Downward buzz | `lin` | Locked door, invalid action, cancel |
| `footstep_stone` | `noise` | Filtered noise | `noise_filter=0.25`, short decay | `exp` | Walking or landing on hard surfaces |
| `engine_thruster` | `psg_noise` | `110->110 Hz` | `noise_filter=0.35`, `sustain=0.80` | `exp` | Ship thrusters, machinery rumble |

---

## 4. Acoustic Physics and Multi-Layer Sound Design

Convincing game sound effects mirror the three physical stages of a real-world impact:

```text
Amplitude
  1.0 |    /\   <-- 1. Transient (1 to 15 ms: sharp high-frequency snap)
      |   /  \
  0.5 |  /    \______  <-- 2. Body (15 to 150 ms: pitch sweep & fundamental weight)
      | /            \________
  0.0 +-----------------------\--> Time (ms)
                               \-- 3. Tail (150 to 600 ms: filtered decay & ring)
```

1. **Transient (`1` to `15 ms`)**: The initial crack or spark when objects collide. Use a fast attack (`0.001` to `0.004` seconds) with high-passed noise (`hpf=800` to `2200`) or high FM modulation index so the cue cuts through background music immediately.
2. **Body (`15` to `150 ms`)**: The core pitch movement that conveys size and mass. Use `curve=hyper` for physical thuds and melee hits, or `curve=exp` for lasers and jumps.
3. **Tail (`150` to `600 ms`)**: The room decay or resonant ring. Sweep a low-pass filter downward (`lpf=1200->150`) or decay the FM index (`mod_index=5.5->0.2`) so the cue settles smoothly into silence.

---

## 5. Production Validation Engine

Every `.sfx` cue should pass `ValidateScore` and `ValidateProductionSFX` before shipping in a game build:

- **Duration**: Between `10 ms` (`0.01s`) and `5.0s`.
- **Non-Silent Signal**: Peak amplitude above `-60 dBFS` and RMS energy above `-70 dBFS`.
- **True Peak Headroom**: Peak level at or below `-0.1 dBFS` (`0.988` linear) to prevent DAC inter-sample clipping.
- **DC Offset**: Mean DC bias on both Left and Right channels within `+/-0.05` (`5%`).
- **Click-Free Boundaries**: First and last stereo frames within `+/-300` (`16-bit PCM`), guaranteed automatically by the engine's boundary micro-fades.

Run the validator across all `.sfx` files from the CLI:

```bash
cd skills/procedural-sfx/scripts
go run . validate *.sfx
```

Example report:

```text
STATUS  | CUE / FILE               | DURATION | PEAK L/R (dBFS) | RMS (dBFS) | DC OFFSET  | BOUNDARY
-----------------------------------------------------------------------------------------------
PASS    | coin_pickup.sfx          | 0.32s   | -16.8 / -16.8   | -24.9     | -0.0000    | Clean   
PASS    | explosion_deep.sfx       | 0.80s   | -11.4 / -11.4   | -23.2     | +0.0006    | Clean   
PASS    | sword_clash.sfx          | 0.25s   | -6.9 / -6.9     | -26.1     | -0.0004    | Clean   
PASS    | ui_select.sfx            | 0.05s   | -16.4 / -16.4   | -29.5     | -0.0001    | Clean   
```

---

## 6. Ebitengine Integration Guide

### 6.1 Pre-Compile Cues at Startup
Compile `.sfx` scripts into `[]byte` slices once when creating your audio manager so `Update()` and `Draw()` never allocate or run DSP synthesis mid-frame:

```go
package main

import (
	"fmt"
	"time"

	"github.com/hajimehoshi/ebiten/v2/audio"
)

const laserDSL = `
title "Arcade Pulse Laser"
type sfx
inst laser preset=arcade_laser duty=0.50->0.125 vol=0.32
track main laser: 950Hz->110Hz:140ms
`

type SoundManager struct {
	audioCtx *audio.Context
	sounds   map[string][]byte
	lastPlay map[string]time.Time
}

func NewSoundManager(audioCtx *audio.Context) (*SoundManager, error) {
	laserPCM, err := CompileDSL(laserDSL)
	if err != nil {
		return nil, fmt.Errorf("compile laser SFX: %w", err)
	}
	if rep, err := ValidateProductionSFX(laserPCM); err != nil || !rep.Passed {
		return nil, fmt.Errorf("validate laser SFX: %w", err)
	}

	return &SoundManager{
		audioCtx: audioCtx,
		sounds:   map[string][]byte{"laser": AlignPCM(laserPCM)},
		lastPlay: make(map[string]time.Time),
	}, nil
}
```

### 6.2 Cooldown Rate-Limiting and 4-Byte Frame Alignment (`&^ 3`)
When multiple projectiles or hits trigger on the same tick, stacking identical waveforms causes phase cancellation and harsh volume spikes. Enforce a per-cue cooldown (`30 ms` to `60 ms`) and always mask byte slices with `&^ 3` (4 bytes per 16-bit stereo sample frame):

```go
func AlignPCM(pcm []byte) []byte {
	return pcm[:len(pcm)&^3]
}

func (sm *SoundManager) PlaySFX(name string, cooldown time.Duration) {
	pcm, ok := sm.sounds[name]
	if !ok || len(pcm) < 4 {
		return
	}
	now := time.Now()
	if last, exists := sm.lastPlay[name]; exists && now.Sub(last) < cooldown {
		return
	}
	sm.lastPlay[name] = now

	player := sm.audioCtx.NewPlayerFromBytes(pcm[:len(pcm)&^3])
	player.Play()
}
```

---

## 7. CLI Reference

Run the CLI tool from `skills/procedural-sfx/scripts`:

```bash
cd skills/procedural-sfx/scripts

# Audition an .sfx file in real time (add -loop to loop continuous cues)
go run . play laser_arcade.sfx
go run . play -loop engine_thruster.sfx

# Play the built-in multi-cue arcade showcase
go run . demo

# Validate one or more .sfx files against production standards
go run . validate *.sfx

# List all 18 built-in archetype presets in a table or as JSON
go run . presets
go run . presets-json

# Export a compiled .sfx cue to a 44.1 kHz 16-bit stereo WAV file
go run . export laser_arcade.sfx laser.wav

# Synthesize a cue and emit a single-line JSON report (used by the Sound Editor in Game Dev Studio)
go run . synth-json -out /tmp/laser.wav laser_arcade.sfx
```
