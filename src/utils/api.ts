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

export interface AntigravitySidecarBridge {
  conversationId: string | null;
  fetch(url: string, options?: RequestInit): Promise<Response>;
  getWorkspaceUris(): Promise<string[]>;
  onWorkspaceChange(listener: (uris: string[]) => void): () => void;
  agent: {
    sendMessage(message: string, conversationId?: string): Promise<unknown>;
    startConversation(message: string, title?: string): Promise<unknown>;
    getConversationMetadata(conversationId: string): Promise<unknown>;
  };
  ui: {
    toggleAuxPane(options?: { open?: boolean }): void;
    toggleConversation(conversationId: string): void;
  };
}

export interface StudioConfig {
  port?: string | number;
  host?: string;
  sessionId?: string;
  workspace?: string;
  apiBaseUrl?: string;
  mode?: 'preview' | 'full';
}

export interface SessionSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface HealthInfo {
  status: string;
  port: number;
  host: string;
  activeSessionId: string | null;
  defaultWorkspace: string;
}

export interface WorkspaceResolveResult {
  workspace: string;
  pkg: string;
  packages?: string[];
  projectPath?: string;
  hasGoMod?: boolean;
}

export interface FsInfoResponse {
  defaultDir: string;
  downloadsDir: string;
  desktopDir: string;
  homeDir: string;
  workspaceDir: string;
  sessionDir: string | null;
}

export interface FsListDirectoryEntry {
  name: string;
  path: string;
  type: 'directory';
  hasGoMod: boolean;
}

export interface FsListFileEntry {
  name: string;
  path: string;
  filePath: string;
  ext: string;
  type: string;
  size: number;
  modifiedTime: number;
}

export interface FsListResponse {
  dir: string;
  parentDir: string | null;
  filter: string;
  directories: FsListDirectoryEntry[];
  files: FsListFileEntry[];
  hasGoMod: boolean;
  packages: string[];
  defaultPkg: string;
}

export interface SessionArtifactItem {
  filename: string;
  relativePath: string;
  name: string;
  displayName: string;
  source: string;
  size: number;
  modifiedTime: number;
  ext: string;
}

export interface BuildWasmSuccess {
  ok: true;
  status: 200;
  buildId: string;
  workspace: string;
  pkg: string;
  wasmBytes: number;
  durationMs: number;
  wasmUrl: string;
  wasmExecUrl: string;
}

export interface BuildWasmFailure {
  ok: false;
  status: 422;
  error: string;
  compilerOutput: string;
  workspace: string;
  pkg: string;
  exitCode: number;
}

export type BuildWasmResult = BuildWasmSuccess | BuildWasmFailure;

export interface SendBugToChatParams {
  sessionId?: string;
  filename?: string;
  imageDataUrl: string;
  note?: string;
  consoleLogs?: string[];
  workspace?: string;
  pkg?: string;
  frameOffset?: string;
  resolution?: string;
  width?: number;
  height?: number;
}

export interface SendBuildErrorToChatParams {
  sessionId?: string;
  buildError: string;
  note?: string;
  workspace?: string;
  pkg?: string;
}

export interface SendStudioErrorToChatParams {
  sessionId?: string;
  errorTitle: string;
  errorDetail?: string;
  tab?: string;
  filePath?: string;
  workspace?: string;
}

export interface SendToChatResponse {
  success: boolean;
  mode: 'screenshot' | 'build-error' | 'studio-error';
  filePath?: string;
  filename?: string;
}

declare global {
  interface Window {
    sidecar?: AntigravitySidecarBridge;
    __STUDIO_CONFIG__?: StudioConfig;
  }
}

let activeSessionId: string | null = null;
let activeWorkspacePath: string | null = null;
const sessionChangeListeners: Array<(sessionId: string) => void> = [];
const workspaceChangeListeners: Array<(workspace: string) => void> = [];

function isConfiguredToken(val: unknown): val is string | number {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return true;
  }
  if (typeof val !== 'string') {
    return false;
  }
  const trimmed = val.trim();
  return trimmed.length > 0 && !(trimmed.startsWith('__') && trimmed.endsWith('__'));
}

/**
 * Wrapper around `window.sidecar.fetch` (which attaches `X-Sidecar-Token` and JSON `Content-Type`
 * per `/ui-extension`) or standard `fetch` when running in Vite dev mode.
 */
export async function sidecarFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = path.startsWith('http://') || path.startsWith('https://')
    ? path
    : `${getApiBaseUrl()}${path}`;
  if (window.sidecar && typeof window.sidecar.fetch === 'function') {
    return window.sidecar.fetch(url, options);
  }
  return fetch(url, options);
}

/**
 * Resolve the base URL for all Playtest Studio HTTP sidecar API calls.
 * When served by `SidecarApp` in Antigravity's Aux Pane (`plugin://...`) or over `http://`,
 * returns `''` so relative `/api/...` URLs route directly to the sidecar.
 */
export function getApiBaseUrl(): string {
  const cfgBaseUrl = window.__STUDIO_CONFIG__?.apiBaseUrl;
  if (isConfiguredToken(cfgBaseUrl)) {
    return String(cfgBaseUrl).trim().replace(/\/+$/, '');
  }
  return '';
}

const VALID_SESSION_ID_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;

/**
 * Resolve the initial session ID from `window.sidecar.conversationId`, query parameters, or `window.__STUDIO_CONFIG__`.
 */
export function getInitialSessionId(): string {
  const sidecarConvId = window.sidecar?.conversationId?.trim();
  if (sidecarConvId && VALID_SESSION_ID_REGEX.test(sidecarConvId)) {
    return sidecarConvId;
  }

  const params = new URLSearchParams(window.location.search);
  const querySessionId = (
    params.get('conversationId') ||
    params.get('session_id') ||
    params.get('sessionId')
  )?.trim();
  if (
    querySessionId &&
    isConfiguredToken(querySessionId) &&
    VALID_SESSION_ID_REGEX.test(querySessionId)
  ) {
    return querySessionId;
  }

  const cfgSessionId = window.__STUDIO_CONFIG__?.sessionId;
  if (isConfiguredToken(cfgSessionId)) {
    const trimmed = String(cfgSessionId).trim();
    if (VALID_SESSION_ID_REGEX.test(trimmed)) {
      return trimmed;
    }
  }

  const fileParam = (params.get('file') || params.get('path'))?.trim();
  if (fileParam) {
    const brainMatch = fileParam.replace(/\\/g, '/').match(/\/brain\/([a-zA-Z0-9_-]{1,128})\//);
    if (
      brainMatch &&
      brainMatch[1] !== 'tempmediaStorage' &&
      VALID_SESSION_ID_REGEX.test(brainMatch[1])
    ) {
      return brainMatch[1];
    }
  }

  return '';
}

/**
 * Resolve the conversation's active workspace folder URIs (`file://...`) from the host bridge.
 */
export async function getWorkspaceUris(): Promise<string[]> {
  if (window.sidecar && typeof window.sidecar.getWorkspaceUris === 'function') {
    try {
      const uris = await Promise.race([
        window.sidecar.getWorkspaceUris(),
        new Promise<string[]>((resolve) => setTimeout(() => resolve([]), 1000)),
      ]);
      return Array.isArray(uris) ? uris : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function getActiveSessionId(): string {
  if (activeSessionId === null) {
    activeSessionId = getInitialSessionId();
  }
  return activeSessionId;
}

export function getSessionId(): string | null {
  const current = getActiveSessionId();
  return current ? current : null;
}

export function setActiveSessionId(id: string): void {
  const trimmed = id.trim();
  if (!trimmed || !VALID_SESSION_ID_REGEX.test(trimmed)) {
    throw new Error(
      `Invalid session_id "${id}". Must be 1-128 alphanumeric, underscore, or hyphen characters.`
    );
  }

  activeSessionId = trimmed;
  if (window.__STUDIO_CONFIG__) {
    window.__STUDIO_CONFIG__.sessionId = trimmed;
  }

  for (const cb of sessionChangeListeners) {
    cb(trimmed);
  }
}

export function setSessionId(id: string): void {
  setActiveSessionId(id);
}

export function onSessionChange(cb: (sessionId: string) => void): void {
  sessionChangeListeners.push(cb);
}

/**
 * Resolve the initial Go workspace path from query parameters or `window.__STUDIO_CONFIG__`.
 */
export function getInitialWorkspacePath(): string {
  const params = new URLSearchParams(window.location.search);
  const queryWorkspace = params.get('workspace')?.trim();
  if (queryWorkspace && isConfiguredToken(queryWorkspace)) {
    return queryWorkspace;
  }

  const cfgWorkspace = window.__STUDIO_CONFIG__?.workspace;
  if (isConfiguredToken(cfgWorkspace)) {
    return String(cfgWorkspace).trim();
  }

  return '';
}

export function getWorkspacePath(): string {
  if (activeWorkspacePath === null) {
    activeWorkspacePath = getInitialWorkspacePath();
  }
  return activeWorkspacePath;
}

export function setWorkspacePath(workspacePath: string): void {
  const trimmed = workspacePath.trim();
  activeWorkspacePath = trimmed;
  if (window.__STUDIO_CONFIG__) {
    window.__STUDIO_CONFIG__.workspace = trimmed;
  }

  for (const cb of workspaceChangeListeners) {
    cb(trimmed);
  }
}

export function onWorkspaceChange(cb: (workspace: string) => void): void {
  workspaceChangeListeners.push(cb);
}

/**
 * Determine whether the studio is running in 'full' Aux Pane mode (default) or 'preview' mode.
 */
export function getStudioMode(): 'preview' | 'full' {
  const modeParam = new URLSearchParams(window.location.search).get('mode');
  if (modeParam === 'preview') {
    return 'preview';
  }
  if (window.__STUDIO_CONFIG__?.mode === 'preview') {
    return 'preview';
  }
  return 'full';
}

/**
 * Construct the URL to open the Playtest Studio in a standalone browser tab.
 */
export function getFullStudioUrl(): string {
  const origin =
    window.location.protocol === 'http:' || window.location.protocol === 'https:'
      ? window.location.origin
      : getApiBaseUrl();
  const sid = getActiveSessionId() || 'standalone';
  const ws = getWorkspacePath();
  const qs = new URLSearchParams({
    mode: 'full',
    conversationId: sid,
  });
  const token = new URLSearchParams(window.location.search).get('token');
  if (token) {
    qs.set('token', token);
  }
  if (ws) {
    qs.set('workspace', ws);
  }
  return `${origin}/?${qs.toString()}`;
}

/**
 * Pass a `file://` workspace URI from `window.sidecar.getWorkspaceUris()` to the backend
 * to convert it via `fileURLToPath` from `node:url` and discover the default Go package.
 */
export async function resolveWorkspaceUri(workspaceUri: string): Promise<WorkspaceResolveResult> {
  const res = await sidecarFetch('/api/workspace/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceUri }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to resolve workspace URI: HTTP ${res.status}`);
  }
  return (await res.json()) as WorkspaceResolveResult;
}

/**
 * Fetch sidecar health, active session ID, and default workspace path.
 */
export async function fetchHealth(): Promise<HealthInfo> {
  const res = await sidecarFetch('/api/health', { method: 'GET', cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to fetch sidecar health: HTTP ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as HealthInfo;
  if (data.activeSessionId && !getActiveSessionId()) {
    setActiveSessionId(data.activeSessionId);
  }
  if (data.defaultWorkspace && !getWorkspacePath()) {
    setWorkspacePath(data.defaultWorkspace);
  }
  return data;
}

let hostWorkspaceListenerBound = false;
let hostWorkspaceSyncPromise: Promise<string> | null = null;

/**
 * Resolves and synchronizes the active project workspace root across all Studio tabs
 * (`Playtest`, `Sound`, and `Sprites`). Prioritizes `window.sidecar.getWorkspaceUris()`
 * and falls back to `/api/health`'s `defaultWorkspace`.
 */
export async function syncWorkspaceFromHost(): Promise<string> {
  if (window.sidecar?.conversationId && !getSessionId()) {
    try {
      setSessionId(window.sidecar.conversationId);
    } catch {
      // Ignore invalid conversationId format
    }
  }

  if (
    !hostWorkspaceListenerBound &&
    window.sidecar &&
    typeof window.sidecar.onWorkspaceChange === 'function'
  ) {
    hostWorkspaceListenerBound = true;
    window.sidecar.onWorkspaceChange((uris: string[]) => {
      if (Array.isArray(uris) && uris.length > 0 && uris[0]) {
        void resolveWorkspaceUri(uris[0])
          .then((resolved) => {
            if (resolved.workspace) {
              setWorkspacePath(resolved.workspace);
            }
          })
          .catch(() => {});
      }
    });
  }

  if (hostWorkspaceSyncPromise) {
    return hostWorkspaceSyncPromise;
  }

  hostWorkspaceSyncPromise = (async () => {
    let resolvedFromBridge = false;
    if (window.sidecar && typeof window.sidecar.getWorkspaceUris === 'function') {
      try {
        const uris = await Promise.race([
          window.sidecar.getWorkspaceUris(),
          new Promise<string[]>((resolve) => setTimeout(() => resolve([]), 1200)),
        ]);
        if (Array.isArray(uris) && uris.length > 0 && uris[0]) {
          const resolved = await resolveWorkspaceUri(uris[0]);
          if (resolved.workspace) {
            setWorkspacePath(resolved.workspace);
            resolvedFromBridge = true;
          }
        }
      } catch {
        // Proceed to health fallback
      }
    }

    try {
      const health = await fetchHealth();
      if (health.activeSessionId && !getSessionId()) {
        setSessionId(health.activeSessionId);
      }
      if (!resolvedFromBridge && !getWorkspacePath() && health.defaultWorkspace) {
        const resolved = await resolveWorkspaceUri(health.defaultWorkspace);
        if (resolved.workspace) {
          setWorkspacePath(resolved.workspace);
        }
      }
    } catch {
      // Ignore health check errors in standalone dev mode
    }

    return getWorkspacePath();
  })().finally(() => {
    hostWorkspaceSyncPromise = null;
  });

  return hostWorkspaceSyncPromise;
}

/**
 * Fetch the latest active session ID from the sidecar server.
 */
export async function fetchActiveSessionId(): Promise<string | null> {
  const res = await sidecarFetch('/api/session/active', { method: 'GET', cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to fetch active session ID: HTTP ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const resolved = typeof data.sessionId === 'string' && data.sessionId ? data.sessionId : null;
  if (resolved && !activeSessionId) {
    activeSessionId = resolved;
  }
  return resolved;
}

/**
 * Fetch the list of recent sessions discovered by the sidecar server.
 */
export async function fetchRecentSessions(): Promise<SessionSummary[]> {
  const res = await sidecarFetch('/api/sessions', { method: 'GET', cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to fetch recent sessions: HTTP ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return Array.isArray(data.sessions) ? data.sessions : [];
}

/**
 * Trigger on-demand Go WASM compilation (`GOOS=js GOARCH=wasm go build`) via the sidecar server.
 * Returns a structured `BuildWasmFailure` when compilation fails with HTTP 422 so the UI can
 * display the compiler traceback and 1-click "Send Build Error to Chat" action.
 */
export async function buildWasm(params: {
  workspace: string;
  pkg?: string;
}): Promise<BuildWasmResult> {
  const workspace = params.workspace.trim();
  if (!workspace) {
    throw new Error('Workspace path is required to compile Go WASM.');
  }
  const pkg = params.pkg?.trim() || undefined;

  const res = await sidecarFetch('/api/playtest/build', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspace, pkg }),
  });

  const rawText = await res.text();
  let data: any = {};
  if (rawText.trim()) {
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error(
        `Unexpected non-JSON response from /api/playtest/build (HTTP ${res.status}): ${rawText.slice(0, 300)}`
      );
    }
  }

  if (res.status === 422) {
    return {
      ok: false,
      status: 422,
      error: data.error || 'Go WASM compilation failed',
      compilerOutput: data.compilerOutput || data.stderr || data.error || rawText,
      workspace: data.workspace || workspace,
      pkg: data.pkg || pkg || '.',
      exitCode: typeof data.exitCode === 'number' ? data.exitCode : 1,
    };
  }

  if (!res.ok) {
    throw new Error(
      data.error || `WASM build request failed with HTTP ${res.status} ${res.statusText}`
    );
  }

  return {
    ok: true,
    status: 200,
    buildId: data.buildId,
    workspace: data.workspace || workspace,
    pkg: data.pkg || pkg || '.',
    wasmBytes: data.wasmBytes ?? 0,
    durationMs: data.durationMs ?? 0,
    wasmUrl: data.wasmUrl || `/api/playtest/wasm?buildId=${encodeURIComponent(data.buildId)}`,
    wasmExecUrl: data.wasmExecUrl || '/api/playtest/wasm_exec.js',
  };
}

/**
 * Save the annotated bug screenshot to the session brain directory and push a structured
 * bug report (with optional WASM console logs) directly into the active Antigravity chat.
 */
export async function sendBugToChat(params: SendBugToChatParams): Promise<SendToChatResponse> {
  const sessionId =
    params.sessionId ||
    window.sidecar?.conversationId ||
    getActiveSessionId() ||
    'standalone';
  const workspace = params.workspace || getWorkspacePath();
  const pkg = params.pkg || '.';
  const filename = params.filename || `playtest-bug-${Date.now()}.png`;

  const res = await sidecarFetch('/api/send-to-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      filename,
      image: params.imageDataUrl,
      note: params.note || '',
      consoleLogs: params.consoleLogs || [],
      workspace,
      pkg,
      metadata: {
        workspace,
        pkg,
        frameOffset: params.frameOffset ?? 'live',
        resolution:
          params.resolution ||
          (params.width && params.height ? `${params.width}x${params.height}` : 'canvas'),
        width: params.width,
        height: params.height,
      },
    }),
  });

  const rawText = await res.text();
  let data: any = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = { error: rawText };
  }

  if (!res.ok) {
    throw new Error(
      data.error || `Failed to send bug report to chat: HTTP ${res.status} ${res.statusText}`
    );
  }

  return data as SendToChatResponse;
}

/**
 * Push a compiler build failure traceback directly into the active Antigravity chat session.
 */
export async function sendBuildErrorToChat(
  params: SendBuildErrorToChatParams
): Promise<SendToChatResponse> {
  const sessionId =
    params.sessionId ||
    window.sidecar?.conversationId ||
    getActiveSessionId() ||
    'standalone';
  const workspace = params.workspace || getWorkspacePath();
  const pkg = params.pkg || '.';

  const res = await sidecarFetch('/api/send-to-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      buildError: params.buildError,
      note: params.note || '',
      workspace,
      pkg,
      metadata: {
        workspace,
        pkg,
      },
    }),
  });

  const rawText = await res.text();
  let data: any = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = { error: rawText };
  }

  if (!res.ok) {
    throw new Error(
      data.error || `Failed to send build error to chat: HTTP ${res.status} ${res.statusText}`
    );
  }

  return data as SendToChatResponse;
}

function inferActiveStudioContext(): { tab: string; filePath: string } {
  const activeTabBtn = document.querySelector('.studio-top-tab.active') as HTMLElement | null;
  const viewAttr = activeTabBtn?.dataset?.view || '';
  const params = new URLSearchParams(window.location.search);
  const queryTab = (params.get('tab') || '').trim().toLowerCase();
  const rawView = viewAttr || queryTab || 'playtest';
  const tab =
    rawView === 'sound'
      ? 'Sound'
      : rawView === 'sprite' || rawView === 'sprites'
        ? 'Sprites'
        : 'Playtest';

  let filePath = (params.get('file') || params.get('path') || '').trim();
  if (rawView === 'sprite' || rawView === 'sprites') {
    const badge = document.getElementById('spr-active-file-badge');
    const titlePath = badge?.getAttribute('title')?.trim() || '';
    if (titlePath && titlePath !== 'No sprite loaded') {
      filePath = titlePath;
    }
  } else if (rawView === 'sound') {
    const label = document.getElementById('sound-active-file-label');
    const titlePath = label?.getAttribute('title')?.trim() || '';
    if (titlePath && !/^Untitled\.(sfx|music)$/i.test(titlePath)) {
      filePath = titlePath;
    }
  }

  return { tab, filePath };
}

/**
 * Push any Game Dev Studio error toast or fatal diagnostic directly to the active Antigravity chat session
 * so the agent can inspect and fix the issue immediately.
 */
export async function sendStudioErrorToChat(
  params: SendStudioErrorToChatParams
): Promise<SendToChatResponse> {
  const sessionId =
    params.sessionId ||
    window.sidecar?.conversationId ||
    getActiveSessionId() ||
    'standalone';
  const workspace = params.workspace || getWorkspacePath() || '.';
  const inferred = inferActiveStudioContext();
  const tab = params.tab || inferred.tab;
  const filePath = params.filePath ?? inferred.filePath;
  const errorTitle = params.errorTitle.trim() || 'Game Dev Studio Error';
  const studioError = (params.errorDetail && params.errorDetail.trim()) || errorTitle;

  const res = await sidecarFetch('/api/send-to-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      errorTitle,
      studioError,
      workspace,
      metadata: {
        workspace,
        tab,
        filePath,
      },
    }),
  });

  const rawText = await res.text();
  let data: any = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = { error: rawText };
  }

  if (!res.ok) {
    throw new Error(
      data.error || `Failed to send error to agent: HTTP ${res.status} ${res.statusText}`
    );
  }

  return data as SendToChatResponse;
}

/**
 * Fetch filesystem directory defaults (`defaultDir`, `workspaceDir`, `downloadsDir`, `desktopDir`, `sessionDir`).
 */
export async function fetchFsInfo(sessionId?: string | null): Promise<FsInfoResponse> {
  const workspaceUris = await getWorkspaceUris();
  const query = new URLSearchParams();
  const sid = sessionId ?? getSessionId();
  if (sid) {
    query.set('session_id', sid);
  }
  if (workspaceUris.length > 0 && workspaceUris[0]) {
    query.set('workspace_uri', workspaceUris[0]);
  } else if (getWorkspacePath()) {
    query.set('workspace', getWorkspacePath());
  }
  const qs = query.toString();
  const res = await sidecarFetch(`/api/fs/info${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    cache: 'no-store',
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to fetch filesystem info: HTTP ${res.status}`);
  }
  return (await res.json()) as FsInfoResponse;
}

/**
 * List immediate subdirectories and matching files in `dir` via `/api/fs/list`.
 */
export async function fetchFsList(
  dir: string,
  filter: 'sound' | 'sprite' | 'project' | 'all' = 'all',
  extensions?: string[]
): Promise<FsListResponse> {
  const query = new URLSearchParams();
  if (dir && dir.trim()) {
    query.set('dir', dir.trim());
  }
  query.set('filter', filter);
  if (extensions && extensions.length > 0) {
    query.set('extensions', extensions.join(','));
  }
  const res = await sidecarFetch(`/api/fs/list?${query.toString()}`, {
    method: 'GET',
    cache: 'no-store',
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to list directory "${dir}": HTTP ${res.status}`);
  }
  return (await res.json()) as FsListResponse;
}

/**
 * Discover runnable Go main packages inside `dir` for the Playtest project picker.
 */
export async function fetchPackages(dir: string): Promise<{
  workspace: string;
  pkg: string;
  packages: string[];
  hasGoMod: boolean;
}> {
  const list = await fetchFsList(dir, 'project');
  return {
    workspace: list.dir || dir,
    pkg: list.defaultPkg || '.',
    packages: Array.isArray(list.packages) && list.packages.length > 0 ? list.packages : ['.'],
    hasGoMod: Boolean(list.hasGoMod),
  };
}

/**
 * Save a file (either base64 binary `data` or UTF-8 `text`) to the filesystem via `/api/fs/save`.
 */
export async function saveToFilesystem(params: {
  directory?: string;
  filename?: string;
  filePath?: string;
  data?: string;
  text?: string;
  workspaceUris?: string[];
}): Promise<{ success: boolean; filename: string; path: string; size: number }> {
  const workspaceUris = params.workspaceUris ?? (await getWorkspaceUris());
  const res = await sidecarFetch('/api/fs/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      directory: params.directory,
      filename: params.filename,
      filePath: params.filePath,
      data: params.data,
      text: params.text,
      workspaceUris,
    }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to save file to filesystem: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Read a file from the filesystem via `/api/fs/open?file=...&format=json`.
 */
export async function openFromFilesystem(filePath: string): Promise<{
  path: string;
  fileName: string;
  ext: string;
  size: number;
  text?: string;
  base64: string;
}> {
  const res = await sidecarFetch(
    `/api/fs/open?file=${encodeURIComponent(filePath)}&format=json`,
    { method: 'GET', cache: 'no-store' }
  );
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to open file "${filePath}": HTTP ${res.status}`);
  }
  return await res.json();
}

