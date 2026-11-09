---
name: game-design
description: >
  Interactive game design workflow and Game Design Document (GDD) authoring
  guide for 2D games in the Antigravity 2D Game Studio. Structures game
  co-creation through one-question-at-a-time interviews, defining core gameplay
  loops, win and loss conditions, control schemes, visual art direction (retro
  pixel art to 2D HD via sprite-design and nano-banana), and audio pipelines
  (procedural-sfx, procedural-music, and lyria) into a clean GDD.md. Activate
  when conceptualizing a new 2D game, defining gameplay mechanics, conducting
  game design interviews (/grill-me), or authoring a Game Design Document.
license: Apache-2.0
metadata:
  category: game-dev
  tags: "gdd, mechanics, game-dev, game-design, prototyping, ebiten, 2d-games"
  author: Daniela Petruzalek (daniela@danicat.dev)
  version: "0.4.0"
  catalog: https://skills.danicat.dev
---

# Game Design & Interactive GDD Co-Creation Guide (`game-design`)

This skill guides you through interactive game design co-creation and produces a clear, actionable **Game Design Document (`GDD.md`)** ready for implementation across the `agy-game-studio` workflow.

> [!IMPORTANT]
> **Genre-Agnostic 2D Design Principle**:
> Never assume a 2D game uses side-scrolling gravity or platforming physics. This workflow supports **every 2D genre**, including:
> - **Side-Scroller Action / Platformer / Metroidvania** (2D side-profile view, jump arcs, combat hitboxes)
> - **Top-Down RPG / Adventure / Dungeon Crawler** (3/4 top-down orthographic view, exploration, quests, directional combat)
> - **Roguelike / Bullet-Heaven / Auto-Shooter / Roguelike Deckbuilder** (run-based progression, procedural encounters, synergy builds)
> - **Puzzle / Match-3 / Physics & Logic Board Games** (front-facing or grid canvas, discrete move rules, combo chains)
> - **Vertical & Horizontal Shmup / Twin-Stick Arcade** (high-density projectiles, enemy wave patterns, spatial-hash evasion)
> - **Turn-Based Strategy / Tactical Grid Games** (orthogonal or hexagonal boards, deterministic action points, unit roles)
> - **Isometric (`2:1` Dimetric) Strategy / RPG / City-Builder** (`26.565 deg` diamond tiles, `SE`/`SW`/`NE`/`NW` facing, depth sorting)
> - **Visual Novel / Narrative Adventure** (front-facing character portraits, branching dialogue, evidence/choice gates)
>
> Always tailor your spatial, simulation, control, visual, and audio questions to the user's chosen genre.

---

## 1. Role in the `agy-game-studio` Ecosystem & Cross-Skill Handoffs

`game-design` turns a rough idea into a concrete blueprint (`GDD.md`) and coordinates cleanly with every skill in the bundle:

| Companion Skill | Relationship & Handoff Responsibility |
| :--- | :--- |
| **`vibe-game-developer`** | **Entrypoint Orchestrator**: Launches `game-design` during the discovery and specification phase, then sequences asset creation, engine coding, and playtesting from the finished `GDD.md`. |
| **`ebitengineer`** | **Engine Implementation**: Consumes the `GDD.md` spatial model, virtual canvas size, simulation mode, scene state machine, and zero-allocation hot-loop specs to build the Go + Ebitengine game. |
| **`sprite-design` + `nano-banana`** | **Visual Art & Sprite Pipeline**: Implements the GDD's camera projection, sprite resolution (**Native 2D HD `256x256`+** vs. **Retro Pixel Art `32x32`/`64x64`**), required animation motion tags, `.sprite` DSL definitions, two-step AI character sheets (`nano-banana` -> `normalize`), and `.aseprite` / `.png`+`.json` exports. |
| **`procedural-sfx` + `procedural-music` + `lyria`** | **Sound & Music Direction**: Implements the GDD's soundscape using pure-code `.sfx` cues (`procedural-sfx`), polyphonic `.music` scores with YM2612 FM/PSG or macOS CoreAudio synthesis (`procedural-music`), or studio AI soundtrack loops (`lyria`). |
| **`game-dev-studio`** | **Interactive Visual Workbench & Tuning**: Opens the **Playtest tab** (`sidecar://agy-game-studio/studio/playtest`), **Sound tab / Sound Editor** (`sidecar://agy-game-studio/studio/sound`), and **Sprite tab / Sprite Editor** (`sidecar://agy-game-studio/studio/sprite`) in **Game Dev Studio** for 60 FPS WebAssembly playtesting, 10-second DVR scrubbing, and asset tuning. |

---

## 2. Interactive Co-Creation Protocol (`/grill-me` & `ask_question`)

Before writing code or generating assets, align on the creative and technical vision with the user:

1. **One Focused Question Batch at a Time**: Use the `ask_question` tool (or the `/grill-me` interview flow) to walk through the design branches step by step. Do not overwhelm the user with a wall of text.
2. **Lead with a Genre-Matched Recommendation**: For every question, put a concrete, practical recommendation first so the user can accept defaults quickly or customize specifics:
   - *Deckbuilder / Puzzle*: `1280x720` or `640x360` virtual canvas for sharp card typography, pointer hit-testing rects, and front-facing 2D HD (`256x256`) art.
   - *Retro Platformer / Shmup / Bullet-Heaven*: `320x180` or `640x360` virtual canvas with `32x32` or `64x64` pixel art, or `1280x720` with `256x256` 2D HD sprites.
   - *Isometric Strategy / City-Builder*: `1280x720` canvas with `2:1` dimetric diamond grid (`64x32` or `128x64` tiles) and depth-sorted unit sprites.
3. **Resolve Dependencies in Order**:
   - Establish **Genre, Camera Perspective, and Core Loop** first.
   - Define **Win/Loss Conditions and Controls** second.
   - Lock in **Visual Art Direction, Resolution, and Sprite Pipeline** (`sprite-design` + `nano-banana`) third.
   - Lock in **Audio & Music Direction** (`procedural-sfx` + `procedural-music` + `lyria`) fourth.
4. **Write `GDD.md` in the Workspace Root**: Once the user confirms the key choices, compile the complete specification into `GDD.md` following [`references/gdd_template.md`](references/gdd_template.md).

---

## 3. Co-Creation Interview Tree

Work through these six branches to build a complete design:

```text
Branch 1: Core Concept, 2D Genre & Camera Perspective
  ├── What is the 1-sentence hook and primary game inspiration?
  ├── What is the 2D genre?
  │    ├── Side-Scroller Action / Platformer / Metroidvania
  │    ├── Top-Down RPG / Adventure / Dungeon Crawler
  │    ├── Roguelike / Bullet-Heaven / Deckbuilder
  │    ├── Puzzle / Match-3 / Logic Board Game
  │    ├── Shmup (Vertical / Horizontal) / Twin-Stick Shooter
  │    ├── Strategy / Turn-Based Tactics
  │    └── Isometric (2:1 Dimetric) Strategy / RPG / Builder
  └── What camera projection matches the genre?
       ├── 2D Side-Profile
       ├── 3/4 Top-Down Orthographic
       ├── Isometric 2:1 (26.565 deg)
       └── Front-Facing / Straight-On Orthographic (UI / Board / Stage)

Branch 2: Simulation Model, Core Loop & Win/Loss Conditions
  ├── How does time advance?
  │    ├── Real-Time Continuous (60 TPS fixed timestep in Ebitengine)
  │    ├── Turn-Based / Phase-Driven
  │    ├── Discrete Grid-Step / Puzzle Move
  │    └── Event / Narrative-Driven
  ├── What is the core 30-second gameplay loop? (Player Action -> Systemic Challenge -> Reward/Feedback)
  └── What exact conditions trigger Victory and Defeat (or end of run)?

Branch 3: Controls & Input Mapping
  ├── Which input devices are supported? (Keyboard, Mouse/Pointer, Gamepad, Touch)
  └── What are the logical game actions? (Move/Navigate, Primary/Confirm, Secondary/Cancel, Special/Inspect, Pause)

Branch 4: Visual Art Direction, Resolution & Sprite Pipeline (sprite-design + nano-banana)
  ├── What virtual screen resolution fits the game? (e.g., 1280x720 for 2D HD / crisp UI, 640x360 balanced, 320x180 retro pixel)
  ├── What sprite resolution and aesthetic should we target?
  │    ├── Option 1: Native 2D HD (256x256 or 512x512 per frame, Recommended Default for rich hand-drawn/cel-shaded detail)
  │    └── Option 2: Retro Pixel Art (32x32 or 64x64 per frame with crisp binary alpha edges and 4-step material ramps)
  ├── Which Visual Production Pipeline should we use?
  │    ├── Path A: Two-Step AI Character Sheet -> Sprite Grid + normalize (nano-banana + sprite-design, best for expressive heroes, bosses, and multi-frame creatures such as black_cat_anime)
  │    ├── Path B: Pure-Code .sprite DSL (sprite-design SDF/pixel compiler with 12 Retro-HD palettes and 12 4-step material ramps, best for zero-asset builds, geometric mobs, ships, puzzle tokens, projectiles, pickups, and seamless tilesets)
  │    └── Path C: Hybrid Visual Pipeline (Path A for hero/boss character sheets and backgrounds + Path B .sprite DSL for tilesets, projectiles, pickups, and UI props)
  └── Which animation motion tags does each character or entity need? (e.g., idle, walk, run, jump, fall, attack, hit, death)

Branch 5: Sound Effects & Music Pipeline (procedural-sfx + procedural-music + lyria)
  ├── How should we produce Sound Effects (SFX)?
  │    └── Pure-Code Procedural SFX (procedural-sfx .sfx DSL with 18 built-in archetypes, PolyBLEP oscillators, LFSR chiptune noise, SVF filter sweeps, and FM impacts)
  ├── How should we produce Background Music (BGM)?
  │    ├── Option A: Pure-Code Procedural Music (procedural-music .music DSL with 8 to 12+ tracks, synthesized via pure-Go SEGA YM2612 FM + SN76489 PSG or native macOS Apple CoreAudio real instruments)
  │    ├── Option B: AI-Generated Studio Soundtrack (lyria 44.1 kHz stereo music loops)
  │    └── Option C: Hybrid Audio Pipeline (lyria for atmospheric BGM tracks + procedural-sfx and procedural-music for instant gameplay SFX and fanfare stingers)
  └── What musical tempo (BPM), mood, instrument palette, and gameplay SFX triggers do we need?

Branch 6: Scene Flow, HUD & Iterative Playtesting (ebitengineer + game-dev-studio)
  ├── What scenes and overlays are needed? (Title, Gameplay, Pause/Inventory/Deck Overlay, Victory/Game Over)
  ├── What HUD elements must stay readable at a glance?
  └── How will we test and tune gameplay? (Headless Go tests + live 60 FPS WASM testing and 10s DVR scrubbing in game-dev-studio)
```

---

## 4. Probing Question Templates & Genre Recommendations

Use these concise templates when interviewing the user:

### Question 1: Genre, Perspective & Core Loop
> *"What is the 1-sentence hook for your game, which 2D genre and camera view does it use, and is the action real-time or turn-based?"*
> - **Side-Scroller Action / Platformer**: 2D side-profile view, 60 TPS real-time physics with responsive jump apex control, coyote time, and melee/ranged combat.
> - **Top-Down RPG / Roguelike / Bullet-Heaven**: 3/4 top-down orthographic view, 360-degree or 8-way movement, dungeon rooms or arena survival waves.
> - **Puzzle / Deckbuilder / Strategy**: Front-facing board, orthogonal grid, or isometric `2:1` diamond map with turn-based or move-driven state transitions.

### Question 2: Win/Loss Thresholds & Session Pacing
> *"How does a match or run progress, what triggers victory, and what triggers defeat?"*
> - **Recommended Default**: Define clear, testable numbers right away (for example: survive 3 escalating waves and defeat the stage boss with HP > 0; clear 5 puzzle stages within the move limit; or capture all tactical objectives before turn 15).

### Question 3: Art Style, Resolution & Sprite Pipeline (`sprite-design` + `nano-banana`)
> *"What visual style and sprite resolution do you want, and should we generate sprites with the Two-Step AI pipeline (`nano-banana` + `sprite-design`), pure-code `.sprite` DSL, or a Hybrid mix?"*
> - **Recommended Default (Hybrid or Two-Step 2D HD)**: Use a `1280x720` virtual canvas with **Native 2D HD (`256x256`)** character sprites created via `nano-banana` turnaround sheets and normalized into `.aseprite`/`.png`+`.json` via `sprite-design`, paired with `.sprite` DSL for pickups, projectiles, and tiles.
> - **Retro Pixel Option**: Use a `320x180` or `640x360` virtual canvas with **`32x32` or `64x64` pixel art** and 12 curated Retro-HD palettes in `sprite-design`.

### Question 4: Audio & Music Direction (`procedural-sfx` + `procedural-music` + `lyria`)
> *"For audio, what musical style and tempo fit your world, and do you prefer procedural `.music` synthesis (YM2612 FM / Apple CoreAudio) or AI-generated `lyria` tracks alongside your `.sfx` cues?"*
> - **Recommended Default**: Use `procedural-sfx` for zero-latency gameplay sound effects (`laser_arcade`, `jump_arcade`, `sword_clash`, `coin_pickup`, `ui_confirm`) and `procedural-music` (`.music` DSL with YM2612 16-bit synth or `-apple` CoreAudio real instruments) for original multi-track stage themes and boss music. Use `lyria` when the user wants streamed acoustic or ambient studio audio loops.

---

## 5. Template & Reference Files

| Module | Reference File | Purpose |
| :--- | :--- | :--- |
| **GDD Template** | [`references/gdd_template.md`](references/gdd_template.md) | 7-section Game Design Document template covering pitch, genre/camera projection, core loop, controls, `sprite-design` + `nano-banana` visual specs, `procedural-sfx` + `procedural-music` + `lyria` audio specs, scene flow, and `ebitengineer` + `game-dev-studio` integration notes. |

---

## 6. Pre-Handoff Checklist

Before handing `GDD.md` off to `vibe-game-developer`, `ebitengineer`, `sprite-design`, `nano-banana`, `procedural-sfx`, `procedural-music`, or `game-dev-studio`, verify:

- [ ] **Genre, Camera Projection & Simulation Defined**: Explicitly states the 2D genre, camera angle (Side-Profile, 3/4 Top-Down, Isometric `2:1`, or Front-Facing), and simulation model without unstated platformer assumptions.
- [ ] **Core Loop & Win/Loss Quantified**: Lists player actions, systemic challenges, and exact numerical win/loss conditions.
- [ ] **Controls Mapped**: Binds logical game actions to Keyboard, Mouse/Pointer, Gamepad, or Touch.
- [ ] **Visual Pipeline & Motion Tags Specified**: Documents virtual canvas dimensions, sprite frame resolution (`256x256` 2D HD vs. `32x32`/`64x64` pixel art), pipeline choice (`sprite-design` `.sprite` DSL, `nano-banana` + `sprite-design` normalize, or Hybrid), and exact animation tags per entity.
- [ ] **Audio Pipeline & Cues Specified**: Lists all `.sfx` triggers for `procedural-sfx` and the BGM plan (`procedural-music` `.music` score with tempo/palette or `lyria` tracks).
- [ ] **Saved & Ready for Studio**: Written to `GDD.md` in the workspace root, with a reminder that assets and builds can be inspected live in `game-dev-studio` (the **Playtest tab**, **Sound Editor**, and **Sprite Editor** in **Game Dev Studio**).
