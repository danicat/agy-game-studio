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
  version: "0.2.0"
  catalog: https://skills.danicat.dev
---

# Procedural Sound Effects: SFX DSL & Synthesis Engine Guide

This skill provides an **SFX Composition DSL**, an audio synthesis engine, 18 archetype presets, and an automated production quality validator in pure Go. It compiles `.sfx` scripts directly into 44.1 kHz, 16-bit signed Little-Endian stereo PCM byte buffers (`[]byte`) in memory.

Sound cues require zero external audio files, eliminate asset loading delays, and consume negligible binary space.

> [!TIP]
> **Looking for multi-track background music, chord progressions, or tracker patterns?**
> Use the companion **`procedural-music`** skill (`skills/procedural-music/SKILL.md`), which shares the same underlying engine core and adds polyphonic MML/Tracker song notation, classical tempo markings, and dual YM2612 / Apple CoreAudio synthesis.

---

## Available scripts and curated SFX library

- `scripts/sound.go`: Complete DSL lexer, parser, preset dictionary, synthesis engine (`CompileDSL`, `SynthesizeScore`), DSP post-filters, production validator (`ValidateProductionSFX`, `ValidateScore`), and WAV exporter (`ExportWAV`).
- `scripts/play.go`: CLI runner supporting real-time playback (`play`, `demo`), quality auditing (`validate`), preset listing (`presets`), and WAV export (`export`).
- `scripts/sound_test.go`: Automated tests verifying DSP building blocks, PolyBLEP anti-aliasing, soft clipping headroom, LFSR noise, and all 18 curated sound effects.
- **Curated Production SFX Library (`scripts/*.sfx`)**:
  - `laser_arcade.sfx`: Fast arcade laser blaster with PolyBLEP square wave.
  - `plasma_gun.sfx`: Heavy plasma bolt with sweeping low-pass filter and sawtooth grit.
  - `explosion_arcade.sfx`: Classic retro chiptune explosion using 16-bit Galois LFSR noise.
  - `explosion_deep.sfx`: Heavy cinematic explosion stacking sub-bass sine drop, LFSR noise, and rumble.
  - `coin_pickup.sfx`: Bright two-tone arcade coin pickup with rapid pitch jump.
  - `gem_shimmer.sfx`: Shimmering crystal gem pickup with dynamic FM modulation sweep.
  - `jump_arcade.sfx`: Classic platformer upward pitch sweep.
  - `jump_spring.sfx`: Rubbery spring jump with triangle wave and pitch vibrato.
  - `sword_clash.sfx`: Sharp metallic blade collision using inharmonic FM and high-passed noise.
  - `shield_deflect.sfx`: Resonant energy shield deflection with FM clang.
  - `hit_punch.sfx`: Heavy melee punch with hyperbolic pitch drop and low-pass filtered transient.
  - `hit_damage.sfx`: Sharp player damage crunch with down-sweeping sawtooth bite.
  - `powerup_fanfare.sfx`: Uplifting four-note triumphant arpeggio for stage clear or level up.
  - `ui_select.sfx`: Ultra-clean, non-fatiguing high sine tick for menu item hovering.
  - `ui_confirm.sfx`: Positive ascending two-tone confirmation chirp.
  - `ui_error.sfx`: Low dual sawtooth buzz signaling invalid inputs or blocked actions.
  - `footstep_stone.sfx`: Subtle textured boot impact on cobblestone or gravel.
  - `engine_thruster.sfx`: Pulsing rocket thruster rumble with periodic LFSR noise.

---

## 1. Core Architecture and DSP Innovations

### 1.1 PolyBLEP Band-Limited Anti-Aliasing
Naive digital generation of hard edges (square waves, sawtooth ramps) creates frequency spikes above the Nyquist frequency (`22,050 Hz`). These reflect back into the audible spectrum as harsh, discordant aliasing buzz.

The synthesis engine applies polynomial band-limited step correction (`PolyBLEP`) to square and sawtooth waveforms. At each waveform transition, the sharp edge is smoothed across adjacent samples:
- Corrects high-frequency foldover distortion while preserving punchy chiptune transients.
- Keeps arcade lasers and crunch waves clean across high pitches without brittle digital hiss.

### 1.2 16-Bit Galois LFSR Chiptune Noise (`wave=psg_noise`)
Traditional white noise generators (`rand.Float64()`) sound like modern analog hiss. Classic consoles (SEGA Master System, Mega Drive, Game Boy, NES) used Linear Feedback Shift Registers (LFSR) clocked at audible rates to produce characteristic metallic grit and punchy explosions.

The engine provides an authentic 16-bit Galois LFSR (`wave=psg_noise`):
- Uses maximal-period shift register taps (`x^16 + x^14 + x^13 + x^11 + 1`).
- Clocks the shift register at the note's target frequency (`freq` parameter).
- Produces true periodic noise when clocked at musical frequencies and broadband chiptune rumble when swept downward.

### 1.3 Dynamic State Variable Filter Sweeps (`lpf=start->end`, `hpf=start->end`, `q=N`)
Static filters cannot capture the living acoustic motion of explosions or plasma discharges. The engine embeds a dynamic Chamberlin State Variable Filter (SVF) directly into voice rendering:
- Supports independent low-pass (`lpf`), high-pass (`hpf`), and resonance (`q`) parameters.
- Sweeps cutoffs smoothly across the note duration: `lpf=3500->400 q=2.5`.
- Preserves filter stability across rapid frequency modulations without pops or numeric explosions.

### 1.4 Dynamic Duty Cycle Sweeps (`duty=start->end`)
Square wave timbre depends directly on pulse width:
- `0.50`: Hollow, clarinet-like retro square wave.
- `0.25`: Punchy, biting arcade lead.
- `0.125`: Thin, reedy buzzer.
The engine supports dynamic sweeps between pulse widths: `duty=0.5->0.125`. This creates evolving phasing textures on lasers, engine whooshes, and sci-fi beams without requiring external flangers.

### 1.5 Pitch Curves (`curve=exp|lin|hyper`)
Pitch trajectories define the perceived mass of a sound:
- `exp` (Exponential, default): Pitch shifts proportional to musical intervals (semitones/octaves). Ideal for lasers, sci-fi whooshes, and jumps.
- `lin` (Linear): Pitch changes by a constant Hz rate per millisecond. Creates mechanical, synthesized pitch slides.
- `hyper` (Hyperbolic): Pitch drops steeply during the first few milliseconds, then flattens into a sustained low rumble. Essential for punchy combat impacts, kick drums, and physical thuds.

### 1.6 Dynamic FM Modulation Sweeps (`mod_index=start->end`)
Two-operator frequency modulation produces metallic clangs, crystal chimes, and bell tones:
- Carrier frequency sets the fundamental pitch.
- Modulator ratio sets harmonic relationships (integer ratios produce warm synths; irrational ratios like `1.414` or `2.76` produce inharmonic metal strikes).
- Modulator index sweeps (`mod_index=5.5->0.2`) let the bright high-frequency collision sparkle decay into a pure resonant hum.

### 1.7 C1 Smooth Soft-Clipping Master Bus (`SoftClip`)
Multi-layer sound effects (for example, combining sub-bass boom, mid crunch, and debris noise) can easily exceed digital full-scale (`+1.0` / `-1.0` or `+/-32767` in 16-bit integer). Hard clipping causes jarring distortion and speaker crackle.

The engine uses a $C^1$-continuous cubic spline soft-knee limiter:
- Samples below `0.75` amplitude pass through with 100% linear transparency.
- Samples above `0.75` enter a smooth asymptotic curve (`0.75 + 0.25 * tanh((|x| - 0.75) / 0.25)`).
- Guaranteed peak ceiling of `1.0` (0 dBFS), protecting master headroom and preventing harsh wrap-around distortion.

### 1.8 Anti-Click Boundary Micro-Fades
Sudden non-zero sample starts or cutoffs produce audible DC speaker pops. Every synthesized cue automatically receives a 44-frame (approx. 1 millisecond) smooth raised-cosine micro-fade at sample 0 and at the final sample. Sound effects start and end at pure zero amplitude.

---

## 2. Procedural SFX DSL Specification

An `.sfx` script contains header directives followed by instruments, step sequences, or layered tracks.

### 2.1 Header Directives

```text
title "Heavy Grenade Explosion"
type sfx
bpm 120
filter lpf cutoff=2400
bitcrush bits=8 downsample=2
loop start=0.05 end=0.95
```

- Comments begin with `#` or `//`.
- `title "<name>"`: Identifies the sound effect in debug logs and validator reports.
- `type sfx`: Declares the file as a sound effect cue.
- `bpm <number>`: Sets the reference tempo when using beat divisions (`:4`, `:8`, `:16`).
- `filter <lpf|hpf> cutoff=<Hz>`: Optional master post-processing filter.
- `bitcrush bits=<1..16> downsample=<1..N>`: Optional lo-fi retro decimation.
- `loop start=<sec> end=<sec>`: Optional seamless loop boundaries for ambient textures and engine loops.

### 2.2 Instrument Definition (`inst`)

Instruments declare reusable sound sources. An instrument can reference one of the 18 built-in archetype presets, customize individual properties, or define a sound entirely from scratch:

```text
inst <name> [preset=<preset_name>] [wave=<type>] [duty=<val|start->end>]
            [lpf=<val|start->end>] [hpf=<val|start->end>] [q=<val>]
            [curve=<exp|lin|hyper>] [fm=<ratio>,<index|start->end>]
            [adsr=<A>,<D>,<S>,<R>] [vol=<0..1>] [pan=<-1..1>]
            [noise=<0..1>] [noise_filter=<0..1>] [vib=<freq>,<depth>]
```

#### Supported Waveforms (`wave=`)
- `square`: PolyBLEP band-limited square wave with adjustable duty cycle (`duty=0.5`).
- `saw` or `sawtooth`: PolyBLEP band-limited sawtooth wave.
- `sine`: Pure sinusoidal tone. Best for sub-bass drops, UI ticks, and gentle hums.
- `triangle`: Low-harmonic warm tone. Best for platformer jumps and body impacts.
- `noise`: Smooth filtered white noise.
- `psg_noise`: Authentic 16-bit Galois LFSR chiptune periodic/white noise.
- `fm`: 2-operator frequency modulation synth.

#### Parameter Keys
- `preset=<name>`: Loads baseline properties from one of the 18 built-in archetypes.
- `duty=<start->end>` or `duty=<val>`: Sets initial or swept duty cycle (`0.01` to `0.99`).
- `lpf=<start->end>` or `lpf=<val>`: Low-pass filter cutoff in Hz.
- `hpf=<start->end>` or `hpf=<val>`: High-pass filter cutoff in Hz.
- `q=<val>`: Filter resonance (`0.5` to `10.0`, default `1.0`).
- `curve=<exp|lin|hyper>`: Pitch trajectory curve.
- `fm=<ratio>,<mod_index_start->mod_index_end>`: Sets modulator ratio and modulation depth sweep.
- `adsr=<attack>,<decay>,<sustain>,<release>`: ADSR envelope times in seconds and sustain level (`0..1`).
- `vol=<0..1>`: Channel gain multiplier.
- `pan=<-1..1>`: Stereo pan position (`-1.0` full left, `0.0` center, `+1.0` full right).
- `noise=<0..1>`: Oscillator and noise blend ratio (`0.0` pure oscillator, `1.0` pure noise).
- `noise_filter=<0..1>`: Low-pass filtering applied to the noise blend.
- `vib=<freq>,<depth>`: Pitch vibrato rate in Hz and depth in Hz.

### 2.3 Note and Pitch Sweep Tokens

Each step or track event specifies pitch and duration:
- **Pitch Sweep**: `950Hz->110Hz:140ms` or `C5->C3:120ms`
- **Fixed Frequency**: `440Hz:80ms` or `A5:16`
- **Preset Trigger**: `:140ms` (inherits default frequencies from the instrument preset)
- **Rest / Gap**: `R:40ms` or `0Hz:50ms`

Durations can be written in milliseconds (`120ms`), seconds (`0.25s`), or beat fractions (`:4`, `:8`, `:16`, `:32`).

### 2.4 Multi-Track Layering (`track`)

Professional sound design stacks multiple distinct layers to form a single impact:

```text
title "Heavy Explosion"
type sfx

inst sub_boom   preset=explosion_deep vol=0.85
inst blast_body preset=explosion_arcade vol=0.70
inst debris     wave=noise vol=0.30 adsr=0.01,0.40,0.0,0.10

track sub:    120Hz->24Hz:600ms
track blast:  180Hz->28Hz:450ms
track debris: 800Hz:600ms
```

All tracks render simultaneously in memory and sum into the soft-clipping master bus.

---

## 3. Built-in SFX Archetype Presets

Use `preset=<name>` in any instrument definition to inherit tested configurations:

| Preset Name | Default Wave | Pitch Range | Filter / Dynamics | Typical Usage |
| :--- | :--- | :--- | :--- | :--- |
| `arcade_laser` | `square` | `950->110 Hz` | `duty=0.5->0.125` | Retro sci-fi gunshots, laser cannons |
| `plasma_gun` | `sawtooth` | `1200->180 Hz` | `lpf=3500->400`, `q=2.2` | Heavy sci-fi energy weapons |
| `explosion_arcade` | `psg_noise` | `180->25 Hz` | `lpf=1200->150`, `q=1.5` | Classic chiptune explosions |
| `explosion_deep` | `sine` | `120->24 Hz` | Sub-bass drop with grit | Heavy cinematic bomb detonations |
| `coin_pickup` | `square` | `988->1319 Hz` | Fast two-tone chime | Collectibles, arcade coins |
| `gem_shimmer` | `fm` | `1568->1568 Hz` | `fm=2.76, 2.2->0.2` | Rare crystals, magic items, chimes |
| `jump_arcade` | `square` | `160->620 Hz` | Fast snappy upward sweep | Retro platformer jumps |
| `jump_spring` | `triangle` | `120->480 Hz` | Vibrato `18 Hz, 25 Hz` | Bouncy trampolines, spring pads |
| `sword_clash` | `fm` | `520->210 Hz` | `fm=1.414, 5.5->0.5` | Sword parries, blade clashes |
| `shield_deflect` | `fm` | `880->440 Hz` | `fm=2.0, 4.0->0.3` | Energy shields, metal bullet ricochets |
| `hit_punch` | `triangle` | `180->45 Hz` | Hyperbolic pitch curve | Melee brawler punches, body hits |
| `hit_damage` | `sawtooth` | `220->65 Hz` | Punchy mid crunch | Player or enemy damage impact |
| `powerup_fanfare` | `square` | `523->1046 Hz` | Rising major intervals | Stage clear, level-up fanfares |
| `ui_select` | `sine` | `880->1100 Hz` | Ultra-short 50 ms tick | Menu cursor navigation |
| `ui_confirm` | `square` | `659->1319 Hz` | Dual ascending chime | Menu selection, confirmation |
| `ui_error` | `sawtooth` | `150->110 Hz` | Dissonant dual pulse | Denied action, invalid target |
| `footstep_stone` | `noise` | Filtered noise | Low thud + grit | Character movement on stone |
| `engine_thruster` | `psg_noise` | `110->110 Hz` | Steady LFSR rumble | Rocket thrusters, machinery hum |

---

## 4. Acoustic Physics & Sound Design Principles

Physical sound events have three distinct acoustic phases:

```
Amplitude
  1.0 |    /\   <-- Transient (1 to 5 ms attack, high energy snap)
      |   /  \
  0.5 |  /    \______  <-- Body (15 to 150 ms, pitch sweep & fundamental weight)
      | /            \________
  0.0 +-----------------------\--> Time (ms)
                               \-- Tail (150 to 600 ms, filtered decay & reverb ring)
```

1. **Transient (0 to 15 ms)**: The initial contact snap when two objects collide or fuel ignites. Use an ultra-fast attack (`0.001` to `0.005` seconds) with high-frequency noise or sharp PolyBLEP edges.
2. **Body (15 to 150 ms)**: The fundamental resonance that gives a sound weight and substance. Hyperbolic sweeps (`curve=hyper`) keep combat hits tight, while exponential sweeps (`curve=exp`) give lasers their sci-fi bite.
3. **Tail (150 to 600 ms)**: The dissipating acoustic ring. Use low-pass filter sweeps (`lpf=1200->150`) or inharmonic FM decay (`mod_index=4.0->0.2`) so the sound fades gracefully without abrupt silence.

---

## 5. Production SFX Validation Engine

The engine includes an automated quality assurance auditor (`ValidateProductionSFX` and `ValidateScore`) accessible both in Go code and via the CLI.

### 5.1 Validation Criteria

A production-ready sound effect must satisfy all of the following rules:
- **Duration**: Must be between 10 milliseconds and 5 seconds.
- **Audio Energy**: Buffer must contain non-zero audio content.
- **True Peak Headroom**: Peak amplitude must stay below `-0.1 dBFS` (`0.988` normalized) to prevent hardware inter-sample clipping on DAC converters.
- **DC Offset**: Absolute DC bias must remain below `0.05` (`5%`) to preserve speaker excursion.
- **Boundary Cleanliness**: Initial sample frame and final sample frame must have zero amplitude, preventing startup and shutdown clicks.

### 5.2 Running Validation via CLI

```bash
cd skills/procedural-sfx/scripts
go run . validate *.sfx
```

Output format:
```text
STATUS  | CUE / FILE               | DURATION | PEAK L/R (dBFS) | RMS (dBFS) | DC OFFSET  | BOUNDARY
-----------------------------------------------------------------------------------------------
PASS    | coin_pickup.sfx          | 0.32   s | -16.8 / -16.8   | -24.9     | -0.0000    | Clean   
PASS    | explosion_deep.sfx       | 0.80   s | -11.4 / -11.4   | -23.2     | +0.0006    | Clean   
PASS    | sword_clash.sfx          | 0.25   s | -6.9 / -6.9     | -26.1     | -0.0004    | Clean   
PASS    | ui_select.sfx            | 0.05   s | -16.4 / -16.4   | -29.5     | -0.0001    | Clean   
```

---

## 6. Ebitengine Integration Guide

### 6.1 Compiling SFX at Startup
Always compile `.sfx` DSL scripts into PCM buffers during game initialization. This eliminates CPU synthesis overhead during active gameplay frames:

```go
package main

import (
	"bytes"
	"time"

	"github.com/hajimehoshi/ebiten/v2/audio"
)

var laserDSL = `
title "Laser Blaster"
type sfx
inst laser preset=arcade_laser vol=0.60
seq: 950Hz->110Hz:140ms
`

type SoundManager struct {
	audioCtx *audio.Context
	sounds   map[string][]byte
	lastPlay map[string]time.Time
}

func NewSoundManager(audioCtx *audio.Context) (*SoundManager, error) {
	laserPCM, err := CompileDSL(laserDSL)
	if err != nil {
		return nil, err
	}

	// Validate production quality at startup
	if rep, err := ValidateProductionSFX(laserPCM); err != nil || !rep.Passed {
		// Log validation issues if needed
	}

	sm := &SoundManager{
		audioCtx: audioCtx,
		sounds:   make(map[string][]byte),
		lastPlay: make(map[string]time.Time),
	}
	sm.sounds["laser"] = laserPCM
	return sm, nil
}
```

### 6.2 Playing Sound Effects with Cooldown Rate-Limiting
When many enemies fire or take damage simultaneously, playing 20 identical sounds on the exact same frame causes digital summing distortion and acoustic harshness. Enforce a cooldown interval (typically 30 to 60 milliseconds) per cue name:

```go
func (sm *SoundManager) PlaySFX(name string, cooldown time.Duration) error {
	now := time.Now()
	if last, ok := sm.lastPlay[name]; ok {
		if now.Sub(last) < cooldown {
			return nil // Rate-limited to prevent acoustic fatigue
		}
	}

	pcm, ok := sm.sounds[name]
	if !ok {
		return nil
	}

	sm.lastPlay[name] = now

	// Ensure 4-byte frame alignment (&^ 3)
	aligned := pcm[:len(pcm)&^3]
	player := sm.audioCtx.NewPlayerFromBytes(aligned)
	player.Play()
	return nil
}
```

### 6.3 Mandatory 4-Byte Frame Alignment (`&^ 3`)
Ebitengine's audio engine expects 16-bit stereo PCM (2 bytes left + 2 bytes right = 4 bytes per frame). Unaligned byte lengths can cause panics or static. Always truncate lengths to multiples of 4 using bitwise clear:

```go
safeLength := len(pcm) &^ 3
```

---

## 7. CLI Reference

The CLI runner located in `scripts/play.go` provides auditioning, validation, and export capabilities.

```bash
cd skills/procedural-sfx/scripts

# Audition an .sfx file in real time
go run . play laser_arcade.sfx

# Run the interactive demo suite cycling through all 18 curated sound effects
go run . demo

# Validate sound effect files against production standards
go run . validate *.sfx

# List all 18 built-in archetype presets and their parameters
go run . presets

# Export an .sfx file to a standard 44.1 kHz 16-bit stereo WAV file
go run . export laser_arcade.sfx laser.wav
```
