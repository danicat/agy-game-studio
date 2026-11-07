---
name: procedural-music
description: >
  Pure-code procedural music composition guide and MML/tracker-style Music DSL
  for polyphonic background music (BGM) in games. Generates 4-byte aligned
  16-bit 44.1 kHz stereo PCM soundtracks in memory with two synthesis options:
  a default pure-Go SEGA Mega Drive YM2612 4-operator FM + band-limited PolyBLEP
  SN76489 PSG + harmonic DSP engine, and a native macOS Apple CoreAudio real
  instrument engine (-apple) backed by gs_instruments.dls. Teaches non-formulaic
  original composition across diverse genres, rhythmic grids, macro-forms, and
  voice-leading rules distilled from classic 16-bit soundtracks. Activate when
  composing original game soundtracks, writing .music DSL scores, or building
  zero-asset game music engines.
license: Apache-2.0
metadata:
  category: game-dev
  tags: "procedural-music, procedural-audio, game-dev, ym2612, coreaudio, chiptune, synth, bgm, music-dsl, music-theory"
  author: Daniela Petruzalek (daniela@danicat.dev)
  version: "0.2.0"
  catalog: https://skills.danicat.dev
---

# Procedural music: Original composition guide and dual-engine DSL

This skill provides a **Music Composition DSL**, a music-theory checker, and **two synthesis options** from a single `.music` score:
1. **Default (Non-Apple)**: A pure-Go **SEGA Mega Drive YM2612 4-operator FM + band-limited SN76489 PSG + harmonic DSP** synth with zero external assets.
2. **Apple (`-apple`)**: A native **macOS CoreAudio real-instrument synth** backed by Apple's built-in Roland GS / General MIDI instrument bank (`gs_instruments.dls`) that upgrades the score with sampled guitars, electric and slap bass, brass sections, strings, keyboards, and acoustic drums.

> [!IMPORTANT]
> **Compose original music, not formulaic clones**:
> Classic 16-bit soundtracks (*Streets of Rage*, *Shinobi III*, *Gaiares*, and *Elemental Master*) succeed because each track builds a distinct world through its own tempo, instrument palette, rhythmic grid, and macro-form. Never stamp every song from a single template:
> - **Match the palette to the setting**: A street-club track uses FM synth-brass, electric piano, slap bass, and PSG leads with zero guitars. A ninja horseback stage contrasts shamisen and koto ostinatos against brass and toms. A gothic shooter pairs twin harmonizing guitars with pipe organ and strings.
> - **Use 8 to 12+ independent channels**: Give each musical role its own track (`30s` to `150s+` duration) so counter-melodies, harmonies, and arpeggios stack on top of the main riff instead of replacing it.
> - **Respect cross-bar phrasing and re-attacked stabs**: Tie sustained melody notes and pads smoothly across barlines without false re-attacks, while writing explicit re-attacks and release gaps (`R:16`) for syncopated chord stabs and bass pulses.
> - **Anchor low frequencies in `C1–C2` (`32–130 Hz`)**: Keep sub-bass and bass fundamentals in Octave 1 and Octave 2 so **50% to 75%** of spectral energy sits below `260 Hz` with zero stationary noise on percussion or melodic voices.

---

## Available scripts and reference scores

- `scripts/sound.go`: Music DSL lexer and parser (`ParseDSL`, `CompileDSL`, `LoadDSLFile`), band-limited harmonic and FM synth (`SynthesizeScore`, `SynthesizeScoreProcedural`), music-theory checker (`ValidateScoreTheory`, `ValidateProductionBGM`), DSP filters (`SliceLoopPCM`, `ApplyLowPassFilter`, `ApplyHighPassFilter`, `ApplyBitcrush`), `SoundSystem` player, and WAV exporter (`ExportWAV`).
- `scripts/ym2612_bank.go`: Hardware-accurate SEGA Mega Drive **YM2612 (OPN2)** 4-operator integer FM + band-limited PolyBLEP **SN76489 PSG** + exponential-decay percussion engine (`stepYM2612Voice`, `stepYM2612Drum`).
- `scripts/gm_instruments.go`: General MIDI program (`0..127`) and Channel 10 drum kit (`27..87`) resolver (`ParseGMProgram`, `ParseGMDrumNote`, `ResolveGMProgram`, `ResolveGMDrumNote`).
- `scripts/apple_synth_darwin.go` & `scripts/apple_synth_other.go`: Native macOS `AudioToolbox` (`MIDISynth` / `DLSSynth`) offline renderer (`SynthesizeScoreApple`) backed by `gs_instruments.dls`.
- `scripts/sound_test.go`: Automated tests verifying drift-free timing, music theory rules, YM2612 periodicity, drum decay hygiene, Non-Apple vs. Apple waveform distinctness, and all reference scores.
- `scripts/play.go`: CLI checker (`validate`), player (`play`, `demo`), and WAV exporter (`export`) supporting the `-apple` flag.
- **Five classic 16-bit study scores** (illustrating five distinct compositional styles):
  - `scripts/bare_knuckle_intro.music`: *Bare Knuckle / Streets of Rage - Intro* (Yuzo Koshiro, `100 BPM`, 41 bars / `98.4s`). Dark urban pad and triplet/delay PSG lead building into a syncopated 3-voice FM synth-brass house hook, slap-bass groove, and soaring counter-melody.
  - `scripts/ground_zero.music`: *Shinobi III - Ground Zero* (`96 BPM`, 56 bars / `140s`). Lyrical rock ballad using modal mixture (`C` Major + borrowed `C` Aeolian chords) over an evolving 3-cycle backing arrangement.
  - `scripts/gaiares_level2.music`: *Gaiares - Mission 2 Ice Stage* (Shinobu Ogawa, `134 BPM`, 73 bars / `130.7s`). Sci-fi shooter theme featuring a 2-bar solo drum intro, multi-bar cross-bar legato leads over rapid PSG arpeggios, and a 33-bar asymmetric loop with a 1-bar solo drum-break turnaround.
  - `scripts/shinobi2_stage2.music`: *The Super Shinobi II / Shinobi III - Idaten* (Morihiko Akiyama, `150 BPM`, 98 bars / `156.8s`). Fast East-Asian fusion action theme framing a 44-bar multi-section loop with a `3+3+3+3+2+2` shamisen/koto pluck ostinato and galloping toms.
  - `scripts/elemental_master_stage1.music`: *Elemental Master - Dance of Flame* (Toshiharu Yamanishi, `126 BPM`, 69 bars / `131.4s`). Neoclassical symphonic metal anthem with an 8-bar ceremonial fanfare intro, twin harmonizing FM guitars in parallel 3rds and 6ths, and driving 16th-note bass.
- **Additional original scores**: `scripts/battle_theme.music` (32-bar boss battle theme) and `scripts/credits_theme.music` (36-bar violin and choir credits ballad).

---

## 1. Core architecture and PCM alignment

### 1.1 Two synthesis options (`Default` vs. `Apple`)
The engine compiles readable `.music` text scores into 16-bit 44.1 kHz stereo PCM buffers using one of two synthesis engines:
* **Default / Non-Apple (`synth default`, or omit `-apple`)**: Uses zero external assets or OS libraries. Synthesizes SEGA Mega Drive **YM2612 (OPN2)** 4-operator FM voices using the 256-entry 12-bit quarter-wave `logsin` and 11-bit `exp` ROM tables (`-8176..+8176`), 20-bit phase counters with 5-bit `keyCode` detune (`DT 0..7`) and multiplier (`MUL 0..15`), and 10-bit envelope stages (`AR`, `D1R`, `SL`, `D2R`, `RR`, `RS`) clocked at `17,756 Hz`. Multi-carrier algorithms (`ALG 4` and `ALG 5`) use calibrated carrier Total Levels (`TL`) and 14-bit floating-point scaling (`float64(out14) / 8192.0`) so chords never clip or buzz. SN76489 PSG pulse waves use `polyBLEP` anti-aliasing, and percussion voices apply exponential decay envelopes (`math.Exp(-decayRate * t)`) so sustained drum slots never leak stationary white noise.
* **Apple Real Instruments (`synth apple` or `-apple` CLI flag)**: Uses macOS's built-in `AudioToolbox` `MIDISynth` / `DLSSynth` AudioUnit backed by `/System/Library/Components/CoreAudio.component/Contents/Resources/gs_instruments.dls`. Each track renders on its own isolated stereo AudioUnit with natural `NoteOff` release tails, upgrading the same `.music` score with real sampled instruments while following every dynamic ramp and stereo pan.
* **Drift-free multi-track timing & C1 soft-knee master bus**: Every track converts beat divisions to sample frames using cumulative time rounding (`int(math.Round(cursorSec * 44100))`). `MixTracksPCM` sums all stereo tracks with a $C^1$-continuous soft-knee master limiter above 85% full scale so peaks never hard-clip.

### 1.2 Mandatory 4-byte PCM frame alignment (`&^ 3`)
`Ebitengine` audio output uses 16-bit signed Little-Endian stereo PCM at 44,100 Hz (`176,400` bytes/sec):
* Every stereo sample frame is **4 bytes** (2 bytes Left + 2 bytes Right).
* `Ebitengine` functions `audio.Context`, `audio.NewInfiniteLoop`, and `Seek` **panic at runtime** if given a buffer length or seek offset that isn't divisible by 4. Always mask lengths and offsets with `&^ 3`:
  ```go
  alignedLen := len(pcm) &^ 3
  alignedOffset := seekBytes &^ 3
  ```

---

## 2. Music composition DSL specification

A `.music` score has four sections: **headers**, **instruments (`inst`)**, **reusable patterns (`pattern`)**, and **multi-channel tracks (`track`)**.

### 2.1 Header directives and classical tempo markings (`tempo` / `bpm`)
```text
title "Bare Knuckle / Streets of Rage - Intro"
type song
tempo moderato 100
time 4/4
```
* `#` (at line start or after spaces) and `//` start comments.
* `synth <default|apple>` optionally selects the default pure-Go YM2612/PSG/DSP engine (`default`) or the macOS CoreAudio real-instrument engine (`apple`).
* `tempo <marking> [<bpm>]` or `bpm <number|marking>` sets the tempo using a number, a classical Italian marking, or both:

| Tempo Marking | Default BPM | Typical Character & Scene Fit |
| :--- | :--- | :--- |
| `larghissimo` / `grave` / `largo` / `lento` / `larghetto` | `24` / `42` / `50` / `56` / `63` | Solemn, mysterious, or atmospheric intros |
| `adagio` / `adagietto` | `70` / `76` | Slow, reflective themes and quiet sanctuaries |
| `andante` / `andantino` | `88` / `96` | Flowing pace for lyrical stage themes and credits ballads |
| `moderato` / `allegretto` | `112` / `120` | Mid-tempo urban grooves (`100 BPM` *Streets of Rage*), exploration, and club beats |
| `allegro` | `138` | Upbeat action stages (`126–150 BPM` *Elemental Master*, *Gaiares*, *Idaten*) |
| `vivace` / `vivacissimo` | `160` / `172` | High-energy boss battles and intense combat |
| `presto` / `prestissimo` | `184` / `204` | Fast escape sequences and final boss phases |

### 2.2 Instrument patches (`inst`) and built-in studio defaults
Every `wave=` archetype comes pre-loaded with studio-calibrated defaults for `vol`, `adsr`, `vib`, `lpf`, `duty`, and a matching General MIDI (`gm=` / `gm_drum=`) instrument for `-apple`. You only need to declare `inst <name> wave=<archetype>` plus the specific attributes you want to override (such as stereo `pan` or custom `vol`):

```text
inst fm_brass_lead wave=ym2612_brass      pan=-0.18
inst fm_brass_echo wave=ym2612_brass      gm=synth_brass_1 vol=0.13 pan=0.24 lpf=0.44
inst psg_lead      wave=psg_square        vol=0.15 pan=-0.10
inst fm_bass       wave=ym2612_slap_bass
inst sub_bass      wave=sub_bass          gm=electric_bass
```

A standard **8-piece studio drum kit** (`kick`, `snare`, `tom_hi`, `tom_mid`, `tom_low`, `hat`, `open_hat`, `crash`) is **pre-seeded in every score**. You can reference `kick`, `snare`, `tom_hi`, `tom_mid`, `tom_low`, `hat`, `open_hat`, and `crash` directly in `pattern` and `track` blocks without writing `inst` lines unless you want to customize a drum's gain, pan, or pitch sweep.

| Waveform (`wave=`) | Default `gm=` Upgrade (`-apple`) | Studio Archetype Defaults & Best Musical Roles |
| :--- | :--- | :--- |
| `ym2612_brass` | `brass_section` (`synth_brass_1`, `synth_brass_2`) | `vol=0.12 pan=0.20 adsr=0.025,0.16,0.86,0.14 vib=4.8,0.06 lpf=0.36`. Punchy 4-op FM synth-brass for syncopated chord stabs (*Streets of Rage*), fanfares, and warm swells. |
| `ym2612_epiano`, `ym2612_bell` | `epiano1`, `vibraphone` (`tubular_bells`) | `epiano`: `vol=0.13 lpf=0.38`; `bell`: `vol=0.060 lpf=0.64`. Crystalline OPN2 electric piano and FM chime for intro chords, inner-voice stabs, and melody doubling. |
| `ym2612_guitar`, `ym2612_rhythm_guitar` | `overdriven_guitar`, `distortion_guitar` | `guitar`: `vol=0.16 vib=5.5,3.50 lpf=0.46`; `rhythm_guitar`: `vol=0.10 lpf=0.42`. 4-op FM rock leads, twin-guitar parallel harmonies (*Elemental Master*), and power chords. |
| `ym2612_bass`, `ym2612_slap_bass`, `sub_bass` | `electric_bass`, `slap_bass_1`, `synth_bass_1` | `bass`: `vol=0.25 lpf=0.055`; `slap_bass`: `vol=0.22 lpf=0.065`; `sub_bass`: `vol=0.24 lpf=0.036`. Anchors `C1–C2` (`32–130 Hz`). |
| `ym2612_strings`, `ym2612_choir`, `ym2612_flute` | `string_ensemble_1`, `choir_aahs`, `flute` | `strings`/`choir`: `vol=0.10 lpf=0.32`; `flute`: `vol=0.12 vib=5.5,2.20 lpf=0.42`. Ensemble string pads, vocal choir textures, and woodwind counter-lines. |
| `psg_square`, `psg_arp` | `lead_square`, `orchestral_harp` (`clavinet`) | `psg_square`: `vol=0.050 duty=0.50 lpf=0.42`; `psg_arp`: `vol=0.072 duty=0.25 lpf=0.44`. Band-limited SN76489 pulse waves for chip leads, delay echoes, and fast `:16` arpeggios. |
| `koto`, `shamisen`, `harp`, `guitar` | `koto`, `shamisen`, `orchestral_harp`, `nylon_guitar` | Plucked string voices (`vol=0.11–0.13`) for East-Asian fusion ostinatos (*Idaten*) and acoustic intros. |
| `violin`, `cello`, `piano`, `organ`, `oboe`, `clarinet`, `shakuhachi` | `violin`, `cello`, `piano`, `church_organ`, `oboe`, `clarinet`, `shakuhachi` | Orchestral strings, keyboard, and solo woodwind models with calibrated attack, vibrato, and filter curves. |
| `kick`, `snare`, `tom`, `hat`, `open_hat`, `crash` | `gm_drum=kick`, `snare`, `tom_hi`, `tom_mid`, `tom_low`, `hat`, `open_hat`, `crash` | Pre-seeded 8-piece exponential-decay Mega Drive drum kit in default mode; acoustic GM drum kit in `-apple` mode. |

| Attribute | Values / Format | Description |
| :--- | :--- | :--- |
| `gm` / `program` | `0..127` or GM name | Real `gs_instruments.dls` instrument for `-apple` (inferred from `wave=` if omitted). |
| `gm_drum` / `drum_note` | `27..87` or drum name | General MIDI Channel 10 percussion note (`kick`, `snare`, `hat`, `open_hat`, `crash`, `tom_hi`, `tom_mid`, `tom_low`). |
| `vol` | `0.0` .. `1.0` | Voice gain override. Keep mids/highs around `0.05–0.18` and bass around `0.20–0.25`. |
| `pan` | `-1.0` .. `+1.0` | Constant-power stereo pan (`-1.0` left, `0.0` center, `+1.0` right). |
| `adsr` | `A,D,S,R` | Envelope override: Attack (sec), Decay (sec), Sustain (`0..1`), Release (sec). |
| `vib` | `rateHz,depthHz` | LFO vibrato rate and depth override in Hz (`vib=5.5,2.20`). |
| `freq` / `sweep` | `<pitchOrHz>` or `<start>-><end>` | Drum pitch sweep override (`freq=158Hz->38Hz`). |
| `lpf` / `hpf` | `(0.0, 1.0]` | Per-instrument low-pass or high-pass filter alpha override. |

### 2.3 Note, chord, tied duration (`~`), repeat (`*N`), group (`(...):dur`), and barline (`|`) syntax
Events inside `pattern` and `track` blocks follow `<target>[:<duration>][*<repeat>][@<modifier>...]`:
* **Pitches, rests, and chords**:
  - Scientific pitch notation `C0`..`B8` with `#` (or `s`) for sharp and `b` for flat: `E5:2`, `Bb4:8.`, `A1:16`.
  - Rests use `R`, `_`, or `.` (`R:1`, `R:16`). Chords use brackets (`[A3 C4 E4]:1`, `[G3 B3 D4]:2`).
* **Standard, dotted, and triplet durations (`:<dur>`)**:
  - Standard subdivisions: `:1` (whole = 4 beats), `:2` (half = 2 beats), `:4` (quarter = 1 beat), `:8` (eighth = 0.5 beats), `:16` (sixteenth = 0.25 beats), `:32` (thirty-second = 0.125 beats).
  - Dotted notes (`.` = `1.5x`): `:1.` (6 beats), `:2.` (3 beats), `:4.` (1.5 beats), `:8.` (0.75 beats).
  - Triplets (`t` = `2/3x`): `:2t` (`4/3` beats), `:4t` (`2/3` beat), `:8t` (`1/3` beat), `:16t` (`1/6` beat).
* **Tied durations (`~`) and cross-barline ties (`~ |`)**:
  - Chain any combination of standard, dotted, or triplet durations with `~` instead of computing `/16` or `/48` fractions by hand:
    - Multi-bar holds: `C3:1~1` (2 bars), `A4:1~1~1` (3 bars), `C3:1~1~2.` (`2.75` bars).
    - Sub-beat and triplet ties: `B4:2.~8.` (`15/16` bar), `E5:4.~16` (`7/16` bar), `D5:1~1~4t` (2 bars + quarter-note triplet), `A5:1~2.~16t`.
  - **Cross-barline ties (`~ |`)**: Write a trailing `~` before a `|` barline (`F5:8~ | F5:16` or shorthand `F5:8~ | :16`) to tie a syncopated note across a measure boundary into a single continuous event with zero re-attack while keeping `|` barline verification exact.
  - Exact `<num>/<den>` fractions remain supported and evaluate through the same 64-bit GCD-reduced rational arithmetic as `~` ties.
* **Sticky running durations**:
  - When consecutive notes, chords, or rests share the same duration, state `:dur` once on the first token (`A4:8t C5 E5` or `E5:4t D5 C5`). The running duration stays active across tokens and inline `(...)` groups until the next `:dur`.
* **Repeats (`*N`) and group-scoped durations (`(...):dur`)**:
  - Repeat individual notes (`C5:8.*5`, `F5*3`) or folded multi-bar phrases (`(A5:2 F5:4 C5 | D5:2. G5:4 | A5:2 F5:4 C5 | B4:1 |)*2`).
  - Attach `:dur` to a parenthesized group (`(C3 G3 C4 G4):16` or `(snare*3 kick):16`) to set the default step duration inside the group without changing the outer running duration.
  - **4/4 Arpeggio Group Duration Math**: In 4/4 time, an 8-note group of sixteenth notes (`(C3 G3 C4 Eb4 G4 Eb4 C4 G3):16`) is exactly 2.0 beats (half a bar). To fill a complete 4/4 measure, append `*2` (`(C3 G3 C4 Eb4 G4 Eb4 C4 G3):16*2 |`) or write all 16 notes. An 8-note group of eighth notes (`(...):8`) fills 4.0 beats (one full bar).
* **Track block pattern references**:
  - Track blocks must strictly reference declared `pattern` identifiers (`track ch01 lead: lead_intro lead_secA`), never instrument names or raw notes with inline durations. Always declare patterns first with `pattern <name> = ...`.
* **Verified measure barlines (`|`)**:
  - Every `|` barline in a `pattern` or `track` is verified against the score's `time` signature (`4/4` = 4 beats per bar). If a bar drops or adds a 16th note or triplet, `ParseDSL` fails fast with the exact pattern/track name and beat offset.

### 2.4 Per-channel volume envelopes, articulations, and transposition
| Category | Modifiers | Behavior |
| :--- | :--- | :--- |
| **Static Levels** | `@ppp`, `@pp`, `@p`, `@mp`, `@mf`, `@f`, `@ff`, `@fff` | Scales note or group gain (`0.20x` to `1.55x`). |
| **Volume Ramps** | `@crescendo`, `@diminuendo`, `@fade_in`, `@fade_out`, `@swell`, `@vol=1.000->0.005` | Smoothly ramps gain sample-by-sample (and via `CC 11` Expression in `synth apple`) across the group or phrase. |
| **Articulations** | `@staccato` (`0.40`), `@spiccato` (`0.28`), `@pizzicato` (`0.35`), `@portato` (`0.70`), `@legato` (`1.0`), `@tenuto`, `@marcato` | Adjusts note gate ratio and attack transient without shifting beat boundaries. |
| **Phrase Modifiers** | `@+12` / `@-12` (or `@+N` / `@-N`), `@pan=-0.6->0.6`, `@lpf=0.35` | Transposes a pattern or group in semitones (`bass_body@-12`), sweeps stereo pan, or overrides filter cutoff. |

---

## 3. Music theory and composition best practices from five 16-bit classics

To compose original songs that feel alive and distinct rather than formulaic, apply these eight principles drawn from *Streets of Rage*, *Gaiares*, *Shinobi III* (*Ground Zero* and *Idaten*), and *Elemental Master*.

### 3.1 Choose a distinct genre palette and macro-form for each song
Never force every track into the same instrument list or an identical `8-bar A + 8-bar B` loop. Pick a structural archetype that fits the scene's dramatic arc:

| Archetype & Study Track | Tempo & Feel | Core Instrument Palette | Macro-Form Architecture |
| :--- | :--- | :--- | :--- |
| **Urban Electronic / Club Groove** (`bare_knuckle_intro.music`) | `100 BPM` (`moderato`), syncopated house/funk | **Zero guitars**: 3-voice FM synth-brass (`brass_section`, `synth_brass_1`, `synth_brass_2`), `epiano1`, `psg_square` lead + `1/8` `clavinet` delay, `slap_bass_1`, `string_ensemble_1`. | **Through-composed 2-phase arc (`41 bars`)**: `8-bar` drumless dark intro -> `8-bar` pulsing bass + club beat buildup -> `8-bar` 3-voice brass hook -> `8-bar` climax adding high PSG counter-lead + harmony -> `9-bar` drumless brass/sub-bass fade outro. |
| **Sci-Fi / Crystalline Shmup** (`gaiares_level2.music`) | `134 BPM` (`allegro`), propulsive & airy | Bright FM lead + echo, `vibraphone` bell, `epiano1`, `brass_section`, `orchestral_harp` `:16` PSG arps, `electric_bass` + `slap_bass_1`. | **Asymmetric loop with drum break (`73 bars`)**: `2-bar` solo drum fill over `Ab1` bass pedal -> `33-bar` main loop (`32` melodic bars + `1` solo drum-break turnaround bar) x 2 -> `5-bar` fade. |
| **East-Asian Fusion / High-Speed Action** (`shinobi2_stage2.music`) | `150 BPM` (`allegro`), galloping momentum | Plucked `shamisen` / `koto` / `orchestral_harp` ostinato, galloping `tom_mid` percussion, heroic FM lead, brass, and driving bass. | **Ostinato frame + multi-section loop (`98 bars`)**: `4-bar` shamisen/tom intro -> `44-bar` loop (`A` heroic theme -> `B` modal lift -> `C` breakdown -> `4-bar` shamisen bridge) x 2 -> `6-bar` fade. |
| **Neoclassical / Symphonic Action** (`elemental_master_stage1.music`) | `126 BPM` (`allegro`), dramatic & driving | Twin harmonizing `overdriven_guitar` + `distortion_guitar` in parallel 3rds/6ths, `epiano1`, `string_ensemble_1`, driving `:16` bass. | **Fanfare intro + twin-lead anthem (`69 bars`)**: `8-bar` ceremonial fanfare intro with tom rolls -> `28-bar` multi-theme loop x 2 -> `5-bar` fade. |
| **Lyrical Stage / Epilogue Ballad** (`ground_zero.music`) | `96 BPM` (`andantino`), nostalgic & spacious | Expressive solo lead + `:16` lower-octave shadow echo, `epiano1`, `brass_section`, `string_ensemble_1`, `orchestral_harp` arps, `C1–C2` bass. | **Invariant melody over evolving cycles (`56 bars`)**: `4-bar` intro -> Cycle 1 (`A+B`, sparse bass, no arps) -> Cycle 2 & 3 (`A+B`, driving `:16` octave bass + open-fifth arps) -> `4-bar` coda. |

### 3.2 Cross-bar continuity vs. re-attacked stabs (the articulation dualism)
Two opposite mistakes ruin procedural game music: **chopping legato notes at barlines** and **merging repeated rhythmic stabs into flat drones**.
1. **Never chop sustained notes at barlines**: When a melody note, pad, or bass pedal holds across multiple bars, write a single tied duration (`C3:1~1`, `A4:1~1~1`, `Eb5:1~2.~8.`) or a cross-barline tie (`F5:8~ | :16`) instead of splitting it into `C3:1 | C3:1` at every measure boundary. Splitting a sustained note forces a fresh FM/sample attack transient on Beat 1 of every bar and destroys long-line phrasing.
2. **Never merge repeated chord stabs into a drone**: When a groove depends on repeated same-pitch stabs (such as *Bare Knuckle*'s 3-voice synth-brass hook), write every `:8.` re-attack explicitly (using `*N` repeats and running durations) and insert a `:16` release rest (`R:16`) at the turnaround so each stab punches through the mix:
   ```text
   # Top brass voice (FM2): explicit :8. re-attacks + cross-bar F5 tie + R:16 release gap
   (A4:8 E5:8.*2 F5*3 R:16 D5:8.*2 G5*2 G5:8 |)*9
   ```
3. **Tie syncopations across barlines**: Notice how the third `F5` (`:8.`) above starts on Step 14 of the odd bar (`2/16` before the barline) and rings through Step 0 (`1/16`) of the even bar before the `R:16` release on Step 1. You can write cross-bar syncopations either as a 2-bar phrase (`F5*3 ... |`) or with an explicit cross-barline tie (`F5*2 F5:8~ | :16 R:16 ... |`).

### 3.3 Rhythmic diversity: Tresillos, triplets-over-16ths, slap bass, and additive ostinatos
Give each composition its own rhythmic signature instead of reusing one rhythm everywhere:
* **Dotted-eighth tresillo stabs (`3+3+3+3+2+2` or `2+3+3+3+3+2`)**: Grouping 16th notes in 3s (`:8.`) against a 4/4 drum beat creates classic 90s club synth-brass hooks (*Bare Knuckle*) and shamisen action ostinatos (*Idaten*: `E4:8. A4 B4 C5 B4:8 A4`).
* **Polyrhythmic triplets (`:8t`, `:4t`) over a 16th-note grid**: To make a lead melody float freely over a straight 4/4 backing (*Bare Knuckle* `Bars 1–16`), mix eighth-note triplets (`:8t`) and quarter-note triplets (`:4t`) with `~` ties (`:1~1~4t`, `:1~2t`, `:1~1~1`) and running durations:
  ```text
  # Exact 16-bar haunting intro lead mixing :8t and :4t triplets with ~ multi-bar ties
  R:2 A4:8t C5 E5 D5:1~1~4t G5:1~2t C5:8t B4 C5:1~1 E5:8t D5:2~2t
  A4:1~1~1 A5:1~2.~16t G5:8~8t E5:4t D5 C5 E5:1~1~2t R:2~2t |
  ```
  Because `ParseDuration` reduces `~` ties with exact 64-bit integer GCD arithmetic, combining `:16`, `:8t`, and `:4t` subdivisions guarantees **zero sample-frame drift**.
* **Three distinct bass engines** (rotate across sections or songs):
  1. **Pulsing pre-drop buildup (`3+3+4+6` = `:8.*2 :4 :4.`)**: Re-attacks a root pedal (`(A2:8.*2 A2:4 A2:4.)*8`) to build tension before the main riff drops.
  2. **Funk offbeat slap-bass (`G2:16 A2:8`)**: Alternates a `1/16` lower-whole-step pickup (`G2:16`) with an `:8` root slap (`((G2:16 A2:8)*4 A2:8. G2:16)*15`).
  3. **Driving `:16` rock/octave bass**: Continuous 16th-note root or octave leaps (`(C1 C2):16*4`) for high-tempo rock and boss stages.
* **Half-bar call-and-response (`2 + (3+3+2)`)**: For lyrical melodies (*Ground Zero*), pair a sustained `:2` half-note call on Beats 1–2 with a `:8. :8. :8` response on Beats 3–4. Never split a held `:2` peak into two `:4 :4` quarter notes.

### 3.4 Multi-voice riff voicing and independent counter-melody layering
1. **Split 3-voice chord riffs across 3 dedicated channels with inner-voice octave drops**: Instead of writing static `[A4 C5 E5]` block chords on one track, assign the top, middle, and bottom voices of a brass or string hook to three separate tracks (`ch01`/`ch02` top brass, `ch03` mid electric piano, `ch04` low brass) and animate the bottom voice with `:16` octave drops (`A4:8 A3:16` and `B4:8 G3:16`):
   ```text
   # Lower brass voice (FM5): adds rhythmic bounce by dropping A4->A3 and B4->G3 on the 3rd sixteenth of each stab
   (R:8 A4:8.*2 A4:8 A3:16 A4:8 A3:16 A3:8 G3 G4:8.*2 B4 B4:8 G3:16 B4:8 |)*9
   ```
2. **Never hijack riff channels when the counter-melody enters**: When a high counter-melody enters in the second half of a groove (such as *Bare Knuckle* `Bars 25–32`: `(A5:2 F5:4 C5 | D5:2. G5:4 | A5:2 F5:4 C5 | B4:1 |)*2`), keep the 3-voice brass riff playing continuously on `ch01–ch04` while the high lead (`ch05`), its `1/8` delay echo (`ch06`), bell double (`ch07`), and middle harmony (`ch08`: `E4:2 F4 | G4:2. F4:4`) enter on their own tracks.
3. **Delay echoes vs. tight stereo doubling**:
   - Use a `:16` or `:8` time-delayed echo (`R:16` or `R:8`, panned opposite) on **sustained, lyrical melodies** (`PSG2` -> `PSG1` in *Bare Knuckle*, or `fm_lead` -> `fm_lead_echo` in *Ground Zero*).
   - Use **zero-delay stereo doubling** (`ch01` panned `-0.18` with `gm=brass_section` + `ch02` panned `+0.24` with `gm=synth_brass_1`) on **fast syncopated chord stabs**, where a `1/16` delay would smear the stabs and collide with adjacent chord changes.

### 3.5 Harmonic palettes: Modal mixture, Dorian/Aeolian vamps, and harmonic minor tension
Vary the harmonic vocabulary across compositions:
* **Aeolian / Dorian two-chord club vamp (`Am7 -> Fmaj7 | G`)**: Alternates an odd-bar `Am -> Fmaj7` progression (`E5 -> F5` over `C5` and `A4/A3`) with an even-bar `G` major triad (`D5 -> G5` over `B4/D5` and `G4/B4`), resolving at the end of the 20-bar section to a full-bar `G` major cadence (`G4 / D5 / B3`).
* **Major tonic with borrowed parallel minor chords (*Modal Mixture*)**: Opens on a bright `C` Major triad (`E5:2 C5:8. G4 E5:8`) and steps down through chords borrowed from `C` natural minor (`Bb` major, `Ab` major, `Fm`) before resolving through a 2-bar `Gsus4 -> G` suspension.
* **Neoclassical minor with phrygian/harmonic minor cadences**: Pairs driving `Em` or `Am` riffs with `F` major (`bII` Neapolitan/Phrygian color), `Dm`, and `E7` dominant turnarounds (*Elemental Master*).

### 3.6 Drum architecture, silence, and phrase-boundary fills
* **Never create a drum channel that only hits cymbals/plates on every beat**: Every percussion voice must play a purposeful groove or fill.
* **Use drumless sections for contrast**: Leaving drums completely silent (`(R:1 |)*7`) during an 8-bar atmospheric intro or a 9-bar outro makes the Beat 4 pickup roll (`R:2. (snare*3 kick):16 |`) and the main beat drop hit with maximum impact.
* **Write syncopated kick/snare grooves and 4/8-bar turnaround fills**:
  - **Club / Funk Beat** (*Bare Knuckle*): `kick:8. kick:16 snare:8 kick:4 kick:8 snare:4 |` (Kick on `1`, `1a`, `2&`, `3&`; Snare on `2` and `4`).
  - **4-Bar Pickup Fill**: Replace Beat 4 on every 4th bar with `snare:8 (tom_hi*2):16 |`.
  - **8-Bar Section Turnaround Fill**: Replace Beat 4 on every 8th bar with `(snare*2 tom_mid snare):16 |` (or a full 1-bar solo tom/snare break as in *Gaiares* Bar 35).

### 3.7 Harmonic consonance rules (`ValidateScoreTheory`) and clean voice-leading
`ValidateScoreTheory` checks all simultaneously sounding pitched tracks:
* **Allowed vertical intervals**: Unisons, octaves, 3rds, 4ths, 5ths, 6ths, major 2nds/9ths (`diff == 2` or `14`), tritones (`diff == 6`), minor 7ths (`diff == 10`), and **major 7ths (`diff == 11`, such as `C4` below `B4` or `F4` below `E5`)**. Short passing or echo notes under `0.25s` (`:16` = `0.15s` or `:8t` = `0.20s` at `100 BPM`) are also permitted.
* **Forbidden vertical collisions**:
  1. **Sustained close minor 2nd (`diff == 1`)** when both notes last `>= 0.25s`.
  2. **Sustained flat 9th (`diff >= 13 && (upper.midi - lower.midi)%12 == 1`)** when both notes last `>= 0.30s` (for example, `B2` or `B3` below `C5`, or `E4` below `F5`).
  3. **Simultaneous `G` natural (`pc == 7`) and `G#`/`Ab` (`pc == 8`)** across channels at any duration.
* **Solve clashes with real voice-leading, never random chromatic shifts**:
  - Never use an automatic pitch-mutator that turns `C -> C#` or `F -> F#` to bypass a validator error.
  - If a melody holds `C5` across a barline into a `B` chord bar, keep the low pad on `C3/E3` until the melody leaves `C5`, then slide to `B2/D3`.
  - If a middle harmony plays `E4` during an `Am -> F` bar (*Bare Knuckle* Bar 29), move the harmony `E4:2 F4` on Beat 3 right when the upper brass chord shifts from `E5` (`Am`) to `F5` (`F`).
  - **Tempo-dependent echo delays and safe measure isolation**:
    - Note durations scale inversely with tempo: `sec = 30 / bpm` for `:8` and `15 / bpm` for `:16`. At `120 BPM`, an eighth note is `0.25s`. At slow tempos (such as `72 BPM`), an eighth note lasts `0.417s`, well over the `0.25s` threshold for sustained minor second collisions (`diff == 1`).
    - At slow tempos (`<= 100 BPM`), if a melody steps by a semitone (such as `Eb -> D` or `C -> B`), an eighth-delayed echo carrying the previous note across the change triggers an illegal minor second clash.
    - **Safe measure-isolated echo template**: Open each echo measure with its own initial rest and release before pickups:
      - Slow tempos (`<= 100 BPM`): `R:8 <lead_note>:2 R:8 <pickup_note>:4 |` (0.5 + 2.0 + 0.5 + 1.0 = 4.0 beats).
      - Fast tempos (`> 100 BPM`): `R:8 <lead_note>:2. <pickup_note>:8 |` (0.5 + 3.0 + 0.5 = 4.0 beats).
      - Keeping echo phrases self-contained within each measure prevents notes from spilling over barlines into new chord downbeats.
  - **Drone and pedal point voice-leading**:
    - When holding a sustained drone or pedal point (such as choir or strings) across changing chords, only sustain pitch classes that belong to every chord in the progression. In a `Cm -> Ab -> Fm -> G` progression, sustain only the common `C` root (`C3:1~1~1~1`). Sustaining a fifth drone (`[C3 G3]:1~1~1~1`) creates an illegal `G` natural vs. `Ab` clash when the `Ab` chord sounds.
  - **Flat-VI chord modal hygiene**:
    - In minor keys, when the harmony moves to the flat-VI chord (such as `Ab` in `C` minor), melody and embellishment channels must avoid `G` natural. Stick to pure chord tones (`Ab`, `C`, `Eb`) to prevent simultaneous `G` vs. `G#/Ab` clashes.

---

## 4. CLI checker, player, and WAV exporter (`scripts/play.go`)

Always run `validate` on every `.music` score before exporting or playing it:

```bash
# 1. Validate music theory, harmonic consonance, barline alignment, >= 8 channels, and >= 30s duration
go run ./scripts validate bare_knuckle_intro.music
go run ./scripts validate gaiares_level2.music
go run ./scripts validate shinobi2_stage2.music
go run ./scripts validate elemental_master_stage1.music
go run ./scripts validate ground_zero.music

# 2. Export to WAV using Default Non-Apple (YM2612/PSG) or Apple Real Instruments (-apple)
go run ./scripts export bare_knuckle_intro.music bare_knuckle_intro.wav
go run ./scripts export -apple bare_knuckle_intro.music bare_knuckle_intro_apple.wav

# 3. Play a .music DSL score with either synthesis option
go run ./scripts play bare_knuckle_intro.music
go run ./scripts play -apple bare_knuckle_intro.music
```

---

## 5. Quality checklist for original compositions

1. **Design a bespoke musical identity first**: Before writing notes, choose the song's tempo (`70–175 BPM`), mode, macro-form (through-composed evolution, asymmetric loop with drum break, ostinato-framed action loop, or multi-cycle ballad), and instrument palette. Never copy another song's instrument list or rhythmic grid verbatim.
2. **Require 8–12+ independent channels and `30s–150s+` duration**: Dedicate separate tracks to riff voices, primary lead, delay echo, counter-melody/harmony, arpeggios, bass, sub-bass, and drums so sections build by stacking independent layers rather than hijacking channels.
3. **Enforce cross-bar continuity, explicit stab re-attacks, and verified `|` barlines**: Hold sustained notes across barlines using `~` ties (`C3:1~1`, `D5:1~1~4t`) or cross-bar ties (`F5:8~ | :16`), write explicit re-attacks and release gaps (`R:16`) for syncopated chord stabs (`:8.*2`), fold repeated phrases with `(...)*N` and `(...):dur`, and place `|` barlines to verify measure alignment.
4. **Anchor `C1–C2` sub-bass and keep 50%–75% of energy below `260 Hz`**: Pair `ym2612_bass` / `ym2612_slap_bass` with an octave-lower `sub_bass` in `C1–C2`, omit 3rds in fast mid-range `:16` arpeggios, and never add stationary noise or ghost cymbal-only drum tracks.
5. **Pass `ValidateProductionBGM` (`go run ./scripts validate`) with pure diatonic/modal voice-leading**: Every `.music` file must pass validation with zero timing drift, aligned `|` barlines, zero melodic pitch-sweep sirens, zero continuous noise on melodic patches, and zero minor-2nd (`m2`), flat-9th (`b9`), or `G` vs. `G#` clashes.
6. **Pre-compile PCM at startup and align to 4 bytes (`&^ 3`)**: Call `CompileDSL` or `SynthesizeScore` during startup (never inside `Update()`/`Draw()`) and always mask PCM lengths and seek offsets with `&^ 3`.

---

## 6. Integrating procedural music into Ebitengine games

Adding procedural music directly to an Ebitengine game gives you tiny asset sizes, sample-exact seamless looping, and pure Go compatibility across desktop and WebAssembly (WASM).

### 6.1 In-memory procedural BGM architecture

Procedural music scores are stored as plain-text `.music` files and synthesized directly into 16-bit 44.1 kHz stereo PCM bytes in memory:

- **Tiny disk footprint**: Each song is a plain-text file of roughly 5 KB to 15 KB, replacing megabytes of audio files.
- **Pure Go portability**: Runs everywhere Ebitengine runs, including WebAssembly in the browser, macOS, Linux, and Windows, with zero Cgo dependencies.
- **Sample-exact seamless loops**: Looping via `audio.NewInfiniteLoop` is mathematically sample-accurate, with zero padding silence or loop seams.
- **Dynamic audio control**: Because the score is synthesized in software, you can dynamically mute stems, alter tempo, or trigger interactive variations at runtime.

> [!NOTE]
> **Why procedural synthesis is preferred over MP3**:
> The MP3 format introduces encoder priming and bit reservoir padding silence (typically 1,152 samples) at the start and end of tracks. When looped in Ebitengine, these padding samples cause an audible gap and pop on every loop cycle. In-memory procedural synthesis guarantees exact sample-frame alignment with zero gaps.

---

### 6.2 Step-by-step Ebitengine integration

#### Step 1: Add the procedural music engine package to your project

Copy the engine source files from `skills/procedural-music/scripts/` into your game project at `internal/audio/procmusic/`:
- `sound.go`: DSL parser, sound system driver, FM/PSG synthesizer, and effects pipeline.
- `ym2612_bank.go`: YM2612 4-operator FM instrument definitions and drum algorithms.
- `gm_instruments.go`: General MIDI patch mappings and archetype presets.

Declare `package procmusic` at the top of these files.

#### Step 2: Embed `.music` files and pre-compile at startup

Embed your `.music` text files with standard Go `//go:embed`. Pre-compile the DSL score into PCM bytes during game initialization or a scene loading screen. Never synthesize inside `Update()` or `Draw()`.

```go
package main

import (
	"bytes"
	_ "embed"
	"log"

	"github.com/hajimehoshi/ebiten/v2"
	"github.com/hajimehoshi/ebiten/v2/audio"

	"mygame/internal/audio/procmusic"
)

//go:embed assets/music/dawn_strategy_battle.music
var battleBGMDSL string

//go:embed assets/music/despair_theme.music
var defeatBGMDSL string

type AudioBank struct {
	audioCtx     *audio.Context
	soundSys     *procmusic.SoundSystem
	battlePlayer *audio.Player
	defeatPlayer *audio.Player
}

func NewAudioBank() (*AudioBank, error) {
	// Standard Ebitengine 44.1 kHz audio context
	const sampleRate = 44100
	audioCtx := audio.NewContext(sampleRate)

	// Pre-compile DSL scores to 16-bit stereo PCM during startup
	battlePCM, err := procmusic.CompileDSL(battleBGMDSL)
	if err != nil {
		return nil, err
	}

	// Mask buffer length with &^ 3 to guarantee mandatory 4-byte frame alignment
	alignedBattleLen := int64(len(battlePCM)) &^ 3
	battleLoopStream := audio.NewInfiniteLoop(bytes.NewReader(battlePCM), alignedBattleLen)

	battlePlayer, err := audioCtx.NewPlayer(battleLoopStream)
	if err != nil {
		return nil, err
	}

	defeatPCM, err := procmusic.CompileDSL(defeatBGMDSL)
	if err != nil {
		return nil, err
	}

	alignedDefeatLen := int64(len(defeatPCM)) &^ 3
	defeatLoopStream := audio.NewInfiniteLoop(bytes.NewReader(defeatPCM), alignedDefeatLen)

	defeatPlayer, err := audioCtx.NewPlayer(defeatLoopStream)
	if err != nil {
		return nil, err
	}

	return &AudioBank{
		audioCtx:     audioCtx,
		soundSys:     procmusic.NewSoundSystem(audioCtx),
		battlePlayer: battlePlayer,
		defeatPlayer: defeatPlayer,
	}, nil
}

func (a *AudioBank) PlayBattleTheme() {
	a.defeatPlayer.Pause()
	a.battlePlayer.SetVolume(0.85)
	a.battlePlayer.Play()
}

func (a *AudioBank) PlayDefeatTheme() {
	a.battlePlayer.Pause()
	a.defeatPlayer.SetVolume(0.80)
	a.defeatPlayer.Play()
}
```

---

### 6.3 Terminal CLI usage and rapid iteration

When composing and testing music scores from the command line:

#### Direct playback
```bash
go run ./skills/procedural-music/scripts play path/to/song.music
```

#### Eliminating Go compiler startup delay
Running `go run .` recompiles all Go files on every run, introducing a 0.6s to 1.0s delay before audio starts. To test playback with zero compiler overhead, build the CLI executable once:

```bash
cd skills/procedural-music/scripts
go build -o music_cli .

# Instant execution:
./music_cli play song.music
```

#### Offline WAV export
To export uncompressed 16-bit 44.1 kHz WAV files for external auditioning or sound editors:

```bash
go run ./skills/procedural-music/scripts export song.music song.wav
```

---

### 6.4 Audio lifecycle: Volume scaling, fade transitions, and rate-limited SFX

To keep audio clean during gameplay transitions:
1. **Never re-synthesize in `Update()`**: Always pre-compile BGM buffers during game initialization or scene transitions.
2. **Smooth track switching**: Before starting a new song, pause the previous player (`player.Pause()` or `soundSys.Stop()`). To fade between scenes, step `player.SetVolume(currentVol)` down over 30 to 60 frames.
3. **Trigger SFX concurrently without choking**: Use `SoundSystem.PlaySFX(cueName, sfxPCM, cooldown)` to trigger polyphonic sound effects concurrently over the background music while enforcing cooldowns so rapid button presses never clip audio channels.
