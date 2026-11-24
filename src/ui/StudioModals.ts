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

import {
  getWorkspacePath,
  fetchFsInfo,
  fetchFsList,
  fetchPackages,
  type FsInfoResponse,
} from '../utils/api.ts';
import { StudioNotifier } from './PlaytestStudioUI.ts';

export interface StudioProjectModalOptions {
  currentWorkspace: string;
  currentPkg?: string;
  onSelectProject: (workspacePath: string, pkg: string) => void | Promise<void>;
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str: string): string {
  return escapeHtml(str).replace(/'/g, '&#39;');
}

function renderQuickDirPills(
  container: HTMLElement,
  info: FsInfoResponse,
  onSelectDir: (dirPath: string) => void
): void {
  const quickDirs: Array<{ label: string; path: string }> = [];
  if (info.workspaceDir) quickDirs.push({ label: 'Workspace', path: info.workspaceDir });
  if (info.downloadsDir) quickDirs.push({ label: 'Downloads', path: info.downloadsDir });
  if (info.desktopDir) quickDirs.push({ label: 'Desktop', path: info.desktopDir });
  if (info.sessionDir) quickDirs.push({ label: 'Session', path: info.sessionDir });

  container.innerHTML = '';
  for (const q of quickDirs) {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'btn btn-sm btn-outline';
    pill.style.cssText = 'height: 22px; padding: 0 7px; font-size: 11px;';
    pill.textContent = q.label;
    pill.title = q.path;
    pill.addEventListener('click', () => onSelectDir(q.path));
    container.appendChild(pill);
  }
}

/**
 * Standardized Open Project Modal for Playtest tab.
 * Lets the user browse directories (`Workspace`, `Downloads`, `Desktop`, or subfolders via `/api/fs/list?filter=project`),
 * discovers runnable Go main packages via `fetchPackages(dir)`, and opens the selected Go project.
 */
export function openStudioProjectModal(options: StudioProjectModalOptions): void {
  const existing = document.getElementById('studio-project-modal-overlay');
  if (existing) existing.remove();

  const initialDir = options.currentWorkspace || getWorkspacePath() || '';
  let selectedPkg = options.currentPkg || '.';

  const overlay = document.createElement('div');
  overlay.id = 'studio-project-modal-overlay';
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal-dialog';
  modal.style.width = '520px';
  modal.style.maxWidth = '95vw';

  modal.innerHTML = `
    <div class="modal-header">
      <div class="modal-title" style="display: flex; align-items: center; gap: 7px;">
        <span>🕹️</span>
        <span>Open Go / Ebitengine Project</span>
      </div>
      <button type="button" class="modal-close-btn" title="Close (Esc)">✕</button>
    </div>
    <div class="modal-body" style="display: flex; flex-direction: column; gap: 10px;">
      <div style="display: flex; flex-direction: column; gap: 5px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; flex-wrap: wrap;">
          <span style="font-size: 11px; font-weight: 600; color: var(--studio-text-secondary);">Project Directory</span>
          <div id="studio-proj-dir-pills" style="display: flex; gap: 4px; flex-wrap: wrap;"></div>
        </div>
        <div style="display: flex; gap: 6px;">
          <input
            type="text"
            id="studio-proj-dir-input"
            class="input-text"
            style="flex: 1; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;"
            value="${escapeAttr(initialDir)}"
            placeholder="/path/to/ebitengine-game"
            spellcheck="false"
          />
          <button type="button" id="studio-proj-up-btn" class="btn btn-sm btn-outline" title="Parent Directory">⬆ Up</button>
          <button type="button" id="studio-proj-go-btn" class="btn btn-sm btn-outline" title="Inspect Directory">Inspect</button>
        </div>
      </div>

      <div
        id="studio-proj-status"
        style="font-size: 11px; padding: 6px 8px; border-radius: 6px; background: var(--studio-surface-hover); border: 1px solid var(--studio-border); color: var(--studio-text-secondary);"
      >
        Checking Go module &amp; runnable packages...
      </div>

      <div style="display: flex; flex-direction: column; gap: 4px;">
        <span style="font-size: 11px; font-weight: 600; color: var(--studio-text-secondary);">Subfolders</span>
        <div
          id="studio-proj-folders-list"
          style="display: flex; flex-direction: column; gap: 4px; min-height: 150px; max-height: 210px; overflow-y: auto; background: var(--studio-bg); border: 1px solid var(--studio-border); border-radius: 6px; padding: 6px;"
        >
          <div style="font-size: 12px; color: var(--studio-text-muted); padding: 8px;">Loading folders...</div>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 4px;">
        <span style="font-size: 11px; font-weight: 600; color: var(--studio-text-secondary);">Runnable Go Package</span>
        <select id="studio-proj-pkg-select" class="input-text" style="height: 30px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">
          <option value="${escapeAttr(selectedPkg)}">${escapeHtml(selectedPkg)}</option>
        </select>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
        <button type="button" id="studio-proj-cancel-btn" class="btn btn-sm btn-outline">Cancel</button>
        <button type="button" id="studio-proj-open-btn" class="btn btn-sm btn-primary">Open Project</button>
      </div>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  let currentParentDir: string | null = null;

  const closeModal = () => {
    window.removeEventListener('keydown', onEsc);
    overlay.remove();
  };

  const onEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
    }
  };
  window.addEventListener('keydown', onEsc);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  modal.querySelector('.modal-close-btn')?.addEventListener('click', closeModal);
  modal.querySelector('#studio-proj-cancel-btn')?.addEventListener('click', closeModal);

  const dirInput = modal.querySelector('#studio-proj-dir-input') as HTMLInputElement;
  const statusEl = modal.querySelector('#studio-proj-status') as HTMLElement;
  const foldersListEl = modal.querySelector('#studio-proj-folders-list') as HTMLElement;
  const pkgSelect = modal.querySelector('#studio-proj-pkg-select') as HTMLSelectElement;
  const pillsEl = modal.querySelector('#studio-proj-dir-pills') as HTMLElement;
  const upBtn = modal.querySelector('#studio-proj-up-btn') as HTMLButtonElement;
  const goBtn = modal.querySelector('#studio-proj-go-btn') as HTMLButtonElement;
  const openBtn = modal.querySelector('#studio-proj-open-btn') as HTMLButtonElement;

  const inspectProjectDirectory = async (dirPath: string) => {
    foldersListEl.innerHTML = `<div style="font-size: 12px; color: var(--studio-text-muted); padding: 8px;">Scanning ${escapeHtml(dirPath || 'workspace')}...</div>`;
    try {
      const [listData, pkgData] = await Promise.all([
        fetchFsList(dirPath, 'project'),
        fetchPackages(dirPath),
      ]);

      dirInput.value = listData.dir;
      currentParentDir = listData.parentDir;
      upBtn.disabled = !currentParentDir;

      const pkgs = pkgData.packages.length > 0 ? pkgData.packages : ['.'];
      pkgSelect.innerHTML = pkgs
        .map((p) => `<option value="${escapeAttr(p)}">${escapeHtml(p)}</option>`)
        .join('');
      if (pkgs.includes(selectedPkg)) {
        pkgSelect.value = selectedPkg;
      } else {
        selectedPkg = pkgData.pkg || pkgs[0] || '.';
        pkgSelect.value = selectedPkg;
      }

      if (pkgData.hasGoMod) {
        statusEl.style.borderColor = 'rgba(16, 185, 129, 0.45)';
        statusEl.style.color = 'var(--studio-success)';
        statusEl.textContent = `✓ Go project detected (${pkgs.length} runnable package${pkgs.length === 1 ? '' : 's'}: ${pkgs.join(', ')})`;
      } else {
        statusEl.style.borderColor = 'var(--studio-border)';
        statusEl.style.color = 'var(--studio-text-muted)';
        statusEl.textContent = 'No go.mod in this folder. Select a subfolder below or open anyway.';
      }

      foldersListEl.innerHTML = '';
      if (listData.directories.length === 0) {
        const emptyEl = document.createElement('div');
        emptyEl.style.cssText = 'font-size: 12px; color: var(--studio-text-muted); padding: 10px; text-align: center;';
        emptyEl.textContent = 'No subdirectories in this folder.';
        foldersListEl.appendChild(emptyEl);
        return;
      }

      for (const dirEntry of listData.directories) {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'session-item-btn';
        row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; width: 100%; text-align: left; padding: 6px 8px;';
        row.innerHTML = `
          <span style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600;">
            <span>📁</span>
            <span>${escapeHtml(dirEntry.name)}</span>
          </span>
          <span style="display: inline-flex; align-items: center; gap: 6px;">
            ${
              dirEntry.hasGoMod
                ? '<span style="font-size: 10px; padding: 1px 6px; border-radius: 4px; background: rgba(16, 185, 129, 0.16); color: var(--studio-success); border: 1px solid rgba(16, 185, 129, 0.4);">go.mod</span>'
                : ''
            }
            <span style="font-size: 11px; color: var(--studio-text-muted);">Open ▸</span>
          </span>
        `;
        row.addEventListener('click', () => {
          void inspectProjectDirectory(dirEntry.path);
        });
        foldersListEl.appendChild(row);
      }
    } catch (err: any) {
      statusEl.style.borderColor = 'var(--studio-danger)';
      statusEl.style.color = 'var(--studio-danger)';
      statusEl.textContent = err?.message || String(err);
      foldersListEl.innerHTML = `<div style="font-size: 12px; color: var(--studio-danger); padding: 8px;">${escapeHtml(err?.message || String(err))}</div>`;
    }
  };

  upBtn.addEventListener('click', () => {
    if (currentParentDir) {
      void inspectProjectDirectory(currentParentDir);
    }
  });

  goBtn.addEventListener('click', () => {
    void inspectProjectDirectory(dirInput.value.trim());
  });

  dirInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void inspectProjectDirectory(dirInput.value.trim());
    }
  });

  openBtn.addEventListener('click', async () => {
    const ws = dirInput.value.trim();
    const pkg = pkgSelect.value.trim() || '.';
    if (!ws) {
      StudioNotifier.error('Missing Project Directory', 'Enter or select a Go project directory.');
      return;
    }
    openBtn.disabled = true;
    try {
      await options.onSelectProject(ws, pkg);
      closeModal();
    } catch (err: any) {
      StudioNotifier.error('Failed to Open Project', err?.message || String(err));
    } finally {
      openBtn.disabled = false;
    }
  });

  void (async () => {
    try {
      const info = await fetchFsInfo();
      const startDir = initialDir || info.workspaceDir || info.defaultDir;
      renderQuickDirPills(pillsEl, info, (pickedDir) => {
        dirInput.value = pickedDir;
        void inspectProjectDirectory(pickedDir);
      });
      await inspectProjectDirectory(startDir);
    } catch {
      await inspectProjectDirectory(initialDir);
    }
  })();
}
