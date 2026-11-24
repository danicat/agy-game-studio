---
name: game-dev-studio
description: >
  Opens the Game Dev Studio side-panel UI extension in the Antigravity
  auxiliary pane by surfacing a sidecar://agy-game-studio/studio/playtest pill
  in chat to compile and playtest Go Ebitengine WASM games at 60 FPS with a
  10-second DVR buffer, bug annotation tools, and animated GIF export.
license: Apache-2.0
metadata:
  category: game-dev
  tags: "ui-extension, sidecar, playtest, wasm, gamedev"
  author: Daniela Petruzalek (daniela@danicat.dev)
  version: "0.4.0"
---

# Game Dev Studio: Side-Panel Launcher

Surfaces a `sidecar://agy-game-studio/studio/playtest` pill in chat to open **Game Dev Studio** in the Antigravity auxiliary pane for live 60 FPS Go Ebitengine WASM playtesting.

---

## Companion skills and MCP server

`game-dev-studio` provides the interactive WASM playtest harness for the `agy-game-studio` plugin suite:

- **Playtest panel (`/playtest`)**: Pairs with `vibe-game-developer` and `ebitengineer` to compile and run Go Ebitengine projects at 60 FPS in WebAssembly, scrub a 10-second DVR buffer, annotate visual bugs, and export 10-second animated GIF clips to chat.

All audio and sprite creation (`sound_presets`, `sfx_synthesize`, `music_validate`, `music_synthesize`, `music_generate`, `sprite_inspect`, `sprite_compile`, `sprite_normalize`, `sprite_extract_palette`, `image_generate`) runs directly through the bundled `game-studio` MCP server so agents can bake assets on disk before embedding them in the Go project.

---

## Displaying the side-panel pill

1. **Surface the pill when playtesting helps**:
   - Emit `[Game Dev Studio](sidecar://agy-game-studio/studio/playtest)` when the `agy-game-studio` plugin is enabled and opening the playtest panel helps the user test, debug, or inspect an Ebitengine Go build.
   - Emit at most one pill per reply.
2. **Output the `sidecar://` pill in chat**:
   ```markdown
   [Game Dev Studio](sidecar://agy-game-studio/studio/playtest)
   ```
