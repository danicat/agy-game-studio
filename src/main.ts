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

import './style.css';
import { PlaytestStudioUI, StudioNotifier } from './ui/PlaytestStudioUI.ts';
import { SoundStudioUI } from './ui/SoundStudioUI.ts';
import { SpriteStudioUI } from './ui/SpriteStudioUI.ts';
import { getStudioMode } from './utils/api.ts';

export type StudioView = 'playtest' | 'sound' | 'sprite';

function parseColorLuminance(raw: string): number | null {
  const val = raw.trim().toLowerCase();
  if (!val) return null;

  const hexMatch = val.match(/^#([0-9a-f]{3,8})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    let r = 0;
    let g = 0;
    let b = 0;
    if (hex.length === 3 || hex.length === 4) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length >= 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  const rgbMatch = val.match(/^rgba?\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)/);
  if (rgbMatch) {
    const r = Number(rgbMatch[1]);
    const g = Number(rgbMatch[2]);
    const b = Number(rgbMatch[3]);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  const hslMatch = val.match(/^hsla?\(\s*[\d.]+\s*[, ]\s*[\d.]+%\s*[, ]\s*([\d.]+)%/);
  if (hslMatch) {
    return Number(hslMatch[1]) / 100;
  }

  const oklchMatch = val.match(/^oklch\(\s*([\d.]+)(%?)/);
  if (oklchMatch) {
    const num = Number(oklchMatch[1]);
    return oklchMatch[2] === '%' ? num / 100 : num;
  }

  // Raw Shadcn / Tailwind HSL triplet e.g. "0 0% 100%" or "222.2 84% 4.9%"
  const tripletMatch = val.match(/^[\d.]+\s+[\d.]+%\s+([\d.]+)%$/);
  if (tripletMatch) {
    return Number(tripletMatch[1]) / 100;
  }

  return null;
}

function applyThemeClass(theme: 'light' | 'dark'): void {
  const htmlEl = document.documentElement;
  const isLight = theme === 'light';
  const changed =
    htmlEl.classList.contains('light') !== isLight ||
    htmlEl.classList.contains('dark') !== !isLight;

  htmlEl.classList.toggle('light', isLight);
  htmlEl.classList.toggle('dark', !isLight);
  document.body?.classList.toggle('light', isLight);
  document.body?.classList.toggle('dark', !isLight);

  if (changed) {
    window.dispatchEvent(new CustomEvent('studio-theme-change', { detail: { theme } }));
  }
}

function detectAndSyncHostTheme(explicitTheme?: string): void {
  if (explicitTheme === 'light' || explicitTheme === 'dark') {
    applyThemeClass(explicitTheme);
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const queryTheme = (params.get('theme') || '').trim().toLowerCase();
  if (queryTheme === 'light' || queryTheme === 'dark') {
    applyThemeClass(queryTheme);
    return;
  }

  const htmlEl = document.documentElement;
  const dataTheme = (
    htmlEl.getAttribute('data-theme') ||
    document.body?.getAttribute('data-theme') ||
    ''
  )
    .trim()
    .toLowerCase();
  if (dataTheme.includes('light')) {
    applyThemeClass('light');
    return;
  }
  if (dataTheme.includes('dark')) {
    applyThemeClass('dark');
    return;
  }

  const rootStyle = getComputedStyle(htmlEl);
  const bgRaw =
    rootStyle.getPropertyValue('--background').trim() ||
    rootStyle.getPropertyValue('--vscode-editor-background').trim() ||
    (document.body ? getComputedStyle(document.body).getPropertyValue('--background').trim() : '');

  const lum = parseColorLuminance(bgRaw);
  if (lum !== null) {
    applyThemeClass(lum > 0.55 ? 'light' : 'dark');
    return;
  }

  if (typeof window.matchMedia === 'function') {
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    if (prefersLight) {
      applyThemeClass('light');
      return;
    }
  }
}

function setupHostThemeSync(): void {
  detectAndSyncHostTheme();

  window.addEventListener('message', (event: MessageEvent) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    const msgType = String(data.type || data.event || '').toLowerCase();
    if (
      msgType === 'theme-change' ||
      msgType === 'theme' ||
      msgType === 'antigravity:theme-change' ||
      typeof data.theme === 'string' ||
      typeof data.colorScheme === 'string'
    ) {
      const rawTheme = String(data.theme || data.colorScheme || data.mode || '').toLowerCase();
      if (rawTheme.includes('light')) {
        detectAndSyncHostTheme('light');
      } else if (rawTheme.includes('dark')) {
        detectAndSyncHostTheme('dark');
      } else {
        detectAndSyncHostTheme();
      }
    }
  });

  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => {
      detectAndSyncHostTheme();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'data-theme']
    });
  }

  if (typeof window.matchMedia === 'function') {
    const mql = window.matchMedia('(prefers-color-scheme: light)');
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', () => detectAndSyncHostTheme());
    }
  }
}

function detectInitialStudioView(): StudioView {
  const pathname = window.location.pathname || '/';
  const params = new URLSearchParams(window.location.search);
  const viewParam = (params.get('view') || '').trim().toLowerCase();
  const fileParam = (params.get('file') || params.get('path') || params.get('uri') || '')
    .trim()
    .toLowerCase();

  if (
    pathname.startsWith('/sprite') ||
    viewParam === 'sprite' ||
    fileParam.endsWith('.sprite') ||
    fileParam.endsWith('.aseprite') ||
    fileParam.endsWith('.ase')
  ) {
    return 'sprite';
  }

  if (
    pathname.startsWith('/sound') ||
    viewParam === 'sound' ||
    fileParam.endsWith('.music') ||
    fileParam.endsWith('.sfx')
  ) {
    return 'sound';
  }

  return 'playtest';
}

function initGameStudio(): void {
  try {
    setupHostThemeSync();
    document.title = 'Game Dev Studio';

    const mode = getStudioMode();
    const modeClass = mode === 'preview' ? 'studio-mode-preview' : 'studio-mode-full';

    document.body.classList.remove('studio-mode-preview', 'studio-mode-full');
    document.body.classList.add('studio-container', modeClass);
    if (mode === 'preview') {
      document.body.classList.add('bg-transparent');
    } else {
      document.body.classList.remove('bg-transparent');
    }

    const appEl = document.getElementById('app');
    if (appEl) {
      appEl.classList.remove('studio-mode-preview', 'studio-mode-full');
      appEl.classList.add('studio-container', modeClass);
    }

    const appRootEl = document.getElementById('app-root');
    if (appRootEl) {
      appRootEl.classList.remove('studio-mode-preview', 'studio-mode-full');
      appRootEl.classList.add('studio-container', modeClass);
    }

    const headerEl = document.getElementById('header-bar');
    const annotationBarEl = document.getElementById('annotation-bar');
    const viewportEl = document.getElementById('viewport-container');
    const bugBarEl = document.getElementById('bug-report-bar');

    if (!appRootEl || !headerEl || !annotationBarEl || !viewportEl || !bugBarEl) {
      throw new Error(
        'Required DOM containers not found for Game Dev Studio. Missing: ' +
          [
            !appRootEl && '#app-root',
            !headerEl && '#header-bar',
            !annotationBarEl && '#annotation-bar',
            !viewportEl && '#viewport-container',
            !bugBarEl && '#bug-report-bar'
          ]
            .filter(Boolean)
            .join(', ')
      );
    }

    // Create a top-level studio view bar above the toolbars (separate hierarchy level)
    let topNavEl = document.getElementById('studio-top-nav');
    if (!topNavEl) {
      topNavEl = document.createElement('nav');
      topNavEl.id = 'studio-top-nav';
      topNavEl.className = 'studio-top-nav';
      topNavEl.setAttribute('aria-label', 'Game Dev Studio Workspace');
      topNavEl.innerHTML = `
        <div class="studio-top-tabs" role="tablist" aria-label="Game Dev Studio Tabs">
          <button
            type="button"
            id="top-tab-playtest"
            class="studio-top-tab"
            role="tab"
            aria-selected="true"
          >
            Playtest
          </button>
          <button
            type="button"
            id="top-tab-sound"
            class="studio-top-tab"
            role="tab"
            aria-selected="false"
          >
            Sound
          </button>
          <button
            type="button"
            id="top-tab-sprite"
            class="studio-top-tab"
            role="tab"
            aria-selected="false"
          >
            Sprites
          </button>
        </div>
      `;
      appRootEl.insertBefore(topNavEl, appRootEl.firstChild);
    }

    const tabPlaytestBtn = topNavEl.querySelector('#top-tab-playtest') as HTMLButtonElement | null;
    const tabSoundBtn = topNavEl.querySelector('#top-tab-sound') as HTMLButtonElement | null;
    const tabSpriteBtn = topNavEl.querySelector('#top-tab-sprite') as HTMLButtonElement | null;

    // Create dedicated Sound Editor root container inside #app-root
    let soundRootEl = document.getElementById('sound-studio-root');
    if (!soundRootEl) {
      soundRootEl = document.createElement('div');
      soundRootEl.id = 'sound-studio-root';
      soundRootEl.className = 'sound-studio-root hidden';
      appRootEl.appendChild(soundRootEl);
    }

    // Create dedicated Sprite Editor root container inside #app-root
    let spriteRootEl = document.getElementById('sprite-studio-root');
    if (!spriteRootEl) {
      spriteRootEl = document.createElement('div');
      spriteRootEl.id = 'sprite-studio-root';
      spriteRootEl.className = 'sprite-studio-root hidden';
      appRootEl.appendChild(spriteRootEl);
    }

    let playtestUI: PlaytestStudioUI | null = null;
    let soundUI: SoundStudioUI | null = null;
    let spriteUI: SpriteStudioUI | null = null;
    let activeView: StudioView = detectInitialStudioView();

    const isFileCompatibleWithView = (filePath: string, view: StudioView): boolean => {
      const lower = (filePath || '').trim().toLowerCase();
      if (!lower) return false;
      if (view === 'sound') {
        return lower.endsWith('.music') || lower.endsWith('.sfx');
      }
      if (view === 'sprite') {
        return lower.endsWith('.sprite') || lower.endsWith('.aseprite') || lower.endsWith('.ase');
      }
      return false;
    };

    const updateUrlForView = (view: StudioView, clearFileParams = false) => {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.has('view')) {
          params.set('view', view);
        }
        const currentFile = params.get('file') || params.get('path') || params.get('uri') || '';
        if (clearFileParams || (currentFile && !isFileCompatibleWithView(currentFile, view))) {
          params.delete('file');
          params.delete('path');
          params.delete('uri');
        }
        const targetPath =
          view === 'sound' ? '/sound' : view === 'sprite' ? '/sprite' : '/playtest';
        const qs = params.toString();
        const nextUrl = `${targetPath}${qs ? `?${qs}` : ''}`;
        if (window.location.pathname + window.location.search !== nextUrl) {
          window.history.replaceState({ view }, '', nextUrl);
        }
      } catch {
        // Ignore history.replaceState restrictions in sandboxed environments
      }
      document.title = 'Game Dev Studio';
    };

    const ensurePlaytestUI = (): PlaytestStudioUI => {
      if (!playtestUI) {
        playtestUI = new PlaytestStudioUI({
          headerEl,
          annotationBarEl,
          viewportEl,
          bugBarEl
        });
      }
      return playtestUI;
    };

    const ensureSoundUI = (): SoundStudioUI => {
      if (!soundUI) {
        soundUI = new SoundStudioUI({
          rootEl: soundRootEl!,
          onSwitchToPlaytest: () => switchToView('playtest')
        });
      }
      return soundUI;
    };

    const ensureSpriteUI = (): SpriteStudioUI => {
      if (!spriteUI) {
        spriteUI = new SpriteStudioUI({
          rootEl: spriteRootEl!
        });
      }
      return spriteUI;
    };

    const switchToView = (view: StudioView, updateHistory = true): void => {
      activeView = view;
      const isPlaytest = view === 'playtest';
      const isSound = view === 'sound';
      const isSprite = view === 'sprite';

      if (tabPlaytestBtn && tabSoundBtn) {
        tabPlaytestBtn.classList.toggle('active', isPlaytest);
        tabPlaytestBtn.setAttribute('aria-selected', String(isPlaytest));
        tabSoundBtn.classList.toggle('active', isSound);
        tabSoundBtn.setAttribute('aria-selected', String(isSound));
      }
      if (tabSpriteBtn) {
        tabSpriteBtn.classList.toggle('active', isSprite);
        tabSpriteBtn.setAttribute('aria-selected', String(isSprite));
      }

      if (!isPlaytest && playtestUI && playtestUI.runner.isRunning() && !playtestUI.runner.isPaused()) {
        playtestUI.runner.setPaused(true);
      }
      if (!isSound && soundUI) {
        soundUI.stopPlayback();
      }
      if (!isSprite && spriteUI) {
        spriteUI.pausePlayback();
      }

      headerEl.classList.toggle('studio-view-hidden', !isPlaytest);
      annotationBarEl.classList.toggle('studio-view-hidden', !isPlaytest);
      viewportEl.classList.toggle('studio-view-hidden', !isPlaytest);
      bugBarEl.classList.toggle('studio-view-hidden', !isPlaytest);

      soundRootEl!.classList.toggle('hidden', !isSound);
      spriteRootEl!.classList.toggle('hidden', !isSprite);

      if (updateHistory) {
        updateUrlForView(view);
      } else {
        document.title = 'Game Dev Studio';
      }

      if (isSound) {
        ensureSoundUI();
      } else if (isSprite) {
        ensureSpriteUI().onShow();
      } else {
        ensurePlaytestUI();
      }
    };

    tabPlaytestBtn?.addEventListener('click', () => switchToView('playtest'));
    tabSoundBtn?.addEventListener('click', () => switchToView('sound'));
    tabSpriteBtn?.addEventListener('click', () => switchToView('sprite'));

    const initialPath = window.location.pathname || '/';
    const shouldNormalizeHistory =
      initialPath.startsWith('/sound') ||
      initialPath.startsWith('/sprite') ||
      initialPath.startsWith('/playtest');
    switchToView(activeView, shouldNormalizeHistory);

    console.log(`[Game Dev Studio] Initialized "${activeView}" view in "${mode}" mode`);
  } catch (err: any) {
    console.error('[Game Dev Studio] Initialization error:', err);
    StudioNotifier.fatal('Game Dev Studio Initialization Failed', err);
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initGameStudio, { once: true });
} else {
  initGameStudio();
}

window.addEventListener('error', (event) => {
  console.error('[Game Dev Studio] Uncaught Window Error:', event);
  StudioNotifier.fatal('Uncaught Runtime Error', event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Game Dev Studio] Unhandled Promise Rejection:', event);
  StudioNotifier.fatal('Unhandled Promise Rejection', event.reason);
});
