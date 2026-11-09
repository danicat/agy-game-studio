---
name: ebitengineer
description: >
  Engineering architecture and best practices for building 2D games in Go using
  Ebitengine (v2). Covers modular game architecture, scene state machines,
  virtual resolution scaling, delta-time physics, zero-allocation draw loops,
  sprite sheet and AnimationController playback, 4-byte aligned 44.1 kHz stereo
  PCM audio, Kage shaders, and WebAssembly playtesting in the Playtest tab in
  Game Dev Studio. Activate when designing, building, optimizing, or debugging
  2D games in Go, implementing game systems with Ebitengine, or compiling games
  to WebAssembly.
license: Apache-2.0
metadata:
  category: game-dev
  tags: "ebitengine, go, golang, game-dev, 2d, wasm, shaders, game-dev-studio"
  author: Daniela Petruzalek (daniela@danicat.dev)
  version: "0.3.0"
  catalog: https://skills.danicat.dev
---

# Ebitengine 2D Game Development Guide (`ebitengineer`)

Genre-agnostic engineering guidelines for building modular, high-performance, cross-platform 2D games (top-down, tactics, shmup, puzzle, isometric, and platformer) in Go using [Ebitengine v2](https://ebitengine.org/) (`github.com/hajimehoshi/ebiten/v2`).

---

## Trigger Conditions
Activate this skill whenever:
- Designing or implementing 2D game architecture, scene flow, camera systems, or rendering pipelines in Go.
- Working with Ebitengine interfaces (`ebiten.Game`), state machines, input management, sprite animation controllers, audio streams, Kage shaders, or `ebiten/v2/text/v2` typography.
- Compiling games to native desktop and WebAssembly (`GOOS=js GOARCH=wasm`) for interactive playtesting in the **Playtest tab in Game Dev Studio** (`game-dev-studio`), optimizing cycle timing, or writing unit tests for Go game components.

---

## Companion Skills & Studio Integration

`ebitengineer` serves as the core Go runtime and systems architecture skill within the `agy-game-studio` workflow:

- **`vibe-game-developer` & `game-design`**: `vibe-game-developer` orchestrates the end-to-end build pipeline while `game-design` defines the Game Design Document (GDD), core loop, virtual resolution (`320x180`, `640x360`, `1280x720`, or `1920x1080`), state progression, and feel budgets. `ebitengineer` turns those specifications into clean, decoupled Go packages under `internal/`.
- **`sprite-design`**: Loads declarative `.sprite` DSL files, binary `.aseprite` v1.3 containers, or normalized `.png` + `.json` sprite sheets at any resolution (retro pixel art like `32x32` and `64x64`, or native 2D HD like `256x256` and `512x512`). Pre-slice every grid cell once at boot (`NewGridSpriteSheet`) and drive playback with a zero-allocation `AnimationController` (`Update(dt)` in `Update()` and `Draw(screen, x, y, flipX)` in `Draw()`).
- **`procedural-sfx`, `procedural-music`, & `lyria`**: Shares a single 44,100 Hz Ebitengine `audio.Context` across procedural `.sfx` cues, `.music` BGM scores (pure-Go YM2612/PSG or macOS CoreAudio `-apple` stems), and `lyria` AI audio streams. Pre-compile or decode all audio into **4-byte aligned** 16-bit Little-Endian stereo PCM byte slices (`len(pcm) &^ 3`) during boot, enforce per-cue SFX cooldowns in `Update()`, and seek BGM streams to 4-byte aligned offsets (`offset &^ 3`) on first user gesture in WebAssembly.
- **`game-dev-studio` (Playtest tab in Game Dev Studio)**: Whenever you create, build, or debug game code in Antigravity, surface the `[Game Dev Studio](sidecar://agy-game-studio/studio/playtest)` pill in chat. The Playtest tab in Game Dev Studio lets the user select a Go project folder and main package via **Open Project** and click **🚀 Run** to compile `./cmd/game` (or the workspace root) to `GOOS=js GOARCH=wasm`, stream live `stdout`/`stderr` console logs, record a 10-second (250-frame) DVR ring buffer (`F8` or `` ` `` to pause and scrub), and annotate and dispatch `📸 Frame` PNG or `🎞️ 10s GIF` visual QA bug reports directly back to chat. In headless or CLI sessions, verify builds standalone via `go test ./...` and `GOOS=js GOARCH=wasm go build ./cmd/game`.
- **`godoctor` & `swarm-coding` / `parallel`**: Use `godoctor` for Go static analysis, AST inspection, and build verification across desktop and WASM targets. When building multiple decoupled subsystems (`internal/physics`, `internal/camera`, `internal/ui`, `internal/tilemap`, `internal/ai`, `internal/save`), define package interfaces first and use `swarm-coding` or `parallel` subagents to implement and unit-test each package concurrently.

---

## Core Architecture & Fail-Fast Engineering Rules

### 1. Modular Architecture (`internal/`)
Organize the codebase into modular subsystems under `internal/`. Never build monolithic single-file games.
- For the complete directory tree and package responsibilities, see [`references/project_structure.md`](references/project_structure.md).

### 2. Fail-Fast Asset Embedding & Validation (No Silent Fallbacks)
- **Zero-Dependency Embedding**: Embed all game assets (`.sprite`, `.aseprite`, `.png` sprite sheets, `.sfx` and `.music` scores, TTF/OTF fonts, Kage shaders) directly into the compiled Go binary using `embed.FS` (`internal/assets`).
- **No Silent Fallbacks**: Never ignore errors (`_ = err`), never substitute dummy 1x1 fallback textures when an asset fails to decode, and never silently clamp out-of-bounds tile or frame IDs. Always fail fast and return rich `fmt.Errorf` diagnostics during `Boot` initialization so errors appear immediately in terminal output and Game Dev Studio console logs.
- **Mandatory Binary Format Validation**: Always validate binary asset files using file identification tools (`file`, `mimetype`, or `http.DetectContentType` in Go) during asset ingestion. Misnamed or corrupt asset files cause decoding failures or black screens on WebAssembly.

### 3. Premultiplied Alpha Invariant (`color.RGBA` vs. `color.NRGBA`)
- In Go's `image/color` and Ebitengine, `color.RGBA` is **alpha-premultiplied**: every channel must satisfy $R \le A$, $G \le A$, $B \le A$.
- Never construct non-premultiplied literals like `color.RGBA{255, 0, 0, 100}` (where $R > A$). Use valid premultiplied `color.RGBA{100, 0, 0, 100}` or straight-alpha `color.NRGBA{255, 0, 0, 100}`.

### 4. Aspect Ratio & Virtual Pixel Canvas
- **16:9 Widescreen Priority**: Unless explicitly specified otherwise, target a **16:9 virtual resolution** (`320x180`, `640x360`, `1280x720`, `1920x1080`).
- **Virtual Pixel Canvas**: All entity physics, collision math, camera coordinates, Kage shader pixel units, and UI layouts operate strictly in virtual canvas coordinates.
- **Automatic Multi-Resolution Scaling**: `Layout(outsideWidth, outsideHeight int)` returns constant virtual dimensions (`virtualWidth, virtualHeight`).

### 5. Cycle Timing & Frame Synchronization
- **Target Frame Rate**: Standard target is **60 TPS** (`ebiten.SetTPS(60)`).
- **Delta-Time Integration**: Integrate movement, camera exponential decay, and timers using delta time ($dt = 1.0 / 60.0$ or measured frame delta) for consistent behavior across refresh rates.
- **Windowing & Fullscreen Toggle**: Support fullscreen toggling via `F11` or `Alt+Enter`:
```go
if inpututil.IsKeyJustPressed(ebiten.KeyF11) || (ebiten.IsKeyPressed(ebiten.KeyAlt) && inpututil.IsKeyJustPressed(ebiten.KeyEnter)) {
    ebiten.SetFullscreen(!ebiten.IsFullscreen())
}
```

---

## Sprite, Audio & Game Dev Studio Runtime Patterns

### 1. Zero-Allocation Sprite & Animation Playback (`sprite-design`)
Whether rendering low-res pixel art (`32x32`, `64x64`) or high-res 2D HD sprites (`256x256`, `512x512`) produced with `sprite-design`, pre-slice all frames from the atlas once during `Boot` initialization and advance a zero-allocation `AnimationController` in `Update()`:

```go
// Pre-slice grid cells once at load time (never call SubImage inside Draw)
sheet, err := NewGridSpriteSheet(atlasImage, frameWidth, frameHeight)
if err != nil {
    return fmt.Errorf("boot: slice sprite sheet: %w", err)
}
ctrl := NewAnimationController(sheet)
if err := ctrl.AddTag("idle", 0, 3, 150*time.Millisecond, LoopForward); err != nil {
    return err
}
if err := ctrl.Play("idle"); err != nil {
    return err
}
```
- **Pixel Art vs. 2D HD Filtering**: Use `ebiten.FilterNearest` when drawing pixel-art sprites or 1:1 native 2D HD frames so pixels remain crisp. Use `ebiten.FilterLinear` when scaling down high-resolution `256x256` or `512x512` 2D HD sprites onto a smaller gameplay canvas.

### 2. Unified 44.1 kHz Stereo PCM Audio (`procedural-sfx`, `procedural-music`, `lyria`)
Create a single `audio.NewContext(44100)` for the entire game process. Ebitengine requires all raw PCM streams to use **16-bit signed Little-Endian stereo PCM (4 bytes per sample frame: 2 bytes Left + 2 bytes Right)**:
- Always mask buffer lengths and seek offsets with `&^ 3` (`aligned := length &^ 3`) before passing them to `audio.NewInfiniteLoop`, `audio.NewInfiniteLoopWithIntro`, `ctx.NewPlayerFromBytes`, or `Seek()`.
- Pre-synthesize `.sfx` and `.music` scripts to `[]byte` buffers during `Boot` initialization (never inside `Update()` or `Draw()`), and enforce a per-cue cooldown (such as `40ms` to `80ms`) on rapid SFX triggers to prevent voice stacking clipping.

### 3. Playtest Tab in Game Dev Studio (`GOOS=js GOARCH=wasm`) & Visual QA
To ensure smooth execution in `[Game Dev Studio](sidecar://agy-game-studio/studio/playtest)`:
1. Verify dual-target compilation before launching the Playtest tab in Game Dev Studio:
   ```bash
   go test ./...
   GOOS=js GOARCH=wasm go build -o /dev/null ./cmd/game
   ```
2. Log key lifecycle milestones (`log.Printf("boot: loaded %d sprites and %d audio cues", ...)`) to standard output so the Playtest tab's console drawer reports startup health.
3. Keep `F8` and backtick (`` ` ``) free of conflicting gameplay bindings when possible so the user can toggle the Playtest tab's 10-second DVR scrubber and annotation overlay cleanly.

---

## Engine Reference Modules

Consult these reference guides for complete, zero-allocation, fail-fast Go implementations:

| Module | Reference File | Key Topics Covered |
| :--- | :--- | :--- |
| **Project Structure** | [`references/project_structure.md`](references/project_structure.md) | Package tree and `internal/` subsystem responsibilities. |
| **Camera & Game Feel ("Juice")** | [`references/camera_and_juice.md`](references/camera_and_juice.md) | 2D `ebiten.GeoM` camera, frame-rate independent exponential lerp, trauma screen shake, hitstop freeze frames, and spring squash-and-stretch. |
| **Kage Shaders & `text/v2`** | [`references/shaders_and_text_v2.md`](references/shaders_and_text_v2.md) | Kage `//kage:unit pixels` shaders (2D lighting, CRT, hit-flash) and `ebiten/v2/text/v2` font loading and aligned layout. |
| **WASM Audio & Save Storage** | [`references/wasm_audio_and_persistence.md`](references/wasm_audio_and_persistence.md) | 4-byte aligned (`&^ 3`) 44.1 kHz stereo PCM audio playback, SFX cooldowns, WASM autoplay unlock `Seek()`, and build-tagged desktop vs. WASM save storage. |
| **UI & HUD System** | [`references/ui_and_hud.md`](references/ui_and_hud.md) | Premultiplied alpha invariant (`R <= A`), pre-sliced 9-slice panels, anchoring math, zero-alloc progress bars, and `text/v2` buttons. |
| **Physics & Collision** | [`references/physics_and_collision.md`](references/physics_and_collision.md) | Genre-agnostic Circle & AABB overlap, axis-separated sweep resolution, spatial hash grids, and slope math. |
| **Tilemaps & Levels** | [`references/tilemaps_and_levels.md`](references/tilemaps_and_levels.md) | Pre-sliced tileset validation, camera frustum culling, isometric projection, and 16-pipe bitmask autotiling. |
| **Input Action Mapping** | [`references/input_action_mapping.md`](references/input_action_mapping.md) | Rebindable action maps, radial analog deadzones, and zero-alloc gamepad polling. |
| **Entity Management** | [`references/entity_management.md`](references/entity_management.md) | Pre-allocated slice pools, deferred deletion buffers, and Structure-of-Arrays (SoA) Light ECS. |
| **Pathfinding & AI** | [`references/pathfinding_and_ai.md`](references/pathfinding_and_ai.md) | Fail-fast A* grid pathfinding, steering behaviors (seek/arrive), and enemy decision FSM. |
| **Server & Cloud Run** | [`references/server_architecture.md`](references/server_architecture.md) | WebAssembly build, multi-stage Dockerfile, and Cloud Run leaderboard REST API. |

---

## Game State Machine & Scene Flow

### Finite State Machine (FSM) Lifecycle
Model all scenes using a `State` interface with strict lifecycle hooks (`Enter() error`, `Update(dt float64) error`, `Draw(screen *ebiten.Image)`, `Exit() error`).

### Standard Scene Progression
```text
Boot (Logo & Asset Preload) -> Intro -> Title Screen -> Game Play -> Game Win / Game Over -> Title Screen
```

### Transition Cleanliness (No Leaks)
Upon `Exit()`, every state **must**:
- Stop or fade out BGM/SFX channels belonging to that scene.
- Flush active particle emitters, animations, hitstop timers, and camera trauma.
- Reset transient input buffers so button presses do not bleed into the next state.

### Attract / Demo Mode (Arcade Style)
1. **Idle Timeout**: On `Title Screen`, if no input is received after a timeout (e.g. 10s), transition to `Demo Mode` (autonomous AI/CPU plays the game).
2. **Instant Interrupt**: Any user input in `Demo Mode` interrupts execution immediately back to `Title Screen`.
3. **Alternating Flow**: Consecutive `Title Screen` idle timeouts alternate between launching `Demo Mode` and re-playing `Intro`.

---

## WebAssembly (WASM), Shaders & Typography Rules

- **Audio Late-Sync (4-Byte PCM Alignment)**: Browser WebAudio contexts remain locked until the first user gesture. Track elapsed time during silent load and `Seek()` to a **4-byte aligned** stereo PCM byte offset (`((samples * 4) % loopLengthBytes) &^ 3`) on first interaction. See [`references/wasm_audio_and_persistence.md`](references/wasm_audio_and_persistence.md).
- **Custom Typography (`ebiten/v2/text/v2` Only)**: Never use `ebitenutil.DebugPrint` for game UI and never use deprecated `ebiten/v2/text` v1. Always load TTF/OTF fonts via `text.NewGoTextFaceSource`, `text.GoTextFace`, and `text.Draw` from `github.com/hajimehoshi/ebiten/v2/text/v2`. See [`references/shaders_and_text_v2.md`](references/shaders_and_text_v2.md).
- **Kage Shaders (`//kage:unit pixels`)**: Always include `//kage:unit pixels` in Kage shaders and pre-allocate `ebiten.DrawRectShaderOptions` and uniform maps at load time. See [`references/shaders_and_text_v2.md`](references/shaders_and_text_v2.md).
- **Build-Tagged Save Persistence**: Implement separate `//go:build !js` (atomic file write in `os.UserConfigDir()`) and `//go:build js && wasm` (`window.localStorage`) storage backends behind a common fail-fast interface. See [`references/wasm_audio_and_persistence.md`](references/wasm_audio_and_persistence.md).

---

## Unit Testing & Performance Rules

1. **Zero Allocations in `Draw()`**: Never call `ebiten.NewImage()`, `SubImage()`, `ebiten.NewShader()`, or allocate slices/maps inside `Draw()`. Pre-allocate all `ebiten.DrawImageOptions`, `text.DrawOptions`, and `SubImage` frame slices during initialization.
2. **Decouple Logic & Render**: Keep all state mutation strictly inside `Update()`. `Draw()` must be a read-only projection of current game state.
3. **Unit Test Coverage**: Write deterministic unit tests for state transitions, collision/spatial hash math, camera lerp/trauma decay, 4-byte PCM alignment, A* pathfinding, and save serialization.
