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
import { getStudioMode } from './utils/api.ts';

export type StudioView = 'playtest' | 'sound';

function detectInitialStudioView(): StudioView {
  const pathname = window.location.pathname || '/';
  const params = new URLSearchParams(window.location.search);
  const viewParam = (params.get('view') || '').trim().toLowerCase();
  const fileParam = (params.get('file') || params.get('path') || params.get('uri') || '')
    .trim()
    .toLowerCase();

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
        'Required DOM containers not found for Game Studio. Missing: ' +
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
      topNavEl.setAttribute('aria-label', 'Studio Workspace');
      topNavEl.innerHTML = `
        <div class="studio-top-tabs" role="tablist" aria-label="Studio Mode">
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
        </div>
      `;
      appRootEl.insertBefore(topNavEl, appRootEl.firstChild);
    }

    const tabPlaytestBtn = topNavEl.querySelector('#top-tab-playtest') as HTMLButtonElement | null;
    const tabSoundBtn = topNavEl.querySelector('#top-tab-sound') as HTMLButtonElement | null;

    // Create dedicated Sound Studio root container inside #app-root
    let soundRootEl = document.getElementById('sound-studio-root');
    if (!soundRootEl) {
      soundRootEl = document.createElement('div');
      soundRootEl.id = 'sound-studio-root';
      soundRootEl.className = 'sound-studio-root hidden';
      appRootEl.appendChild(soundRootEl);
    }

    let playtestUI: PlaytestStudioUI | null = null;
    let soundUI: SoundStudioUI | null = null;
    let activeView: StudioView = detectInitialStudioView();

    const updateUrlForView = (view: StudioView) => {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.has('view')) {
          params.set('view', view);
        }
        const targetPath = view === 'sound' ? '/sound' : '/playtest';
        const qs = params.toString();
        const nextUrl = `${targetPath}${qs ? `?${qs}` : ''}`;
        if (window.location.pathname + window.location.search !== nextUrl) {
          window.history.replaceState({ view }, '', nextUrl);
        }
      } catch {
        // Ignore history.replaceState restrictions in sandboxed environments
      }
      document.title = view === 'sound' ? 'Sound Studio' : 'Playtest Studio';
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

    const switchToView = (view: StudioView, updateHistory = true): void => {
      activeView = view;
      const isSound = view === 'sound';

      if (tabPlaytestBtn && tabSoundBtn) {
        tabPlaytestBtn.classList.toggle('active', !isSound);
        tabPlaytestBtn.setAttribute('aria-selected', String(!isSound));
        tabSoundBtn.classList.toggle('active', isSound);
        tabSoundBtn.setAttribute('aria-selected', String(isSound));
      }

      if (isSound) {
        if (playtestUI && playtestUI.runner.isRunning() && !playtestUI.runner.isPaused()) {
          playtestUI.runner.setPaused(true);
        }
        headerEl.classList.add('studio-view-hidden');
        annotationBarEl.classList.add('studio-view-hidden');
        viewportEl.classList.add('studio-view-hidden');
        bugBarEl.classList.add('studio-view-hidden');

        soundRootEl!.classList.remove('hidden');
        ensureSoundUI();
      } else {
        if (soundUI) {
          soundUI.stopPlayback();
        }
        soundRootEl!.classList.add('hidden');

        headerEl.classList.remove('studio-view-hidden');
        annotationBarEl.classList.remove('studio-view-hidden');
        viewportEl.classList.remove('studio-view-hidden');
        bugBarEl.classList.remove('studio-view-hidden');

        ensurePlaytestUI();
      }

      if (updateHistory) {
        updateUrlForView(view);
      }
    };

    tabPlaytestBtn?.addEventListener('click', () => switchToView('playtest'));
    tabSoundBtn?.addEventListener('click', () => switchToView('sound'));

    const initialPath = window.location.pathname || '/';
    const shouldNormalizeHistory =
      initialPath.startsWith('/sound') || initialPath.startsWith('/playtest');
    switchToView(activeView, shouldNormalizeHistory);

    console.log(`[Game Studio] Initialized "${activeView}" view in "${mode}" mode`);
  } catch (err: any) {
    console.error('[Game Studio] Initialization error:', err);
    StudioNotifier.fatal('Game Studio Initialization Failed', err);
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initGameStudio, { once: true });
} else {
  initGameStudio();
}

window.addEventListener('error', (event) => {
  console.error('[Game Studio] Uncaught Window Error:', event);
  StudioNotifier.fatal('Uncaught Runtime Error', event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Game Studio] Unhandled Promise Rejection:', event);
  StudioNotifier.fatal('Unhandled Promise Rejection', event.reason);
});
