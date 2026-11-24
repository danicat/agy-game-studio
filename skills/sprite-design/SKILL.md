---
name: sprite-design
description: >
  2D game sprite design, chroma-key grid normalization, and procedural .sprite
  DSL workflow using the game-studio MCP server. Covers sprite_inspect,
  sprite_compile, sprite_normalize, sprite_extract_palette, and image_generate
  to export baked .png, .json, .aseprite, and .sprite assets for //go:embed
  playback in Ebitengine.
license: Apache-2.0
metadata:
  category: game-dev
  tags: "sprites, animation, pixel-art, tilesets, aseprite, sdf"
  author: Daniela Petruzalek (daniela@danicat.dev)
  version: "0.4.0"
---

# 2D sprite design, normalization, and frame animation

`sprite-design` turns character designs and procedural `.sprite` rules into baked, game-ready 2D sprite assets (`.png`, `.json`, `.aseprite`, and `.sprite`) using the **`game-studio` MCP server**, then loads them at 60 FPS in Ebitengine via `//go:embed` without heap allocations in `Draw()`.

- **`.sprite` container and procedural DSL spec**: [`references/dsl-reference.md`](references/dsl-reference.md)
- **Binary Aseprite and `.gpl` palette spec**: [`references/aseprite_format.md`](references/aseprite_format.md)

---

## Companion skills

| Skill | Role in the sprite pipeline |
| :--- | :--- |
| **`vibe-game-developer`** | Orchestrates end-to-end game builds and delegates character and tileset production to `sprite-design`. |
| **`game-design`** | Defines player mechanics, animation tag budgets, hitbox timing, and camera projection before sprite creation. |
| **`nano-banana`** | Generates the Step 1 character reference sheet and raw Step 2 `4x4` chroma-key grids via `image_generate`. |
| **`ebitengineer`** | Embeds baked `.png`/`.json` or `.aseprite` outputs via `//go:embed` and drives `AnimationController` inside `Update()` and `Draw()`. |

---

## Bundled `game-studio` MCP sprite tools

Run all sprite inspection, compilation, normalization, and palette extraction directly through the `game-studio` MCP server (no external scripts needed):

| MCP Tool | Key Arguments | Purpose |
| :--- | :--- | :--- |
| **`sprite_inspect`** | `filePath` (req), `frameWidth`, `frameHeight`, `cols`, `rows`, `jsonPath`, `outPngPath` | Inspects a `.sprite`, `.aseprite`/`.ase`, or `.png` sheet, returns full QA metrics (`passed`, `fillRatioPct`, `centerOfMassX`, `luminanceSteps`, `premultipliedClean`, `tags`, `issues`), and optionally exports a rendered PNG. |
| **`sprite_compile`** | `dsl`, `filePath`, `baseDir`, `outPngPath`, `outJsonPath`, `outAsepritePath`, `outPreviewPath`, `outGifDir`, `gifPrefix`, `scale` (`1..16`) | Compiles a `.sprite` script (either sheet-backed or procedural SDF/pixel `part` blocks) and writes baked `.png`, `.json` manifest, `.aseprite`, preview PNG, and per-tag `.gif` previews. |
| **`sprite_normalize`** | `filePath` or `filePaths`, `frameWidth`, `frameHeight`, `cols`, `rows`, `tolerance` (`0..255`, default `18`), `center` (default `true`), `ground` (default `false`), `pad` (default `2`), `durationMs` (default `100`), `tags`, `outPngPath`, `outJsonPath`, `outSpritePath`, `outAsepritePath`, `outPreviewPath`, `outGifDir`, `gifPrefix`, `scale` | Strips chroma-key backgrounds, removes edge bleed, aligns and grounds frames into premultiplied RGBA (`R, G, B <= A`), and exports normalized `.png`, `.json`, `.sprite`, `.aseprite`, preview PNG, and per-tag `.gif` previews. |
| **`sprite_extract_palette`** | `filePath` (req), `numRamps` (`1..12`, default `4`) | Extracts 4-step material shading ramps (`Shadow -> Base -> Light -> Specular`) from a reference character sheet PNG or JPEG as ready-to-paste `.sprite` DSL `ramp` lines. |

---

## Two-step AI sprite generation pipeline (`image_generate` + `sprite_normalize`)

Generating a full sprite sheet in one prompt fails when an image model tries to invent a character and keep 16 frames consistent at once. Split character design (Step 1) from animation grid generation and normalization (Step 2).

### Step 0: Confirm motions, projection, resolution, and path

Before creating an asset, confirm any detail missing from the request:

1. **Animation tags (`tags`)**:
   - Side-scroller or platformer: `idle`, `walk`, `run`, `jump` (with mid-air apex pose), `fall`, `crouch`, `attack`, `hit`, `death`.
   - Top-down RPG or twin-stick: `idle`, `walk`, `run`, `interact`, `attack`, `cast`, `hit`, `ko`.
   - Isometric `2:1` tactics: `idle`, `move`, `action`, `selected`, `damaged` across `SE`, `SW`, `NE`, `NW`.
   - Puzzle, card, or arcade shooter: `idle`, `hover` or `bank`, `activate` or `boost`, `combo_glow`, `burst`.
2. **Camera projection**: `2D side-profile`, `3/4 top-down`, `isometric 2:1 (26.565 deg)`, or `front-facing ortho`.
3. **Target frame resolution**: `256x256` Native 2D HD (default, omit `frameWidth`/`frameHeight` to preserve `w/cols x h/rows`), `128x128` compact HD, or `64x64` / `32x32` pixel art (`frameWidth: 64, frameHeight: 64` or `32`).
4. **Production path**: Path A (`image_generate` + `sprite_normalize`) for expressive heroes and bosses; Path B (procedural `.sprite` DSL + `sprite_compile`) for slimes, projectiles, pickups, and seamless tilesets.

### Step 1: Generate the character reference sheet (`image_generate`)

Invoke `image_generate` to build a turnaround character sheet first:

```json
{
  "tool": "image_generate",
  "arguments": {
    "prompt": "2D game character reference sheet of a black anime cat hero, 1:2 head-to-body ratio, 2D side-profile gameplay angle, clear limb and tail separation, printed 4-step color swatch bar on neutral gray background",
    "outPath": "assets/raw/character_sheet.png",
    "model": "nano-banana-2.1",
    "resolution": "2K",
    "aspectRatio": "1:1"
  }
}
```

Include four traits in every Step 1 prompt:
1. **`1:2` to `1:3` head-to-body ratio**: Keeps eyes, silhouettes, and readability crisp at both HD and `64x64` / `32x32` scales.
2. **Exact gameplay projection**: Match the game camera angle (`side-profile`, `3/4 top-down`, `isometric 2:1`, or `front-facing`).
3. **Clear limb and silhouette separation**: Keep arms, tails, capes, and weapons slightly away from the torso.
4. **Printed 4-step color swatch bar**: Lock exact `Shadow -> Base -> Light -> Specular` tones for Step 2 consistency (and optionally extract them with `sprite_extract_palette`).

If `image_generate` fails due to missing credentials or auth errors, stop immediately and report the exact error. Never substitute placeholder squares or bypass credentials.

### Step 2: Generate `4x4` chroma-key grids and normalize (`sprite_normalize`)

Pass `assets/raw/character_sheet.png` in `inputImages` to `image_generate` to create uniform `4x4` animation grids on flat `#00FF00` bright green or `#FF00FF` magenta with no grid lines, borders, or text labels. For eight motions (`32` frames), generate two `4x4` grids (`4` motions each) and pass both in `filePaths` to `sprite_normalize`.

```json
{
  "tool": "image_generate",
  "arguments": {
    "prompt": "Keep the exact character identity and color swatches from the reference sheet. Uniform 4x4 2D sprite sheet grid on a flat unlit #00FF00 chroma-key background, no grid lines or labels, at least 15% empty #00FF00 margin inside every cell. Row 1: 4-frame idle breathing. Row 2: 4-frame walk cycle. Row 3: 4-frame run cycle. Row 4: 4-frame jump arc (crouch anticipation, upward launch, rising ascent, horizontal mid-air apex suspension).",
    "inputImages": ["assets/raw/character_sheet.png"],
    "outPath": "assets/raw/raw_grid_part1.png",
    "model": "nano-banana-2.1",
    "resolution": "1K",
    "aspectRatio": "1:1",
    "thinkingLevel": "high"
  }
}
```

Enforce two rules in every Step 2 prompt:
- **15% empty cell margin**: Leave at least `15%` empty `#00FF00` padding on all four sides of every cell so tails, ears, and weapons never cross boundaries.
- **Complete 4-frame jump arc**: Specify `crouch anticipation`, `upward launch`, `rising ascent`, and `horizontal mid-air apex` so `jump` transitions smoothly into `fall`.

Then call `sprite_normalize` to strip chroma backgrounds, trim bleed, unmix fringes into premultiplied RGBA, center horizontally, ground frames, and bake the `.png`, `.json`, `.sprite`, `.aseprite`, preview PNG, and per-tag `.gif` files:

```json
{
  "tool": "sprite_normalize",
  "arguments": {
    "filePaths": ["assets/raw/raw_grid_part1.png", "assets/raw/raw_grid_part2.png"],
    "cols": 4,
    "rows": 4,
    "center": true,
    "ground": true,
    "pad": 8,
    "durationMs": 100,
    "tags": [
      "idle:0:3:100:pingpong",
      "walk:4:7:100:loop",
      "run:8:11:100:loop",
      "jump:12:15:100:once",
      "fall:16:19:100:loop",
      "crouch:20:23:100:once",
      "sleep:24:27:100:pingpong",
      "attack:28:31:100:once"
    ],
    "outPngPath": "internal/assets/sprites/hero_cat.png",
    "outJsonPath": "internal/assets/sprites/hero_cat.json",
    "outSpritePath": "assets/sprites/hero_cat.sprite",
    "outAsepritePath": "internal/assets/sprites/hero_cat.aseprite",
    "outPreviewPath": "assets/previews/hero_cat_preview.png",
    "outGifDir": "assets/previews/gifs"
  }
}
```

- For retro pixel art (`64x64` or `32x32`), also pass `"frameWidth": 64, "frameHeight": 64` (and `"scale": 4` for magnified preview/GIF outputs).
- Always inspect `outPreviewPath`, `outGifDir`, and the QA fields in the tool report before embedding the sheet into your game to catch baseline drift, cropped limbs, or cell bleed.

---

## The `.sprite` format: sheet containers and procedural SDF

### Sheet-backed container (`sheet "..."`)

Written automatically by `sprite_normalize` or edited by hand, a container `.sprite` links an atlas `.png` or `.aseprite` to its frame size, grid layout, `fps` or `duration`, and tag ranges (including optional lead-in `once` frames like `tag run 8 once, 9..11 loop`):

```text
title "hero_cat"
type sprite
sheet "hero_cat.png"
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

### Procedural SDF and pixel-art definition (`part ...`)

When a `.sprite` script omits `sheet` and defines Z-ordered `part` blocks instead, `sprite_compile` evaluates 2D Signed Distance Fields (`circle`, `box`, `capsule`, `ring`, `poly`, `line`, `pixel`), shades normals across 4-step material ramps, adds a 1px outline for sprites (none for seamless `type tileset`), and animates parts via `pose` transforms (`dx`, `dy`, `rot`, `scale`, `squash`, `visible`, `ease`):

```text
title "Slime Familiar"
type sprite
size 32x32
palette forest
outline #0D1712
light -0.5,-0.7

part shadow ramp=obsidian z=-5 pivot=16,28
  box 16,28 8,1.5 r=1.0 step=0

part body ramp=slime z=0 pivot=16,27 dither=bayer2
  circle 16,20 r=8.5
  box 16,24 9.0,4.0 r=2.5 op=smin k=2.5

part eyes ramp=obsidian z=5 pivot=16,19
  pixel 13,18 w=2 h=3 step=0
  pixel 18,18 w=2 h=3 step=0
  pixel 13,18 w=1 h=1 step=3 ramp=bone
  pixel 18,18 w=1 h=1 step=3 ramp=bone

tag idle frames=4 duration=150ms loop=loop
  pose body squash=sin(0.10)
  pose eyes dy=sin(1.0)
```

Pass the `.sprite` text (`dsl`) or `filePath` to `sprite_compile` with `outPngPath`, `outJsonPath`, `outAsepritePath`, `outPreviewPath`, and `outGifDir` to bake game-ready assets on disk.

---

## Five visual QA checks (`sprite_inspect` / `sprite_compile` / `sprite_normalize`)

1. **Premultiplied alpha (`premultipliedClean`, `R, G, B <= A`)**: Every pixel in every frame must be valid premultiplied RGBA to prevent bright blending halos.
2. **Bounding-box fill ratio (`fillRatioPct`)**: `type sprite` must occupy `8.0%` to `92.0%` of the frame area; `type tileset` must occupy `50.0%` to `100.0%`.
3. **Center-of-mass stability (`centerOfMassX`)**: Horizontal center of mass across frames must remain within `18%` to `82%` of frame width so `flipX` mirrors naturally without shifting position.
4. **Shading contrast (`luminanceSteps`)**: Opaque pixels must span at least `3` distinct luminance buckets (out of `16` Rec. 601 quantized levels).
5. **Tag bounds and timing**: Every tag must satisfy `0 <= FromFrame <= ToFrame < TotalFrames` with positive `DurationMs`.

---

## Baking, `//go:embed`, and zero-allocation Ebitengine integration

Bake final `.png` + `.json` manifests (or `.aseprite` binaries) into `internal/assets/sprites/` via `sprite_compile` or `sprite_normalize`, embed them in Go using `//go:embed`, and pre-slice every cell once at startup so `Draw()` never calls `SubImage` or allocates `ebiten.DrawImageOptions`:

```go
package assets

import (
	"bytes"
	_ "embed"
	"fmt"
	"image"
	_ "image/png"

	"github.com/hajimehoshi/ebiten/v2"
)

//go:embed sprites/hero_cat.png
var heroCatPNG []byte

//go:embed sprites/hero_cat.json
var HeroCatJSON []byte

func LoadEmbeddedImage(raw []byte, label string) (*ebiten.Image, error) {
	img, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return nil, fmt.Errorf("assets: decode %s: %w", label, err)
	}
	return ebiten.NewImageFromImage(img), nil
}
```

Slice the decoded `*ebiten.Image` once at `Boot` (using either a grid slicer `NewGridSpriteSheet` + `AnimationController` or `SolarLune/goaseprite` over the exported JSON manifest as shown in [`references/aseprite_format.md`](references/aseprite_format.md)):

```go
sheet, err := NewGridSpriteSheet(atlasImage, 256, 256)
if err != nil {
	return nil, err
}
ctrl := NewAnimationController(sheet)
if err := ctrl.AddTag("idle", 0, 3, 100*time.Millisecond, LoopPingPong); err != nil {
	return nil, err
}
if err := ctrl.AddTagWithIntro("run", 8, 9, 11, 100*time.Millisecond, LoopForward); err != nil {
	return nil, err
}
if err := ctrl.AddTag("attack", 28, 31, 60*time.Millisecond, LoopOnce); err != nil {
	return nil, err
}
if err := ctrl.Play("idle"); err != nil {
	return nil, fmt.Errorf("play initial idle tag: %w", err)
}
```
