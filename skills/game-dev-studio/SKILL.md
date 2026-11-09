---
name: game-dev-studio
description: >
  Opens the Game Dev Studio side-panel UI extension in the Antigravity
  auxiliary pane by surfacing a sidecar://agy-game-studio/studio/ pill in chat.
license: Apache-2.0
metadata:
  category: game-dev
  tags: "ui-extension, sidecar, playtest, sound-editor, sprite-editor, gamedev"
  author: Daniela Petruzalek (daniela@danicat.dev)
  version: "0.4.0"
---

# Game Dev Studio: Side-Panel Launcher

Surfaces a `sidecar://agy-game-studio/studio/` pill in chat to open **Game Dev Studio** in the auxiliary pane on the requested tab (`playtest`, `sound`, or `sprite`).

## Displaying the Side-Panel Pill

1. **Resolve the target tab and file (if any)**:
   - Default to `/playtest` when no specific tab or file is requested.
   - Use `/sound` when opening the Sound tab (Sound Editor) or a `.music` / `.sfx` file.
   - Use `/sprite` when opening the Sprite tab (Sprite Editor) or a `.sprite` / `.aseprite` file.
   - If a target file is in scope, resolve its absolute path on disk and use its basename as the link label.
2. **Output the `sidecar://` pill in chat**:
   - **Playtest tab (default)**:
     ```markdown
     [Game Dev Studio](sidecar://agy-game-studio/studio/playtest)
     ```
   - **Sound tab (Sound Editor)**:
     ```markdown
     [Sound Editor](sidecar://agy-game-studio/studio/sound)
     [file.music](sidecar://agy-game-studio/studio/sound?file=/absolute/path/to/file.music)
     [file.sfx](sidecar://agy-game-studio/studio/sound?file=/absolute/path/to/file.sfx)
     ```
   - **Sprite tab (Sprite Editor)**:
     ```markdown
     [Sprite Editor](sidecar://agy-game-studio/studio/sprite)
     [file.sprite](sidecar://agy-game-studio/studio/sprite?file=/absolute/path/to/file.sprite)
     [file.aseprite](sidecar://agy-game-studio/studio/sprite?file=/absolute/path/to/file.aseprite)
     ```
