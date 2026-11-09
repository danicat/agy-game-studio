---
name: sprite-design
description: >
  Complete guide and .sprite engine for 2D game sprites, tilesets, and frame
  animations in Ebitengine. Covers the 2-step AI Character Sheet to Sprite Grid
  pipeline with nano-banana, chroma-key normalization into .sprite, .aseprite,
  .png, and .json containers, procedural SDF and pixel-art .sprite definitions,
  the Sprite Editor (Sprite tab in Game Dev Studio) visual and text workbench,
  and zero-allocation AnimationController state machines.
license: Apache-2.0
metadata:
  category: game-dev
  tags: "sprites, pixel-art, tilesets, animation, aseprite, sdf, sprite-dsl, ebiten, gamedev, go"
  author: Daniela Petruzalek (daniela@danicat.dev)
  version: "0.4.0"
  catalog: https://skills.danicat.dev
---

# 2D Sprite Design, Normalization & Frame Animation (`sprite-design`)

`sprite-design` turns character designs and procedural definitions into game-ready 2D sprite containers (`.sprite`, `.aseprite`, `.png`, and `.json`) and drives them at 60 FPS in Ebitengine with zero heap allocations during `Draw()`.

> [!TIP]
> **Reference Specifications**:
> - **`.sprite` Container & Procedural DSL Guide**: [`references/dsl-reference.md`](references/dsl-reference.md)
> - **Binary Aseprite (`.aseprite`) & GIMP Palette (`.gpl`) Spec**: [`references/aseprite_format.md`](references/aseprite_format.md)
> - **Reference Workspace Sprite Bundle**: `skills/sprite-design/scripts/black_cat_anime.sprite` (paired with `black_cat_anime.png`, `black_cat_anime.aseprite`, and `black_cat_anime.json`)

---

## 1. Cross-Skill Workflow & Headless CLI Autonomy

`sprite-design` works alongside five companion skills with clear boundaries:

| Skill | Role in the Sprite & Game Pipeline |
| :--- | :--- |
| **`vibe-game-developer`** | Orchestrates end-to-end game builds, delegating character and tileset production to `sprite-design` and surfacing **Sprite Editor** (`game-dev-studio`) pills at each milestone. |
| **`game-design`** | Defines player mechanics, state transitions, hitbox timing, camera projection, and visual readability targets that determine which animation tags a sprite needs. |
| **`nano-banana`** | Generates the Step 1 character reference sheet and the raw Step 2 `4x4` chroma-key animation grids before `sprite-design` normalizes them. |
| **`sprite-design` (this skill)** | Normalizes raw AI sprite grids, compiles `.sprite` container and procedural SDF files, validates visual QA invariants, exports `.aseprite` and `.png`+`.json` bundles, and provides Ebitengine's `GridSpriteSheet` and `AnimationController`. |
| **`ebitengineer`** | Integrates `GridSpriteSheet` and `AnimationController` into the fixed-timestep 60 TPS `Update()` loop, camera `GeoM` pipeline, Kage shaders, and particle pools. |
| **`game-dev-studio`** | Opens the optional **Sprites** tab (`sidecar://agy-game-studio/studio/sprite`) for inspecting `.sprite` and `.aseprite` containers and sending per-frame feedback notes. |

> [!NOTE]
> **100% Headless CLI Autonomy**:
> Every command in `skills/sprite-design/scripts/` runs directly from the terminal (`go run . normalize`, `go run . validate`, `go run . export`, `go run . extract-palette`, `go run . inspect-json`, `go run . synth-json`, and `go test -v ./...`) without requiring the sidecar UI.

---

## 2. The Two-Step AI Sprite Generation Pipeline (Primary Workflow)

Generating a multi-frame sprite sheet in a single prompt often fails because the image model tries to invent character proportions and maintain frame-to-frame consistency at the same time. Splitting character design (Step 1) from animation grid generation and deterministic normalization (Step 2) solves this across every resolution and genre.

### 2.0 Step 0: Clarify Motions, Camera Angle, Resolution & Path (`ask_question`)

Before generating a character, creature, enemy, or game piece, ask the user (using `ask_question` when available) to confirm any of these four choices not already specified in their prompt:

1. **Animation Motions (`tag` names)** matched to the genre:
   - **Side-Scroller / Platformer / Metroidvania**: `idle`, `walk`, `run`, `jump` (with explicit mid-air apex pose), `fall`, `crouch`, `sleep`, `attack`, `hit`, `death`.
   - **Top-Down RPG / Adventure / Twin-Stick**: `idle`, `walk`, `run`, `interact`, `attack`, `cast`, `hit`, `ko` (side-mirrored or 4-way `down`, `up`, `side`).
   - **Isometric (`2:1` Dimetric) Strategy / Tactics**: `idle`, `move`, `action`, `selected`, `damaged` along `SE`, `SW`, `NE`, `NW` diagonals.
   - **Puzzle / Match-3 / Card / Shmup**: `idle`, `hover` / `bank`, `activate` / `boost`, `combo_glow`, `shatter` / `burst`.
2. **Camera Angle & Projection**:
   - **2D Side-Profile** (platformers, run-and-gun, beat-'em-ups).
   - **3/4 Top-Down Orthographic** (RPGs, dungeon crawlers, action-adventures, vertical shmups).
   - **Isometric `2:1` (`26.565 deg`)** (tactical RPGs, city-builders, strategy games).
   - **Front-Facing Ortho** (puzzle tokens, card battlers, turn-based RPG enemies).
3. **Target Frame Resolution**:
   - **`256x256` Native 2D HD (Recommended Default)**: Preserves full hand-drawn or cel-shaded `1024x1024` `4x4` cell resolution with smooth premultiplied alpha edges and zero downsampling blur.
   - **`128x128` Mid-Res HD**: Compact HD sprites for crowded action arenas or shmups.
   - **`64x64` or `32x32` Retro Pixel Art**: Downsamples or rasterizes onto a crisp pixel grid with binary alpha edges (`-fw 64 -fh 64` or `-fw 32 -fh 32`).
4. **Production Path**:
   - **Path A (2-Step AI Character Sheet -> Sprite Grid + `normalize`)**: Best for expressive characters, creatures, companions, and bosses.
   - **Path B (Procedural `.sprite` DSL)**: Best for geometric mobs, projectiles, pickups, props, and seamless tilesets.

### 2.1 Step 1: Generate the Character Reference Sheet (`nano-banana`)

Use `nano-banana` (or `image-generator`) to create a turnaround or design reference sheet first whenever building a hero, boss, companion, NPC, or multi-part enemy:

1. **Readable Game Proportions (`1:2` to `1:3` Head-to-Body Ratio)**: Keeps the face, eyes, ears, and silhouette distinct at gameplay scale across `256x256`, `128x128`, `64x64`, and `32x32`.
2. **Exact Genre Camera Angle**: Draw the reference poses in the exact projection used in gameplay (side-profile, 3/4 top-down, isometric `2:1`, or front-facing).
3. **Clear Silhouette Separation**: Pose limbs, tails, capes, and weapons slightly away from the torso so joint pivots and silhouettes read cleanly.
4. **Printed 4-Step Color Swatch Bar**: Include a solid 4-step color ramp (`Shadow -> Base -> Light -> Specular`) for each primary material so Step 2 locks exact colors.

*(Skip Step 1 and go straight to Path B `.sprite` DSL for simple slimes, drones, projectiles, coins, chests, or tilesets.)*

### 2.2 Step 2: Generate the Raw `4x4` Sprite Grid & Run `normalize`

Pass the Step 1 character sheet as an image reference (`-i` in `nano-banana`) to generate uniform `4x4` animation grids (`1024x1024` for `256x256` frames) on a flat `#00FF00` bright green or `#FF00FF` magenta chroma-key background with **no grid lines, no borders, and no text labels**. For 8 motions (`32` frames, such as `black_cat_anime`), generate two `4x4` grids (`4` motions per grid, `4` frames per row) and pass both files to `normalize`.

Enforce two mandatory layout rules in every Step 2 image generation prompt:

1. **Strict 15% Cell Safety Margin (Zero Border Bleed)**:
   Instruct the generator to leave at least **15% (`38px+` on a `256x256` cell) of empty `#00FF00` chroma-key margin** on all four sides of every character inside its cell. Tails, ears, weapons, and low paws in Row 3 must never touch or cross into Row 4.
2. **Complete Parabolic Jump Arc with Explicit Mid-Air Apex Frame**:
   Whenever generating a 4-frame `jump` row, specify all four phases explicitly so the transition into `fall` feels natural:
   - **Frame 1 (`crouch anticipation`)**: Coiled low on the ground gathering energy to spring.
   - **Frame 2 (`upward launch`)**: Springing steeply upward off the ground with extended hind legs.
   - **Frame 3 (`rising ascent`)**: Airborne rising upward, front paws or arms reaching up.
   - **Frame 4 (`mid-air peak / apex suspension`)**: Horizontal floating body at the top of the jump arc where upward velocity reaches zero before reversing into `fall`, with legs or paws tucked underneath and head level.

#### Deterministic Normalization into `.sprite` + `.aseprite` + `.png` + `.json`

Run `go run . normalize` from `skills/sprite-design/scripts/`. The normalizer splits rows and columns along empty gutters, stripsdisconnected border bleed via connected-component pruning (`findMainBodyAndFullBBox`), unmixes chroma-key edges into premultiplied RGBA ($R, G, B \le A$), centers and grounds each frame while preserving airborne jump/fall height, and automatically writes the `.sprite` container file alongside `-out`:

```bash
cd skills/sprite-design/scripts

# Native 256x256 2D HD (omit -fw and -fh to preserve native cell resolution w/cols x h/rows)
go run . normalize -cols 4 -rows 4 -center=true -ground=true -pad 8 \
  -tag idle:0:3:100:pingpong \
  -tag walk:4:7:100:loop \
  -tag run:8:11:100:loop:9 \
  -tag jump:12:15:100:once \
  -tag fall:16:19:100:loop \
  -tag crouch:20:23:100:once \
  -tag sleep:24:27:100:pingpong \
  -tag attack:28:31:100:once \
  -out black_cat_anime.png \
  -sprite black_cat_anime.sprite \
  -json black_cat_anime.json \
  -aseprite black_cat_anime.aseprite \
  -preview /tmp/black_cat_preview.png \
  -gif-dir /tmp/black_cat_gifs -gif-prefix black_cat \
  raw_grid_part1.png raw_grid_part2.png

# Retro 64x64 or 32x32 Pixel Art (pass explicit -fw and -fh to downsample with crisp binary alpha edges)
go run . normalize -fw 64 -fh 64 -cols 4 -rows 4 -center=true -ground=true -pad 3 \
  -tag idle:0:3:100:pingpong \
  -tag walk:4:7:100:loop \
  -tag run:8:11:100:loop:9 \
  -tag jump:12:15:100:once \
  -out cat_64.png -sprite cat_64.sprite -json cat_64.json -aseprite cat_64.aseprite \
  -preview /tmp/cat_64_preview.png -gif-dir /tmp/cat_64_gifs -scale 4 \
  raw_grid_part1.png
```

> [!IMPORTANT]
> **Mandatory Visual Self-Check (`read_file`)**:
> Always export `-preview` and `-gif-dir` when generating or normalizing a sprite, inspect the preview PNG and per-motion GIFs with `read_file` to verify stable baselines, complete jump arcs, and zero cell bleed, and embed the per-motion GIFs in your response or artifact.

---

## 3. The `.sprite` Format: Sheet Containers & Procedural SDF

A `.sprite` file is the unified text entry point for both normalized AI sprite sheets and pure-code procedural art. See [`references/dsl-reference.md`](references/dsl-reference.md) for the complete grammar, 12 Retro-HD palettes, 12 material ramps, SDF primitives, and transformation math.

### 3.1 Mode 1: Sheet-Backed `.sprite` Container (`black_cat_anime.sprite`)

Generated automatically by `normalize` (or written by hand), a container `.sprite` file links a packed `.png` atlas or binary `.aseprite` file to its frame size, grid layout, standardized sprite-wide frame rate (`fps 10` or `duration 100ms`), and animation tags (including optional lead-in `once` frames like `tag run 8 once, 9..11 loop`):

```text
title "black_cat_anime"
type sprite
sheet "black_cat_anime.png"
size 256x256
grid 4x8
fps 10

tag idle       0..3 pingpong
tag walk       4..7 loop
tag run        8 once, 9..11 loop
tag jump       12..15 once
tag fall       16..19 loop
tag crouch     20..23 once
tag sleep      24..27 pingpong
tag attack     28..31 once
```

### 3.2 Mode 2: Procedural SDF & Pixel-Art `.sprite` Definition

When a `.sprite` file contains Z-ordered `part` blocks instead of `sheet "..."`, the compiler evaluates 2D Signed Distance Fields (`circle`, `box`, `capsule`, `ring`, `poly`, `line`, `pixel`), shades surface normals across 4-step material ramps (`shadow`, `base`, `light`, `specular`), stamps a 1-pixel outer outline, and animates parts via `pose` transforms (`dx`, `dy`, `rot`, `scale`, volume-preserving `squash`, `visible`, and `ease`):

```text
title "Star Pickup"
type sprite
size 24x24
palette snes
outline #141020
light -0.5,-0.7
fps 10

part body ramp=gold z=0 pivot=12,12 dither=bayer2
  circle 12,12 r=6.5
  ring 12,12 r=8.0 thick=1.5 op=smin k=1.5
  pixel 10,9 w=2 h=2 step=3 ramp=bone

tag spin frames=4 loop=loop
  pose body dy=sin(1.5) squash=cos(0.12)
```

---

## 4. Streamlined Sprite Editor Workflow (`game-dev-studio`)

Whenever you create, normalize, or edit a `.sprite` or `.aseprite` file, surface a clickable `sidecar://` pill in chat so the user can inspect the asset in the **Sprite tab in Game Dev Studio** (**Sprite Editor**):

- **File-scoped pill** (opens Game Dev Studio with the Sprite tab focused on the file; use the file's basename as the link label):
  - `[black_cat_anime.sprite](sidecar://agy-game-studio/studio/sprite?file=/abs/path/to/black_cat_anime.sprite)`
  - `[black_cat_anime.aseprite](sidecar://agy-game-studio/studio/sprite?file=/abs/path/to/black_cat_anime.aseprite)`
- **General pill**:
  - `[Game Dev Studio (Sprite Tab)](sidecar://agy-game-studio/studio/sprite)` (or `[Sprite Editor](sidecar://agy-game-studio/studio/sprite)`)

### Key Sprite Editor Behaviors

1. **Standardized File, Artifact, Save & Export Menu**:
   Follows the same standardized menu as Paint Studio (`agy-paint-studio`): **Open File** (`.sprite` or `.aseprite`), **Open Artifact** (browse/save session artifacts), **Save** (save `.sprite` to filesystem or browser download), and **Export** (export `.aseprite`, `.png` sheet, or `.json` manifest).
2. **Container-Only Scope (`.sprite` and `.aseprite` Only)**:
   The **Sprite tab** opens `.sprite` and `.aseprite` container files (such as `black_cat_anime.sprite` and `black_cat_anime.aseprite`). Opening an `.aseprite` binary parses its binary header, cels, and `0x2018` tags directly without silently substituting a sibling `.sprite` file. Never open raw `.png` files in the Sprite Editor; raw `.png` images belong in Paint Studio (`paint-studio`).
3. **Starts Paused**:
   Animation playback always starts paused on the resting frame so the user can inspect proportions and silhouettes before clicking **Play**.
4. **Visual vs. `.sprite` Text Toggle**:
   A two-way action button switches between **Visual** preview mode and **`.sprite` Text** editor mode for live edits to tag frame ranges, lead-in `once` frames, loop modes (`loop`, `once`, `pingpong`, `reverse`), or SDF primitives.
5. **Inline Playback, Speed, Lead-In (`1× Once`) & Backdrop Controls**:
   The toolbar provides **Play / Pause**, **Speed** (`0.25x`, `0.5x`, `1x`, `2x`), a **`1× Once`** toggle in the bottom transport bar to flag lead-in intro frames inside a looping tag (emitting `tag run 8 once, 9..11 loop`), and **Backdrop** (`Slate`, `Light`, `Void`, `Chroma`). The canvas enforces uniform aspect-ratio scaling so frames never stretch.
6. **Per-Frame Prompt Comments (`+ Note` and `Send`)**:
   In the bottom comment bar, the user can attach notes to specific tags or frames with `+ Note` and click `Send` to dispatch structured revision requests back to the main chat.

---

## 5. CLI Commands & Visual QA Validator (`ValidateSprite`)

Run all CLI commands from `skills/sprite-design/scripts/`:

```bash
cd skills/sprite-design/scripts

# 1. Validate .sprite, .aseprite, or .png files against all 5 visual QA invariants
go run . validate black_cat_anime.sprite black_cat_anime.aseprite

# 2. Normalize raw AI sprite grids into .png, .sprite, .json, .aseprite, preview PNG, and per-tag GIFs
go run . normalize -cols 4 -rows 4 -center=true -ground=true -pad 8 \
  -tag idle:0:3:100:pingpong -tag walk:4:7:100:loop \
  -out clean.png -sprite clean.sprite -json clean.json -aseprite clean.aseprite \
  -preview /tmp/clean_preview.png -gif-dir /tmp/clean_gifs raw_grid.png

# 3. Export a .sprite file (container or procedural SDF) to .aseprite, .png, .json, preview, and GIFs
go run . export -png out.png -json out.json -aseprite out.aseprite \
  -preview /tmp/out_preview.png -gif-dir /tmp/out_gifs -scale 1 black_cat_anime.sprite

# 4. Extract 4-step material ramp lines from a Step 1 character reference sheet PNG
go run . extract-palette -ramps 4 character_sheet.png

# 5. Emit single-line JSON inspection or synthesis reports for tooling and sidecars
go run . inspect-json black_cat_anime.sprite
go run . synth-json -png /tmp/out.png black_cat_anime.sprite
```

### Five Deterministic Visual QA Checks (`ValidateSprite`)

1. **Premultiplied Alpha Invariant ($R, G, B \le A$)**: Every pixel across every frame and `SheetRGBA` must satisfy `R <= A`, `G <= A`, and `B <= A` (`ValidatePremultipliedRGBA`), preventing glowing halos in Ebitengine.
2. **Frame Bounding-Box Fill Ratio**:
   - `type sprite`: Active bounding box must occupy **`8.0%` to `92.0%`** of the frame area.
   - `type tileset`: Active bounding box must occupy **`50.0%` to `100.0%`** of the frame area.
3. **Center-of-Mass Pivot Stability**: Horizontal center of mass across sprite frames must stay within **`18%` to `82%`** of the frame width so horizontal flipping (`flipX`) never teleports the character.
4. **Shading & Silhouette Contrast**: Opaque pixels must span at least **3 distinct luminance buckets** (out of 16 quantized Rec. 601 luminance levels).
5. **Animation Tag Integrity**: Every tag must have valid frame bounds (`0 <= FromFrame <= ToFrame < TotalFrames`) and positive frame duration (`DurationMs > 0`).

---

## 6. Zero-Allocation Ebitengine Integration Patterns

### 6.1 Option A: Load a `.sprite` File Directly (`LoadSpriteFile` -> `ToEbitenController`)

Both sheet-backed `.sprite` containers (such as `black_cat_anime.sprite`) and procedural SDF `.sprite` scripts compile directly into an Ebitengine `AnimationController` at startup:

```go
package main

import (
	"time"

	"github.com/hajimehoshi/ebiten/v2"
)

type Actor struct {
	X, Y       float64
	FacingLeft bool
	Anim       *AnimationController
}

func NewActor(spritePath string) (*Actor, error) {
	spec, err := LoadSpriteFile(spritePath)
	if err != nil {
		return nil, err
	}
	compiled, err := CompileSprite(spec)
	if err != nil {
		return nil, err
	}
	ctrl, err := compiled.ToEbitenController()
	if err != nil {
		return nil, err
	}
	_ = ctrl.Play("idle")
	return &Actor{X: 120, Y: 180, Anim: ctrl}, nil
}

func (a *Actor) Update() error {
	// Advance animation state machine using fixed 60 TPS delta (16.66ms)
	a.Anim.Update(time.Second / 60)
	return nil
}

func (a *Actor) Draw(screen *ebiten.Image) {
	// Zero-allocation sub-image draw with automatic horizontal flip handling
	a.Anim.Draw(screen, a.X, a.Y, a.FacingLeft)
}
```

### 6.2 Option B: Pre-Sliced `.png` Atlas (`NewGridSpriteSheet` & `NewAnimationController`)

When embedding a normalized `.png` sheet with `//go:embed`, slice all grid cells once during initialization (`NewGridSpriteSheet`) so `Draw()` never calls `SubImage` on the heap:

```go
package main

import (
	"bytes"
	_ "embed"
	"image"
	_ "image/png"
	"time"

	"github.com/hajimehoshi/ebiten/v2"
)

//go:embed black_cat_anime.png
var catSheetPNG []byte

func LoadCatController() (*AnimationController, error) {
	decoded, _, err := image.Decode(bytes.NewReader(catSheetPNG))
	if err != nil {
		return nil, err
	}
	atlas := ebiten.NewImageFromImage(decoded)

	// Pre-slice all 256x256 cells at load time (zero SubImage allocations in Draw)
	sheet, err := NewGridSpriteSheet(atlas, 256, 256)
	if err != nil {
		return nil, err
	}

	ctrl := NewAnimationController(sheet)
	if err := ctrl.AddTag("idle", 0, 3, 100*time.Millisecond, LoopPingPong); err != nil {
		return nil, err
	}
	if err := ctrl.AddTag("walk", 4, 7, 100*time.Millisecond, LoopForward); err != nil {
		return nil, err
	}
	if err := ctrl.AddTagWithIntro("run", 8, 9, 11, 100*time.Millisecond, LoopForward); err != nil {
		return nil, err
	}
	if err := ctrl.AddTag("jump", 12, 15, 100*time.Millisecond, LoopOnce); err != nil {
		return nil, err
	}
	if err := ctrl.AddTag("fall", 16, 19, 100*time.Millisecond, LoopForward); err != nil {
		return nil, err
	}
	_ = ctrl.Play("idle")
	return ctrl, nil
}
```
