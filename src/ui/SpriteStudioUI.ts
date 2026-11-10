/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { StudioNotifier } from './PlaytestStudioUI.ts';
import {
  getSessionId,
  getWorkspacePath,
  onWorkspaceChange,
  sidecarFetch,
  syncWorkspaceFromHost
} from '../utils/api.ts';
import {
  openStudioFileModal,
  openStudioArtifactModal,
  openStudioSaveExportModal,
  type LoadedStudioArtifact
} from './StudioModals.ts';

export interface SpriteTagInfo {
  name: string;
  fromFrame: number;
  loopFromFrame?: number;
  toFrame: number;
  frames: number;
  durationMs: number;
  loop: string;
}

export interface SpritePartSummary {
  name: string;
  ramp: string;
  z: number;
  primitiveCount: number;
}

export interface SpriteSynthReport {
  passed: boolean;
  error?: string;
  title: string;
  type: string;
  width: number;
  height: number;
  sheetWidth: number;
  sheetHeight: number;
  sheetCols: number;
  sheetRows: number;
  palette: string;
  totalFrames: number;
  fillRatioPct: number;
  opaquePixelPct: number;
  centerOfMassX: number;
  centerOfMassY: number;
  luminanceSteps: number;
  premultipliedClean: boolean;
  tags: SpriteTagInfo[];
  parts: SpritePartSummary[];
  paletteColors?: string[];
  issues: string[];
}

export interface SpriteFileEntry {
  name: string;
  title: string;
  path: string;
  filePath: string;
  kind: 'png' | 'dsl';
  hasManifest?: boolean;
  hasAseprite?: boolean;
  frameSize?: string;
  tagCount?: number;
  totalFrames?: number;
}

export interface SpriteStudioOptions {
  rootEl: HTMLElement;
}

export interface SpriteFrameComment {
  frameIndex: number;
  tagName: string;
  localFrame: number;
  row: number;
  col: number;
  comment: string;
}

type SpriteEditorMode = 'visual' | 'text';
type BackdropStyle = 'slate' | 'light' | 'void' | 'chroma';

export class SpriteStudioUI {
  private rootEl: HTMLElement;
  private editorMode: SpriteEditorMode = 'visual';

  private activeFilePath = '';
  private activeFileName = '';
  private activeSheetId = '';
  private activeDsl = '';
  private report: SpriteSynthReport | null = null;
  private sheetImage: HTMLImageElement | null = null;

  // Animation playback state (starts paused)
  private isPlaying = false;
  private isOffscreenSkipped = false;
  private rafId: number | null = null;
  private lastTickTime = 0;
  private elapsedInFrameMs = 0;
  private currentFrameIndex = 0;
  private pingPongDir = 1;
  private activeTagIndex = 0; // -1 = All Frames, >= 0 = index into report.tags
  private speedMultiplier = 1.0;

  // Stage visual options
  private smoothFilter = false;
  private backdrop: BackdropStyle = 'slate';
  private userSelectedBackdrop = false;
  private frameComments = new Map<number, SpriteFrameComment>();

  // DOM Elements
  private activeFileLabelEl!: HTMLElement;
  private openFileBtn!: HTMLButtonElement;
  private openArtifactBtn!: HTMLButtonElement;
  private saveBtn!: HTMLButtonElement;
  private exportBtn!: HTMLButtonElement;
  private modeVisualBtn!: HTMLButtonElement;
  private modeTextBtn!: HTMLButtonElement;
  private visualPaneEl!: HTMLElement;
  private textPaneEl!: HTMLElement;
  private playPauseBtn!: HTMLButtonElement;
  private stagePlayBtn!: HTMLButtonElement;
  private prevFrameBtn!: HTMLButtonElement;
  private nextFrameBtn!: HTMLButtonElement;
  private toggleOnceBtn!: HTMLButtonElement;
  private frameReadoutEl!: HTMLElement;
  private textTitleEl!: HTMLElement;
  private stageCanvas!: HTMLCanvasElement;
  private stageCtx!: CanvasRenderingContext2D;
  private stageHudEl!: HTMLElement;
  private atlasCanvas!: HTMLCanvasElement;
  private atlasCtx!: CanvasRenderingContext2D;
  private scrubberEl!: HTMLInputElement;
  private tagsBarEl!: HTMLElement;
  private dslTextarea!: HTMLTextAreaElement;
  private saveDslBtn!: HTMLButtonElement;
  private compileDslBtn!: HTMLButtonElement;
  private commentTargetEl!: HTMLElement;
  private pinnedCommentsBarEl!: HTMLElement;
  private pinCommentBtn!: HTMLButtonElement;
  private chatNoteInputEl!: HTMLInputElement;

  constructor(options: SpriteStudioOptions) {
    this.rootEl = options.rootEl;
    this.backdrop = this.isLightTheme() ? 'light' : 'slate';
    this.buildDOM();
    this.bindEvents();
    this.setupBackgroundProcessingGuard();
    this.setupThemeSync();
    this.renderStageAndAtlas();
    onWorkspaceChange(() => {
      void this.loadCatalogAndInitialAsset(true);
    });
    void this.loadCatalogAndInitialAsset();
  }

  private isLightTheme(): boolean {
    return document.documentElement.classList.contains('light');
  }

  private setupThemeSync(): void {
    const syncThemeBackdrop = () => {
      if (!this.userSelectedBackdrop) {
        const nextBg: BackdropStyle = this.isLightTheme() ? 'light' : 'slate';
        if (this.backdrop !== nextBg) {
          this.backdrop = nextBg;
          this.syncBackdropPillsUI();
        }
      }
      this.renderStageAndAtlas();
    };

    window.addEventListener('studio-theme-change', syncThemeBackdrop);
    if (typeof MutationObserver !== 'undefined') {
      const mo = new MutationObserver(syncThemeBackdrop);
      mo.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class', 'data-theme']
      });
    }
  }

  private syncBackdropPillsUI(): void {
    this.rootEl.querySelectorAll('#spr-bg-group .sprite-speed-pill').forEach((btn) => {
      const bg = (btn as HTMLElement).dataset.bg as BackdropStyle;
      btn.classList.toggle('active', bg === this.backdrop);
    });
  }

  private updateActiveFileBadge(): void {
    if (!this.activeFileLabelEl) return;
    const displayName =
      this.activeFileName ||
      (this.activeFilePath ? this.activeFilePath.split('/').pop() || this.activeFilePath : '') ||
      (this.report?.title ? `${this.report.title}.sprite` : '');
    if (displayName) {
      this.activeFileLabelEl.textContent = displayName;
      this.activeFileLabelEl.title = this.activeFilePath || displayName;
      if (this.textTitleEl) {
        this.textTitleEl.textContent = displayName;
      }
    } else {
      this.activeFileLabelEl.textContent = 'No sprite loaded';
      this.activeFileLabelEl.title = 'Open a .sprite or .aseprite file or artifact';
      if (this.textTitleEl) {
        this.textTitleEl.textContent = '.sprite Source';
      }
    }
  }

  private static isSupportedSpriteFile(filePath: string): boolean {
    const lower = (filePath || '').trim().toLowerCase();
    return lower.endsWith('.sprite') || lower.endsWith('.aseprite') || lower.endsWith('.ase');
  }

  public onShow(): void {
    this.isOffscreenSkipped = false;
    if (!this.userSelectedBackdrop) {
      this.backdrop = this.isLightTheme() ? 'light' : 'slate';
      this.syncBackdropPillsUI();
    }
    this.renderStageAndAtlas();
    if (this.sheetImage && this.isPlaying) {
      this.startAnimationLoop();
    }
  }

  public pausePlayback(): void {
    this.isPlaying = false;
    this.updatePlayPauseButton();
    this.stopAnimationLoop();
  }

  private buildDOM(): void {
    const isLight = this.backdrop === 'light';
    this.rootEl.innerHTML = `
      <div class="sound-studio-shell">
        <!-- Two-Row Top Toolbar: Row 1 File Actions, Row 2 Visual / Text Toggle, Play/Pause, Backdrop -->
        <header class="sound-toolbar sound-toolbar-two-rows">
          <div class="sound-toolbar-row">
            <div class="sound-toolbar-main">
              <span
                id="spr-active-file-label"
                class="file-badge-pill"
                title="Open a .sprite or .aseprite file or artifact"
              >No sprite loaded</span>
            </div>

            <div class="sound-toolbar-edges">
              <button
                type="button"
                id="spr-open-file-btn"
                class="btn btn-sm btn-outline btn-header-action"
                title="Open .sprite or .aseprite file from workspace or computer"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                <span class="btn-label">Open</span>
              </button>

              <button
                type="button"
                id="spr-artifacts-btn"
                class="btn btn-sm btn-outline btn-header-action"
                title="Open or save session sprite artifacts"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                <span class="btn-label">Artifacts</span>
              </button>

              <button
                type="button"
                id="spr-save-btn"
                class="btn btn-sm btn-outline btn-header-action"
                title="Save .sprite or .aseprite file"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                <span class="btn-label">Save</span>
              </button>

              <button
                type="button"
                id="spr-export-btn"
                class="btn btn-sm btn-primary btn-header-action"
                title="Export as .aseprite, .png sprite sheet, or .json animation manifest"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                <span class="btn-label">Export</span>
              </button>
            </div>
          </div>

          <div class="sound-toolbar-row">
            <div class="sound-toolbar-main">
              <div class="sound-mode-tabs" role="tablist" aria-label="Editor Mode">
                <button
                  type="button"
                  id="spr-mode-visual"
                  class="sound-mode-tab active"
                  role="tab"
                  aria-selected="true"
                  tabindex="0"
                >
                  Visual
                </button>
                <button
                  type="button"
                  id="spr-mode-text"
                  class="sound-mode-tab"
                  role="tab"
                  aria-selected="false"
                  tabindex="-1"
                  title="Edit raw .sprite container text"
                >
                  Text
                </button>
              </div>

              <button
                type="button"
                id="spr-play-btn"
                class="btn btn-primary sound-play-btn"
              >
                Play
              </button>
            </div>

            <div class="sound-toolbar-edges">
              <div class="sprite-speed-pills" id="spr-bg-group" role="group" aria-label="Backdrop">
                <button type="button" class="sprite-speed-pill${!isLight ? ' active' : ''}" data-bg="slate" title="Dark slate backdrop">Slate</button>
                <button type="button" class="sprite-speed-pill${isLight ? ' active' : ''}" data-bg="light" title="Light backdrop">Light</button>
                <button type="button" class="sprite-speed-pill" data-bg="void" title="Pure black backdrop">Void</button>
                <button type="button" class="sprite-speed-pill" data-bg="chroma" title="Chroma green backdrop">Chroma</button>
              </div>
            </div>
          </div>
        </header>

        <!-- 1. Visual Mode: Stage, Transport (Pause/Play + Speed), Motion Chips & Frame Strip -->
        <main id="spr-visual-pane" class="sound-hero-stage">
          <section class="sprite-stage-card" aria-label="Animated Sprite Stage">
            <div class="sprite-stage-canvas-wrap">
              <canvas id="sprite-stage-canvas" width="520" height="240"></canvas>
              <div class="sound-wave-overlay">
                <span id="sprite-stage-hud" class="sound-time-pill">No sprite loaded</span>
              </div>
            </div>

            <div class="sprite-transport-bar" role="group" aria-label="Animation Transport and Speed">
              <div class="sprite-transport-btns">
                <button
                  type="button"
                  id="spr-prev-frame-btn"
                  class="sprite-transport-btn"
                  title="Previous frame"
                  aria-label="Previous frame"
                >
                  ⏮
                </button>
                <button
                  type="button"
                  id="spr-stage-play-btn"
                  class="sprite-transport-btn primary"
                  title="Play / Pause animation"
                  aria-label="Play animation"
                >
                  ▶
                </button>
                <button
                  type="button"
                  id="spr-next-frame-btn"
                  class="sprite-transport-btn"
                  title="Next frame"
                  aria-label="Next frame"
                >
                  ⏭
                </button>
              </div>

              <label for="sprite-frame-scrubber" class="sr-only">Frame Scrubber</label>
              <input
                type="range"
                id="sprite-frame-scrubber"
                class="sprite-range-slider"
                min="0"
                max="0"
                step="1"
                value="0"
              />
              <span id="spr-frame-readout" class="sprite-frame-readout">#0</span>

              <button
                type="button"
                id="spr-toggle-once-btn"
                class="sprite-speed-pill"
                title="Flag this frame to run once as a lead-in before looping the rest of the animation (e.g. tag run 8 once, 9..11 loop)"
              >
                1× Once
              </button>

              <div class="sprite-speed-pills" id="spr-stage-speed-group" role="group" aria-label="Animation Speed">
                <button type="button" class="sprite-speed-pill" data-speed="0.25" title="0.25x speed">0.25×</button>
                <button type="button" class="sprite-speed-pill" data-speed="0.5" title="0.5x speed">0.5×</button>
                <button type="button" class="sprite-speed-pill active" data-speed="1" title="1x speed">1×</button>
                <button type="button" class="sprite-speed-pill" data-speed="2" title="2x speed">2×</button>
              </div>
            </div>
          </section>

          <section class="sound-controls-card" aria-label="Sprite Motions and Frames">
            <div id="sprite-tags-bar" class="sound-preset-strip" role="tablist" aria-label="Sprite Motions"></div>
            <div class="sprite-filmstrip-wrap">
              <canvas id="sprite-atlas-canvas" width="520" height="140" title="Click any sprite frame to pause and comment on it"></canvas>
            </div>
          </section>
        </main>

        <!-- 2. .sprite Text Mode: Direct .sprite Text Editor -->
        <main id="spr-text-pane" class="sound-hero-stage sprite-text-editor-pane hidden">
          <section class="sprite-text-card" aria-label=".sprite Text Editor">
            <div class="sprite-text-header">
              <span id="spr-text-title" class="sprite-text-title">.sprite Source</span>
              <div class="sprite-text-actions">
                <button type="button" id="spr-compile-btn" class="btn btn-secondary btn-sm">
                  Apply
                </button>
                <button type="button" id="spr-save-dsl-btn" class="btn btn-primary btn-sm">
                  Save .sprite
                </button>
              </div>
            </div>
            <textarea
              id="sprite-dsl-textarea"
              class="sound-dsl-textarea sprite-full-textarea"
              spellcheck="false"
              placeholder="// Select a sprite or write .sprite definition here..."
              aria-label="Sprite DSL source code"
            ></textarea>
          </section>
        </main>

        <!-- Bottom Per-Sprite Comment & Prompt Bar -->
        <footer class="sprite-comment-footer">
          <div id="spr-pinned-comments-bar" class="sprite-pinned-comments hidden" aria-label="Pinned sprite frame comments"></div>
          <div class="sound-prompt-bar">
            <span id="spr-comment-target" class="sprite-comment-target-pill" title="Selected sprite frame for comment">
              #0
            </span>
            <input
              type="text"
              id="sprite-chat-note-input"
              class="sound-prompt-input"
              placeholder="Click a sprite frame to comment on it, or ask to edit..."
              aria-label="Comment on selected sprite frame"
            />
            <button
              type="button"
              id="spr-pin-comment-btn"
              class="btn btn-secondary sprite-pin-btn"
              title="Pin comment to this specific sprite frame so you can comment on multiple frames before sending"
            >
              + Note
            </button>
            <button
              type="button"
              id="spr-send-frame-btn"
              class="btn btn-primary sound-send-btn"
            >
              Send
            </button>
          </div>
        </footer>
      </div>
    `;

    this.activeFileLabelEl = this.rootEl.querySelector('#spr-active-file-label') as HTMLElement;
    this.openFileBtn = this.rootEl.querySelector('#spr-open-file-btn') as HTMLButtonElement;
    this.openArtifactBtn = this.rootEl.querySelector('#spr-artifacts-btn') as HTMLButtonElement;
    this.saveBtn = this.rootEl.querySelector('#spr-save-btn') as HTMLButtonElement;
    this.exportBtn = this.rootEl.querySelector('#spr-export-btn') as HTMLButtonElement;
    this.modeVisualBtn = this.rootEl.querySelector('#spr-mode-visual') as HTMLButtonElement;
    this.modeTextBtn = this.rootEl.querySelector('#spr-mode-text') as HTMLButtonElement;
    this.visualPaneEl = this.rootEl.querySelector('#spr-visual-pane') as HTMLElement;
    this.textPaneEl = this.rootEl.querySelector('#spr-text-pane') as HTMLElement;
    this.playPauseBtn = this.rootEl.querySelector('#spr-play-btn') as HTMLButtonElement;
    this.stagePlayBtn = this.rootEl.querySelector('#spr-stage-play-btn') as HTMLButtonElement;
    this.prevFrameBtn = this.rootEl.querySelector('#spr-prev-frame-btn') as HTMLButtonElement;
    this.nextFrameBtn = this.rootEl.querySelector('#spr-next-frame-btn') as HTMLButtonElement;
    this.toggleOnceBtn = this.rootEl.querySelector('#spr-toggle-once-btn') as HTMLButtonElement;
    this.frameReadoutEl = this.rootEl.querySelector('#spr-frame-readout') as HTMLElement;
    this.textTitleEl = this.rootEl.querySelector('#spr-text-title') as HTMLElement;
    this.stageCanvas = this.rootEl.querySelector('#sprite-stage-canvas') as HTMLCanvasElement;
    this.stageCtx = this.stageCanvas.getContext('2d')!;
    this.stageHudEl = this.rootEl.querySelector('#sprite-stage-hud') as HTMLElement;
    this.atlasCanvas = this.rootEl.querySelector('#sprite-atlas-canvas') as HTMLCanvasElement;
    this.atlasCtx = this.atlasCanvas.getContext('2d')!;
    this.scrubberEl = this.rootEl.querySelector('#sprite-frame-scrubber') as HTMLInputElement;
    this.tagsBarEl = this.rootEl.querySelector('#sprite-tags-bar') as HTMLElement;
    this.dslTextarea = this.rootEl.querySelector('#sprite-dsl-textarea') as HTMLTextAreaElement;
    this.saveDslBtn = this.rootEl.querySelector('#spr-save-dsl-btn') as HTMLButtonElement;
    this.compileDslBtn = this.rootEl.querySelector('#spr-compile-btn') as HTMLButtonElement;
    this.commentTargetEl = this.rootEl.querySelector('#spr-comment-target') as HTMLElement;
    this.pinnedCommentsBarEl = this.rootEl.querySelector('#spr-pinned-comments-bar') as HTMLElement;
    this.pinCommentBtn = this.rootEl.querySelector('#spr-pin-comment-btn') as HTMLButtonElement;
    this.chatNoteInputEl = this.rootEl.querySelector('#sprite-chat-note-input') as HTMLInputElement;

    this.syncRangeSliderCssVars();
    this.updatePlayPauseButton();
    this.updateActiveFileBadge();
  }

  private switchEditorMode(mode: SpriteEditorMode): void {
    this.editorMode = mode;
    const isVisual = mode === 'visual';
    this.modeVisualBtn.classList.toggle('active', isVisual);
    this.modeVisualBtn.setAttribute('aria-selected', String(isVisual));
    this.modeVisualBtn.setAttribute('tabindex', isVisual ? '0' : '-1');

    this.modeTextBtn.classList.toggle('active', !isVisual);
    this.modeTextBtn.setAttribute('aria-selected', String(!isVisual));
    this.modeTextBtn.setAttribute('tabindex', !isVisual ? '0' : '-1');

    this.visualPaneEl.classList.toggle('hidden', !isVisual);
    this.textPaneEl.classList.toggle('hidden', isVisual);

    if (isVisual) {
      this.renderStageAndAtlas();
    } else {
      this.pausePlayback();
    }
  }

  private syncRangeSliderCssVars(): void {
    const min = this.scrubberEl.min || '0';
    const max = this.scrubberEl.max || '100';
    const val = this.scrubberEl.value || '0';
    this.scrubberEl.style.setProperty('--attr-min', min);
    this.scrubberEl.style.setProperty('--attr-max', max === min ? String(Number(min) + 1) : max);
    this.scrubberEl.style.setProperty('--control-value', val);
    this.scrubberEl.setAttribute('aria-valuetext', `Frame ${Number(val) + 1}`);
  }

  private setupBackgroundProcessingGuard(): void {
    this.rootEl.addEventListener('contentvisibilityautostatechange', (event: any) => {
      if (event.skipped) {
        this.isOffscreenSkipped = true;
        this.stopAnimationLoop();
      } else {
        this.isOffscreenSkipped = false;
        if (this.isPlaying && this.sheetImage) {
          this.startAnimationLoop();
        }
      }
    });

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        if (!this.isOffscreenSkipped && !this.rootEl.classList.contains('hidden')) {
          this.renderStageAndAtlas();
        }
      });
      const stageWrap = this.stageCanvas?.parentElement;
      const atlasWrap = this.atlasCanvas?.parentElement;
      if (stageWrap) ro.observe(stageWrap);
      if (atlasWrap) ro.observe(atlasWrap);
    }
  }

  private bindEvents(): void {
    this.modeVisualBtn.addEventListener('click', () => this.switchEditorMode('visual'));
    this.modeTextBtn.addEventListener('click', () => this.switchEditorMode('text'));

    this.openFileBtn.addEventListener('click', () => {
      this.handleOpenFileModal();
    });

    this.openArtifactBtn.addEventListener('click', () => {
      this.handleOpenArtifactModal();
    });

    this.saveBtn.addEventListener('click', () => {
      this.handleSaveModal();
    });

    this.exportBtn.addEventListener('click', () => {
      this.handleExportModal();
    });

    this.playPauseBtn.addEventListener('click', () => {
      this.togglePlayPause();
    });

    this.stagePlayBtn.addEventListener('click', () => {
      this.togglePlayPause();
    });

    this.prevFrameBtn.addEventListener('click', () => {
      this.stepFrame(-1);
    });

    this.nextFrameBtn.addEventListener('click', () => {
      this.stepFrame(1);
    });

    this.toggleOnceBtn.addEventListener('click', () => {
      this.toggleOnceOnCurrentFrame();
    });

    this.stageCanvas.addEventListener('click', () => {
      if (this.sheetImage) {
        this.togglePlayPause();
      }
    });

    // Backdrop pills
    this.rootEl.querySelectorAll('#spr-bg-group .sprite-speed-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        const bg = ((btn as HTMLElement).dataset.bg as BackdropStyle) || 'slate';
        this.userSelectedBackdrop = true;
        this.backdrop = bg;
        this.syncBackdropPillsUI();
        this.renderStageAndAtlas();
      });
    });

    // Speed pills
    this.rootEl.querySelectorAll('#spr-stage-speed-group .sprite-speed-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sp = Number((btn as HTMLElement).dataset.speed) || 1.0;
        this.setSpeedMultiplier(sp);
      });
    });

    // Scrubber
    this.scrubberEl.addEventListener('input', () => {
      const idx = Number(this.scrubberEl.value) || 0;
      this.selectAndPauseFrame(idx);
    });

    this.compileDslBtn.addEventListener('click', () => {
      void this.compileCurrentDsl(true);
    });

    this.saveDslBtn.addEventListener('click', () => {
      void this.saveCurrentDsl();
    });

    this.dslTextarea.addEventListener('keydown', (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        void this.compileCurrentDsl(true);
      }
    });

    // Click cell on Filmstrip / Atlas canvas to pause on & select that specific sprite frame
    this.atlasCanvas.addEventListener('click', (e: MouseEvent) => {
      if (!this.report || !this.sheetImage) return;
      const rect = this.atlasCanvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const scaleX = this.atlasCanvas.width / rect.width;
      const scaleY = this.atlasCanvas.height / rect.height;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      if (this.activeTagIndex >= 0) {
        const range = this.getActiveFrameRange();
        const count = Math.max(1, range.to - range.from + 1);
        const stripRect = this.getFilmstripDrawRect(count);
        if (
          clickX < stripRect.x ||
          clickX > stripRect.x + stripRect.w ||
          clickY < stripRect.y ||
          clickY > stripRect.y + stripRect.h
        ) {
          return;
        }
        const localIdx = Math.min(
          count - 1,
          Math.max(0, Math.floor(((clickX - stripRect.x) / stripRect.w) * count))
        );
        this.selectAndPauseFrame(range.from + localIdx, true);
      } else {
        const cols = Math.max(1, this.report.sheetCols || 1);
        const rows = Math.max(1, this.report.sheetRows || 1);
        const drawInfo = this.getAtlasDrawRect();
        if (
          clickX < drawInfo.x ||
          clickX > drawInfo.x + drawInfo.w ||
          clickY < drawInfo.y ||
          clickY > drawInfo.y + drawInfo.h
        ) {
          return;
        }
        const col = Math.min(cols - 1, Math.max(0, Math.floor(((clickX - drawInfo.x) / drawInfo.w) * cols)));
        const row = Math.min(rows - 1, Math.max(0, Math.floor(((clickY - drawInfo.y) / drawInfo.h) * rows)));
        const frameIdx = row * cols + col;
        if (frameIdx >= 0 && frameIdx < this.report.totalFrames) {
          this.selectAndPauseFrame(frameIdx, true);
        }
      }
    });

    // Pin comment to selected sprite frame
    this.pinCommentBtn.addEventListener('click', () => {
      this.pinCommentToCurrentFrame();
    });

    // Send prompt + snapshot to chat
    this.rootEl.querySelector('#spr-send-frame-btn')?.addEventListener('click', () => {
      void this.sendCanvasToChat();
    });
    this.chatNoteInputEl.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.shiftKey || e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        this.pinCommentToCurrentFrame();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        void this.sendCanvasToChat();
      }
    });
  }

  private setSpeedMultiplier(speed: number): void {
    this.speedMultiplier = speed;
    this.rootEl
      .querySelectorAll('#spr-stage-speed-group .sprite-speed-pill')
      .forEach((b) => {
        const bSpeed = Number((b as HTMLElement).dataset.speed) || 1.0;
        b.classList.toggle('active', Math.abs(bSpeed - speed) < 0.01);
      });
  }

  private stepFrame(delta: number): void {
    if (!this.report) return;
    const range = this.getActiveFrameRange();
    const span = Math.max(1, range.to - range.from + 1);
    const local = ((this.currentFrameIndex - range.from + delta) % span + span) % span;
    this.selectAndPauseFrame(range.from + local, false);
  }

  private selectAndPauseFrame(frameIdx: number, focusCommentInput = false): void {
    if (!this.report) return;
    const total = Math.max(1, this.report.totalFrames || 1);
    this.currentFrameIndex = Math.max(0, Math.min(total - 1, frameIdx));
    this.isPlaying = false;
    this.updatePlayPauseButton();
    this.stopAnimationLoop();
    this.syncScrubberToFrame();
    this.updateCommentTargetBadge();
    this.renderStageAndAtlas();

    const existing = this.frameComments.get(this.currentFrameIndex);
    if (existing && !this.chatNoteInputEl.value.trim()) {
      this.chatNoteInputEl.value = existing.comment;
    }
    if (focusCommentInput) {
      this.chatNoteInputEl.focus();
    }
  }

  private getFrameMetadata(frameIdx: number): {
    tagName: string;
    localFrame: number;
    tagSpan: number;
    row: number;
    col: number;
  } {
    if (!this.report) {
      return { tagName: 'all', localFrame: 1, tagSpan: 1, row: 1, col: 1 };
    }
    const cols = Math.max(1, this.report.sheetCols || 1);
    const col = (frameIdx % cols) + 1;
    const row = Math.floor(frameIdx / cols) + 1;
    const tags = this.report.tags || [];
    for (const t of tags) {
      if (frameIdx >= t.fromFrame && frameIdx <= t.toFrame) {
        return {
          tagName: t.name,
          localFrame: frameIdx - t.fromFrame + 1,
          tagSpan: Math.max(1, t.toFrame - t.fromFrame + 1),
          row,
          col,
        };
      }
    }
    return {
      tagName: 'all',
      localFrame: frameIdx + 1,
      tagSpan: Math.max(1, this.report.totalFrames || 1),
      row,
      col,
    };
  }

  private updateCommentTargetBadge(): void {
    if (!this.commentTargetEl) return;
    if (!this.report) {
      this.commentTargetEl.textContent = '#0';
      return;
    }
    const meta = this.getFrameMetadata(this.currentFrameIndex);
    this.commentTargetEl.textContent = `${meta.tagName} #${this.currentFrameIndex}`;
    this.commentTargetEl.title = `Frame #${this.currentFrameIndex} · ${meta.tagName} (${meta.localFrame}/${meta.tagSpan}) · Row ${meta.row}, Col ${meta.col}`;
    this.chatNoteInputEl.placeholder = `Comment on ${meta.tagName} #${this.currentFrameIndex} (Row ${meta.row}, Col ${meta.col})...`;
  }

  private pinCommentToCurrentFrame(): void {
    if (!this.report) return;
    const text = this.chatNoteInputEl.value.trim();
    if (!text) {
      StudioNotifier.info('Type a note first, then click "+ Note" to pin it to this sprite.');
      this.chatNoteInputEl.focus();
      return;
    }
    const meta = this.getFrameMetadata(this.currentFrameIndex);
    this.frameComments.set(this.currentFrameIndex, {
      frameIndex: this.currentFrameIndex,
      tagName: meta.tagName,
      localFrame: meta.localFrame,
      row: meta.row,
      col: meta.col,
      comment: text,
    });
    this.chatNoteInputEl.value = '';
    this.renderPinnedCommentsBar();
    this.renderStageAndAtlas();
  }

  private renderPinnedCommentsBar(): void {
    if (!this.pinnedCommentsBarEl) return;
    this.pinnedCommentsBarEl.innerHTML = '';
    if (this.frameComments.size === 0) {
      this.pinnedCommentsBarEl.classList.add('hidden');
      return;
    }
    this.pinnedCommentsBarEl.classList.remove('hidden');

    const sorted = Array.from(this.frameComments.values()).sort((a, b) => a.frameIndex - b.frameIndex);
    for (const item of sorted) {
      const chip = document.createElement('div');
      chip.className = 'sprite-comment-chip';

      const jumpBtn = document.createElement('button');
      jumpBtn.type = 'button';
      jumpBtn.className = 'sprite-comment-chip-jump';
      const preview = item.comment.length > 28 ? `${item.comment.slice(0, 26)}…` : item.comment;
      jumpBtn.textContent = `${item.tagName} #${item.frameIndex}: "${preview}"`;
      jumpBtn.title = `Jump to ${item.tagName} #${item.frameIndex} (Row ${item.row}, Col ${item.col}): ${item.comment}`;
      jumpBtn.addEventListener('click', () => {
        this.selectAndPauseFrame(item.frameIndex, true);
        this.chatNoteInputEl.value = item.comment;
      });

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'sprite-comment-chip-remove';
      removeBtn.textContent = '×';
      removeBtn.setAttribute('aria-label', `Remove comment on frame #${item.frameIndex}`);
      removeBtn.addEventListener('click', () => {
        this.frameComments.delete(item.frameIndex);
        this.renderPinnedCommentsBar();
        this.renderStageAndAtlas();
      });

      chip.appendChild(jumpBtn);
      chip.appendChild(removeBtn);
      this.pinnedCommentsBarEl.appendChild(chip);
    }
  }

  private togglePlayPause(): void {
    if (!this.sheetImage) {
      StudioNotifier.info('Select a sprite first.');
      return;
    }
    this.isPlaying = !this.isPlaying;
    if (this.isPlaying) {
      const range = this.getActiveFrameRange();
      if (range.loop === 'once' && this.currentFrameIndex >= range.to) {
        this.currentFrameIndex = range.from;
        this.syncScrubberToFrame();
        this.renderStageAndAtlas();
      }
      if (this.editorMode !== 'visual') {
        this.switchEditorMode('visual');
      }
      this.startAnimationLoop();
    } else {
      this.stopAnimationLoop();
    }
    this.updatePlayPauseButton();
  }

  private toggleOnceOnCurrentFrame(): void {
    if (!this.report || !this.report.tags || this.activeTagIndex < 0 || this.activeTagIndex >= this.report.tags.length) {
      StudioNotifier.info('Select a named animation tag first to flag a lead-in frame to run once.');
      return;
    }
    const tag = this.report.tags[this.activeTagIndex];
    if (tag.toFrame <= tag.fromFrame) {
      StudioNotifier.info(`Tag "${tag.name}" has only 1 frame.`);
      return;
    }

    if (this.currentFrameIndex < tag.toFrame) {
      const targetLoopFrom = this.currentFrameIndex + 1;
      if (tag.loopFromFrame === targetLoopFrom) {
        delete tag.loopFromFrame;
        StudioNotifier.info(`Cleared lead-in once flag on "${tag.name}" (${tag.fromFrame}..${tag.toFrame} ${tag.loop || 'loop'}).`);
      } else {
        tag.loopFromFrame = targetLoopFrom;
        if (tag.loop === 'once' || !tag.loop || tag.loop === 'forward') {
          tag.loop = 'loop';
        }
        const introLabel = targetLoopFrom - 1 > tag.fromFrame ? `${tag.fromFrame}..${targetLoopFrom - 1}` : `${tag.fromFrame}`;
        const loopLabel = tag.toFrame > targetLoopFrom ? `${targetLoopFrom}..${tag.toFrame}` : `${targetLoopFrom}`;
        StudioNotifier.info(`Flagged "${tag.name}": ${introLabel} once, ${loopLabel} ${tag.loop}`);
      }
    } else {
      // On the last frame of the tag, toggle the entire tag between once and loop
      const nextLoop = tag.loop === 'once' ? 'loop' : 'once';
      tag.loop = nextLoop;
      if (nextLoop === 'once') {
        delete tag.loopFromFrame;
      }
      StudioNotifier.info(`Set "${tag.name}" playback mode to ${nextLoop}.`);
    }

    this.syncTagToDsl(tag);
    this.syncScrubberToFrame();
    this.renderStageAndAtlas();
  }

  private syncTagToDsl(tag: SpriteTagInfo): void {
    const currentDsl = this.dslTextarea.value || this.activeDsl;
    if (!currentDsl.trim()) return;

    const rawLoop = String(tag.loop || 'loop').toLowerCase();
    const loopMode = rawLoop === 'forward' || rawLoop === '' ? 'loop' : rawLoop;
    let formattedLine = '';
    if (tag.loopFromFrame && tag.loopFromFrame > tag.fromFrame && tag.loopFromFrame <= tag.toFrame) {
      const introRange =
        tag.loopFromFrame - 1 > tag.fromFrame
          ? `${tag.fromFrame}..${tag.loopFromFrame - 1}`
          : `${tag.fromFrame}`;
      const loopRange =
        tag.toFrame > tag.loopFromFrame
          ? `${tag.loopFromFrame}..${tag.toFrame}`
          : `${tag.loopFromFrame}`;
      formattedLine = `tag ${tag.name.padEnd(10)} ${introRange} once, ${loopRange} ${loopMode}`;
    } else {
      const rangeStr = tag.toFrame > tag.fromFrame ? `${tag.fromFrame}..${tag.toFrame}` : `${tag.fromFrame}`;
      formattedLine = `tag ${tag.name.padEnd(10)} ${rangeStr} ${loopMode}`;
    }

    const lines = currentDsl.split('\n');
    const escapedName = tag.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tagRegex = new RegExp(`^(\\s*tag\\s+${escapedName}\\b)(.*)$`, 'i');
    let replaced = false;
    const nextLines = lines.map((line) => {
      if (!replaced && tagRegex.test(line)) {
        replaced = true;
        return formattedLine;
      }
      return line;
    });
    if (replaced) {
      const updated = nextLines.join('\n');
      this.dslTextarea.value = updated;
      this.activeDsl = updated;
    }
  }

  private getDefaultBasename(): string {
    const raw =
      this.activeFileName ||
      (this.activeFilePath ? this.activeFilePath.split('/').pop() || '' : '') ||
      this.report?.title ||
      'sprite';
    return (
      raw
        .replace(/\.(sprite|aseprite|ase|png|gif|json)$/i, '')
        .trim()
        .replace(/[^a-zA-Z0-9._-]+/g, '_') || 'sprite'
    );
  }

  private getInitialSaveDirectory(): string {
    if (this.activeFilePath && this.activeFilePath.includes('/')) {
      return this.activeFilePath.slice(0, this.activeFilePath.lastIndexOf('/'));
    }
    return getWorkspacePath() || '';
  }

  private handleOpenFileModal(): void {
    openStudioFileModal({
      title: 'Open Sprite File (.sprite, .aseprite)',
      acceptExtensions: ['.sprite', '.aseprite', '.ase'],
      filterType: 'sprite',
      initialDirectory: this.getInitialSaveDirectory(),
      onSelectFilePath: async (absPath: string) => {
        await this.loadAssetFile(absPath);
      },
      onSelectLocalFile: async (file: File) => {
        await this.loadLocalFile(file);
      }
    });
  }

  private handleOpenArtifactModal(): void {
    openStudioArtifactModal({
      title: 'Session Sprite Artifacts',
      filterExtensions: ['.sprite', '.aseprite', '.png', '.gif'],
      defaultSaveName: this.getDefaultBasename(),
      saveFormats: [
        { value: 'sprite', label: '.sprite DSL Source' },
        { value: 'aseprite', label: '.aseprite Sprite Container' },
        { value: 'png', label: '.png Sprite Sheet' }
      ],
      onLoadArtifact: async (artifact: LoadedStudioArtifact) => {
        await this.loadArtifactIntoEditor(artifact);
      },
      onGetSavePayload: async (format: string) => {
        if (format === 'sprite') {
          const text = this.dslTextarea.value.trim() || this.activeDsl.trim();
          if (!text) {
            throw new Error('No .sprite DSL text available to save.');
          }
          return { text, ext: '.sprite' };
        }
        if (format === 'aseprite') {
          const payload = await this.buildExportPayload('aseprite');
          return { base64: payload.base64, ext: '.aseprite' };
        }
        const payload = await this.buildExportPayload('png');
        return { base64: payload.base64, ext: '.png' };
      }
    });
  }

  private handleSaveModal(initialFormatId?: 'sprite' | 'aseprite'): void {
    const hasDsl = Boolean(this.dslTextarea.value.trim() || this.activeDsl.trim());
    const defaultFormat =
      initialFormatId ||
      (this.activeFilePath.toLowerCase().endsWith('.aseprite') ||
      this.activeFilePath.toLowerCase().endsWith('.ase')
        ? 'aseprite'
        : hasDsl
          ? 'sprite'
          : 'aseprite');

    openStudioSaveExportModal({
      mode: 'save',
      title: 'Save Sprite',
      defaultBasename: this.getDefaultBasename(),
      initialDirectory: this.getInitialSaveDirectory(),
      initialFormatId: defaultFormat,
      formats: [
        { id: 'sprite', label: 'Sprite DSL (.sprite)', ext: '.sprite' },
        { id: 'aseprite', label: 'Aseprite Binary (.aseprite)', ext: '.aseprite' }
      ],
      onGetPayload: async (formatId: string) => {
        if (formatId === 'sprite') {
          const text = this.dslTextarea.value.trim() || this.activeDsl.trim();
          if (!text) {
            throw new Error('Write or load a .sprite DSL definition before saving as .sprite.');
          }
          return { text, mimeType: 'text/plain;charset=utf-8' };
        }
        return await this.buildExportPayload('aseprite');
      },
      onSaved: (savedPath: string, filename: string) => {
        if (savedPath) {
          this.activeFilePath = savedPath;
        }
        this.activeFileName = filename;
        this.updateActiveFileBadge();
      }
    });
  }

  private handleExportModal(): void {
    if (!this.sheetImage || !this.report) {
      StudioNotifier.info('Open or compile a sprite before exporting.');
      return;
    }

    openStudioSaveExportModal({
      mode: 'export',
      title: 'Export Sprite Asset',
      defaultBasename: this.getDefaultBasename(),
      initialDirectory: this.getInitialSaveDirectory(),
      initialFormatId: 'aseprite',
      formats: [
        { id: 'aseprite', label: 'Aseprite Container (.aseprite)', ext: '.aseprite' },
        { id: 'png', label: 'Packed Sprite Sheet (.png)', ext: '.png' },
        { id: 'json', label: 'Animation Manifest (.json)', ext: '.json' }
      ],
      onGetPayload: async (formatId: string) => {
        return await this.buildExportPayload(formatId as 'aseprite' | 'png' | 'json');
      }
    });
  }

  private async buildExportPayload(
    formatId: 'aseprite' | 'png' | 'json'
  ): Promise<{ base64?: string; text?: string; mimeType: string }> {
    if (!this.sheetImage || !this.report) {
      throw new Error('No compiled or loaded sprite sheet available to export.');
    }

    if (formatId === 'png') {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, this.sheetImage.naturalWidth || this.report.sheetWidth || this.report.width);
      canvas.height = Math.max(1, this.sheetImage.naturalHeight || this.report.sheetHeight || this.report.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to acquire 2D context for PNG export.');
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(this.sheetImage, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
      return { base64, mimeType: 'image/png' };
    }

    if (formatId === 'json') {
      const cols = Math.max(1, this.report.sheetCols || 1);
      const rows = Math.max(1, this.report.sheetRows || 1);
      const fw = Math.max(1, this.report.width || 1);
      const fh = Math.max(1, this.report.height || 1);
      const total = Math.max(1, this.report.totalFrames || 1);
      const tags = this.report.tags || [];
      const frames = [];
      for (let i = 0; i < total; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const tagMatch = tags.find((t) => i >= t.fromFrame && i <= t.toFrame);
        frames.push({
          frame: i,
          x: col * fw,
          y: row * fh,
          w: fw,
          h: fh,
          durationMs: tagMatch?.durationMs || 100,
          tag: tagMatch?.name || 'all'
        });
      }
      const manifest = {
        title: this.report.title || this.getDefaultBasename(),
        type: this.report.type || 'sprite',
        frameWidth: fw,
        frameHeight: fh,
        sheetWidth: this.report.sheetWidth || cols * fw,
        sheetHeight: this.report.sheetHeight || rows * fh,
        cols,
        rows,
        totalFrames: total,
        tags,
        frames
      };
      return {
        text: `${JSON.stringify(manifest, null, 2)}\n`,
        mimeType: 'application/json;charset=utf-8'
      };
    }

    // formatId === 'aseprite'
    const aseBytes = await this.encodeAsepriteBinary();
    return {
      base64: SpriteStudioUI.uint8ToBase64(aseBytes),
      mimeType: 'application/octet-stream'
    };
  }

  private static uint8ToBase64(bytes: Uint8Array): string {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const sub = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...sub);
    }
    return btoa(binary);
  }

  private static async zlibCompress(raw: Uint8Array): Promise<Uint8Array> {
    if (typeof CompressionStream === 'undefined') {
      throw new Error('CompressionStream("deflate") is required to encode .aseprite cel chunks.');
    }
    const cs = new CompressionStream('deflate');
    const writer = cs.writable.getWriter();
    await writer.write(raw as unknown as BufferSource);
    await writer.close();
    const ab = await new Response(cs.readable).arrayBuffer();
    return new Uint8Array(ab);
  }

  private static async zlibDecompress(compressed: Uint8Array): Promise<Uint8Array> {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('DecompressionStream("deflate") is required to decode .aseprite cel chunks.');
    }
    const ds = new DecompressionStream('deflate');
    const writer = ds.writable.getWriter();
    await writer.write(compressed as unknown as BufferSource);
    await writer.close();
    const ab = await new Response(ds.readable).arrayBuffer();
    return new Uint8Array(ab);
  }

  private async encodeAsepriteBinary(): Promise<Uint8Array> {
    if (!this.sheetImage || !this.report) {
      throw new Error('No sprite sheet loaded.');
    }
    const fw = Math.max(1, this.report.width);
    const fh = Math.max(1, this.report.height);
    const cols = Math.max(1, this.report.sheetCols || 1);
    const numFrames = Math.max(1, this.report.totalFrames || 1);
    const tags = this.report.tags || [];

    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = fw;
    frameCanvas.height = fh;
    const frameCtx = frameCanvas.getContext('2d', { willReadFrequently: true });
    if (!frameCtx) {
      throw new Error('Failed to create 2D context for .aseprite encoding.');
    }

    const textEncoder = new TextEncoder();
    const frameBuffers: Uint8Array[] = [];
    let totalFramesBytes = 0;

    for (let idx = 0; idx < numFrames; idx++) {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      frameCtx.clearRect(0, 0, fw, fh);
      frameCtx.drawImage(this.sheetImage, col * fw, row * fh, fw, fh, 0, 0, fw, fh);
      const rgba = new Uint8Array(frameCtx.getImageData(0, 0, fw, fh).data.buffer);
      const compressedCel = await SpriteStudioUI.zlibCompress(rgba);

      const chunks: Uint8Array[] = [];

      if (idx === 0) {
        // Layer chunk (0x2004) for "Sprite"
        const layerName = textEncoder.encode('Sprite');
        const layerChunkSize = 6 + 16 + 2 + layerName.length;
        const layerBuf = new Uint8Array(layerChunkSize);
        const ldv = new DataView(layerBuf.buffer);
        ldv.setUint32(0, layerChunkSize, true);
        ldv.setUint16(4, 0x2004, true);
        ldv.setUint16(6, 1, true); // Visible
        ldv.setUint16(8, 0, true); // Image layer
        ldv.setUint16(10, 0, true); // Child level
        ldv.setUint16(12, 0, true);
        ldv.setUint16(14, 0, true);
        ldv.setUint16(16, 0, true); // Normal blend
        layerBuf[18] = 255; // Opacity
        ldv.setUint16(22, layerName.length, true);
        layerBuf.set(layerName, 24);
        chunks.push(layerBuf);

        // Tags chunk (0x2018)
        if (tags.length > 0) {
          let tagsSize = 6 + 2 + 8;
          const encodedTagNames = tags.map((t) => textEncoder.encode(t.name || 'anim'));
          for (const tn of encodedTagNames) {
            tagsSize += 17 + 2 + tn.length;
          }
          const tagsBuf = new Uint8Array(tagsSize);
          const tdv = new DataView(tagsBuf.buffer);
          tdv.setUint32(0, tagsSize, true);
          tdv.setUint16(4, 0x2018, true);
          tdv.setUint16(6, tags.length, true);
          let toff = 16;
          for (let ti = 0; ti < tags.length; ti++) {
            const t = tags[ti];
            const tn = encodedTagNames[ti];
            tdv.setUint16(toff, Math.max(0, t.fromFrame), true);
            tdv.setUint16(toff + 2, Math.max(0, t.toFrame), true);
            let loopDir = 0;
            let repeat = 0;
            if (t.loop === 'reverse') loopDir = 1;
            else if (t.loop === 'pingpong') loopDir = 2;
            else if (t.loop === 'once') repeat = 1;
            tagsBuf[toff + 4] = loopDir;
            tdv.setUint16(toff + 5, repeat, true);
            if (t.loopFromFrame && t.loopFromFrame > t.fromFrame && t.loopFromFrame <= t.toFrame) {
              tdv.setUint16(toff + 7, t.loopFromFrame, true);
              tagsBuf[toff + 9] = 1;
            }
            tagsBuf[toff + 13] = 99;
            tagsBuf[toff + 14] = 102;
            tagsBuf[toff + 15] = 241;
            tdv.setUint16(toff + 17, tn.length, true);
            tagsBuf.set(tn, toff + 19);
            toff += 19 + tn.length;
          }
          chunks.push(tagsBuf);
        }
      }

      // Cel chunk (0x2005)
      const celChunkSize = 6 + 20 + compressedCel.length;
      const celBuf = new Uint8Array(celChunkSize);
      const cdv = new DataView(celBuf.buffer);
      cdv.setUint32(0, celChunkSize, true);
      cdv.setUint16(4, 0x2005, true);
      cdv.setUint16(6, 0, true); // Layer index 0
      cdv.setInt16(8, 0, true); // X
      cdv.setInt16(10, 0, true); // Y
      celBuf[12] = 255; // Opacity
      cdv.setUint16(13, 2, true); // Compressed image cel
      cdv.setInt16(15, 0, true); // Z-index
      cdv.setUint16(22, fw, true);
      cdv.setUint16(24, fh, true);
      celBuf.set(compressedCel, 26);
      chunks.push(celBuf);

      let chunksByteLen = 0;
      for (const c of chunks) chunksByteLen += c.length;
      const frameByteLen = 16 + chunksByteLen;
      const frameBuf = new Uint8Array(frameByteLen);
      const fdv = new DataView(frameBuf.buffer);

      const tagMatch = tags.find((t) => idx >= t.fromFrame && idx <= t.toFrame);
      const durMs = Math.max(16, tagMatch?.durationMs || 100);

      fdv.setUint32(0, frameByteLen, true);
      fdv.setUint16(4, 0xf1fa, true);
      fdv.setUint16(6, chunks.length, true);
      fdv.setUint16(8, durMs, true);
      fdv.setUint32(12, chunks.length, true);

      let foff = 16;
      for (const c of chunks) {
        frameBuf.set(c, foff);
        foff += c.length;
      }
      frameBuffers.push(frameBuf);
      totalFramesBytes += frameBuf.length;
    }

    const totalFileSize = 128 + totalFramesBytes;
    const out = new Uint8Array(totalFileSize);
    const hdv = new DataView(out.buffer);
    hdv.setUint32(0, totalFileSize, true);
    hdv.setUint16(4, 0xa5e0, true);
    hdv.setUint16(6, numFrames, true);
    hdv.setUint16(8, fw, true);
    hdv.setUint16(10, fh, true);
    hdv.setUint16(12, 32, true); // 32-bit RGBA
    hdv.setUint32(14, 1, true); // Layer opacity valid
    hdv.setUint16(18, 100, true);
    out[28] = 0;
    hdv.setUint16(32, 1, true);
    out[34] = 1;
    out[35] = 1;
    hdv.setUint16(38, fw, true);
    hdv.setUint16(40, fh, true);

    let offset = 128;
    for (const fb of frameBuffers) {
      out.set(fb, offset);
      offset += fb.length;
    }
    return out;
  }

  private async decodeAndLoadAsepriteBuffer(buffer: ArrayBuffer, displayName: string): Promise<void> {
    const bytes = new Uint8Array(buffer);
    if (bytes.length < 128) {
      throw new Error(`Invalid .aseprite file "${displayName}" (too short).`);
    }
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const magic = dv.getUint16(4, true);
    if (magic !== 0xa5e0) {
      throw new Error(`Invalid .aseprite header magic in "${displayName}".`);
    }
    const numFrames = Math.max(1, dv.getUint16(6, true));
    const fw = Math.max(1, dv.getUint16(8, true));
    const fh = Math.max(1, dv.getUint16(10, true));
    const depth = dv.getUint16(12, true);
    if (depth !== 32) {
      throw new Error(`Unsupported .aseprite color depth (${depth}-bit); 32-bit RGBA expected.`);
    }

    const cols = Math.max(1, Math.min(8, Math.ceil(Math.sqrt(numFrames))));
    const rows = Math.max(1, Math.ceil(numFrames / cols));
    const sheetW = cols * fw;
    const sheetH = rows * fh;

    const sheetCanvas = document.createElement('canvas');
    sheetCanvas.width = sheetW;
    sheetCanvas.height = sheetH;
    const sheetCtx = sheetCanvas.getContext('2d');
    if (!sheetCtx) {
      throw new Error('Failed to create 2D context for .aseprite sheet decoding.');
    }

    const tags: SpriteTagInfo[] = [];
    const frameDurations: number[] = [];
    const textDecoder = new TextDecoder();

    let offset = 128;
    for (let frameIdx = 0; frameIdx < numFrames && offset + 16 <= bytes.length; frameIdx++) {
      const frameBytes = dv.getUint32(offset, true);
      const frameMagic = dv.getUint16(offset + 4, true);
      if (frameMagic !== 0xf1fa) {
        break;
      }
      const oldChunks = dv.getUint16(offset + 6, true);
      const durationMs = dv.getUint16(offset + 8, true) || 100;
      const newChunks = dv.getUint32(offset + 12, true);
      const chunkCount = newChunks > 0 ? newChunks : oldChunks;
      frameDurations.push(durationMs);

      let chunkOffset = offset + 16;
      const frameEnd = Math.min(bytes.length, offset + frameBytes);

      for (let c = 0; c < chunkCount && chunkOffset + 6 <= frameEnd; c++) {
        const chunkSize = dv.getUint32(chunkOffset, true);
        const chunkType = dv.getUint16(chunkOffset + 4, true);
        if (chunkSize < 6 || chunkOffset + chunkSize > frameEnd) {
          break;
        }

        if (chunkType === 0x2018 && chunkOffset + 16 <= frameEnd) {
          const tagCount = dv.getUint16(chunkOffset + 6, true);
          let toff = chunkOffset + 16;
          for (let ti = 0; ti < tagCount && toff + 19 <= chunkOffset + chunkSize; ti++) {
            const fromFrame = dv.getUint16(toff, true);
            const toFrame = dv.getUint16(toff + 2, true);
            const loopDir = bytes[toff + 4];
            const repeat = dv.getUint16(toff + 5, true);
            const loopFromCand = dv.getUint16(toff + 7, true);
            const hasLoopFrom = bytes[toff + 9] === 1;
            const nameLen = dv.getUint16(toff + 17, true);
            const nameEnd = Math.min(chunkOffset + chunkSize, toff + 19 + nameLen);
            const name = textDecoder.decode(bytes.subarray(toff + 19, nameEnd)) || `tag_${ti}`;
            tags.push({
              name,
              fromFrame,
              loopFromFrame:
                hasLoopFrom && loopFromCand > fromFrame && loopFromCand <= toFrame
                  ? loopFromCand
                  : undefined,
              toFrame,
              frames: Math.max(1, toFrame - fromFrame + 1),
              durationMs,
              loop:
                loopDir === 1
                  ? 'reverse'
                  : loopDir === 2
                    ? 'pingpong'
                    : repeat === 1
                      ? 'once'
                      : 'loop'
            });
            toff = nameEnd;
          }
        } else if (chunkType === 0x2005 && chunkOffset + 26 <= frameEnd) {
          const celX = dv.getInt16(chunkOffset + 8, true);
          const celY = dv.getInt16(chunkOffset + 10, true);
          const celType = dv.getUint16(chunkOffset + 13, true);
          if (celType === 2 || celType === 0) {
            const celW = dv.getUint16(chunkOffset + 22, true);
            const celH = dv.getUint16(chunkOffset + 24, true);
            const rawSlice = bytes.subarray(chunkOffset + 26, chunkOffset + chunkSize);
            const pixels =
              celType === 2 ? await SpriteStudioUI.zlibDecompress(rawSlice) : rawSlice;
            if (pixels.length >= celW * celH * 4 && celW > 0 && celH > 0) {
              const celCanvas = document.createElement('canvas');
              celCanvas.width = celW;
              celCanvas.height = celH;
              const celCtx = celCanvas.getContext('2d');
              if (celCtx) {
                const clamped = new Uint8ClampedArray(celW * celH * 4);
                clamped.set(pixels.subarray(0, celW * celH * 4));
                const imgData = new ImageData(clamped, celW, celH);
                celCtx.putImageData(imgData, 0, 0);
                const col = frameIdx % cols;
                const row = Math.floor(frameIdx / cols);
                sheetCtx.drawImage(celCanvas, col * fw + celX, row * fh + celY);
              }
            }
          }
        }

        chunkOffset += chunkSize;
      }

      offset += Math.max(16, frameBytes);
    }

    for (const t of tags) {
      if (t.fromFrame >= 0 && t.fromFrame < frameDurations.length) {
        t.durationMs = frameDurations[t.fromFrame] || 100;
      }
    }

    const title = displayName.replace(/\.(aseprite|ase)$/i, '');
    const report: SpriteSynthReport = {
      passed: true,
      title,
      type: 'aseprite',
      width: fw,
      height: fh,
      sheetWidth: sheetW,
      sheetHeight: sheetH,
      sheetCols: cols,
      sheetRows: rows,
      palette: 'rgba',
      totalFrames: numFrames,
      fillRatioPct: 50,
      opaquePixelPct: 50,
      centerOfMassX: 0.5,
      centerOfMassY: 0.5,
      luminanceSteps: 8,
      premultipliedClean: true,
      tags:
        tags.length > 0
          ? tags
          : [
              {
                name: 'default',
                fromFrame: 0,
                toFrame: numFrames - 1,
                frames: numFrames,
                durationMs: frameDurations[0] || 100,
                loop: 'forward'
              }
            ],
      parts: [],
      issues: []
    };

    const pngDataUrl = sheetCanvas.toDataURL('image/png');
    const firstDur = report.tags[0]?.durationMs || 100;
    const tagLines = report.tags.map((t) => {
      const mode = t.loop === 'forward' || !t.loop ? 'loop' : t.loop;
      if (t.loopFromFrame && t.loopFromFrame > t.fromFrame && t.loopFromFrame <= t.toFrame) {
        const intro = t.loopFromFrame - 1 > t.fromFrame ? `${t.fromFrame}..${t.loopFromFrame - 1}` : `${t.fromFrame}`;
        const loopR = t.toFrame > t.loopFromFrame ? `${t.loopFromFrame}..${t.toFrame}` : `${t.loopFromFrame}`;
        return `tag ${t.name.padEnd(10)} ${intro} once, ${loopR} ${mode}`;
      }
      const rangeStr = t.toFrame > t.fromFrame ? `${t.fromFrame}..${t.toFrame}` : `${t.fromFrame}`;
      return `tag ${t.name.padEnd(10)} ${rangeStr} ${mode}`;
    });
    const fpsLine = 1000 % firstDur === 0 ? `fps ${1000 / firstDur}` : `duration ${firstDur}ms`;
    const synthDsl = [
      `title "${title}"`,
      `type sprite`,
      `sheet "${displayName}"`,
      `size ${fw}x${fh}`,
      `grid ${cols}x${rows}`,
      fpsLine,
      '',
      ...tagLines,
      ''
    ].join('\n');
    this.activeDsl = synthDsl;
    this.dslTextarea.value = synthDsl;
    await this.applyLoadedSheetResponse(`local_${Date.now()}`, report, pngDataUrl);
  }

  private async loadImageBufferIntoEditor(
    buffer: ArrayBuffer,
    displayName: string,
    ext: string
  ): Promise<void> {
    const mime = ext === '.gif' ? 'image/gif' : 'image/png';
    const blob = new Blob([buffer], { type: mime });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    try {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to decode image "${displayName}"`));
        img.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }

    const sw = Math.max(1, img.naturalWidth || img.width);
    const sh = Math.max(1, img.naturalHeight || img.height);
    let cols = 1;
    let rows = 1;
    let fw = sw;
    let fh = sh;
    if (sw > sh && sw % sh === 0 && sw / sh <= 16) {
      cols = sw / sh;
      fw = sh;
    }

    const totalFrames = cols * rows;
    const title = displayName.replace(/\.(png|gif)$/i, '');
    const report: SpriteSynthReport = {
      passed: true,
      title,
      type: 'sheet',
      width: fw,
      height: fh,
      sheetWidth: sw,
      sheetHeight: sh,
      sheetCols: cols,
      sheetRows: rows,
      palette: 'rgba',
      totalFrames,
      fillRatioPct: 50,
      opaquePixelPct: 50,
      centerOfMassX: 0.5,
      centerOfMassY: 0.5,
      luminanceSteps: 8,
      premultipliedClean: true,
      tags: [
        {
          name: 'all',
          fromFrame: 0,
          toFrame: totalFrames - 1,
          frames: totalFrames,
          durationMs: 100,
          loop: 'forward'
        }
      ],
      parts: [],
      issues: []
    };

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    await this.applyLoadedSheetResponse(`img_${Date.now()}`, report, canvas.toDataURL('image/png'));
  }

  private async loadLocalFile(file: File): Promise<void> {
    this.pausePlayback();
    this.activeFilePath = '';
    this.activeFileName = file.name;
    this.updateActiveFileBadge();

    const lower = file.name.toLowerCase();
    if (lower.endsWith('.sprite')) {
      const text = await file.text();
      this.activeDsl = text;
      this.dslTextarea.value = text;
      await this.compileCurrentDsl(true);
      return;
    }

    const buffer = await file.arrayBuffer();
    if (lower.endsWith('.aseprite') || lower.endsWith('.ase')) {
      await this.decodeAndLoadAsepriteBuffer(buffer, file.name);
      this.switchEditorMode('visual');
      StudioNotifier.success(`Loaded "${file.name}"`);
      return;
    }

    if (lower.endsWith('.png') || lower.endsWith('.gif')) {
      const ext = lower.endsWith('.gif') ? '.gif' : '.png';
      await this.loadImageBufferIntoEditor(buffer, file.name, ext);
      this.switchEditorMode('visual');
      StudioNotifier.success(`Loaded "${file.name}"`);
    }
  }

  private async loadArtifactIntoEditor(artifact: LoadedStudioArtifact): Promise<void> {
    this.pausePlayback();
    this.activeFilePath = artifact.filePath || '';
    this.activeFileName = artifact.displayName || artifact.filename;
    this.updateActiveFileBadge();

    const ext = (artifact.ext || '').toLowerCase();
    if (ext === '.sprite') {
      const text =
        typeof artifact.text === 'string'
          ? artifact.text
          : new TextDecoder().decode(artifact.content);
      this.activeDsl = text;
      this.dslTextarea.value = text;
      await this.compileCurrentDsl(true);
      return;
    }

    if (ext === '.aseprite' || ext === '.ase') {
      await this.decodeAndLoadAsepriteBuffer(artifact.content, this.activeFileName);
      this.switchEditorMode('visual');
      return;
    }

    await this.loadImageBufferIntoEditor(artifact.content, this.activeFileName, ext);
    this.switchEditorMode('visual');
  }

  public async loadCatalogAndInitialAsset(preserveSelection = false): Promise<void> {
    try {
      if (!getWorkspacePath()) {
        await syncWorkspaceFromHost();
      }

      if (preserveSelection && this.activeFilePath) {
        await this.loadAssetFile(this.activeFilePath);
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const requestedFile = (params.get('file') || params.get('path') || params.get('uri') || '').trim();
      if (!preserveSelection && requestedFile && SpriteStudioUI.isSupportedSpriteFile(requestedFile)) {
        await this.loadAssetFile(requestedFile);
      }
    } catch (err: any) {
      StudioNotifier.error('Sprite Editor failed to load initial asset', err.message);
    }
  }

  private async loadAssetFile(filePath: string): Promise<void> {
    if (!SpriteStudioUI.isSupportedSpriteFile(filePath)) {
      return;
    }
    // Always start paused when opening a sprite
    this.pausePlayback();
    this.activeFilePath = filePath;
    this.activeFileName = filePath.split('/').pop() || filePath;
    this.updateActiveFileBadge();

    const lower = filePath.toLowerCase();
    if (lower.endsWith('.sprite')) {
      await this.loadDslFile(filePath);
    } else {
      await this.loadAsepriteOrSheet(filePath);
    }
  }

  private async loadAsepriteOrSheet(filePath: string): Promise<void> {
    try {
      const res = await sidecarFetch('/api/sprite/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to inspect sprite (${res.status})`);
      }

      if (typeof data.dsl === 'string' && data.dsl.trim()) {
        this.activeDsl = data.dsl;
        this.dslTextarea.value = data.dsl;
      }
      await this.applyLoadedSheetResponse(data.sheetId, data.report, data.pngDataUrl);
      this.updateActiveFileBadge();
    } catch (err: any) {
      StudioNotifier.error('Failed to inspect sprite', err.message);
    }
  }

  private async loadDslFile(filePath: string): Promise<void> {
    try {
      const readRes = await sidecarFetch('/api/sprite/file/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
      });
      const readData = await readRes.json();
      if (!readRes.ok) {
        throw new Error(readData.error || `Failed to read "${filePath}"`);
      }
      this.activeDsl = readData.content || '';
      this.dslTextarea.value = this.activeDsl;

      await this.compileCurrentDsl(false);
      this.updateActiveFileBadge();
    } catch (err: any) {
      StudioNotifier.error('Failed to load .sprite file', err.message);
    }
  }

  private async compileCurrentDsl(switchToVisualOnSuccess = false): Promise<void> {
    try {
      const dsl = this.dslTextarea.value;
      if (!dsl.trim()) {
        StudioNotifier.info('Write or open a .sprite definition first.');
        return;
      }
      this.activeDsl = dsl;
      const res = await sidecarFetch('/api/sprite/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dsl, filePath: this.activeFilePath }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Sprite DSL compilation failed (${res.status})`);
      }
      await this.applyLoadedSheetResponse(data.sheetId, data.report, data.pngDataUrl);
      this.updateActiveFileBadge();
      if (switchToVisualOnSuccess) {
        this.switchEditorMode('visual');
        StudioNotifier.info(`Applied "${data.report?.title || 'Sprite'}"`);
      }
    } catch (err: any) {
      StudioNotifier.error('DSL Compile Error', err.message);
    }
  }

  private async saveCurrentDsl(): Promise<void> {
    const content = this.dslTextarea.value;
    if (!content.trim()) {
      StudioNotifier.info('Cannot save empty .sprite text.');
      return;
    }

    if (!this.activeFilePath || !this.activeFilePath.toLowerCase().endsWith('.sprite')) {
      this.handleSaveModal('sprite');
      return;
    }

    try {
      const res = await sidecarFetch('/api/sprite/file/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: this.activeFilePath, content }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Save failed (${res.status})`);
      }
      this.activeFilePath = data.filePath || this.activeFilePath;
      this.activeFileName = data.fileName || this.activeFilePath.split('/').pop() || '';
      this.updateActiveFileBadge();
      StudioNotifier.info(`Saved ${data.fileName}`);
      await this.compileCurrentDsl(true);
    } catch (err: any) {
      StudioNotifier.error('Failed to save .sprite file', err.message);
    }
  }

  private async applyLoadedSheetResponse(
    sheetId: string,
    report: SpriteSynthReport,
    pngDataUrl?: string
  ): Promise<void> {
    this.activeSheetId = sheetId;
    this.report = report;

    let srcUrl = typeof pngDataUrl === 'string' && pngDataUrl.startsWith('data:image/') ? pngDataUrl : '';
    let objectUrlToRevoke = '';
    if (!srcUrl) {
      const pngRes = await sidecarFetch(
        `/api/sprite/png?sheetId=${encodeURIComponent(sheetId)}&t=${Date.now()}`,
        { method: 'GET' }
      );
      if (!pngRes.ok) {
        throw new Error(`Failed to fetch sprite sheet PNG (${pngRes.status})`);
      }
      const blob = await pngRes.blob();
      objectUrlToRevoke = URL.createObjectURL(blob);
      srcUrl = objectUrlToRevoke;
    }

    const img = new Image();
    try {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to decode sprite sheet PNG (${sheetId})`));
        img.src = srcUrl;
      });
    } finally {
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
    }
    this.sheetImage = img;
    this.smoothFilter = report.width >= 128 || report.height >= 128;

    // Select first tag by default and keep paused
    this.activeTagIndex = report.tags && report.tags.length > 0 ? 0 : -1;
    const range = this.getActiveFrameRange();
    this.currentFrameIndex = range.from;
    this.pingPongDir = 1;
    this.elapsedInFrameMs = 0;
    this.isPlaying = false;
    this.updatePlayPauseButton();
    this.stopAnimationLoop();
    this.frameComments.clear();
    this.renderPinnedCommentsBar();

    this.renderTagsBar();
    this.syncScrubberToFrame();
    this.updateCommentTargetBadge();
    this.renderStageAndAtlas();
  }

  private getActiveFrameRange(): {
    from: number;
    loopFrom: number;
    to: number;
    durationMs: number;
    loop: string;
    name: string;
  } {
    if (!this.report) {
      return { from: 0, loopFrom: 0, to: 0, durationMs: 100, loop: 'loop', name: 'none' };
    }
    const total = Math.max(1, this.report.totalFrames || 1);
    const tags = this.report.tags || [];
    if (this.activeTagIndex >= 0 && this.activeTagIndex < tags.length) {
      const t = tags[this.activeTagIndex];
      const from = Math.max(0, Math.min(total - 1, t.fromFrame));
      const to = Math.max(from, Math.min(total - 1, t.toFrame));
      const loopFrom =
        t.loopFromFrame && t.loopFromFrame > from && t.loopFromFrame <= to
          ? t.loopFromFrame
          : from;
      const rawLoop = String(t.loop || 'loop').toLowerCase();
      return {
        from,
        loopFrom,
        to,
        durationMs: t.durationMs > 0 ? t.durationMs : 100,
        loop: rawLoop === 'forward' || rawLoop === '' ? 'loop' : rawLoop,
        name: t.name,
      };
    }
    return {
      from: 0,
      loopFrom: 0,
      to: total - 1,
      durationMs: 100,
      loop: 'loop',
      name: 'all',
    };
  }

  private syncOnceButtonUI(): void {
    if (!this.toggleOnceBtn) return;
    const range = this.getActiveFrameRange();
    const isOnceFrame =
      this.activeTagIndex >= 0 &&
      (range.loop === 'once' || (range.loopFrom > range.from && this.currentFrameIndex < range.loopFrom));
    this.toggleOnceBtn.classList.toggle('active', isOnceFrame);
    this.toggleOnceBtn.disabled = !this.report || this.activeTagIndex < 0;
  }

  private syncScrubberToFrame(): void {
    const range = this.getActiveFrameRange();
    this.scrubberEl.min = String(range.from);
    this.scrubberEl.max = String(range.to);
    this.scrubberEl.value = String(this.currentFrameIndex);
    this.syncRangeSliderCssVars();
    if (this.frameReadoutEl) {
      const localIdx = Math.max(1, this.currentFrameIndex - range.from + 1);
      const span = Math.max(1, range.to - range.from + 1);
      this.frameReadoutEl.textContent = `#${this.currentFrameIndex} · ${localIdx}/${span}`;
    }
    this.syncOnceButtonUI();
    this.updateCommentTargetBadge();
  }

  private renderTagsBar(): void {
    this.tagsBarEl.innerHTML = '';
    if (!this.report) return;

    const tags = this.report.tags || [];
    const createChip = (label: string, idx: number) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `sound-preset-chip${this.activeTagIndex === idx ? ' active' : ''}`;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', String(this.activeTagIndex === idx));
      btn.textContent = label;
      btn.addEventListener('click', () => {
        this.activeTagIndex = idx;
        const r = this.getActiveFrameRange();
        this.currentFrameIndex = r.loop === 'reverse' ? r.to : r.from;
        this.pingPongDir = 1;
        this.elapsedInFrameMs = 0;
        this.renderTagsBar();
        this.syncScrubberToFrame();
        this.renderStageAndAtlas();
      });
      return btn;
    };

    tags.forEach((t, idx) => {
      this.tagsBarEl.appendChild(createChip(t.name, idx));
    });
    if (tags.length > 1 || tags.length === 0) {
      this.tagsBarEl.appendChild(createChip('All', -1));
    }
  }

  private updatePlayPauseButton(): void {
    if (this.playPauseBtn) {
      this.playPauseBtn.textContent = this.isPlaying ? 'Pause' : 'Play';
    }
    if (this.stagePlayBtn) {
      this.stagePlayBtn.textContent = this.isPlaying ? '⏸' : '▶';
      this.stagePlayBtn.setAttribute('aria-label', this.isPlaying ? 'Pause animation' : 'Play animation');
    }
  }

  private advanceTagFrame(): void {
    if (!this.report) return;
    const range = this.getActiveFrameRange();
    if (range.to <= range.from) {
      this.currentFrameIndex = range.from;
      return;
    }

    if (range.loop === 'once') {
      if (this.currentFrameIndex < range.to) {
        this.currentFrameIndex++;
      } else {
        this.pausePlayback();
      }
    } else if (range.loop === 'reverse') {
      this.currentFrameIndex--;
      if (this.currentFrameIndex < range.loopFrom) {
        this.currentFrameIndex = range.to;
      }
    } else if (range.loop === 'pingpong') {
      this.currentFrameIndex += this.pingPongDir;
      if (this.currentFrameIndex > range.to) {
        this.pingPongDir = -1;
        this.currentFrameIndex = Math.max(range.loopFrom, range.to - 1);
      } else if (this.currentFrameIndex < range.loopFrom && this.pingPongDir < 0) {
        this.pingPongDir = 1;
        this.currentFrameIndex = Math.min(range.to, range.loopFrom + 1);
      }
    } else {
      this.currentFrameIndex++;
      if (this.currentFrameIndex > range.to) {
        this.currentFrameIndex = range.loopFrom;
      }
    }
  }

  private startAnimationLoop(): void {
    if (this.rafId !== null) return;
    this.lastTickTime = performance.now();
    const tick = (now: number) => {
      if (!this.isPlaying || this.isOffscreenSkipped) {
        this.rafId = null;
        return;
      }
      const dt = Math.min(100, Math.max(0, now - this.lastTickTime));
      this.lastTickTime = now;

      const range = this.getActiveFrameRange();
      const effDuration = Math.max(16, range.durationMs / Math.max(0.1, this.speedMultiplier));
      this.elapsedInFrameMs += dt;
      if (this.elapsedInFrameMs >= effDuration) {
        this.elapsedInFrameMs %= effDuration;
        this.advanceTagFrame();
        this.syncScrubberToFrame();
        this.renderStageAndAtlas();
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stopAnimationLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private drawBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.backdrop === 'chroma') {
      ctx.fillStyle = '#00FF00';
      ctx.fillRect(0, 0, w, h);
      return;
    }
    if (this.backdrop === 'void') {
      ctx.fillStyle = '#0B0A14';
      ctx.fillRect(0, 0, w, h);
      return;
    }
    const cell = 16;
    const cA = this.backdrop === 'light' ? '#E4E6EB' : '#1E1D2F';
    const cB = this.backdrop === 'light' ? '#F4F5F8' : '#26253A';
    for (let y = 0; y < h; y += cell) {
      for (let x = 0; x < w; x += cell) {
        ctx.fillStyle = ((x / cell + y / cell) & 1) === 0 ? cA : cB;
        ctx.fillRect(x, y, cell, cell);
      }
    }
  }

  private drawFrameAt(
    ctx: CanvasRenderingContext2D,
    frameIdx: number,
    dstX: number,
    dstY: number,
    dstW: number,
    dstH: number,
    alpha = 1.0
  ): void {
    if (!this.sheetImage || !this.report) return;
    const cols = Math.max(1, this.report.sheetCols || 1);
    const fw = this.report.width;
    const fh = this.report.height;
    const col = frameIdx % cols;
    const row = Math.floor(frameIdx / cols);
    const sx = col * fw;
    const sy = row * fh;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = this.smoothFilter;
    if (this.smoothFilter) {
      ctx.imageSmoothingQuality = 'high';
    }
    ctx.drawImage(this.sheetImage, sx, sy, fw, fh, dstX, dstY, dstW, dstH);
    ctx.restore();
  }

  private renderStageAndAtlas(): void {
    this.renderStage();
    this.renderAtlas();
  }

  private syncStageCanvasSize(): void {
    const wrap = this.stageCanvas.parentElement;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const targetW = Math.max(200, Math.round(rect.width || 520));
    const targetH = Math.max(160, Math.round(rect.height || 240));
    if (this.stageCanvas.width !== targetW || this.stageCanvas.height !== targetH) {
      this.stageCanvas.width = targetW;
      this.stageCanvas.height = targetH;
    }
  }

  private syncAtlasCanvasSize(targetHeight: number): void {
    const wrap = this.atlasCanvas.parentElement;
    const rect = wrap ? wrap.getBoundingClientRect() : null;
    const targetW = Math.max(200, Math.round(rect && rect.width > 40 ? rect.width : 520));
    const targetH = Math.max(80, Math.round(targetHeight));
    if (this.atlasCanvas.width !== targetW || this.atlasCanvas.height !== targetH) {
      this.atlasCanvas.width = targetW;
      this.atlasCanvas.height = targetH;
    }
  }

  private renderStage(): void {
    this.syncStageCanvasSize();
    const cw = this.stageCanvas.width;
    const ch = this.stageCanvas.height;
    const ctx = this.stageCtx;
    this.drawBackdrop(ctx, cw, ch);

    if (!this.sheetImage || !this.report) {
      this.stageHudEl.textContent = 'No sprite loaded';
      ctx.save();
      ctx.fillStyle = this.backdrop === 'light' ? '#475569' : '#94A3B8';
      ctx.font = '600 13px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Click "Open File" or "Open Artifact" to inspect a sprite', cw * 0.5, ch * 0.5);
      ctx.restore();
      return;
    }

    const fw = Math.max(1, this.report.width);
    const fh = Math.max(1, this.report.height);
    const range = this.getActiveFrameRange();

    // Strictly uniform scale across X and Y so sprites are never distorted
    const availW = cw * 0.86;
    const availH = ch * 0.86;
    const scale = Math.min(availW / fw, availH / fh);
    const drawW = Math.max(1, Math.round(fw * scale));
    const drawH = Math.max(1, Math.round(fh * scale));

    const dstX = Math.round((cw - drawW) * 0.5);
    const dstY = Math.round((ch - drawH) * 0.5);

    this.drawFrameAt(ctx, this.currentFrameIndex, dstX, dstY, drawW, drawH, 1.0);

    const localIdx = this.currentFrameIndex - range.from + 1;
    const span = Math.max(1, range.to - range.from + 1);
    const loopSummary =
      range.loopFrom > range.from
        ? `${range.loopFrom - 1 > range.from ? `${range.from}..${range.loopFrom - 1}` : range.from} once, ${range.to > range.loopFrom ? `${range.loopFrom}..${range.to}` : range.loopFrom} ${range.loop}`
        : `${range.from}..${range.to} ${range.loop}`;
    this.stageHudEl.textContent = `${range.name} (${loopSummary}) · ${localIdx}/${span} · ${fw}×${fh}`;
  }

  private getFilmstripDrawRect(count: number): { x: number; y: number; w: number; h: number; cellW: number } {
    const cw = this.atlasCanvas.width;
    const ch = this.atlasCanvas.height;
    if (!this.report || count <= 0) {
      return { x: 0, y: 0, w: cw, h: ch, cellW: cw };
    }
    const pad = 8;
    const availW = Math.max(16, cw - pad * 2);
    const availH = Math.max(16, ch - pad * 2);
    const fw = Math.max(1, this.report.width);
    const fh = Math.max(1, this.report.height);
    const scale = Math.min(availW / (count * fw), availH / fh);
    const cellW = Math.max(1, Math.round(fw * scale));
    const cellH = Math.max(1, Math.round(fh * scale));
    const totalW = cellW * count;
    const x = Math.round((cw - totalW) * 0.5);
    const y = Math.round((ch - cellH) * 0.5);
    return { x, y, w: totalW, h: cellH, cellW };
  }

  private getAtlasDrawRect(): { x: number; y: number; w: number; h: number } {
    const cw = this.atlasCanvas.width;
    const ch = this.atlasCanvas.height;
    if (!this.report || this.report.sheetWidth <= 0 || this.report.sheetHeight <= 0) {
      return { x: 0, y: 0, w: cw, h: ch };
    }
    const pad = 8;
    const availW = cw - pad * 2;
    const availH = ch - pad * 2;
    const scale = Math.min(availW / this.report.sheetWidth, availH / this.report.sheetHeight);
    const w = Math.max(1, Math.round(this.report.sheetWidth * scale));
    const h = Math.max(1, Math.round(this.report.sheetHeight * scale));
    const x = Math.round((cw - w) * 0.5);
    const y = Math.round((ch - h) * 0.5);
    return { x, y, w, h };
  }

  private drawCellCommentBadge(
    ctx: CanvasRenderingContext2D,
    frameIdx: number,
    cx: number,
    cy: number,
    cellW: number,
    cellH: number
  ): void {
    ctx.save();
    if (cellW >= 28 && cellH >= 28) {
      ctx.font = '600 9px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle =
        this.backdrop === 'light' ? 'rgba(248, 250, 252, 0.85)' : 'rgba(11, 10, 20, 0.72)';
      ctx.fillRect(cx + 2, cy + 2, 20, 12);
      ctx.fillStyle = this.backdrop === 'light' ? '#0F172A' : 'rgba(255, 255, 255, 0.78)';
      ctx.fillText(`#${frameIdx}`, cx + 4, cy + 11);

      if (this.activeTagIndex >= 0) {
        const range = this.getActiveFrameRange();
        const isOnceFrame =
          range.loop === 'once' || (range.loopFrom > range.from && frameIdx < range.loopFrom);
        if (isOnceFrame) {
          ctx.fillStyle = 'rgba(59, 130, 246, 0.88)';
          ctx.fillRect(cx + 2, cy + cellH - 14, 24, 12);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText('1×', cx + 6, cy + cellH - 5);
        }
      }
    }

    if (this.frameComments.has(frameIdx)) {
      const badgeW = Math.min(16, Math.max(10, cellW * 0.24));
      const bx = cx + cellW - badgeW - 3;
      const by = cy + 3;
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(bx + badgeW * 0.5, by + badgeW * 0.5, badgeW * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0B0A14';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', bx + badgeW * 0.5, by + badgeW * 0.5 + 0.5);
    }
    ctx.restore();
  }

  private renderAtlas(): void {
    const gridStrokeColor =
      this.backdrop === 'light' ? 'rgba(15, 23, 42, 0.2)' : 'rgba(255, 255, 255, 0.16)';

    if (!this.sheetImage || !this.report) {
      this.syncAtlasCanvasSize(120);
      const cw = this.atlasCanvas.width;
      const ch = this.atlasCanvas.height;
      this.drawBackdrop(this.atlasCtx, cw, ch);
      this.atlasCtx.save();
      this.atlasCtx.fillStyle = this.backdrop === 'light' ? '#64748B' : '#94A3B8';
      this.atlasCtx.font = '500 12px system-ui, -apple-system, sans-serif';
      this.atlasCtx.textAlign = 'center';
      this.atlasCtx.textBaseline = 'middle';
      this.atlasCtx.fillText('Animation filmstrip & frame grid will appear here', cw * 0.5, ch * 0.5);
      this.atlasCtx.restore();
      return;
    }

    if (this.activeTagIndex >= 0) {
      this.syncAtlasCanvasSize(132);
      const cw = this.atlasCanvas.width;
      const ch = this.atlasCanvas.height;
      const ctx = this.atlasCtx;
      this.drawBackdrop(ctx, cw, ch);

      const range = this.getActiveFrameRange();
      const count = Math.max(1, range.to - range.from + 1);
      const strip = this.getFilmstripDrawRect(count);

      for (let i = 0; i < count; i++) {
        const frameIdx = range.from + i;
        const cx = strip.x + i * strip.cellW;
        const cy = strip.y;
        this.drawFrameAt(ctx, frameIdx, cx, cy, strip.cellW, strip.h, 1.0);

        ctx.save();
        if (frameIdx === this.currentFrameIndex) {
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(cx + 1, cy + 1, strip.cellW - 2, strip.h - 2);
        } else if (this.frameComments.has(frameIdx)) {
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.65)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(cx + 0.75, cy + 0.75, strip.cellW - 1.5, strip.h - 1.5);
        } else {
          ctx.strokeStyle = gridStrokeColor;
          ctx.lineWidth = 1;
          ctx.strokeRect(cx + 0.5, cy + 0.5, strip.cellW - 1, strip.h - 1);
        }
        ctx.restore();

        this.drawCellCommentBadge(ctx, frameIdx, cx, cy, strip.cellW, strip.h);
      }
      return;
    }

    // Full packed sheet view when "All" chip is selected
    this.syncAtlasCanvasSize(220);
    const cw = this.atlasCanvas.width;
    const ch = this.atlasCanvas.height;
    const ctx = this.atlasCtx;
    this.drawBackdrop(ctx, cw, ch);

    const rect = this.getAtlasDrawRect();
    ctx.save();
    ctx.imageSmoothingEnabled = this.smoothFilter;
    if (this.smoothFilter) {
      ctx.imageSmoothingQuality = 'high';
    }
    ctx.drawImage(this.sheetImage, rect.x, rect.y, rect.w, rect.h);

    const cols = Math.max(1, this.report.sheetCols || 1);
    const rows = Math.max(1, this.report.sheetRows || 1);
    const cellW = rect.w / cols;
    const cellH = rect.h / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const cx = rect.x + c * cellW;
        const cy = rect.y + r * cellH;

        if (idx === this.currentFrameIndex) {
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(cx + 1, cy + 1, cellW - 2, cellH - 2);
        } else if (this.frameComments.has(idx)) {
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.65)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(cx + 0.75, cy + 0.75, cellW - 1.5, cellH - 1.5);
        } else {
          ctx.strokeStyle = gridStrokeColor;
          ctx.lineWidth = 1;
          ctx.strokeRect(cx + 0.5, cy + 0.5, cellW - 1, cellH - 1);
        }
        this.drawCellCommentBadge(ctx, idx, cx, cy, cellW, cellH);
      }
    }
    ctx.restore();
  }

  private renderCommentedFramesCard(comments: SpriteFrameComment[]): string {
    if (!this.report || !this.sheetImage || comments.length === 0) {
      return this.stageCanvas.toDataURL('image/png');
    }

    const cols = Math.min(4, Math.max(1, comments.length));
    const rows = Math.ceil(comments.length / cols);
    const cardW = 180;
    const cardH = 210;
    const pad = 12;

    const canvas = document.createElement('canvas');
    canvas.width = cols * cardW + (cols + 1) * pad;
    canvas.height = rows * cardH + (rows + 1) * pad;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#12111C';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const fw = Math.max(1, this.report.width);
    const fh = Math.max(1, this.report.height);

    comments.forEach((item, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const x = pad + c * (cardW + pad);
      const y = pad + r * (cardH + pad);

      ctx.fillStyle = '#1E1D2F';
      ctx.fillRect(x, y, cardW, cardH);
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, cardW - 2, cardH - 2);

      // Uniformly fit sprite frame inside 140x140 box
      const boxSize = 140;
      const scale = Math.min(boxSize / fw, boxSize / fh);
      const drawW = Math.max(1, Math.round(fw * scale));
      const drawH = Math.max(1, Math.round(fh * scale));
      const bx = x + Math.round((cardW - drawW) * 0.5);
      const by = y + 8 + Math.round((boxSize - drawH) * 0.5);
      this.drawFrameAt(ctx, item.frameIndex, bx, by, drawW, drawH, 1.0);

      ctx.fillStyle = '#F59E0B';
      ctx.font = 'bold 12px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(
        `${item.tagName} #${item.frameIndex} (R${item.row}C${item.col})`,
        x + 8,
        y + 166
      );

      ctx.fillStyle = '#E4E6EB';
      ctx.font = '11px system-ui, -apple-system, sans-serif';
      const line1 = item.comment.slice(0, 26);
      const line2 = item.comment.length > 26 ? item.comment.slice(26, 52) : '';
      ctx.fillText(line1, x + 8, y + 184);
      if (line2) {
        ctx.fillText(line2, x + 8, y + 199);
      }
    });

    return canvas.toDataURL('image/png');
  }

  private async sendCanvasToChat(): Promise<void> {
    if (!this.report) {
      StudioNotifier.info('Select a sprite first before sending to chat.');
      return;
    }
    try {
      const typedText = this.chatNoteInputEl.value.trim();
      const allComments = new Map<number, SpriteFrameComment>(this.frameComments);
      if (typedText) {
        const meta = this.getFrameMetadata(this.currentFrameIndex);
        allComments.set(this.currentFrameIndex, {
          frameIndex: this.currentFrameIndex,
          tagName: meta.tagName,
          localFrame: meta.localFrame,
          row: meta.row,
          col: meta.col,
          comment: typedText,
        });
      }

      const sortedComments = Array.from(allComments.values()).sort(
        (a, b) => a.frameIndex - b.frameIndex
      );
      const range = this.getActiveFrameRange();
      const sessionId = getSessionId() || 'standalone';

      let note = '';
      let dataUrl = '';
      if (sortedComments.length > 1) {
        const lines = sortedComments.map(
          (c) =>
            `- Frame #${c.frameIndex} (${c.tagName} ${c.localFrame}, Row ${c.row} Col ${c.col}): ${c.comment}`
        );
        note = `Sprite review for "${this.report.title}" (${this.activeFilePath}):\n${lines.join('\n')}`;
        dataUrl = this.renderCommentedFramesCard(sortedComments);
      } else if (sortedComments.length === 1) {
        const c = sortedComments[0];
        note = `${c.comment} (${this.report.title} · ${c.tagName} · frame #${c.frameIndex} [Row ${c.row}, Col ${c.col}])`;
        dataUrl = this.renderCommentedFramesCard(sortedComments);
      } else {
        note = `Sprite Editor: "${this.report.title}" · ${range.name} · frame #${this.currentFrameIndex} (${this.report.width}×${this.report.height})`;
        dataUrl = this.stageCanvas.toDataURL('image/png');
      }

      const res = await sidecarFetch('/api/send-to-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          image: dataUrl,
          filename: `sprite_${range.name}_${Date.now()}.png`,
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Send to chat failed (${res.status})`);
      }
      this.chatNoteInputEl.value = '';
      this.frameComments.clear();
      this.renderPinnedCommentsBar();
      this.renderStageAndAtlas();
      StudioNotifier.info('Sent sprite review to chat');
    } catch (err: any) {
      StudioNotifier.error('Send to chat failed', err.message);
    }
  }
}
