---
name: nano-banana
description: >
  Conversational image generation and multimodal editing with Google Nano
  Banana models via the game-studio MCP image_generate tool. Supports
  nano-banana-2.1 (default), nano-banana-2, nano-banana-2-lite, and
  nano-banana-pro across 14 aspect ratios, up to 4K resolution, up to 14
  reference images, and Search grounding. Bakes .png art, parallax layers,
  and 4x4 chroma-key sprite grids for sprite_normalize and //go:embed in
  Ebitengine.
license: Apache-2.0
metadata:
  category: media
  tags: "image-generation, image-editing, sprites, generative-ai, vertex-ai, gemini-api"
  author: Daniela Petruzalek (daniela@danicat.dev)
  version: "0.6.0"
---

# Nano Banana image generation (`image_generate`)

Generate, edit, and iterate on visual assets with Google's **Nano Banana** models (`nano-banana-2.1`, `nano-banana-2`, `nano-banana-2-lite`, and `nano-banana-pro`) using the **`game-studio` MCP tool `image_generate`** (which supports both **Vertex AI / Gemini Enterprise** Application Default Credentials and `GEMINI_API_KEY` / `GOOGLE_API_KEY`).

> [!CAUTION]
> **Fail fast with zero fallbacks on authentication or tool errors**:
> `image_generate` requires valid **Vertex AI / Gemini Enterprise** credentials (`gcloud auth application-default login`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION="global"`, `GOOGLE_GENAI_USE_ENTERPRISE="true"`, or `enterprise: true` with `project` / `location`) OR a **Gemini API key** (`GEMINI_API_KEY` or `GOOGLE_API_KEY`). If `image_generate` returns an authentication or validation error, **stop at once**, report the exact error to the user, and ask them to fix credentials or arguments. Never fabricate mock images, swap models silently, or bypass credential checks.

---

## Trigger conditions

Activate this skill whenever the user asks to:
- Generate illustrations, key art, UI assets, character turnaround sheets, `4x4` sprite animation grids, or panoramic backgrounds (`1:4`, `4:1`, `1:8`, `8:1`) up to `4K`.
- Edit, restyle, translate, or combine existing images conversationally.
- Use **"banana" as a verb** (such as "banana this image" or "banana this photo into 16-bit pixel art").
- Keep character, object, or style consistency across frames or scenes with reference images (`inputImages`).

---

## `image_generate` MCP tool parameters

Invoke `image_generate` on the `game-studio` MCP server with these exact parameter names:

| Parameter | Type & Required | Valid Values & Rules |
| :--- | :--- | :--- |
| **`prompt`** | `string` (**required**) | Text prompt describing the image to generate or edit. |
| **`outPath`** | `string` (**required**) | Output file path on disk (parent directories are created automatically). |
| **`model`** | `string` | `nano-banana-2.1` (default, alias `gemini-nano-banana-2.1`), `nano-banana-2` (`gemini-3.1-flash-image`), `nano-banana-2-lite` (`gemini-3.1-flash-lite-image`), `nano-banana-pro` (`gemini-3-pro-image`). Rejects `imagen-*`, `nano-banana`, `gemini-2.5-flash-image`, and `*-preview`. |
| **`aspectRatio`** | `string` | `1:1` (default), `1:4`, `1:8`, `2:3`, `3:2`, `3:4`, `4:1`, `4:3`, `4:5`, `5:4`, `8:1`, `9:16`, `16:9`, `21:9`. (`1:4`, `4:1`, `1:8`, `8:1` are rejected on `nano-banana-pro`.) |
| **`resolution`** | `string` | `512px` (`512` normalized to `512px`, `nano-banana-2` only), `1K` (default), `2K`, `4K`. (`2K` and `4K` are rejected on `nano-banana-2-lite`.) |
| **`apiMode`** | `string` | `interactions` (default) or `models`. |
| **`inputImages`** | `[]string` | Up to 14 local reference image paths (`.png`, `.jpg`, `.jpeg`, `.webp`, `.heic`, `.heif`). |
| **`thinkingLevel`** | `string` | `minimal` or `high` (or `medium`, supported only on `nano-banana-2.1` where it is the model default). |
| **`search`** | `bool` | Google Web Search grounding (rejected on `nano-banana-2-lite`). |
| **`imageSearch`** | `bool` | Google Web + Image Search grounding (rejected on `nano-banana-2-lite` and `nano-banana-pro`). |
| **`enterprise`** | `bool` | Force Vertex AI / Gemini Enterprise Application Default Credentials. |
| **`project`** | `string` | Google Cloud Project ID for Vertex AI / Gemini Enterprise (overrides `GOOGLE_CLOUD_PROJECT`). |
| **`location`** | `string` | Google Cloud location for Vertex AI / Gemini Enterprise (defaults to `global`; `us-central1` returns `404` on `nano-banana-2.1`). |

---

## Model selection and capability matrix

| Capability / Feature | `nano-banana-2.1` (Default) | `nano-banana-2-lite` | `nano-banana-2` | `nano-banana-pro` |
| :--- | :--- | :--- | :--- | :--- |
| **Canonical Model ID** | `gemini-nano-banana-2.1` | `gemini-3.1-flash-lite-image` | `gemini-3.1-flash-image` | `gemini-3-pro-image` |
| **Primary Focus** | **Primary workhorse**: speed, 4K, panoramas, Search grounding, editing | Low latency (<2s) and high throughput at low cost | Previous-generation generalist with `512px` and `4K` | Studio precision, multi-reference consistency |
| **Resolutions** | `1K`, `2K`, `4K` | `1K` only | `512px`, `1K`, `2K`, `4K` | `1K`, `2K`, `4K` |
| **Aspect Ratios** | All 14 ratios (panoramic seam elimination on `1:4`, `4:1`, `1:8`, `8:1`) | All 14 ratios | All 14 ratios | 10 standard ratios (no `1:4`, `4:1`, `1:8`, `8:1`) |
| **Search Grounding** | `search` + `imageSearch` | Not supported | `search` + `imageSearch` | `search` only |
| **Thinking Mode** | `minimal`, `medium` (default), `high` | `minimal` (default), `high` | `minimal` (default), `high` | Enabled by default |
| **Reference Anchors** | Up to 14 (10 objects + 4 characters) | Up to 14 (best for single-image edits) | Up to 14 (10 objects + 4 characters) | Up to 14 (6 objects + 5 characters + 3 styles) |
| **Reference Guide** | [nano-banana-2-1.md](references/nano-banana-2-1.md) | [nano-banana-2-lite.md](references/nano-banana-2-lite.md) | [nano-banana-2.md](references/nano-banana-2.md) | [nano-banana-pro.md](references/nano-banana-pro.md) |

> [!IMPORTANT]
> **Vertex AI `global` endpoint, unsupported parameters, and retired models**:
> - **Use `global` on Vertex AI / Gemini Enterprise**: `gemini-nano-banana-2.1` runs on the `global` endpoint (`us-central1` returns `404`).
> - **Do not pass sampling parameters in direct SDK calls**: `seed`, `temperature`, `topP`, `topK`, and `logprobs` return an HTTP `400` API error on `gemini-nano-banana-2.1`.
> - **Retired models**: All `imagen-*` models, `nano-banana`, `gemini-2.5-flash-image`, and `*-preview` image models are rejected. Use `nano-banana-2.1`, `nano-banana-2-lite`, `nano-banana-2`, or `nano-banana-pro`.

---

## Technical reference cards

Consult the model cards in `references/` for complete resolution grids, token budgets (`4K` uses `2,520` tokens on Gemini Developer API and `3,780` tokens on Vertex AI), and optional external SDK/CLI patterns:
- **[references/nano-banana-2-1.md](references/nano-banana-2-1.md)**
- **[references/nano-banana-2-lite.md](references/nano-banana-2-lite.md)**
- **[references/nano-banana-2.md](references/nano-banana-2.md)**
- **[references/nano-banana-pro.md](references/nano-banana-pro.md)**
- **[references/README.md](references/README.md)**

---

## Core MCP workflows

### 1. Seamless `4:1` parallax background (`image_generate`)

```json
{
  "tool": "image_generate",
  "arguments": {
    "prompt": "A seamless 2D side-scrolling pixel-art parallax background of a synthwave city skyline at dusk, clean horizon",
    "outPath": "internal/assets/backgrounds/synthwave_parallax.png",
    "model": "nano-banana-2.1",
    "resolution": "2K",
    "aspectRatio": "4:1",
    "imageSearch": true
  }
}
```

### 2. Explicit Vertex AI / Gemini Enterprise call (`enterprise: true`)

```json
{
  "tool": "image_generate",
  "arguments": {
    "prompt": "A minimalist flat illustration of a ruby potion bottle icon on a dark UI card",
    "outPath": "internal/assets/ui/potion_icon.png",
    "model": "nano-banana-2-lite",
    "aspectRatio": "1:1",
    "enterprise": true,
    "project": "your-gcp-project-id",
    "location": "global"
  }
}
```

### 3. Two-step character sheet to normalized sprite asset (`image_generate` -> `sprite_normalize`)

Splitting character design from animation grid generation keeps proportions and colors stable across frames:

1. **Step 1 (Reference turnaround sheet)**: Call `image_generate` (`model: "nano-banana-2.1"`, `resolution: "2K"`, `aspectRatio: "1:1"`) with readable silhouette proportions (`1:2` to `1:3` head-to-body), the game's camera projection (`2D side-profile`, `3/4 top-down`, or `2:1 isometric`), clear limb separation from the torso, and a printed 4-step color swatch bar on a flat neutral gray background.
2. **Step 2 (`inputImages` chroma-key sprite grid)**: Pass `inputImages: ["assets/raw/character_sheet.png"]` with `thinkingLevel: "high"` to generate a uniform `4x4` grid (`16` frames) on a flat, unlit `#00FF00` bright green (or `#FF00FF` magenta) background with zero grid lines, borders, shadows, or labels, and at least `15%` empty cell margin on all four sides:

```json
{
  "tool": "image_generate",
  "arguments": {
    "prompt": "Keep the exact character proportions and color swatches from the reference sheet. Uniform 4x4 sprite sheet grid in 2D side-profile facing right on a flat unlit #00FF00 background, no grid lines or labels, at least 15% empty #00FF00 margin inside every cell. Row 1: idle. Row 2: walk. Row 3: run. Row 4: 4-phase jump arc (crouch anticipation, launch, rising ascent, mid-air apex).",
    "inputImages": ["assets/raw/character_sheet.png"],
    "outPath": "assets/raw/raw_grid_part1.png",
    "model": "nano-banana-2.1",
    "resolution": "2K",
    "aspectRatio": "1:1",
    "thinkingLevel": "high"
  }
}
```

3. **Step 3 (Normalize & bake via `sprite_normalize`)**: Pass `raw_grid_part1.png` to `sprite_normalize` (`cols: 4`, `rows: 4`, `center: true`, `ground: true`, `tags: [...]`) to strip chroma backgrounds and export baked `.png`, `.json`, `.aseprite`, `.sprite`, and preview `.gif` files.

---

## Baking and `//go:embed` in Ebitengine

Save final baked backgrounds, portraits, card illustrations, and normalized sprite sheets (`.png`, `.json`, `.aseprite`) under `internal/assets/` so your Go Ebitengine binary embeds them cleanly via `//go:embed` with zero runtime API keys or network dependencies:

```go
//go:embed assets/backgrounds/synthwave_parallax.png
var parallaxPNG []byte
```

---

## Prompting best practices

1. **Specify materials and camera**: Name surface textures, lighting direction, and camera projection (`strict 2D side-profile orthographic`, `2:1 isometric`, `16-bit pixel art`, `cel-shaded 2D art with dark outlines`).
2. **Enforce sprite grid geometry**: State exact rows/columns (`4x4 grid`), unlit solid key background (`#00FF00`), zero borders or text labels, and `15%` empty cell margin.
3. **Anchor identity with `inputImages`**: Always pass your Step 1 character sheet in `inputImages` when generating animation sheets or scene variations.
4. **Target edits precisely**: Name both what changes and what stays untouched (`"Change only the armor trim to gold. Keep the pose, expression, and background unchanged."`).
5. **Frame scenes positively**: Describe what appears instead of negations (`"an empty, quiet cobblestone street"` rather than `"no cars"`).
