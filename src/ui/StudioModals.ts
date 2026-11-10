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
  sidecarFetch,
  getApiBaseUrl,
  getSessionId,
  fetchActiveSessionId,
  getWorkspacePath,
  getWorkspaceUris,
  fetchFsInfo,
  fetchFsList,
  fetchPackages,
  type FsInfoResponse,
} from '../utils/api.ts';
import { StudioNotifier } from './PlaytestStudioUI.ts';

export interface StudioFileModalOptions {
  title: string;
  acceptExtensions: string[];
  filterType: 'sound' | 'sprite';
  initialDirectory?: string;
  onSelectFilePath: (absPath: string) => void | Promise<void>;
  onSelectLocalFile?: (file: File) => void | Promise<void>;
}

export interface StudioProjectModalOptions {
  currentWorkspace: string;
  currentPkg?: string;
  onSelectProject: (workspacePath: string, pkg: string) => void | Promise<void>;
}

export interface LoadedStudioArtifact {
  filename: string;
  filePath?: string;
  displayName: string;
  ext: string;
  content: ArrayBuffer;
  text?: string;
}

export interface StudioArtifactModalOptions {
  title?: string;
  filterExtensions: string[];
  defaultSaveName: string;
  saveFormats: Array<{ value: string; label: string }>;
  onLoadArtifact: (artifact: LoadedStudioArtifact) => void | Promise<void>;
  onGetSavePayload: (format: string) => Promise<{ base64?: string; text?: string; ext: string }>;
}

export interface StudioSaveExportFormat {
  id: string;
  label: string;
  ext: string;
}

export interface StudioSaveExportModalOptions {
  mode: 'save' | 'export';
  title: string;
  defaultBasename: string;
  initialDirectory?: string;
  initialFormatId?: string;
  formats: StudioSaveExportFormat[];
  onGetPayload: (formatId: string) => Promise<{ base64?: string; text?: string; mimeType: string }>;
  onSaved?: (savedPath: string, filename: string) => void;
}

let lastSaveDirectory = '';
let lastBrowseDirectory = '';

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

function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
 * 1. Standardized Open File Modal for Sound & Sprite tabs.
 * Supports browsing workspace/filesystem folders (`/api/fs/list`), quick folder pills,
 * direct path entry, and native `<input type="file">` upload.
 */
export function openStudioFileModal(options: StudioFileModalOptions): void {
  const existing = document.getElementById('studio-file-modal-overlay');
  if (existing) existing.remove();

  const initialDir =
    options.initialDirectory ||
    lastBrowseDirectory ||
    getWorkspacePath() ||
    '';

  const overlay = document.createElement('div');
  overlay.id = 'studio-file-modal-overlay';
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal-dialog';
  modal.style.width = '520px';
  modal.style.maxWidth = '95vw';

  const acceptStr = options.acceptExtensions
    .map((ext) => (ext.startsWith('.') ? ext : `.${ext}`))
    .join(',');

  modal.innerHTML = `
    <div class="modal-header">
      <div class="modal-title" style="display: flex; align-items: center; gap: 7px;">
        <span>📂</span>
        <span>${escapeHtml(options.title)}</span>
      </div>
      <button type="button" class="modal-close-btn" title="Close (Esc)">✕</button>
    </div>
    <div class="modal-body" style="display: flex; flex-direction: column; gap: 10px;">
      <div style="display: flex; flex-direction: column; gap: 5px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; flex-wrap: wrap;">
          <span style="font-size: 11px; font-weight: 600; color: var(--studio-text-secondary);">Folder</span>
          <div id="studio-file-dir-pills" style="display: flex; gap: 4px; flex-wrap: wrap;"></div>
        </div>
        <div style="display: flex; gap: 6px;">
          <input
            type="text"
            id="studio-file-dir-input"
            class="input-text"
            style="flex: 1; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;"
            value="${escapeAttr(initialDir)}"
            placeholder="/path/to/workspace"
            spellcheck="false"
          />
          <button type="button" id="studio-file-up-btn" class="btn btn-sm btn-outline" title="Parent Directory">⬆ Up</button>
          <button type="button" id="studio-file-go-btn" class="btn btn-sm btn-outline" title="List Directory">Go</button>
        </div>
      </div>

      <div
        id="studio-file-list"
        style="display: flex; flex-direction: column; gap: 4px; min-height: 180px; max-height: 250px; overflow-y: auto; background: var(--studio-bg); border: 1px solid var(--studio-border); border-radius: 6px; padding: 6px;"
      >
        <div style="font-size: 12px; color: var(--studio-text-muted); padding: 8px;">Loading directory contents...</div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 4px;">
        <span style="font-size: 11px; font-weight: 600; color: var(--studio-text-secondary);">Selected File Path (${escapeHtml(acceptStr)})</span>
        <input
          type="text"
          id="studio-file-path-input"
          class="input-text"
          style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace;"
          placeholder="Select a file above or paste an absolute file path..."
          spellcheck="false"
        />
      </div>

      <input type="file" id="studio-hidden-local-file" accept="${escapeAttr(acceptStr)}" class="hidden" />

      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 2px; flex-wrap: wrap;">
        <button type="button" id="studio-browse-local-btn" class="btn btn-sm btn-outline" title="Browse local file from computer">
          <span>💻 Browse Local File...</span>
        </button>
        <div style="display: flex; gap: 8px;">
          <button type="button" id="studio-file-cancel-btn" class="btn btn-sm btn-outline">Cancel</button>
          <button type="button" id="studio-file-open-btn" class="btn btn-sm btn-primary">Open File</button>
        </div>
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
  modal.querySelector('#studio-file-cancel-btn')?.addEventListener('click', closeModal);

  const dirInput = modal.querySelector('#studio-file-dir-input') as HTMLInputElement;
  const pathInput = modal.querySelector('#studio-file-path-input') as HTMLInputElement;
  const listEl = modal.querySelector('#studio-file-list') as HTMLElement;
  const pillsEl = modal.querySelector('#studio-file-dir-pills') as HTMLElement;
  const upBtn = modal.querySelector('#studio-file-up-btn') as HTMLButtonElement;
  const goBtn = modal.querySelector('#studio-file-go-btn') as HTMLButtonElement;
  const openBtn = modal.querySelector('#studio-file-open-btn') as HTMLButtonElement;
  const localBtn = modal.querySelector('#studio-browse-local-btn') as HTMLButtonElement;
  const localInput = modal.querySelector('#studio-hidden-local-file') as HTMLInputElement;

  const triggerOpenPath = async (targetPath: string) => {
    const trimmed = targetPath.trim();
    if (!trimmed) {
      StudioNotifier.error('Missing File Path', 'Select a file from the list or enter a file path.');
      return;
    }
    openBtn.disabled = true;
    const origText = openBtn.textContent;
    openBtn.textContent = 'Opening...';
    try {
      await options.onSelectFilePath(trimmed);
      closeModal();
    } catch (err: any) {
      StudioNotifier.error('Failed to Open File', err?.message || String(err));
    } finally {
      openBtn.disabled = false;
      openBtn.textContent = origText;
    }
  };

  const loadDirectory = async (dirPath: string) => {
    listEl.innerHTML = `<div style="font-size: 12px; color: var(--studio-text-muted); padding: 8px;">Loading ${escapeHtml(dirPath || 'workspace')}...</div>`;
    try {
      const data = await fetchFsList(dirPath, options.filterType, options.acceptExtensions);
      dirInput.value = data.dir;
      lastBrowseDirectory = data.dir;
      currentParentDir = data.parentDir;
      upBtn.disabled = !currentParentDir;

      listEl.innerHTML = '';

      if (data.directories.length === 0 && data.files.length === 0) {
        const emptyEl = document.createElement('div');
        emptyEl.style.cssText = 'font-size: 12px; color: var(--studio-text-muted); padding: 12px; text-align: center;';
        emptyEl.textContent = `No matching (${acceptStr}) files or subfolders in this directory.`;
        listEl.appendChild(emptyEl);
        return;
      }

      for (const dirEntry of data.directories) {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'session-item-btn';
        row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; width: 100%; text-align: left; padding: 6px 8px;';
        row.innerHTML = `
          <span style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600;">
            <span>📁</span>
            <span>${escapeHtml(dirEntry.name)}</span>
          </span>
          <span style="font-size: 11px; color: var(--studio-text-muted);">Folder ▸</span>
        `;
        row.addEventListener('click', () => {
          void loadDirectory(dirEntry.path);
        });
        listEl.appendChild(row);
      }

      for (const fileEntry of data.files) {
        const row = document.createElement('div');
        row.className = 'session-item-btn';
        row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; padding: 6px 8px;';

        const left = document.createElement('div');
        left.style.cssText = 'display: flex; flex-direction: column; min-width: 0; flex: 1; cursor: pointer;';
        left.innerHTML = `
          <div style="display: flex; align-items: center; gap: 6px; font-weight: 600; color: var(--studio-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <span>${fileEntry.ext === '.music' || fileEntry.ext === '.sfx' || fileEntry.ext === '.wav' ? '🎵' : '🎨'}</span>
            <span>${escapeHtml(fileEntry.name)}</span>
          </div>
          <div style="font-size: 10px; color: var(--studio-text-muted); font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">
            ${escapeHtml(formatByteSize(fileEntry.size))}
          </div>
        `;

        const selectRow = () => {
          pathInput.value = fileEntry.path;
          listEl.querySelectorAll('.studio-file-row-selected').forEach((el) => {
            (el as HTMLElement).style.borderColor = '';
            el.classList.remove('studio-file-row-selected');
          });
          row.classList.add('studio-file-row-selected');
          row.style.borderColor = 'var(--studio-accent)';
        };

        left.addEventListener('click', selectRow);
        left.addEventListener('dblclick', () => {
          selectRow();
          void triggerOpenPath(fileEntry.path);
        });

        const rowOpenBtn = document.createElement('button');
        rowOpenBtn.type = 'button';
        rowOpenBtn.className = 'btn btn-sm btn-outline';
        rowOpenBtn.style.cssText = 'height: 24px; padding: 0 8px; font-size: 11px; flex-shrink: 0;';
        rowOpenBtn.textContent = 'Open';
        rowOpenBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          pathInput.value = fileEntry.path;
          void triggerOpenPath(fileEntry.path);
        });

        row.appendChild(left);
        row.appendChild(rowOpenBtn);
        listEl.appendChild(row);
      }
    } catch (err: any) {
      listEl.innerHTML = `<div style="font-size: 12px; color: var(--studio-danger); padding: 8px;">${escapeHtml(err?.message || String(err))}</div>`;
    }
  };

  upBtn.addEventListener('click', () => {
    if (currentParentDir) {
      void loadDirectory(currentParentDir);
    }
  });

  goBtn.addEventListener('click', () => {
    void loadDirectory(dirInput.value.trim());
  });

  dirInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void loadDirectory(dirInput.value.trim());
    }
  });

  pathInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void triggerOpenPath(pathInput.value);
    }
  });

  openBtn.addEventListener('click', () => {
    void triggerOpenPath(pathInput.value);
  });

  localBtn.addEventListener('click', () => {
    localInput.click();
  });

  localInput.addEventListener('change', async () => {
    const file = localInput.files?.[0];
    if (!file) return;
    try {
      if (options.onSelectLocalFile) {
        await options.onSelectLocalFile(file);
        closeModal();
      } else {
        const anyFile = file as File & { path?: string };
        if (anyFile.path) {
          await options.onSelectFilePath(anyFile.path);
          closeModal();
        }
      }
    } catch (err: any) {
      StudioNotifier.error('Failed to Load Local File', err?.message || String(err));
    } finally {
      localInput.value = '';
    }
  });

  void (async () => {
    try {
      const info = await fetchFsInfo();
      const targetStartDir = initialDir || info.defaultDir || info.workspaceDir;
      renderQuickDirPills(pillsEl, info, (pickedDir) => {
        dirInput.value = pickedDir;
        void loadDirectory(pickedDir);
      });
      await loadDirectory(targetStartDir);
    } catch {
      await loadDirectory(initialDir);
    }
  })();
}

/**
 * 2. Standardized Open Project Modal for Playtest tab.
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

/**
 * 3. Standardized Session Artifacts Modal (modeled after `agy-paint-studio`'s `ArtifactModal.ts`).
 * Top section saves current asset to Session Artifacts; bottom section lists and opens session artifacts.
 */
export function openStudioArtifactModal(options: StudioArtifactModalOptions): void {
  const existing = document.getElementById('studio-artifact-modal-overlay');
  if (existing) existing.remove();

  let sessionId = getSessionId() || 'standalone';
  const normalizedFilterExts = new Set(
    options.filterExtensions.map((e) => (e.startsWith('.') ? e.toLowerCase() : `.${e.toLowerCase()}`))
  );

  const overlay = document.createElement('div');
  overlay.id = 'studio-artifact-modal-overlay';
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal-dialog artifact-modal';
  modal.style.width = '520px';
  modal.style.maxWidth = '95vw';

  const formatOptionsHtml = options.saveFormats
    .map((f) => `<option value="${escapeAttr(f.value)}">${escapeHtml(f.label)}</option>`)
    .join('');

  modal.innerHTML = `
    <div class="modal-header">
      <div class="modal-title" style="display: flex; align-items: center; gap: 7px;">
        <span>📦</span>
        <span>${escapeHtml(options.title || 'Session Artifacts')}</span>
      </div>
      <button type="button" class="modal-close-btn" title="Close (Esc)">✕</button>
    </div>
    <div class="modal-body" style="display: flex; flex-direction: column; gap: 12px;">
      <!-- Save to Artifacts Section -->
      <div class="artifact-save-box" style="display: flex; flex-direction: column; gap: 6px; background: var(--studio-surface-hover); padding: 10px; border-radius: 8px; border: 1px solid var(--studio-border);">
        <div class="section-subtitle" style="font-size: 11px; font-weight: 600; color: var(--studio-text-secondary);">Save Current Asset to Session Artifacts</div>
        <div class="artifact-save-controls" style="display: flex; gap: 6px; flex-wrap: wrap;">
          <input
            type="text"
            id="artifact-save-name"
            class="input-text"
            style="flex: 1 1 160px;"
            placeholder="filename"
            value="${escapeAttr(options.defaultSaveName)}"
          />
          <select id="artifact-save-format" class="input-text" style="height: 28px;">
            ${formatOptionsHtml}
          </select>
          <button type="button" id="artifact-save-btn" class="btn btn-sm btn-primary">Save to Artifacts</button>
        </div>
      </div>

      <!-- Browse Artifacts Section -->
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <div class="section-subtitle" style="font-size: 11px; font-weight: 600; color: var(--studio-text-secondary);">
          Artifacts in Current Session (${escapeHtml(Array.from(normalizedFilterExts).join(', '))})
        </div>
        <div
          id="artifact-list-container"
          class="artifact-list"
          style="display: flex; flex-direction: column; gap: 6px; min-height: 180px; max-height: 280px; overflow-y: auto; background: var(--studio-bg); border: 1px solid var(--studio-border); border-radius: 6px; padding: 8px;"
        >
          <div class="artifact-loading" style="font-size: 12px; color: var(--studio-text-muted);">Loading session artifacts...</div>
        </div>
      </div>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

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

  const listContainer = modal.querySelector('#artifact-list-container') as HTMLElement;
  const saveNameInput = modal.querySelector('#artifact-save-name') as HTMLInputElement;
  const saveFormatSelect = modal.querySelector('#artifact-save-format') as HTMLSelectElement;
  const saveBtn = modal.querySelector('#artifact-save-btn') as HTMLButtonElement;

  const isImageExt = (ext: string) =>
    ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(ext.toLowerCase());

  const loadArtifactsList = async () => {
    listContainer.innerHTML = '<div class="artifact-loading" style="font-size: 12px; color: var(--studio-text-muted);">Loading session artifacts...</div>';
    try {
      if (!sessionId || sessionId === 'standalone') {
        const active = await fetchActiveSessionId().catch(() => null);
        if (active) sessionId = active;
      }

      const res = await sidecarFetch(
        `/api/artifacts?session_id=${encodeURIComponent(sessionId)}`,
        { method: 'GET', cache: 'no-store' }
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      const rawArtifacts: any[] = data.artifacts || [];
      const artifacts = rawArtifacts.filter((art) => {
        const ext = String(art.ext || '').toLowerCase();
        return normalizedFilterExts.size === 0 || normalizedFilterExts.has(ext);
      });

      listContainer.textContent = '';

      if (artifacts.length === 0) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'artifact-empty';
        emptyEl.style.cssText = 'font-size: 12px; color: var(--studio-text-muted); padding: 12px; text-align: center;';
        emptyEl.textContent = 'No matching artifacts in this session yet.';
        listContainer.appendChild(emptyEl);
        return;
      }

      for (const art of artifacts) {
        const artName = art.name || art.displayName || art.filename || 'unnamed';
        const artRelativePath = art.relativePath || art.filename || artName;
        const artSize = typeof art.size === 'number' ? art.size : 0;
        const ext = String(art.ext || '').toLowerCase();

        const card = document.createElement('div');
        card.className = 'artifact-card artifact-item';
        card.style.cssText =
          'display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--studio-border); background: var(--studio-surface-hover);';

        const thumbWrap = document.createElement('div');
        thumbWrap.style.cssText =
          'width: 36px; height: 36px; border-radius: 5px; background: var(--studio-bg); border: 1px solid var(--studio-border); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;';

        if (isImageExt(ext)) {
          const img = document.createElement('img');
          img.style.cssText = 'width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated;';
          img.alt = artName;
          img.src = `${getApiBaseUrl()}/api/artifact?session_id=${encodeURIComponent(sessionId)}&filename=${encodeURIComponent(artRelativePath)}`;
          thumbWrap.appendChild(img);
        } else {
          const badge = document.createElement('span');
          badge.style.cssText = 'font-size: 9px; font-weight: 700; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--studio-accent);';
          badge.textContent = ext.replace(/^\./, '').toUpperCase() || 'FILE';
          thumbWrap.appendChild(badge);
        }

        const infoWrap = document.createElement('div');
        infoWrap.style.cssText = 'display: flex; flex-direction: column; min-width: 0; flex: 1;';

        const nameEl = document.createElement('div');
        nameEl.style.cssText = 'font-size: 12px; font-weight: 600; color: var(--studio-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
        nameEl.title = artRelativePath;
        nameEl.textContent = artName;

        const metaEl = document.createElement('div');
        metaEl.style.cssText = 'font-size: 10px; color: var(--studio-text-muted);';
        const timeStr = art.modifiedTime ? ` • ${new Date(art.modifiedTime).toLocaleTimeString()}` : '';
        metaEl.textContent = `${formatByteSize(artSize)}${timeStr}`;

        infoWrap.appendChild(nameEl);
        if (artRelativePath !== artName) {
          const pathEl = document.createElement('div');
          pathEl.style.cssText = 'font-size: 10px; color: var(--studio-text-muted); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
          pathEl.textContent = artRelativePath;
          infoWrap.appendChild(pathEl);
        }
        infoWrap.appendChild(metaEl);

        const openArtBtn = document.createElement('button');
        openArtBtn.type = 'button';
        openArtBtn.className = 'btn btn-sm btn-outline';
        openArtBtn.textContent = 'Open';
        openArtBtn.addEventListener('click', async () => {
          openArtBtn.disabled = true;
          try {
            const fileUrl = `/api/artifact?session_id=${encodeURIComponent(sessionId)}&filename=${encodeURIComponent(artRelativePath)}`;
            const fileRes = await sidecarFetch(fileUrl);
            if (!fileRes.ok) {
              throw new Error(`Failed to download artifact "${artRelativePath}": HTTP ${fileRes.status}`);
            }
            const content = await fileRes.arrayBuffer();
            const text = new TextDecoder('utf-8').decode(content);
            await options.onLoadArtifact({
              filename: artRelativePath,
              filePath: typeof art.filePath === 'string' ? art.filePath : '',
              displayName: artName,
              ext,
              content,
              text,
            });
            StudioNotifier.success(`Opened artifact "${artName}"`);
            closeModal();
          } catch (err: any) {
            StudioNotifier.error('Failed to Open Artifact', err?.message || String(err));
          } finally {
            openArtBtn.disabled = false;
          }
        });

        card.appendChild(thumbWrap);
        card.appendChild(infoWrap);
        card.appendChild(openArtBtn);
        listContainer.appendChild(card);
      }
    } catch (err: any) {
      listContainer.innerHTML = `<div class="artifact-error" style="font-size: 12px; color: var(--studio-danger);">${escapeHtml(err?.message || String(err))}</div>`;
    }
  };

  saveBtn.addEventListener('click', async () => {
    const format = saveFormatSelect.value;
    let baseName = saveNameInput.value.trim() || options.defaultSaveName || `asset-${Date.now()}`;
    saveBtn.disabled = true;
    const origText = saveBtn.textContent;
    saveBtn.textContent = 'Saving...';

    try {
      const payload = await options.onGetSavePayload(format);
      const ext = payload.ext.startsWith('.') ? payload.ext : `.${payload.ext}`;
      if (!baseName.toLowerCase().endsWith(ext.toLowerCase())) {
        baseName += ext;
      }

      const res = await sidecarFetch('/api/artifact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          filename: baseName,
          data: payload.base64,
          text: payload.text,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}: ${res.statusText}`);
      }

      const result = await res.json();
      StudioNotifier.success(`Saved "${result.filename}" to session artifacts!`);
      await loadArtifactsList();
    } catch (err: any) {
      StudioNotifier.error('Save to Artifacts Failed', err?.message || String(err));
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = origText;
    }
  });

  void loadArtifactsList();
}

/**
 * 4. Standardized Save / Export Modal (modeled after `agy-paint-studio`'s `openSaveExportModal`).
 * Supports format pills, quick destination pills (`Workspace`, `Downloads`, `Desktop`, `Session`),
 * filename + live path preview, `Browser Download`, and `Save to Filesystem` (`/api/fs/save`).
 */
export function openStudioSaveExportModal(options: StudioSaveExportModalOptions): void {
  const existing = document.getElementById('save-export-modal-overlay');
  if (existing) existing.remove();

  const formats = options.formats;
  if (!formats || formats.length === 0) return;

  let currentFormat: StudioSaveExportFormat =
    formats.find((f) => f.id === options.initialFormatId) || formats[0];

  const baseName = options.defaultBasename || `asset-${Date.now()}`;
  const initialDir =
    options.initialDirectory ||
    lastSaveDirectory ||
    getWorkspacePath() ||
    '~/Downloads';

  const overlay = document.createElement('div');
  overlay.id = 'save-export-modal-overlay';
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal-dialog';
  modal.style.width = '460px';
  modal.style.maxWidth = '94vw';

  const formatPillsHtml = formats
    .map(
      (f) => `
      <button
        type="button"
        class="btn btn-sm btn-outline save-format-btn ${f.id === currentFormat.id ? 'active btn-primary' : ''}"
        data-format-id="${escapeAttr(f.id)}"
      >${escapeHtml(f.label)}</button>
    `
    )
    .join('');

  const stripKnownExtensions = (name: string): string => {
    const trimmed = name.trim();
    for (const f of formats) {
      const cleanExt = f.ext.replace(/^\./, '');
      const regex = new RegExp(`\\.${cleanExt}$`, 'i');
      if (regex.test(trimmed)) {
        return trimmed.replace(regex, '') || baseName;
      }
    }
    return trimmed.replace(/\.(music|sfx|wav|sprite|aseprite|ase|png|json|gif|psd|jpg|jpeg|webp)$/i, '') || baseName;
  };

  const ensureExtension = (name: string, fmt: StudioSaveExportFormat): string => {
    const cleanExt = fmt.ext.replace(/^\./, '');
    const stem = stripKnownExtensions(name);
    return `${stem}.${cleanExt}`;
  };

  modal.innerHTML = `
    <div class="modal-header">
      <div class="modal-title">
        <span id="save-modal-title">${escapeHtml(options.title)}</span>
      </div>
      <button type="button" class="modal-close-btn" title="Close (Esc)">✕</button>
    </div>
    <div class="modal-body" style="display: flex; flex-direction: column; gap: 12px;">
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <span style="font-size: 11px; font-weight: 600; color: var(--studio-text-secondary);">Format</span>
        <div style="display: flex; gap: 6px; flex-wrap: wrap;" id="save-format-pills">
          ${formatPillsHtml}
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 6px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
          <span style="font-size: 11px; font-weight: 600; color: var(--studio-text-secondary);">Destination Folder</span>
          <div id="save-dir-pills" style="display: flex; gap: 4px; flex-wrap: wrap;"></div>
        </div>
        <input
          type="text"
          id="save-dir-input"
          class="input-text"
          value="${escapeAttr(initialDir)}"
          placeholder="/path/to/workspace"
          spellcheck="false"
        />
      </div>

      <div style="display: flex; flex-direction: column; gap: 6px;">
        <span style="font-size: 11px; font-weight: 600; color: var(--studio-text-secondary);">Filename</span>
        <input
          type="text"
          id="save-filename-input"
          class="input-text"
          value="${escapeAttr(ensureExtension(baseName, currentFormat))}"
          spellcheck="false"
        />
      </div>

      <div
        id="save-fullpath-preview"
        style="font-size: 11px; color: var(--studio-text-muted); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--studio-surface-hover); padding: 6px 8px; border-radius: 6px; border: 1px solid var(--studio-border); word-break: break-all;"
      ></div>

      <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 2px; flex-wrap: wrap;">
        <button type="button" id="save-browser-download-btn" class="btn btn-sm btn-outline" title="Download via Browser">
          Browser Download
        </button>
        <div style="display: flex; gap: 8px;">
          <button type="button" id="save-cancel-btn" class="btn btn-sm btn-outline">Cancel</button>
          <button type="button" id="save-confirm-btn" class="btn btn-sm btn-primary">Save to Filesystem</button>
        </div>
      </div>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

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
  modal.querySelector('#save-cancel-btn')?.addEventListener('click', closeModal);

  const dirInput = modal.querySelector('#save-dir-input') as HTMLInputElement;
  const filenameInput = modal.querySelector('#save-filename-input') as HTMLInputElement;
  const previewEl = modal.querySelector('#save-fullpath-preview') as HTMLElement;
  const dirPillsEl = modal.querySelector('#save-dir-pills') as HTMLElement;
  const confirmBtn = modal.querySelector('#save-confirm-btn') as HTMLButtonElement;
  const browserDownloadBtn = modal.querySelector('#save-browser-download-btn') as HTMLButtonElement;
  const formatBtns = modal.querySelectorAll('.save-format-btn');

  const updatePreview = () => {
    const dir = dirInput.value.trim().replace(/\/+$/, '') || '.';
    const fn = ensureExtension(filenameInput.value, currentFormat);
    previewEl.textContent = `${dir}/${fn}`;
  };

  updatePreview();

  formatBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const fmtId = btn.getAttribute('data-format-id');
      const found = formats.find((f) => f.id === fmtId);
      if (!found) return;
      currentFormat = found;
      formatBtns.forEach((b) => {
        const active = b === btn;
        b.classList.toggle('active', active);
        b.classList.toggle('btn-primary', active);
      });
      filenameInput.value = ensureExtension(filenameInput.value, currentFormat);
      updatePreview();
    });
  });

  dirInput.addEventListener('input', updatePreview);
  filenameInput.addEventListener('input', updatePreview);

  void (async () => {
    try {
      const info = await fetchFsInfo();
      if (!options.initialDirectory && !lastSaveDirectory && info.defaultDir) {
        dirInput.value = info.defaultDir;
        updatePreview();
      }
      renderQuickDirPills(dirPillsEl, info, (pickedDir) => {
        dirInput.value = pickedDir;
        updatePreview();
      });
    } catch {
      // Ignore fs/info error in standalone mode
    }
  })();

  const handleFilesystemSave = async () => {
    const directory = dirInput.value.trim();
    const finalFilename = ensureExtension(filenameInput.value, currentFormat);
    if (!directory) {
      StudioNotifier.error('Missing Directory', 'Specify a destination folder path.');
      return;
    }

    confirmBtn.disabled = true;
    const origText = confirmBtn.textContent;
    confirmBtn.textContent = 'Saving...';

    try {
      const [workspaceUris, payload] = await Promise.all([
        getWorkspaceUris(),
        options.onGetPayload(currentFormat.id),
      ]);

      const res = await sidecarFetch('/api/fs/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directory,
          filename: finalFilename,
          data: payload.base64,
          text: payload.text,
          workspaceUris,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}: ${res.statusText}`);
      }

      const result = await res.json();
      lastSaveDirectory = directory;
      StudioNotifier.success(`Saved to ${result.path}`);
      if (options.onSaved) {
        options.onSaved(result.path, result.filename || finalFilename);
      }
      closeModal();
    } catch (err: any) {
      StudioNotifier.error('Save to Filesystem Failed', err?.message || String(err));
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = origText;
    }
  };

  confirmBtn.addEventListener('click', () => {
    void handleFilesystemSave();
  });

  filenameInput.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleFilesystemSave();
    }
  });

  dirInput.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleFilesystemSave();
    }
  });

  browserDownloadBtn.addEventListener('click', async () => {
    const finalFilename = ensureExtension(filenameInput.value, currentFormat);
    browserDownloadBtn.disabled = true;
    try {
      const payload = await options.onGetPayload(currentFormat.id);
      let blob: Blob;
      if (typeof payload.text === 'string') {
        blob = new Blob([payload.text], { type: payload.mimeType || 'text/plain;charset=utf-8' });
      } else if (typeof payload.base64 === 'string') {
        const rawB64 = payload.base64.includes(',') ? payload.base64.split(',')[1] : payload.base64;
        const binStr = atob(rawB64);
        const bytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) {
          bytes[i] = binStr.charCodeAt(i);
        }
        blob = new Blob([bytes], { type: payload.mimeType || 'application/octet-stream' });
      } else {
        throw new Error('Empty download payload.');
      }

      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = finalFilename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      StudioNotifier.success(`Downloaded "${finalFilename}"`);
      closeModal();
    } catch (err: any) {
      StudioNotifier.error('Browser Download Failed', err?.message || String(err));
    } finally {
      browserDownloadBtn.disabled = false;
    }
  });
}
