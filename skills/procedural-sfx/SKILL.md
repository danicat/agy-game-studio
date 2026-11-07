---
name: procedural-sfx
description: >
  Synthesize zero-latency procedural game sound effects (SFX) and ambient loops in pure Go
  for Ebitengine using the Procedural SFX DSL (.sfx). Covers transient envelopes, pitch sweeps
  (Hz->Hz:ms), 2-operator inharmonic FM (metallic clangs, coins, bells), filtered noise bursts
  (explosions, footsteps, thrusters, wind), multi-layer impact stacking, DSP post-processing
  (LPF, HPF, bitcrusher), cooldown rate-limiting, and real-time or WAV export workflows.
license: Apache-2.0
metadata:
  category: game-dev
  tags: "audio, sfx, sound-effects, dsp, synthesis, procedural-audio, sfx-dsl, ebiten, gamedev, go"
  author: Daniela Petruzalek (daniela@danicat.dev)
---

# Procedural Sound Effects & SFX DSL Guide

Use this skill to design, synthesize, and play zero-latency procedural sound effects (SFX) and ambient texture loops in pure Go for Ebitengine (`github.com/hajimehoshi/ebiten/v2/audio`).

All sound effects are authored in the **Procedural SFX DSL** (`.sfx` files or inline strings) and compiled directly into 44.1 kHz, 16-bit signed little-endian stereo PCM byte slices (`[]byte`) at startup—eliminating runtime synthesis overhead and external binary audio assets.

> [!TIP]
> **Looking for multi-track background music (BGM), chord progressions, or tracker patterns?**
> Use the companion **`procedural-music`** skill (`skills/procedural-music/SKILL.md`), which shares the same `sound.go` synthesizer engine and adds MML/Tracker pattern notation (`pattern`, `track`, chords, `@+N` transposition, and `(...)*N` repeats).

---

## 1. The Procedural SFX DSL Specification

An `.sfx` script consists of metadata/DSP headers followed by either:
- **Direct Step Sequences (`step`)**: Quick, explicit step-by-step synthesis where each step defines its own frequencies, duration, waveform, ADSR envelope, FM parameters, or noise blend.
- **Instrument + Sequence/Track Layers (`inst` + `seq` or `track`)**: Define reusable timbres (`inst`) and trigger pitch sweeps (`950Hz->120Hz:150ms`), notes (`E6:16`), or stacked multi-layer transient + body tracks.

### 1.1 Headers & Global DSP Directives

| Directive | Syntax Example | Description |
| :--- | :--- | :--- |
| `title` | `title: Plasma Rifle Shot` | Human-readable sound effect name |
| `type` | `type: sfx` | Sound category (`sfx` for one-shot effects, `music` for looping cues) |
| `bpm` | `bpm: 120` | Optional tempo when using beat-relative durations (`:4`, `:8`, `:16`) |
| `filter` | `filter: lpf cutoff=1800` | Optional master post-processing filter (`lpf` or `hpf` with `cutoff=<Hz>`) |
| `bitcrush` | `bitcrush: bits=8 downsample=4` | Optional retro lo-fi quantizer (`bits=1..16`, `downsample=1..N`) |
| `loop` | `loop: start=0.05 end=0.95` | Optional seamless loop window in seconds (`SliceLoopPCM`) for ambient loops |

Comments start with `#` (when at column 0 or preceded by whitespace) or `//`.

### 1.2 Explicit `step` Directives

Each `step` line appends a consecutive synthesis segment with millisecond or beat duration:

```text
step <freq_or_sweep>:<duration> wave=<type> vol=<0..1> env=<A>,<D>,<S>,<R> [noise=<0..1>] [fm=<ratio>,<index>]
```

- **Frequency / Pitch Sweep**:
  - Fixed frequency in Hz or scientific pitch: `440Hz:80ms`, `A5:16`, `0Hz:50ms` (pure noise or silence).
  - Exponential pitch sweep (`start->end:duration`): `950Hz->120Hz:150ms`, `140Hz->550Hz:110ms`, `C5->C3:120ms`.
- **Duration**:
  - Explicit time: `45ms`, `150ms`, `0.25s`.
  - Beat subdivision (uses `bpm`, default `120`): `:4`, `:8`, `:16`, `:32`.
- **Parameters**:
  - `wave=<sine|square|triangle|saw|noise|fm>`
  - `vol=<0.0..1.0>` (step gain multiplier)
  - `env=<attack_sec>,<decay_sec>,<sustain_level>,<release_sec>` (e.g., `env=0.002,0.08,0.0,0.03`)
  - `noise=<0.0..1.0>` (blends white noise into pitched oscillator for gritty impacts and thrusters)
  - `fm=<mod_ratio>,<mod_index>` (2-operator FM parameters; irrational ratios like `1.414` or `2.76` create metallic clangs)

### 1.3 Instrument (`inst`) + `seq` / `track` Layering

For multi-layered sound effects (e.g., stacking a sub-bass boom, a mid-range crunch, and a high-frequency debris tail in parallel), define instruments (`inst`) and stack `track` lines:

```text
title: Heavy Grenade Explosion
type: sfx
filter: lpf cutoff=2400

inst sub_boom   wave=sine  vol=0.90 env=0.003,0.35,0.0,0.10
inst crunch     wave=saw   vol=0.65 env=0.002,0.18,0.1,0.08 noise=0.75
inst debris     wave=noise vol=0.45 env=0.010,0.45,0.0,0.15

track sub_boom: 110Hz->28Hz:450ms
track crunch:   220Hz->45Hz:280ms 0Hz:170ms
track debris:   1000Hz:450ms
```

All `track` declarations render in parallel and mix with automatic soft clipping (`math.Tanh` above `0.85` peak) to prevent harsh digital distortion.

---

## 2. Acoustic Physics & Sound Design Principles

Why do procedural sound effects often sound like sterile "test tones"? Because real physical impacts have **three distinct phases** and **rapid pitch/timbre movement**:

1. **The Transient (0–15 ms)**: The initial snap, click, or burst of energy when two objects collide or a plasma bolt ignites. Needs an ultra-fast attack (`0.001`–`0.005`s) and high-frequency or noisy content.
2. **The Body (15–150 ms)**: The resonant pitch sweep or fundamental tone that gives the sound weight and pitch identity.
3. **The Tail (150–600 ms)**: The decaying resonance, metallic ring, or filtered noise rumble.

```
Amplitude
  ^
1.0|   /\  <-- Transient (1-5ms Attack, bright/noisy snap)
   |  /  \
0.5| /    \______  <-- Body (Exponential pitch sweep / FM ring)
   |/            \________
0.0+-----------------------\--> Time (ms)
                            \-- Tail (Low-pass noise / release decay)
```

### Key Synthesis Techniques

- **Exponential Pitch Sweeps (`start->end`)**: Human pitch perception is logarithmic (octaves double in frequency). `SynthesizePatch` uses exponential frequency interpolation (`f0 * (f1/f0)^t`) whenever `Freq > 0 && EndFreq > 0`, making laser zaps (`950Hz->120Hz`) and jump whooshes (`140Hz->580Hz`) sound tight and natural rather than front-loaded.
- **Inharmonic 2-Operator FM (`wave=fm fm=<ratio>,<index>`)**:
  - Integer ratios (`1.0`, `2.0`, `3.0`) produce harmonic tones (synths, organs, bass).
  - Irrational ratios (`1.414`, `2.76`, `3.14`) produce **inharmonic sidebands** that sound like struck metal: swords clashing, armor hits, anvils, coins, and bells.
  - Because `SynthesizePatch` scales the FM modulation index by the ADSR envelope (`env * ModIndex`), a fast decay automatically sweeps the timbre from a bright metallic strike down into a pure sine ring-out!
- **Noise + Oscillator Blending (`noise=0.0..1.0`)**: Pure white noise lacks pitch identity; pure oscillators lack grit. Blending `noise=0.35` into a downward-sweeping `saw` or `square` wave produces punchy gunshots, engine thrusters, and heavy footsteps.

---

## 3. Procedural SFX Recipe Catalog

All recipes below are valid `.sfx` DSL scripts ready to pass to `CompileDSL` or play via the CLI runner.

### 3.1 Laser / Plasma Zap
Rapid downward exponential sweep on a square/saw wave with a small noise burst for ignition bite:

```text
title: Laser Zap
type: sfx

inst laser wave=square vol=0.70 env=0.002,0.09,0.1,0.03 noise=0.15
seq: 980Hz->110Hz:140ms
```

### 3.2 Platformer Jump Whoosh
Two-stage upward exponential pitch sweep with triangle wave warmth:

```text
title: Jump Whoosh
type: sfx

inst jump wave=triangle vol=0.65 env=0.005,0.06,0.6,0.03
seq: 150Hz->320Hz:65ms 320Hz->640Hz:95ms
```

### 3.3 Coin / Gem Pickup
Two crisp high-pitched notes (`B5` -> `E6`) using 2-operator FM for a bright metallic chime:

```text
title: Coin Pickup
type: sfx
bpm: 150

inst chime wave=fm vol=0.65 env=0.001,0.18,0.15,0.08 fm=2.0,1.8
seq: B5:32 E6:8
```

### 3.4 Sword Clash / Metallic Armor Hit
Inharmonic FM (`fm=1.414,4.5`) layered with a brief high-frequency noise scrape:

```text
title: Sword Clash
type: sfx

inst blade_ring wave=fm    vol=0.75 env=0.001,0.22,0.0,0.08 fm=1.414,4.5
inst scrape     wave=noise vol=0.50 env=0.001,0.035,0.0,0.01

track blade_ring: 880Hz->860Hz:280ms
track scrape:     2000Hz:45ms 0Hz:235ms
```

### 3.5 Multi-Layer Explosion
Sub-bass sine drop + distorted bitcrushed noise rumble + low-pass filter:

```text
title: Arcade Explosion
type: sfx
filter: lpf cutoff=1600
bitcrush: bits=6 downsample=3

inst boom   wave=sine  vol=0.95 env=0.002,0.40,0.0,0.10
inst rumble wave=saw   vol=0.75 env=0.005,0.38,0.1,0.12 noise=0.80

track boom:   120Hz->24Hz:500ms
track rumble: 180Hz->32Hz:500ms
```

### 3.6 UI Click / Hover Tick & Error Buzz
Ultra-short micro-transients (`15ms`–`90ms`) that give menus tactile responsiveness:

```text
# UI Hover Tick (crisp high-passed micro-pop)
title: UI Hover Tick
type: sfx
filter: hpf cutoff=1200

step 1800Hz->900Hz:18ms wave=triangle vol=0.45 env=0.001,0.012,0.0,0.005
```

```text
# UI Error / Invalid Action Buzz (double low sawtooth pulse)
title: UI Error Buzz
type: sfx
filter: lpf cutoff=950

inst buzz wave=saw vol=0.60 env=0.003,0.06,0.3,0.02 noise=0.10
seq: 130Hz:80ms R:30ms 110Hz->95Hz:120ms
```

### 3.7 Footstep on Gravel / Dirt
High-passed short noise burst with a subtle low thud:

```text
title: Gravel Footstep
type: sfx
filter: hpf cutoff=450

inst thud   wave=sine  vol=0.55 env=0.002,0.04,0.0,0.01
inst gravel wave=noise vol=0.45 env=0.003,0.05,0.0,0.02

track thud:   140Hz->55Hz:55ms
track gravel: 800Hz:65ms
```

### 3.8 Power-Up Arpeggio
Rapid upward 16th-note arpeggio with FM shimmer:

```text
title: Shield Power-Up
type: sfx
bpm: 160

inst power wave=fm vol=0.65 env=0.003,0.08,0.4,0.04 fm=2.0,1.5
seq: C4:16 E4:16 G4:16 C5:16 E5:16 G5:16 C6:8
```

---

## 4. DSP Post-Processing & Ambient Loops

Beyond per-step synthesis, `sound.go` provides four standalone DSP post-processing functions (also accessible via DSL headers):

1. **`ApplyLowPassFilter(pcm []byte, cutoffHz float64) []byte`** (`filter: lpf cutoff=<Hz>`):
   - Single-pole RC low-pass filter (`alpha = dt / (rc + dt)`).
   - **Use cases**: Muffling explosions underwater or behind walls, taming harsh white noise into wind or distant thunder, warming up raw square/sawtooth waves.
2. **`ApplyHighPassFilter(pcm []byte, cutoffHz float64) []byte`** (`filter: hpf cutoff=<Hz>`):
   - Single-pole RC high-pass filter.
   - **Use cases**: Removing muddy sub-bass from UI clicks, hi-hats, footsteps, and radio/intercom voice effects.
3. **`ApplyBitcrush(pcm []byte, bits int, downsample int) []byte`** (`bitcrush: bits=<1..16> downsample=<1..N>`):
   - Sample-and-hold decimator + bit-depth quantizer.
   - **Use cases**: Retro 8-bit/arcade explosions (`bits=6 downsample=4`), robotic voice glitches, shield break effects.
4. **`SliceLoopPCM(pcm []byte, startSec, endSec float64) ([]byte, error)`** (`loop: start=<sec> end=<sec>`):
   - Extracts a 4-byte aligned sub-slice (`&^ 3`) and applies a 2 ms anti-click micro-fade at both boundaries.
   - **Use cases**: Turning a synthesized noise/hum buffer into a seamless looping engine thruster, force-field hum, or wind ambience without boundary clicks.

---

## 5. Ebitengine Integration & Cooldown Rate-Limiting

### 5.1 Pre-Baking SFX at Startup

Always compile `.sfx` DSL scripts into PCM buffers during `init()` or level load, then register them with `SoundSystem.RegisterSound`:

```go
var sfxLaserDSL = `
title: Laser Zap
type: sfx
inst laser wave=square vol=0.70 env=0.002,0.09,0.1,0.03 noise=0.15
seq: 980Hz->110Hz:140ms
`

func initAudio(ss *SoundSystem) error {
	laserPCM, _, err := CompileDSL(sfxLaserDSL)
	if err != nil {
		return err
	}
	ss.RegisterSound("laser", laserPCM)
	return nil
}
```

### 5.2 Preventing "Machine-Gun" Clipping with `PlaySFX`

In action games, 20 enemies taking damage or firing on the exact same frame will stack 20 identical waveforms, causing severe digital clipping and ear fatigue. Use `SoundSystem.PlaySFX(name, cooldown)` to enforce a minimum interval (typically `35ms`–`60ms`) between triggers of the same sound effect:

```go
// At most one "laser" trigger every 45 milliseconds
if err := ss.PlaySFX("laser", 45*time.Millisecond); err != nil {
	return err
}
```

### 5.3 Ebitengine 4-Byte Alignment Invariant

Ebitengine's `audio.Context` processes 16-bit signed little-endian stereo PCM (`4 bytes per sample frame`). Passing an unaligned buffer length or seek offset causes panics or loud static. All helpers in `sound.go` (`SynthesizePatch`, `CompileDSL`, `SliceLoopPCM`, `SeekBytes`) enforce `&^ 3` alignment automatically.

---

## 6. CLI Player & WAV Exporter (`scripts/`)

This skill bundles a standalone Ebitengine synthesizer and CLI preview/export runner in `scripts/`:
- `scripts/sound.go`: Complete DSL parser, synthesizer, DSP filters, `SoundSystem`, and `ExportWAV`.
- `scripts/play.go`: CLI runner (`main` package) to audition `.sfx` files in real time or export `.wav` files.

### Commands

```bash
# Audition an .sfx file in real time
cd skills/procedural-sfx/scripts
go run . -file laser.sfx

# Export an .sfx file to a standard 44.1 kHz 16-bit stereo WAV file
go run . -file explosion.sfx -out explosion.wav

# Run the built-in SFX demo suite
go run .
```
