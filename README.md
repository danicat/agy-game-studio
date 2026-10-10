# Vibe Code a 2D Game with Go and Gemini

This plugin gives Antigravity the skills to build 2D games in Go with [Ebitengine](https://ebitengine.org/) and Google Gemini.

## Quick start

1. Run the setup check to verify Go 1.26+, `uv`, Node.js, and your Gemini credentials (`kungfu` and `godoctor` are optional but recommended):
   ```bash
   ./scripts/check_env.sh
   ```

2. In Antigravity chat, start the main game workflow with the slash command:
   ```text
   /vibe-game-developer
   ```
   Tell the agent what kind of game you want to make. It will help you write a short design doc and then build the game step by step. You can draw sprites and make music with Gemini (Nano Banana 2.1 and Lyria 3.5), or generate art and sound in pure Go code.

## Included skills

| Skill | What it does |
| :--- | :--- |
| [`vibe-game-developer`](skills/vibe-game-developer/SKILL.md) | Main entry point (`/vibe-game-developer`). Routes your prompts to the right design, code, art, or audio skill. |
| [`playtest-studio`](skills/playtest-studio/SKILL.md) | Launches the live 60 FPS Ebitengine WASM Playtest Studio in the side pane (`/playtest-studio`) with a 10s DVR rewind buffer, 10s GIF export, and visual bug annotations. |
| [`game-design`](skills/game-design/SKILL.md) | Asks a few questions (`/grill-me`) to turn your idea into a clear `GDD.md`. |
| [`ebitengineer`](skills/ebitengineer/SKILL.md) | Writes Ebitengine v2 game loops, scenes, 2D cameras, physics, tilemaps, shaders, and WebAssembly builds. |
| [`procedural-art`](skills/procedural-art/SKILL.md) | Draws 2D sprites, shapes, color ramps, and particles in pure Go code without image files. |
| [`sprite-animation`](skills/sprite-animation/SKILL.md) | Slices sprite sheets, plays frame animations, and reads Aseprite files. |
| [`procedural-composer`](skills/procedural-composer/SKILL.md) | Generates retro sound effects and music loops in pure Go code. |
| [`nano-banana`](skills/nano-banana/SKILL.md) | Generates sprites, tilesets, and game art with Nano Banana 2.1 (`gemini-nano-banana-2.1`). |
| [`lyria`](skills/lyria/SKILL.md) | Generates 44.1 kHz stereo music tracks and loops with Lyria 3.5 (`lyria-3.5`). |
| [`godoctor`](skills/godoctor/SKILL.md) | Checks Go code quality, test coverage (`testquery`), and mutation score (`selene`). |
| [`swarm-coding`](skills/swarm-coding/SKILL.md) | Splits big tasks across parallel subagents so each one works on separate files. |

## Helper scripts

You can also run the media and sprite tools from your terminal:

```bash
# Generate or edit images with Nano Banana 2.1
uv run skills/nano-banana/scripts/banana.py --help

# Generate music tracks with Lyria 3.5
uv run skills/lyria/scripts/lyria.py --help

# Slice a sprite sheet PNG into an Aseprite JSON manifest
uv run skills/sprite-animation/scripts/slice_spritesheet.py --help
```

## About the author

DISCLAIMER: I AM NOT A GAME DEVELOPER.

<img src="chibi_dani_oops.png" alt="Chibi Dani Oops" width="320" />

I am [Daniela Petruzalek](https://linkedin.com/in/petruzalek), a Developer Relations Engineer at Google. I might not be a game developer, but I am a lifetime gamer and game collector. I enjoy using projects like this to teach software engineering, agentic coding, and creative ways to build with AI.