---
name: game-design
description: >
  Interactive 2D game design workflow and Game Design Document (GDD) authoring
  guide. Structures co-creation through one-decision-at-a-time interviews
  covering genre, camera projection, core loops, win/loss rules, controls, 2D HD
  or pixel-art sprite pipelines, and procedural or AI audio pipelines into
  GDD.md. Activate when conceptualizing a 2D game, defining mechanics, or
  authoring a Game Design Document.
license: Apache-2.0
metadata:
  category: game-dev
  tags: "gdd, mechanics, gamedev, 2d, prototyping"
  author: Daniela Petruzalek (daniela@danicat.dev)
  version: "0.4.0"
---

# Game design and interactive GDD co-creation

Use this skill to turn a rough game idea into a clear, genre-matched **Game Design Document (`GDD.md`)** before writing engine code or generating assets.

> [!IMPORTANT]
> **Genre-agnostic 2D design principle**:
> Never assume a 2D game uses side-scrolling gravity or platforming physics. Support **every 2D genre**, including:
> - **Side-Scroller Action / Platformer / Metroidvania**: 2D side-profile view, jump arcs, combat hitboxes
> - **Top-Down RPG / Adventure / Dungeon Crawler**: 3/4 top-down orthographic view, exploration, directional combat
> - **Roguelike / Bullet-Heaven / Auto-Shooter / Deckbuilder**: run progression, encounter graphs, card or build synergies
> - **Puzzle / Match-3 / Physics & Logic Board Games**: front-facing or grid canvas, discrete moves, combo chains
> - **Vertical & Horizontal Shmup / Twin-Stick Arcade**: dense projectiles, wave patterns, spatial-hash evasion
> - **Turn-Based Strategy / Tactical Grid Games**: orthogonal or hexagonal boards, action points, unit roles
> - **Isometric (`2:1` Dimetric) Strategy / RPG / City-Builder**: `26.565 deg` diamond tiles, `SE`/`SW`/`NE`/`NW` facing, depth sorting
> - **Visual Novel / Narrative Adventure**: front-facing character portraits, branching dialogue, choice gates
>
> Always tailor your spatial, control, visual, and audio questions to the user's chosen genre.

---

## Companion skill handoffs

`game-design` produces `GDD.md` for the bundled `agy-game-studio` execution skills, MCP tools, and Game Dev Studio:

| Companion Skill | Role & Handoff Responsibility |
| :--- | :--- |
| **`vibe-game-developer`** | Orchestrates discovery, asset generation, baked `//go:embed` wiring, Ebitengine implementation, and playtesting from `GDD.md`. |
| **`ebitengineer`** | Implements virtual resolution, spatial/collision rules, simulation timing (`60 TPS`), scene FSM, save storage, and zero-allocation `Draw()` loops. |
| **`sprite-design`, `nano-banana`** | Delivers sprite resolution (`256x256+` 2D HD vs. `32x32`/`64x64` pixel art), animation tags, two-step AI sheets (`image_generate` -> `sprite_normalize`), or `.sprite` DSL assets (`sprite_compile`). |
| **`procedural-sfx`, `procedural-music`, `lyria`** | Builds zero-latency `.sfx` sound effects (`sfx_synthesize`), polyphonic `.music` scores (`music_validate` + `music_synthesize`), or `lyria` studio BGM tracks (`music_generate`). |
| **`game-dev-studio`** | Opens `/playtest` in the Game Dev Studio side panel so the user can launch, scrub, and test WASM builds at 60 FPS. |

---

## Interactive co-creation protocol

Align on vision and constraints step by step before generating assets or writing Go code:

1. **Ask one decision at a time**: Present one focused question per turn (using multiple-choice prompts when available) so the user can steer cleanly without facing a wall of options.
2. **Lead with a genre-matched default**: Start each question with a concrete recommendation matched to the chosen genre:
   - *Deckbuilder / Puzzle / Visual Novel*: `1280x720` or `640x360` virtual canvas for sharp card typography, pointer hit-testing rects, and `256x256` 2D HD art.
   - *Platformer / Shmup / Bullet-Heaven*: `320x180` or `640x360` virtual canvas with `32x32` or `64x64` pixel art, or `1280x720` with `256x256` 2D HD sprites.
   - *Isometric Strategy / Builder*: `1280x720` canvas with `2:1` diamond tiles (`64x32` or `128x64`) and depth-sorted sprites.
3. **Resolve dependencies in order**: Lock in **Genre and Camera Projection** -> **Simulation and Core Loop** -> **Win/Loss Rules and Controls** -> **Visual Style, Resolution, and Sprite Pipeline** -> **Audio and Music Pipeline** -> **Scene Flow, HUD, and Save Storage**.
4. **Write `GDD.md` in the workspace root**: Synthesize confirmed choices using [`references/gdd_template.md`](references/gdd_template.md).

---

## Co-creation interview tree

Work through these six branches in order:

```text
Branch 1: Core Concept, 2D Genre & Camera Projection
  ├── 1-sentence hook and primary inspiration
  ├── 2D genre (Side-Scroller, Top-Down RPG, Bullet-Heaven, Deckbuilder, Puzzle, Shmup, Tactics, Isometric 2:1, Visual Novel)
  └── Camera projection (2D Side-Profile, 3/4 Top-Down Ortho, Isometric 2:1 [26.565 deg], Front-Facing Ortho)

Branch 2: Simulation Model, Core Loop & Win/Loss Rules
  ├── Time model (Real-Time 60 TPS fixed timestep, Turn-Based, Discrete Grid-Step, Event/Narrative-Driven)
  ├── Core 30-second loop (Player Action -> Systemic Challenge -> Feedback/Progression)
  └── Quantitative Victory and Defeat (or narrative ending) conditions

Branch 3: Controls & Input Mapping
  ├── Target devices (Keyboard, Mouse/Pointer, Gamepad, Touch)
  └── Logical actions (Navigate/Move, Primary/Confirm, Secondary/Cancel, Special/Inspect, Pause)

Branch 4: Visual Art Direction, Resolution & Sprite Pipeline
  ├── Virtual resolution (1280x720 2D HD/UI, 640x360 balanced, 320x180 retro pixel)
  ├── Sprite frame tier:
  │    ├── Option 1: Native 2D HD (256x256 or 512x512, recommended default for hand-drawn/cel-shaded art)
  │    └── Option 2: Retro Pixel Art (32x32 or 64x64, crisp binary alpha and 4-step material ramps)
  ├── Visual pipeline mode:
  │    ├── Path A: Two-Step AI Character Sheet -> 4x4 Chroma Grid (image_generate -> sprite_normalize)
  │    ├── Path B: Pure-Code .sprite SDF/Pixel DSL (sprite_compile, 12 Retro-HD palettes, 12 4-step material ramps)
  │    └── Path C: Hybrid (Path A for heroes/bosses/portraits/backgrounds + Path B for tilesets/projectiles/props)
  └── Entity animation motion tags (e.g., idle, walk, run, jump, fall, attack, hit, death)

Branch 5: Audio & Music Pipeline
  ├── Sound effects (SFX): Pure-code procedural-sfx (.sfx DSL via sound_presets + sfx_synthesize -> baked .wav)
  ├── Background music (BGM):
  │    ├── Option A: Pure-code procedural-music (.music DSL via music_validate + music_synthesize: YM2612/PSG or macOS apple: true DLS)
  │    ├── Option B: AI studio music via lyria (music_generate: lyria-3.5, lyria-3-pro-preview, lyria-3-clip-preview)
  │    └── Option C: Hybrid (lyria for flagship/ambient themes + procedural-music/.sfx for sample-exact stage loops and cues)
  └── Tempo (BPM), time signature, key, mood, and SFX trigger map

Branch 6: Scene Flow, HUD & Save Persistence
  ├── Scene FSM & overlays (Boot, Title, Gameplay, Pause/Inventory/Deck/Dialogue, Victory/Game Over)
  ├── HUD layout anchors (top-left status, top-right score/minimap, bottom action bar)
  └── Save storage & verification (desktop JSON in os.UserConfigDir() + WASM window.localStorage, or Cloud Run REST leaderboard; go test ./... + Playtest panel in Game Dev Studio)
```

---

## Single-decision question templates

Ask one prompt at a time instead of stacking unrelated questions together:

### Prompt 1: Core hook and 2D genre
> *"What is the 1-sentence hook for your game, and which 2D genre fits best?"*
> - **Recommendation**: *"Pick one clear focus such as a top-down bullet-heaven, an 8x8 turn-based tactics game, a roguelike deckbuilder, or a side-scrolling action platformer."*

### Prompt 2: Camera projection and simulation pace
> *"Should the game use real-time `60 TPS` action or turn/move-based pacing, and which camera angle (`2D side-profile`, `3/4 top-down`, `2:1 isometric`, or `front-facing`) fits best?"*
> - **Recommendation**: *"Use `3/4 top-down` or `2D side-profile` at fixed `60 TPS` for arcade action, or `front-facing` / `2:1 isometric` with discrete turns for puzzle and tactical games."*

### Prompt 3: Core loop and win/loss thresholds
> *"What triggers victory, what causes defeat, and how long should a single run or stage take?"*
> - **Recommendation**: *"Set testable numeric targets upfront, such as surviving 3 escalating waves and defeating a stage boss with HP above 0, or solving 5 puzzle boards within par moves."*

### Prompt 4: Visual style, sprite resolution, and pipeline
> *"Which sprite tier (`256x256` Native 2D HD vs. `32x32`/`64x64` pixel art) and asset pipeline (`Path A: nano-banana + sprite_normalize`, `Path B: .sprite DSL`, or `Path C: Hybrid`) should we use?"*
> - **Recommendation**: *"Use a `1280x720` virtual canvas with `Path C (Hybrid)`: generate `256x256` 2D HD heroes and backgrounds via `image_generate` + `sprite_normalize`, and author tilesets, projectiles, and pickups in `.sprite` DSL (`sprite_compile`)."*

### Prompt 5: Sound effects and background music
> *"Do you prefer pure-code `.sfx` + `.music` synthesis (YM2612 chiptune or macOS CoreAudio DLS), AI-generated `lyria` music tracks, or a hybrid mix?"*
> - **Recommendation**: *"Use `procedural-sfx` (`sfx_synthesize`) for zero-latency gameplay SFX and `procedural-music` (`music_synthesize`) for sample-exact stage loops, or pair `lyria` (`music_generate` in `.wav` on `lyria-3.5`) for studio orchestral or vocal themes."*

---

## Template and pre-handoff checklist

Compile confirmed decisions into `GDD.md` using [`references/gdd_template.md`](references/gdd_template.md) and verify:

- [ ] **Genre, camera projection, and simulation model locked**: No unstated platformer or side-view gravity assumptions.
- [ ] **Core loop and numeric win/loss rules defined**: Victory, defeat, and run pacing are testable.
- [ ] **Controls mapped**: Logical actions cover Keyboard, Mouse/Pointer, Gamepad, or Touch targets.
- [ ] **Visual pipeline and animation tags specified**: States virtual resolution, frame tier (`256x256` 2D HD vs. `32x32`/`64x64` pixel art), pipeline path (`A`, `B`, or `C`), and exact motion tags per entity.
- [ ] **Audio and music plan specified**: Lists `.sfx` cues and `.music` (YM2612/`apple`) or `lyria` BGM tracks, baked to `.wav`/`.mp3` for `//go:embed`.
- [ ] **Persistence and verification ready**: Specifies desktop/WASM storage (`os.UserConfigDir()` + `localStorage`) or Cloud Run leaderboard, saves `GDD.md` in the workspace root, and plans playtesting in `/playtest`.
