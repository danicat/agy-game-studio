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
import { getStudioMode } from './utils/api.ts';

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

    new PlaytestStudioUI({
      headerEl,
      annotationBarEl,
      viewportEl,
      bugBarEl
    });

    console.log(`[Game Dev Studio] Initialized playtest view in "${mode}" mode`);
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
