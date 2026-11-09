---
name: game-dev-studio
description: >
  Open the Game Dev Studio side-panel UI extension (Playtest tab, Sound tab /
  Sound Editor, and Sprite tab / Sprite Editor) in the auxiliary pane. Use
  whenever the user types /game-dev-studio, or asks to open the interactive
  visual workbench to playtest an Ebitengine game, audition or edit .music and
  .sfx files in the Sound Editor, or inspect .sprite and .aseprite sprite
  containers in the Sprite Editor.
license: Apache-2.0
metadata:
  category: game-dev
  tags: "ui-extension, sidecar, playtest, wasm, sound-editor, sprite-editor, ebiten, gamedev"
  author: Daniela Petruzalek (daniela@danicat.dev)
  version: "0.4.0"
  catalog: https://skills.danicat.dev
---

# Game Dev Studio (`game-dev-studio`)

`game-dev-studio` is the navigation shortcut skill for opening the **Game Dev Studio** side-panel UI extension (`sidecars/studio`) in the auxiliary pane. Use the top tab switcher bar inside the panel, or surface a direct `sidecar://` pill in chat, to open **Game Dev Studio** with the relevant tab in focus:
1. **Playtest tab in Game Dev Studio** (`🎮 Playtest`)
2. **Sound tab in Game Dev Studio** (`🎹 Sound`, or **Sound Editor**)
3. **Sprite tab in Game Dev Studio** (`🎨 Sprites`, or **Sprite Editor**)

> [!NOTE]
> **Optional Visual Workbench vs. 100% Agentic / Headless CLI Workflow**:
> The side panel is an **optional visual workbench for human inspection, playtesting, and fine-tuning** in Antigravity IDE and Antigravity 2.0. For a 100% agentic or headless `agy` CLI workflow, the domain skills (`procedural-music`, `procedural-sfx`, `sprite-design`, and `go test ./...`) run standalone without requiring the sidecar UI.

---

## Standardized Menu & Strict Tab Independence

All tabs in **Game Dev Studio** follow the same standardized menu pattern as Paint Studio (`agy-paint-studio`) and run with strict tab independence:

1. **No Auto-Load or Skill-Folder Combo Boxes**: None of the three tabs auto-load a file, auto-compile a game, or populate a dropdown combo box with internal skill directory files on startup. A file opens automatically only when an explicit, compatible file path is passed via `?file=...` (such as clicking a registered `.music`, `.sfx`, `.sprite`, or `.aseprite` file pill).
2. **Clean Tab Switching**: Switching tabs in the top bar strips incompatible `?file=...` query parameters so tabs never contaminate each other (for example, switching from a `.sprite` file in the Sprite tab to the Sound tab or Playtest tab clears the `.sprite` parameter).
3. **Standardized Header Actions Across Tabs**:
   - **Playtest tab (`🎮 Playtest`)**: Uses **Open Project** to select the desired Go project folder and main package, then **🚀 Run** to compile to WebAssembly and playtest with the 10-second DVR and frame annotation tools.
   - **Sound tab / Sound Editor (`🎹 Sound`)**: Strictly separates **Song (`.music`)** and **SFX (`.sfx`)** DSL modes with mode-scoped **Open File** and **Open Artifact** modals (`.wav` is Export-only), **Save** (save `.music` or `.sfx` to the filesystem or browser download), **Export** (export `.wav` to the filesystem or browser download), a dynamic 1:1 instrument-to-channel mixer, and two-row toolbar action buttons to toggle between **GUI** and **Text** mode and between **Wave** and **Spectrum** visualizers.
   - **Sprite tab / Sprite Editor (`🎨 Sprites`)**: Uses **Open File** (`.sprite` or binary `.aseprite`), **Open Artifact** (browse/save session artifacts), **Save** (save `.sprite` to the filesystem or browser download), and **Export** (export `.aseprite`, `.png` sheet, or `.json` manifest), plus two-row toolbar action buttons for **Visual** / **Text** mode, **Play** / **Pause** (starts paused), **Speed**, **Backdrop**, and a **`1× Once`** lead-in frame toggle (`tag run 8 once, 9..11 loop`) in the bottom transport bar.

---

## Tabs & `sidecar://` Pills

Surface the matching pill in chat whenever the user creates, edits, or inspects game code, audio files (`.music`, `.sfx`), or sprite containers (`.sprite`, `.aseprite`), or asks to open **Game Dev Studio**:

### 1. Playtest Tab in Game Dev Studio (`🎮 Playtest`)

Opens the live 60 FPS Ebitengine WebAssembly (`GOOS=js GOARCH=wasm`) runner, **Open Project** folder and main package selector, `🚀 Run` button, 10-second (250-frame at 25 FPS) DVR ring buffer scrubber, visual bug annotation canvas (`Pen`, `Arrow`, `Box`, `Text`), and 1-click `📸 Frame` PNG and `🎞️ 10s GIF` bug report sender. Does not auto-compile until the user selects a project and clicks `🚀 Run`.

- **General pill**:
  ```markdown
  [Game Dev Studio](sidecar://agy-game-studio/studio/playtest)
  ```

### 2. Sound Tab in Game Dev Studio (`🎹 Sound` / Sound Editor)

Opens **Game Dev Studio** with the **Sound tab** (**Sound Editor**) in focus. Provides mode-scoped **Open File** and **Open Artifact** (`.music` in `Song` mode, `.sfx` in `SFX` mode; `.wav` is disallowed for opening and reserved for **Export**), **Save**, and **Export** (`.wav`) in a two-row toolbar, action buttons to toggle between **GUI** and **Text** mode and between **Wave** and **Spectrum** (`< 260 Hz` FFT) visualizers, WebAudio playback, dual `🎛️ YM2612` and `🍎 CoreAudio` synthesis, a 1:1 instrument-to-channel stems mixer (`M` Mute and `S` Solo), undo/redo/reset controls, and production scorecard. Never auto-detects or populates a combo box with skill files.

- **General pill**:
  ```markdown
  [Game Dev Studio (Sound Tab)](sidecar://agy-game-studio/studio/sound)
  ```
  *(or `[Sound Editor](sidecar://agy-game-studio/studio/sound)`)*
- **File-scoped pill** (opens Game Dev Studio with the Sound tab focused on the file; use the file's basename as the link label):
  ```markdown
  [laser.sfx](sidecar://agy-game-studio/studio/sound?file=/abs/path/to/laser.sfx)
  ```
  ```markdown
  [stage1.music](sidecar://agy-game-studio/studio/sound?file=/abs/path/to/stage1.music)
  ```

### 3. Sprite Tab in Game Dev Studio (`🎨 Sprites` / Sprite Editor)

Opens **Game Dev Studio** with the **Sprite tab** (**Sprite Editor**) in focus:

- **Standardized File, Artifact, Save & Export Menu**: Uses **Open File** (`.sprite` or `.aseprite`), **Open Artifact** (browse/save session artifacts), **Save** (save `.sprite` to filesystem or browser download), and **Export** (export `.aseprite`, `.png` sheet, or `.json` manifest).
- **Container-Only Scope & Direct `.aseprite` Binary Import**: Opens `.sprite` and `.aseprite` container files (such as `black_cat_anime.sprite` and `black_cat_anime.aseprite`). Opening an `.aseprite` file parses its binary header, cels, and `0x2018` tags directly without substituting a `.sprite` file. Never open raw `.png` files here; raw `.png` files belong in Paint Studio (`paint-studio`).
- **Starts Paused**: Animation playback starts paused (`Play` button ready) so you can inspect the resting frame right away.
- **Visual vs. Text Toggle**: Action button toggles between **Visual** mode and **Text** mode in a clean two-row toolbar.
- **Inline Controls, Lead-In (`1× Once`) & Uniform Aspect Ratio**: Action buttons for **Play / Pause**, **Speed** (`0.25×`, `0.5×`, `1×`, `2×`), a **`1× Once`** toggle in the bottom transport bar to flag lead-in intro frames inside a loop (`tag run 8 once, 9..11 loop`), and **Backdrop** (`Slate`, `Light`, `Void`, `Chroma`). The canvas enforces strictly uniform aspect-ratio scaling so sprites are never stretched or distorted.
- **Prompt & Comment-Driven Iteration**: All edits and refinements happen through chat prompts and per-sprite frame comments using `+ Note` and `Send` in the bottom comment bar.

- **General pill**:
  ```markdown
  [Game Dev Studio (Sprite Tab)](sidecar://agy-game-studio/studio/sprite)
  ```
  *(or `[Sprite Editor](sidecar://agy-game-studio/studio/sprite)`)*
- **File-scoped pill** (opens Game Dev Studio with the Sprite tab focused on the file; use the file's basename as the link label):
  ```markdown
  [black_cat_anime.sprite](sidecar://agy-game-studio/studio/sprite?file=/abs/path/to/black_cat_anime.sprite)
  ```
  ```markdown
  [black_cat_anime.aseprite](sidecar://agy-game-studio/studio/sprite?file=/abs/path/to/black_cat_anime.aseprite)
  ```

---

## Cross-Skill Integration

`game-dev-studio` connects the visual sidecar workbench to the wider game development skill ecosystem:

| Skill | Integration with `game-dev-studio` |
| :--- | :--- |
| **`vibe-game-developer`** | End-to-end game development orchestrator that launches **Game Dev Studio** (`Playtest`, `Sound`, and `Sprites` tabs) via pills at each milestone so the user can test gameplay, audio, and animations in the side panel. |
| **`game-design`** | Translates core loops, game feel targets, and mechanic specs into playable prototypes verified in the **Playtest tab in Game Dev Studio** via the 10-second DVR scrubber and frame annotations. |
| **`ebitengineer`** | Builds the 60 FPS Ebitengine game loop, fixed-timestep physics, and `GOOS=js GOARCH=wasm` target compiled and run inside the **Playtest tab in Game Dev Studio**. |
| **`sprite-design`** | Generates and edits `.sprite` DSL definitions and `.aseprite` containers inspected in the **Sprite tab in Game Dev Studio** (**Sprite Editor**) using `Visual` and `.sprite` Text modes and refined via `+ Note` and `Send` frame comments. |
| **`nano-banana`** | Generates reference character sheets and visual concepts that `sprite-design` normalizes and packages into `.sprite` or `.aseprite` containers for preview in the **Sprite Editor**. |
| **`procedural-sfx`** | Synthesizes pure-code `.sfx` cues audited, tweaked, saved, and exported to `.wav` in the **Sound tab in Game Dev Studio** (**Sound Editor**). |
| **`procedural-music`** | Composes polyphonic `.music` scores auditioned in the **Sound Editor** with real-time YM2612 / CoreAudio switching, GUI / Text and Wave / Spectrum toggles, stem solo/mute controls, and `.wav` export. |
| **`lyria`** | Pairs generative music prototyping and stem ideas with procedural arrangements and audio QA alongside the **Sound Editor**. |
| **`godoctor`** | Provides AST-aware Go refactoring, static analysis, and smart builds to keep Ebitengine game code clean before compiling to WebAssembly in the **Playtest tab in Game Dev Studio**. |

---

## Navigation & Quick Reference

| Game Dev Studio Tab | Sidecar URI | Primary Use |
| :--- | :--- | :--- |
| **Playtest tab (`🎮 Playtest`)** | `sidecar://agy-game-studio/studio/playtest` | Select Go project folder and main package via **Open Project**, compile to WASM (`🚀 Run`), pause and scrub the 10s DVR (`F8` or `` ` ``), annotate bugs, and send `📸 Frame` PNG or `🎞️ 10s GIF` reports to chat. |
| **Sound tab / Sound Editor (`🎹 Sound`)** | `sidecar://agy-game-studio/studio/sound` | Open, edit, save, and export `.sfx` and `.music` files (**Open File**, **Open Artifact**, **Save**, **Export** `.wav`), toggle **GUI** vs. **Text** and **Wave** vs. **Spectrum** (`< 260 Hz` FFT), switch `🎛️ YM2612` vs. `🍎 CoreAudio`, and solo/mute stems. |
| **Sprite tab / Sprite Editor (`🎨 Sprites`)** | `sidecar://agy-game-studio/studio/sprite` | Open, inspect, save, and export `.sprite` and `.aseprite` containers (**Open File**, **Open Artifact**, **Save** `.sprite`, **Export** `.aseprite`/`.png`/`.json`), toggle **Visual** vs. **`.sprite` Text** mode, adjust **Play / Pause** (starts paused), **Speed**, and **Backdrop**, and dispatch frame feedback with `+ Note` and `Send`. |
