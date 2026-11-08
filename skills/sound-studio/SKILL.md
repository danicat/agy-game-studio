---
name: sound-studio
description: Launch the Live Procedural Audio (.music & .sfx) Synth Workbench & WebAudio Player UI extension in the Antigravity side pane. Use whenever the user types /sound-studio, creates or edits .music or .sfx files, auditions sound effects or 16-bit YM2612/CoreAudio soundtracks, or inspects audio DSP and music-theory validation scorecards.
license: Apache-2.0
---

# Sound Studio (`/sound-studio`)

Sound Studio is an Antigravity UI extension (`agy-game-studio/studio/sound`) that renders in the auxiliary (side) pane and binds to `.music` and `.sfx` files. It provides a live procedural audio DSL editor, 18 built-in SFX archetype presets, dual synthesis engines (`YM2612 4-Op FM + PolyBLEP SN76489 PSG` default and macOS `Apple CoreAudio DLS` via `-apple`), a real-time WebAudio stereo waveform and FFT spectrum visualizer (with `< 260 Hz` bass anchor zone highlighting), an interactive multi-track Mute/Solo mixer, an automated DSP and music-theory production scorecard, 1-click `.wav` export, and `💬 Send to Chat` integration.

> [!NOTE]
> **Optional Visual Workbench vs. 100% Agentic / Headless CLI Workflow**:
> Sound Studio is an **optional visual workbench for human inspection and fine-tuning** inside Antigravity IDE / 2.0. For a 100% agentic or headless `agy` CLI workflow, the domain skills (`procedural-music` and `procedural-sfx`) and CLI validators (`go test ./...` and `go run . validate <file>`) work completely standalone without requiring the sidecar UI.

## Opening Sound Studio

Whenever a user creates, edits, or reviews a `*.music` or `*.sfx` file, or asks to open Sound Studio, surface the UI extension pill in chat:

- To open Sound Studio directly:
  ```markdown
  [Sound Studio](sidecar://agy-game-studio/studio/sound)
  ```
- To open a specific `.sfx` or `.music` file in Sound Studio (using the file's basename as the link text):
  ```markdown
  [laser.sfx](sidecar://agy-game-studio/studio/sound?file=/abs/path/to/laser.sfx)
  ```
  ```markdown
  [stage1.music](sidecar://agy-game-studio/studio/sound?file=/abs/path/to/stage1.music)
  ```

## Workflow

1. **Select or Create a Cue / Score**: Pick any workspace `.music` or `.sfx` file, explore the **Curated SFX Library (18 cues)** and **Curated Music Library (7 scores)**, click **`+ .sfx`** or **`+ .music`** for a clean starter template, or select one of the **18 SFX Archetype Presets** (`arcade_laser`, `plasma_gun`, `explosion_arcade`, `explosion_deep`, `coin_pickup`, `gem_shimmer`, `jump_arcade`, `jump_spring`, `sword_clash`, `shield_deflect`, `hit_punch`, `hit_damage`, `powerup_fanfare`, `ui_select`, `ui_confirm`, `ui_error`, `footstep_stone`, `engine_thruster`) to audition immediately.
2. **Synthesize & Audition (`⌘Enter` / `Ctrl+Enter`)**: Click **`▶ Synthesize & Play`** (or press `⌘Enter`). Toggle between **`🎛️ YM2612`** (pure-Go SEGA Mega Drive 4-operator FM + SN76489 PSG) and **`🍎 CoreAudio`** (macOS real instrument DLS bank) for `.music` scores.
3. **Inspect Waveform & FFT Spectrum**: Switch between **`🌊 Waveform + Envelope`** (full stereo buffer overview with scrubbable playhead and live oscilloscope) and **`📊 FFT Spectrum (<260Hz Bass Zone)`** to verify the `50%` to `75%` low-frequency energy target.
4. **Solo / Mute Individual Tracks**: Use the **Track Mixer** (`M` Mute / `S` Solo) to isolate individual channels (`lead`, `arp`, `bass`, `sub`, `drums`) and re-synthesize in real time.
5. **Verify Production Scorecard & Send to Chat**: Review True Peak headroom (`< -0.1 dBFS`), RMS level, DC offset (`< 0.05`), boundary click safety, and music-theory diagnostics. Click any `Line N` badge to jump directly to offending DSL lines, save with **`💾 Save`** (`⌘S`), export 44.1 kHz 16-bit stereo audio with **`📥 Export WAV`**, or click **`💬 Send to Chat`** to send the DSL and scorecard to the active Antigravity conversation.
