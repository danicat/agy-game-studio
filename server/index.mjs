// Copyright 2026 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import {
  normalizeWorkspacePath,
  discoverMainPackage,
  resolveWasmExecJsPath,
  compileGoWasm,
  resolveCompiledWasm,
} from './services/wasm-builder.mjs';
import {
  listSoundFiles,
  getSoundPresets,
  readSoundFile,
  saveSoundFile,
  synthesizeSound,
  getSynthesizedWav,
  getSynthesizedStems,
  exportSoundWav,
} from './services/sound_service.mjs';
import {
  listSpriteFiles,
  getSpritePresets,
  inspectSpriteSheet,
  compileSpriteDsl,
  normalizeSpriteSheetApi,
  getSpriteSheetPng,
  readSpriteDslFile,
  saveSpriteDslFile,
} from './services/sprite_service.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginRoot = path.resolve(__dirname, '..');
const distPath = path.join(pluginRoot, 'dist');
const STARTED_AT = Date.now();

const SESSION_ID_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;
const SEND_TO_CHAT_FILENAME_REGEX = /^[a-zA-Z0-9_\-]+\.(png|jpg|jpeg|webp|gif)$/i;
const MAX_JSON_BODY_BYTES = 2 * 1024 * 1024; // 2MB default
const MAX_CHAT_BODY_BYTES = 25 * 1024 * 1024; // 25MB for annotated screenshots
const AGENTAPI_TIMEOUT_MS = 15_000; // 15 seconds

export const ALLOWED_ARTIFACT_EXTENSIONS = new Set([
  '.music',
  '.sfx',
  '.wav',
  '.sprite',
  '.aseprite',
  '.ase',
  '.png',
  '.json',
  '.gif',
  '.psd',
  '.jpg',
  '.jpeg',
  '.webp',
  '.svg',
]);

const SOUND_ARTIFACT_EXTENSIONS = new Set(['.music', '.sfx', '.wav']);
const SPRITE_ARTIFACT_EXTENSIONS = new Set([
  '.sprite',
  '.aseprite',
  '.ase',
  '.png',
  '.json',
  '.gif',
  '.psd',
  '.jpg',
  '.jpeg',
  '.webp',
]);
const TEXT_FILE_EXTENSIONS = new Set(['.music', '.sfx', '.sprite', '.json', '.svg']);

let activeServerPort = null;

function createHttpError(message, statusCode, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

export function getDefaultWorkspace() {
  if (process.env.PLAYTEST_WORKSPACE && process.env.PLAYTEST_WORKSPACE.trim()) {
    return normalizeWorkspacePath(process.env.PLAYTEST_WORKSPACE.trim());
  }
  const cwd = path.resolve(process.cwd());
  const sidecarDir = path.join(pluginRoot, 'sidecars', 'studio');
  if (cwd === sidecarDir) {
    return pluginRoot;
  }
  return cwd;
}

function hasEnclosingGoMod(startDir) {
  let current = path.resolve(startDir);
  for (let depth = 0; depth < 6; depth++) {
    if (fs.existsSync(path.join(current, 'go.mod'))) {
      return true;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return false;
}

export function discoverRunnableGoPackages(dirPath) {
  if (!dirPath || !fs.existsSync(dirPath)) return [];
  let stat;
  try {
    stat = fs.statSync(dirPath);
  } catch {
    return [];
  }
  if (!stat.isDirectory()) return [];

  const packages = [];
  try {
    const rootEntries = fs.readdirSync(dirPath, { withFileTypes: true });
    const hasRootGo = rootEntries.some(
      (e) => e.isFile() && e.name.endsWith('.go') && !e.name.endsWith('_test.go')
    );
    if (hasRootGo) {
      packages.push('.');
    }

    for (const parentFolder of ['cmd', 'examples']) {
      const searchDir = path.join(dirPath, parentFolder);
      if (fs.existsSync(searchDir) && fs.statSync(searchDir).isDirectory()) {
        const subEntries = fs
          .readdirSync(searchDir, { withFileTypes: true })
          .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
          .sort((a, b) => a.name.localeCompare(b.name));

        for (const sub of subEntries) {
          const subDir = path.join(searchDir, sub.name);
          const subFiles = fs.readdirSync(subDir, { withFileTypes: true });
          if (
            subFiles.some(
              (f) => f.isFile() && f.name.endsWith('.go') && !f.name.endsWith('_test.go')
            )
          ) {
            packages.push(`./${parentFolder}/${sub.name}`);
          }
        }
      }
    }
  } catch {
    // Ignore directory read errors during package scan
  }
  return packages;
}

export function resolveWorkspaceInfo(workspaceInput) {
  const resolvedPath =
    workspaceInput && typeof workspaceInput === 'string' && workspaceInput.trim()
      ? normalizeWorkspacePath(workspaceInput)
      : getDefaultWorkspace();

  let pkg = '.';
  try {
    pkg = discoverMainPackage(resolvedPath);
  } catch {
    pkg = '.';
  }

  const packages = discoverRunnableGoPackages(resolvedPath);
  const subPkgPath =
    pkg && pkg !== '.' ? path.resolve(resolvedPath, pkg) : resolvedPath;
  const hasGoMod =
    fs.existsSync(path.join(resolvedPath, 'go.mod')) ||
    fs.existsSync(path.join(subPkgPath, 'go.mod')) ||
    hasEnclosingGoMod(subPkgPath);

  return {
    workspace: resolvedPath,
    pkg,
    packages: packages.length > 0 ? packages : [pkg],
    projectPath: resolvedPath,
    hasGoMod,
  };
}

// Determine Antigravity app data directory portably with fail-fast validation
export function getAppDataDir() {
  if (process.env.ANTIGRAVITY_APP_DATA_DIR) {
    const envDir = process.env.ANTIGRAVITY_APP_DATA_DIR.trim();
    if (!fs.existsSync(envDir)) {
      throw createHttpError(
        `Configured ANTIGRAVITY_APP_DATA_DIR does not exist: "${envDir}"`,
        500
      );
    }
    return path.resolve(envDir);
  }

  // If ANTIGRAVITY_EXECUTABLE_DATA_DIR is set by Antigravity (<app data dir>/sidecar_data/<plugin>/<sidecar>/data),
  // walk up 4 levels to <app data dir> if it contains brain/.
  if (process.env.ANTIGRAVITY_EXECUTABLE_DATA_DIR) {
    const candidateFromExec = path.resolve(
      process.env.ANTIGRAVITY_EXECUTABLE_DATA_DIR,
      '..',
      '..',
      '..',
      '..'
    );
    if (fs.existsSync(path.join(candidateFromExec, 'brain'))) {
      return candidateFromExec;
    }
  }

  const home = os.homedir();
  const candidates = [
    path.join(home, '.gemini', 'antigravity'),
    path.join(home, 'Library', 'Application Support', 'Antigravity'),
    path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'Antigravity'),
    path.join(process.env.XDG_DATA_HOME || path.join(home, '.local', 'share'), 'Antigravity'),
    path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Antigravity'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const geminiRoot = path.join(home, '.gemini');
  if (fs.existsSync(geminiRoot)) {
    const entries = fs.readdirSync(geminiRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const candidateDir = path.join(geminiRoot, entry.name);
        if (fs.existsSync(path.join(candidateDir, 'brain'))) {
          return candidateDir;
        }
      }
    }
  }

  throw createHttpError(
    `Antigravity app data directory not found. Set ANTIGRAVITY_APP_DATA_DIR to a valid directory.`,
    500
  );
}

export function validateSessionId(sessionId) {
  if (!sessionId || typeof sessionId !== 'string' || !SESSION_ID_REGEX.test(sessionId)) {
    throw createHttpError(
      `Invalid or missing session_id: "${sessionId}". Must match ${SESSION_ID_REGEX}.`,
      400
    );
  }
  return sessionId;
}

// Resolve session brain directory with strict existence check (fail-fast 404 for unknown sessions)
export function resolveSessionBrainDir(sessionId) {
  validateSessionId(sessionId);
  const appDataDir = getAppDataDir();
  const brainDir = path.join(appDataDir, 'brain');
  const sessionDir = path.join(brainDir, sessionId);

  if (sessionId === 'standalone') {
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    return sessionDir;
  }

  if (!fs.existsSync(sessionDir) || !fs.statSync(sessionDir).isDirectory()) {
    throw createHttpError(
      `Session brain directory not found for session_id "${sessionId}" at "${sessionDir}".`,
      404
    );
  }

  return sessionDir;
}

// Discover recent Antigravity session IDs from brain directories
export function getRecentSessions() {
  const appData = getAppDataDir();
  const brainDir = path.join(appData, 'brain');
  if (!fs.existsSync(brainDir)) {
    return [];
  }

  const entries = fs.readdirSync(brainDir, { withFileTypes: true });
  const list = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'tempmediaStorage') {
      continue;
    }
    const id = entry.name;
    if (!SESSION_ID_REGEX.test(id)) {
      continue;
    }
    const sessionPath = path.join(brainDir, id);
    const transcriptPath = path.join(sessionPath, '.system_generated', 'logs', 'transcript.jsonl');
    const targetPath = fs.existsSync(transcriptPath) ? transcriptPath : sessionPath;
    const stat = fs.statSync(targetPath);
    list.push({
      id,
      title: `Session ${id.slice(0, 8)}`,
      updatedAt: new Date(stat.mtimeMs).toISOString(),
      mtimeMs: stat.mtimeMs,
    });
  }

  list.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return list.slice(0, 20).map(({ id, title, updatedAt }) => ({ id, title, updatedAt }));
}

export function getActiveSessionId() {
  const recent = getRecentSessions();
  if (process.env.ANTIGRAVITY_CONVERSATION_ID) {
    const envConv = process.env.ANTIGRAVITY_CONVERSATION_ID.trim();
    if (recent.some((s) => s.id === envConv)) {
      return envConv;
    }
  }
  return recent.length > 0 ? recent[0].id : null;
}

export function getConfig() {
  const rawPort =
    process.env.ANTIGRAVITY_SIDECAR_WEB_PORT !== undefined
      ? String(process.env.ANTIGRAVITY_SIDECAR_WEB_PORT).trim()
      : process.env.PORT !== undefined
      ? String(process.env.PORT).trim()
      : '7789';
  const port = Number.parseInt(rawPort, 10);
  if (
    Number.isNaN(port) ||
    (port !== 0 && (port < 1024 || port > 65535)) ||
    String(port) !== rawPort
  ) {
    throw new Error(
      `Invalid port environment variable: "${rawPort}". Must be 0 (ephemeral) or an integer between 1024 and 65535.`
    );
  }

  return {
    port,
    host: process.env.HOST || '127.0.0.1',
  };
}

export const readConfig = getConfig;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.psd': 'image/vnd.adobe.photoshop',
  '.music': 'text/plain; charset=utf-8',
  '.sfx': 'text/plain; charset=utf-8',
  '.wav': 'audio/wav',
  '.sprite': 'text/plain; charset=utf-8',
  '.aseprite': 'application/octet-stream',
  '.ase': 'application/octet-stream',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
};

function parseWorkspaceUri(uri) {
  if (typeof uri !== 'string' || !uri.trim()) return null;
  const trimmed = uri.trim();
  if (trimmed.startsWith('file://')) {
    try {
      return path.resolve(fileURLToPath(trimmed));
    } catch {
      return null;
    }
  }
  return path.resolve(trimmed);
}

function expandTildeAndUri(rawPath) {
  const homeDir = os.homedir();
  const trimmed = String(rawPath || '').trim();
  if (trimmed === '~') return homeDir;
  if (trimmed.startsWith('~/') || trimmed.startsWith('~\\')) {
    return path.join(homeDir, trimmed.slice(2));
  }
  if (trimmed.startsWith('file://')) {
    return fileURLToPath(trimmed);
  }
  return trimmed;
}

function getAllowedFsRoots(workspaceUris) {
  const homeDir = os.homedir();
  const allowedRoots = [
    path.resolve(homeDir),
    path.resolve(os.tmpdir()),
    path.resolve(process.cwd()),
    path.resolve(getDefaultWorkspace()),
  ];
  try {
    allowedRoots.push(fs.realpathSync(os.tmpdir()));
  } catch {
    // ignore if tmpdir realpath fails
  }
  if (process.env.WORKSPACE_ROOT) {
    allowedRoots.push(path.resolve(process.env.WORKSPACE_ROOT));
  }
  if (process.env.PLAYTEST_WORKSPACE) {
    allowedRoots.push(path.resolve(process.env.PLAYTEST_WORKSPACE));
  }
  if (process.env.ANTIGRAVITY_EXECUTABLE_DATA_DIR) {
    allowedRoots.push(path.resolve(process.env.ANTIGRAVITY_EXECUTABLE_DATA_DIR));
  }
  if (Array.isArray(workspaceUris)) {
    for (const uri of workspaceUris) {
      const parsed = parseWorkspaceUri(uri);
      if (parsed) allowedRoots.push(parsed);
    }
  }
  try {
    allowedRoots.push(path.resolve(getAppDataDir()));
  } catch {
    // ignore if appDataDir is not configured
  }
  return allowedRoots;
}

function isWithinAllowedRoot(candidate, workspaceUris) {
  const allowedRoots = getAllowedFsRoots(workspaceUris);
  return allowedRoots.some(
    (root) => candidate === root || candidate.startsWith(root + path.sep)
  );
}

export function validateArtifactRelativePath(relPath, { allowReadSystemGeneratedMedia = false } = {}) {
  if (!relPath || typeof relPath !== 'string' || !relPath.trim()) {
    throw createHttpError('Missing or empty artifact filename/path.', 400);
  }
  if (relPath.includes('\0')) {
    throw createHttpError('Invalid artifact filename: null byte detected.', 400);
  }
  if (path.isAbsolute(relPath) || relPath.startsWith('/') || relPath.startsWith('\\')) {
    throw createHttpError(`Invalid artifact filename "${relPath}": must be a relative path.`, 400);
  }

  const normalized = relPath.replace(/\\/g, '/');
  const segments = normalized.split('/');
  if (relPath.includes('..') || segments.some((seg) => seg === '..' || seg === '.')) {
    throw createHttpError(
      `Access denied: path traversal sequence ".." is not allowed in "${relPath}".`,
      400
    );
  }

  if (!allowReadSystemGeneratedMedia) {
    if (
      normalized === '.system_generated' ||
      normalized.startsWith('.system_generated/') ||
      segments.includes('.system_generated')
    ) {
      throw createHttpError(
        `Access denied: writing into ".system_generated" is forbidden ("${relPath}").`,
        400
      );
    }
  } else if (
    normalized === '.system_generated' ||
    normalized.startsWith('.system_generated/logs') ||
    normalized.startsWith('.system_generated/messages')
  ) {
    throw createHttpError(
      `Access denied: access to internal logs or messages in ".system_generated" is forbidden ("${relPath}").`,
      400
    );
  }

  const ext = path.extname(relPath).toLowerCase();
  if (!ALLOWED_ARTIFACT_EXTENSIONS.has(ext)) {
    throw createHttpError(
      `Unsupported file extension "${ext}" for "${relPath}". Allowed extensions: ${Array.from(ALLOWED_ARTIFACT_EXTENSIONS).join(', ')}.`,
      400
    );
  }

  return { normalized, ext };
}

export function scanConversationMedia(sessionDir, filter = 'all') {
  if (!fs.existsSync(sessionDir)) {
    return [];
  }
  const realSessionDir = fs.realpathSync(sessionDir);
  const results = [];
  const normalizedFilter = String(filter || 'all').toLowerCase();
  const allowedSet =
    normalizedFilter === 'sound'
      ? SOUND_ARTIFACT_EXTENSIONS
      : normalizedFilter === 'sprite'
      ? SPRITE_ARTIFACT_EXTENSIONS
      : ALLOWED_ARTIFACT_EXTENSIONS;

  function walk(currentDir, relPrefix = '', source = 'Artifact') {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.name === 'node_modules' ||
        entry.name === '.git' ||
        (relPrefix === '.system_generated' &&
          (entry.name === 'logs' || entry.name === 'messages'))
      ) {
        continue;
      }
      const fullPath = path.join(currentDir, entry.name);
      const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;

      let realEntryPath;
      try {
        realEntryPath = fs.realpathSync(fullPath);
      } catch (err) {
        console.warn(`[game-dev-studio] Skipping unresolvable entry "${fullPath}": ${err.message}`);
        continue;
      }

      if (
        realEntryPath !== realSessionDir &&
        !realEntryPath.startsWith(realSessionDir + path.sep)
      ) {
        console.warn(`[game-dev-studio] Skipping symlink outside session directory: "${fullPath}"`);
        continue;
      }

      const stat = fs.statSync(realEntryPath);
      if (stat.isDirectory()) {
        if (entry.name === '.user_uploaded') {
          walk(fullPath, relPath, 'User Upload');
        } else if (entry.name === '.tempmediaStorage') {
          walk(fullPath, relPath, 'Temp Media');
        } else if (entry.name === '.system_generated') {
          walk(fullPath, relPath, 'Step Media');
        } else if (!entry.name.startsWith('.')) {
          walk(fullPath, relPath, source);
        }
      } else if (stat.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (allowedSet.has(ext)) {
          results.push({
            filename: relPath,
            relativePath: relPath,
            filePath: fullPath,
            name: entry.name,
            displayName: entry.name,
            source,
            size: stat.size,
            modifiedTime: stat.mtimeMs,
            ext,
          });
        }
      }
    }
  }

  walk(sessionDir);
  return results.sort((a, b) => b.modifiedTime - a.modifiedTime);
}

export function handleGetArtifacts(data = {}) {
  const sessionId = data.session_id || data.sessionId || getActiveSessionId() || 'standalone';
  const sessionDir = resolveSessionBrainDir(sessionId);
  const filter = data.filter || 'all';
  const media = scanConversationMedia(sessionDir, filter);
  return { artifacts: media, media };
}

export function handleGetArtifact(data = {}) {
  const sessionId = data.session_id || data.sessionId || getActiveSessionId() || 'standalone';
  const filename = data.filename || data.path;
  const sessionDir = resolveSessionBrainDir(sessionId);
  const { ext } = validateArtifactRelativePath(filename, {
    allowReadSystemGeneratedMedia: true,
  });

  const targetPath = path.resolve(sessionDir, filename);
  const realSessionDir = fs.realpathSync(sessionDir);

  if (targetPath !== sessionDir && !targetPath.startsWith(sessionDir + path.sep)) {
    throw createHttpError(
      'Access denied: path traversal attempt outside session directory.',
      400
    );
  }

  const lstat = fs.lstatSync(targetPath, { throwIfNoEntry: false });
  if (!lstat) {
    throw createHttpError(`Artifact file not found: "${filename}"`, 404);
  }

  let realTargetPath;
  try {
    realTargetPath = fs.realpathSync(targetPath);
  } catch (err) {
    throw createHttpError(
      `Access denied: unable to resolve real path for "${filename}": ${err.message}`,
      400
    );
  }

  if (!realTargetPath.startsWith(realSessionDir + path.sep)) {
    throw createHttpError(
      'Access denied: resolved artifact path escapes session directory.',
      400
    );
  }

  const stat = fs.statSync(realTargetPath);
  if (!stat.isFile()) {
    throw createHttpError(`Artifact path is not a regular file: "${filename}"`, 400);
  }

  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const headers = {
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  };
  if (ext === '.svg') {
    headers['Content-Security-Policy'] = "default-src 'none'; sandbox";
  }

  const fileData = fs.readFileSync(realTargetPath);
  return {
    filename,
    ext,
    contentType,
    headers,
    fileData,
    isText: TEXT_FILE_EXTENSIONS.has(ext),
  };
}

export function handlePostArtifact(data = {}) {
  const sessionId = data.session_id || data.sessionId || getActiveSessionId() || 'standalone';
  const filename = data.filename || data.path;
  const textPayload = data.text;
  const payload = data.data ?? data.image ?? data.content;

  const sessionDir = resolveSessionBrainDir(sessionId);
  validateArtifactRelativePath(filename);

  const hasText = typeof textPayload === 'string';
  const hasBase64 = typeof payload === 'string' && payload.trim().length > 0;
  if (!hasText && !hasBase64) {
    throw createHttpError(
      'Missing or invalid "data" or "text" in save artifact request.',
      400
    );
  }

  const targetPath = path.resolve(sessionDir, filename);
  if (targetPath !== sessionDir && !targetPath.startsWith(sessionDir + path.sep)) {
    throw createHttpError(
      'Access denied: path traversal attempt outside session directory.',
      400
    );
  }

  const realSessionDir = fs.realpathSync(sessionDir);
  const targetDir = path.dirname(targetPath);

  let existingAncestor = targetDir;
  while (!fs.existsSync(existingAncestor)) {
    const parent = path.dirname(existingAncestor);
    if (parent === existingAncestor) break;
    existingAncestor = parent;
  }
  const realAncestor = fs.realpathSync(existingAncestor);
  if (
    realAncestor !== realSessionDir &&
    !realAncestor.startsWith(realSessionDir + path.sep)
  ) {
    throw createHttpError(
      'Access denied: target ancestor directory escapes session directory.',
      400
    );
  }

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const realParentDir = fs.realpathSync(targetDir);
  if (
    realParentDir !== realSessionDir &&
    !realParentDir.startsWith(realSessionDir + path.sep)
  ) {
    throw createHttpError(
      'Access denied: target parent directory escapes session directory.',
      400
    );
  }

  const existingLstat = fs.lstatSync(targetPath, { throwIfNoEntry: false });
  if (existingLstat) {
    let realExisting;
    try {
      realExisting = fs.realpathSync(targetPath);
    } catch (err) {
      throw createHttpError(
        `Access denied: invalid existing symlink at "${filename}": ${err.message}`,
        400
      );
    }
    if (!realExisting.startsWith(realSessionDir + path.sep)) {
      throw createHttpError(
        'Access denied: target file symlink points outside session directory.',
        400
      );
    }
  }

  let buffer;
  if (hasText) {
    buffer = Buffer.from(textPayload, 'utf-8');
  } else {
    const rawBase64 = payload.includes(',') ? payload.split(',')[1] : payload;
    buffer = Buffer.from(rawBase64, 'base64');
  }
  fs.writeFileSync(targetPath, buffer);

  return { success: true, filename, path: targetPath, size: buffer.length };
}

export function handleGetFsInfo(data = {}) {
  const homeDir = os.homedir();
  const downloadsDir = path.join(homeDir, 'Downloads');
  const desktopDir = path.join(homeDir, 'Desktop');

  const hostWorkspaceDir = parseWorkspaceUri(
    data.workspace_uri || data.workspaceUri || data.workspace
  );
  const workspaceDir = hostWorkspaceDir || getDefaultWorkspace();

  const sessionId = data.session_id || data.sessionId || getActiveSessionId();
  let sessionDir = null;
  if (sessionId && SESSION_ID_REGEX.test(sessionId)) {
    try {
      sessionDir = resolveSessionBrainDir(sessionId);
    } catch {
      sessionDir = null;
    }
  }

  const defaultDir =
    workspaceDir && fs.existsSync(workspaceDir)
      ? workspaceDir
      : fs.existsSync(downloadsDir)
      ? downloadsDir
      : homeDir;

  return {
    defaultDir,
    downloadsDir,
    desktopDir,
    homeDir,
    workspaceDir,
    sessionDir,
  };
}

export function handleGetFsList(data = {}) {
  const rawDir = data.dir || data.directory || data.path || getDefaultWorkspace();
  if (typeof rawDir !== 'string' || !rawDir.trim()) {
    throw createHttpError('Missing or empty "dir" query parameter.', 400);
  }
  if (rawDir.includes('\0')) {
    throw createHttpError('Invalid directory path: null byte detected.', 400);
  }

  const targetDir = path.resolve(expandTildeAndUri(rawDir));
  if (!isWithinAllowedRoot(targetDir)) {
    throw createHttpError(
      `Access denied: directory "${targetDir}" must be within your home, workspace, or temp directory.`,
      403
    );
  }

  if (!fs.existsSync(targetDir)) {
    throw createHttpError(`Directory not found: "${targetDir}"`, 404);
  }

  const realDir = fs.realpathSync(targetDir);
  if (!isWithinAllowedRoot(realDir)) {
    throw createHttpError(
      `Access denied: resolved directory "${realDir}" is outside allowed user directories.`,
      403
    );
  }

  const dirStat = fs.statSync(realDir);
  if (!dirStat.isDirectory()) {
    throw createHttpError(`Path is not a directory: "${targetDir}"`, 400);
  }

  const filter = String(data.filter || 'all').toLowerCase();
  let allowedExts;
  if (typeof data.extensions === 'string' && data.extensions.trim()) {
    allowedExts = new Set(
      data.extensions
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
        .map((e) => (e.startsWith('.') ? e : `.${e}`))
    );
  } else if (filter === 'sound') {
    allowedExts = new Set(['.music', '.sfx']);
  } else if (filter === 'sprite') {
    allowedExts = new Set(['.sprite', '.aseprite', '.ase']);
  } else if (filter === 'project') {
    allowedExts = new Set();
  } else {
    allowedExts = ALLOWED_ARTIFACT_EXTENSIONS;
  }

  const entries = fs.readdirSync(realDir, { withFileTypes: true });
  const directories = [];
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') {
      continue;
    }
    const fullPath = path.join(realDir, entry.name);
    let realEntryPath;
    let stat;
    try {
      realEntryPath = fs.realpathSync(fullPath);
      if (!isWithinAllowedRoot(realEntryPath)) continue;
      stat = fs.statSync(realEntryPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      directories.push({
        name: entry.name,
        path: fullPath,
        type: 'directory',
        hasGoMod: fs.existsSync(path.join(fullPath, 'go.mod')),
      });
    } else if (stat.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (allowedExts.has(ext)) {
        files.push({
          name: entry.name,
          path: fullPath,
          filePath: fullPath,
          ext,
          type: ext.slice(1),
          size: stat.size,
          modifiedTime: stat.mtimeMs,
        });
      }
    }
  }

  directories.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  const packages = discoverRunnableGoPackages(realDir);
  const hasGoMod =
    fs.existsSync(path.join(realDir, 'go.mod')) ||
    hasEnclosingGoMod(realDir) ||
    packages.length > 0;
  const defaultPkg = packages.length > 0 ? packages[0] : '.';
  const parentCandidate = path.dirname(realDir);
  const parentDir =
    parentCandidate !== realDir && isWithinAllowedRoot(parentCandidate)
      ? parentCandidate
      : null;

  return {
    dir: realDir,
    parentDir,
    filter,
    directories,
    files,
    hasGoMod,
    packages: packages.length > 0 ? packages : ['.'],
    defaultPkg,
  };
}

export function handlePostFsSave(data = {}) {
  const { directory, filename, filePath, workspaceUris } = data;
  const textPayload = data.text;
  const payload = data.data ?? data.image ?? data.content;

  const hasText = typeof textPayload === 'string';
  const hasBase64 = typeof payload === 'string' && payload.trim().length > 0;
  if (!hasText && !hasBase64) {
    throw createHttpError(
      'Missing or invalid "data" or "text" in filesystem save request.',
      400
    );
  }

  let targetPath;
  if (
    typeof directory === 'string' &&
    directory.trim() &&
    typeof filename === 'string' &&
    filename.trim()
  ) {
    if (
      filename.includes('\0') ||
      filename.includes('/') ||
      filename.includes('\\') ||
      filename === '.' ||
      filename === '..'
    ) {
      throw createHttpError(
        `Invalid filename "${filename}": must be a single file name without directory separators.`,
        400
      );
    }
    if (directory.includes('\0')) {
      throw createHttpError('Invalid directory path: null byte detected.', 400);
    }
    const resolvedDir = path.resolve(expandTildeAndUri(directory));
    targetPath = path.join(resolvedDir, filename.trim());
  } else if (typeof filePath === 'string' && filePath.trim()) {
    if (filePath.includes('\0')) {
      throw createHttpError('Invalid filePath: null byte detected.', 400);
    }
    targetPath = path.resolve(expandTildeAndUri(filePath));
  } else {
    throw createHttpError(
      'Missing target location: provide either ("directory" and "filename") or "filePath".',
      400
    );
  }

  const ext = path.extname(targetPath).toLowerCase();
  if (!ALLOWED_ARTIFACT_EXTENSIONS.has(ext)) {
    throw createHttpError(
      `Unsupported file extension "${ext}". Allowed extensions: ${Array.from(ALLOWED_ARTIFACT_EXTENSIONS).join(', ')}.`,
      400
    );
  }

  const normalizedSegments = targetPath.split(path.sep);
  if (normalizedSegments.includes('.system_generated')) {
    throw createHttpError(
      'Access denied: writing into ".system_generated" is forbidden.',
      400
    );
  }

  if (!isWithinAllowedRoot(targetPath, workspaceUris)) {
    throw createHttpError(
      `Access denied: target path "${targetPath}" must be within your home, workspace, or temp directory.`,
      403
    );
  }

  const targetDir = path.dirname(targetPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const realTargetDir = fs.realpathSync(targetDir);
  if (!isWithinAllowedRoot(realTargetDir, workspaceUris)) {
    throw createHttpError(
      `Access denied: resolved target directory "${realTargetDir}" is outside allowed user directories.`,
      403
    );
  }

  const existingLstat = fs.lstatSync(targetPath, { throwIfNoEntry: false });
  if (existingLstat) {
    let realExisting;
    try {
      realExisting = fs.realpathSync(targetPath);
    } catch (err) {
      throw createHttpError(
        `Access denied: invalid existing symlink at "${targetPath}": ${err.message}`,
        400
      );
    }
    if (!isWithinAllowedRoot(realExisting, workspaceUris)) {
      throw createHttpError(
        'Access denied: target file symlink points outside allowed user directories.',
        403
      );
    }
  }

  let buffer;
  if (hasText) {
    buffer = Buffer.from(textPayload, 'utf-8');
  } else {
    const rawBase64 = payload.includes(',') ? payload.split(',')[1] : payload;
    buffer = Buffer.from(rawBase64, 'base64');
  }
  fs.writeFileSync(targetPath, buffer);

  return {
    success: true,
    filename: path.basename(targetPath),
    path: targetPath,
    size: buffer.length,
  };
}

export function handleGetFsOpen(data = {}) {
  const rawFile = data.file || data.filePath || data.path;
  if (!rawFile || typeof rawFile !== 'string' || !rawFile.trim()) {
    throw createHttpError('Missing or empty "file" query parameter.', 400);
  }
  if (rawFile.includes('\0')) {
    throw createHttpError('Invalid file path: null byte detected.', 400);
  }

  const targetPath = path.resolve(expandTildeAndUri(rawFile));
  const ext = path.extname(targetPath).toLowerCase();
  if (!ALLOWED_ARTIFACT_EXTENSIONS.has(ext)) {
    throw createHttpError(
      `Unsupported file extension "${ext}". Allowed extensions: ${Array.from(ALLOWED_ARTIFACT_EXTENSIONS).join(', ')}.`,
      400
    );
  }

  const normalizedSegments = targetPath.split(path.sep);
  const sysGenIdx = normalizedSegments.indexOf('.system_generated');
  if (
    sysGenIdx !== -1 &&
    (normalizedSegments[sysGenIdx + 1] === 'logs' ||
      normalizedSegments[sysGenIdx + 1] === 'messages')
  ) {
    throw createHttpError(
      'Access denied: reading internal logs or messages from ".system_generated" is forbidden.',
      400
    );
  }

  if (!isWithinAllowedRoot(targetPath)) {
    throw createHttpError(
      `Access denied: file path "${targetPath}" must be within your home, workspace, or temp directory.`,
      403
    );
  }

  if (!fs.existsSync(targetPath)) {
    throw createHttpError(`File not found: "${targetPath}"`, 404);
  }

  const realTargetPath = fs.realpathSync(targetPath);
  if (!isWithinAllowedRoot(realTargetPath)) {
    throw createHttpError(
      `Access denied: resolved file path "${realTargetPath}" is outside allowed user directories.`,
      403
    );
  }

  const stat = fs.statSync(realTargetPath);
  if (!stat.isFile()) {
    throw createHttpError(`Path is not a regular file: "${targetPath}"`, 400);
  }

  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const fileData = fs.readFileSync(realTargetPath);
  return {
    path: realTargetPath,
    fileName: path.basename(realTargetPath),
    ext,
    contentType,
    fileData,
    isText: TEXT_FILE_EXTENSIONS.has(ext),
  };
}

// Parse JSON request body with strict byte-limit enforcement before buffering
export function parseJsonBody(req, maxBytes = MAX_JSON_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytesRead = 0;
    let aborted = false;

    req.on('data', (chunk) => {
      if (aborted) return;
      const chunkBuf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      bytesRead += chunkBuf.length;
      if (bytesRead > maxBytes) {
        aborted = true;
        req.destroy();
        reject(
          createHttpError(
            `Payload Too Large: request body exceeds limit of ${maxBytes} bytes.`,
            413
          )
        );
        return;
      }
      chunks.push(chunkBuf);
    });

    req.on('end', () => {
      if (aborted) return;
      if (bytesRead === 0) {
        resolve({});
        return;
      }
      try {
        const raw = Buffer.concat(chunks, bytesRead).toString('utf-8');
        if (!raw.trim()) {
          resolve({});
        } else {
          resolve(JSON.parse(raw));
        }
      } catch (err) {
        reject(createHttpError(`Malformed JSON request body: ${err.message}`, 400));
      }
    });

    req.on('error', (err) => {
      if (aborted) return;
      reject(err);
    });
  });
}

function getAgentApiExecutable() {
  if (process.env.AGENTAPI_BIN) {
    const customBin = process.env.AGENTAPI_BIN.trim();
    if (!fs.existsSync(customBin)) {
      throw createHttpError(
        `Configured AGENTAPI_BIN executable not found at "${customBin}".`,
        500
      );
    }
    return { file: customBin, prefixArgs: [] };
  }

  if (process.env.ANTIGRAVITY_AGENTAPI_EXE) {
    const exe = process.env.ANTIGRAVITY_AGENTAPI_EXE.trim();
    if (fs.existsSync(exe)) {
      return { file: exe, prefixArgs: ['agentapi'] };
    }
  }

  const appDataDir = getAppDataDir();
  const binaryName = process.platform === 'win32' ? 'agentapi.exe' : 'agentapi';
  const binPath = path.join(appDataDir, 'bin', binaryName);
  if (fs.existsSync(binPath)) {
    return { file: binPath, prefixArgs: [] };
  }

  return { file: binaryName, prefixArgs: [] };
}

function spawnAgentApiSendMessage(title, sessionId, messageContent) {
  const { file, prefixArgs } = getAgentApiExecutable();
  return new Promise((resolve, reject) => {
    const proc = spawn(
      file,
      [...prefixArgs, 'send-message', `--title=${title}`, sessionId, messageContent],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGKILL');
      reject(
        createHttpError(
          `agentapi send-message timed out after ${AGENTAPI_TIMEOUT_MS}ms.`,
          504
        )
      );
    }, AGENTAPI_TIMEOUT_MS);

    proc.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) return;
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(
          createHttpError(
            `agentapi send-message failed with exit code ${code}: ${stderr || stdout}`,
            502
          )
        );
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      if (timedOut) return;
      reject(
        createHttpError(
          `Failed to execute agentapi binary "${file}": ${err.message}`,
          500
        )
      );
    });
  });
}

async function deliverMessageToChat(sidecarApp, sessionId, title, messageContent) {
  if (process.env.AGENTAPI_BIN || !sidecarApp) {
    await spawnAgentApiSendMessage(title, sessionId, messageContent);
    return;
  }

  let projectId = '';
  try {
    const metaData = sidecarApp.getConversationMetadata(sessionId);
    const metaEvent =
      metaData?.response?.conversationMetadata || metaData?.response?.conversation_metadata;
    projectId = metaEvent?.metadata?.projectId || metaEvent?.metadata?.project_id || '';
  } catch {
    // Proceed with default projectId if metadata lookup is unavailable
  }

  sidecarApp.sendMessage(sessionId, messageContent, {
    title,
    ...(projectId ? { projectId } : {}),
  });
}

export function buildRunnerHtml(params = {}) {
  const buildId = params.buildId ? String(params.buildId) : '';
  const runnerId = Number.parseInt(String(params.runnerId || '1'), 10) || 1;
  const demoMode =
    params.demo === '1' || params.demo === 'true' || params.demo === true;
  const initialMuted =
    params.muted === '1' || params.muted === 'true' || params.muted === true;
  const captureIntervalMs =
    Number.parseInt(String(params.captureIntervalMs || '40'), 10) || 40;

  let wasmExecInline = '';
  if (!demoMode) {
    if (!buildId) {
      throw createHttpError('Missing "buildId" query parameter for /api/playtest/runner.', 400);
    }
    resolveCompiledWasm(buildId);
    const wasmExecPath = resolveWasmExecJsPath();
    wasmExecInline = fs
      .readFileSync(wasmExecPath, 'utf-8')
      .replace(/<\/script/gi, '<\\/script');
  }

  const tokenSuffix = params.token ? `&token=${encodeURIComponent(String(params.token))}` : '';
  const wasmBinaryUrl = demoMode
    ? ''
    : `/api/playtest/wasm?buildId=${encodeURIComponent(buildId)}${tokenSuffix}`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Ebitengine Playtest Runner</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      height: 100%;
      background: #090D16;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      user-select: none;
    }
    canvas {
      display: block;
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      image-rendering: pixelated;
      outline: none;
    }
  </style>
</head>
<body tabindex="0">
  <script>
    (function() {
      const runnerId = ${JSON.stringify(runnerId)};
      const demoMode = ${JSON.stringify(demoMode)};
      const wasmBinaryUrl = ${JSON.stringify(wasmBinaryUrl)};
      let captureIntervalMs = ${JSON.stringify(captureIntervalMs)};
      let lastCaptureTimeMs = -Infinity;
      let isMuted = ${JSON.stringify(initialMuted)};

      function postToParent(payload) {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(
            Object.assign({ source: 'playtest-runner-child', runnerId: runnerId }, payload),
            '*'
          );
        }
      }

      window.__RUNNER_CONFIG__ = {
        runnerId: runnerId,
        demoMode: demoMode,
        wasmBinaryUrl: wasmBinaryUrl,
        postToParent: postToParent
      };

      // 1. WebGL preserveDrawingBuffer: true Shim
      const origGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, attrs) {
        if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
          attrs = Object.assign({}, attrs || {}, { preserveDrawingBuffer: true });
          window.__ACTIVE_GAME_CANVAS__ = this;
        } else if (type === '2d' && !window.__ACTIVE_GAME_CANVAS__) {
          window.__ACTIVE_GAME_CANVAS__ = this;
        }
        return origGetContext.call(this, type, attrs);
      };

      // 2. WebAudio Context Tracker for Mute & Pause Support
      const audioContexts = [];
      const OrigAudioContext = window.AudioContext || window.webkitAudioContext;
      if (OrigAudioContext) {
        const WrappedAudioContext = function(...args) {
          const ctx = new OrigAudioContext(...args);
          audioContexts.push(ctx);
          if (isMuted || window.__PLAYTEST_PAUSED__) {
            ctx.suspend().catch(function() {});
          }
          return ctx;
        };
        WrappedAudioContext.prototype = OrigAudioContext.prototype;
        window.AudioContext = WrappedAudioContext;
        if (window.webkitAudioContext) {
          window.webkitAudioContext = WrappedAudioContext;
        }
      }

      function syncAudioState() {
        const shouldSuspend = isMuted || Boolean(window.__PLAYTEST_PAUSED__);
        for (let i = 0; i < audioContexts.length; i++) {
          const ctx = audioContexts[i];
          if (ctx.state === 'closed') continue;
          if (shouldSuspend && ctx.state === 'running') {
            ctx.suspend().catch(function() {});
          } else if (!shouldSuspend && ctx.state === 'suspended') {
            ctx.resume().catch(function() {});
          }
        }
      }

      // 3. Zero-Encoding GPU Blit Ring Buffer for 10s DVR (250 frames @ 25 FPS)
      const maxDvrSlots = 250;
      const dvrSlots = new Array(maxDvrSlots);
      let dvrWritePtr = 0;
      let dvrCount = 0;

      window.__PLAYTEST_GET_DVR_FRAMES__ = function() {
        if (dvrCount === 0) return [];
        const startSlot = dvrCount < maxDvrSlots ? 0 : dvrWritePtr;
        const out = new Array(dvrCount);
        for (let i = 0; i < dvrCount; i++) {
          out[i] = dvrSlots[(startSlot + i) % maxDvrSlots];
        }
        return out;
      };

      function captureFrameSnapshot(timestampMs, force) {
        if (!force && (timestampMs - lastCaptureTimeMs < captureIntervalMs)) {
          return;
        }
        const canvas = window.__ACTIVE_GAME_CANVAS__ || document.querySelector('canvas');
        if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
          return;
        }
        try {
          let slot = dvrSlots[dvrWritePtr];
          if (!slot) {
            const c = document.createElement('canvas');
            slot = {
              canvas: c,
              ctx: c.getContext('2d'),
              width: 0,
              height: 0,
              timestampMs: 0
            };
            dvrSlots[dvrWritePtr] = slot;
          }
          const maxW = 480;
          const scale = canvas.width > maxW ? maxW / canvas.width : 1;
          const targetW = Math.max(64, Math.round(canvas.width * scale));
          const targetH = Math.max(36, Math.round(canvas.height * scale));
          if (slot.width !== targetW || slot.height !== targetH) {
            slot.canvas.width = targetW;
            slot.canvas.height = targetH;
            slot.width = targetW;
            slot.height = targetH;
            if (slot.ctx) {
              slot.ctx.imageSmoothingEnabled = false;
            }
          }
          if (slot.ctx) {
            slot.ctx.clearRect(0, 0, targetW, targetH);
            slot.ctx.drawImage(canvas, 0, 0, targetW, targetH);
          }
          slot.timestampMs = timestampMs;
          dvrWritePtr = (dvrWritePtr + 1) % maxDvrSlots;
          if (dvrCount < maxDvrSlots) {
            dvrCount++;
          }
          lastCaptureTimeMs = timestampMs;
        } catch (err) {
          // Ignore transient canvas snapshot errors
        }
      }

      // 4. requestAnimationFrame Pause & DVR Hook
      window.__PLAYTEST_PAUSED__ = false;
      const pausedCallbacks = [];
      const origRAF = window.requestAnimationFrame.bind(window);

      window.requestAnimationFrame = function(callback) {
        return origRAF(function(timestamp) {
          if (window.__PLAYTEST_PAUSED__) {
            pausedCallbacks.push(callback);
            return;
          }
          callback(timestamp);
          captureFrameSnapshot(timestamp, false);
        });
      };

      // 5. Console & Go Panic Ring Buffer Hook
      function formatArgs(args) {
        return Array.from(args).map(function(a) {
          if (typeof a === 'string') return a;
          if (a instanceof Error) return a.stack || a.message;
          try { return JSON.stringify(a); } catch (e) { return String(a); }
        }).join(' ');
      }

      const origLog = console.log.bind(console);
      const origWarn = console.warn.bind(console);
      const origError = console.error.bind(console);

      console.log = function(...args) {
        origLog(...args);
        const text = formatArgs(args);
        postToParent({ type: 'LOG', level: 'log', text: text });
        if (text.startsWith('panic:') || text.includes('runtime error:')) {
          postToParent({ type: 'PANIC', message: text });
        }
      };

      console.warn = function(...args) {
        origWarn(...args);
        postToParent({ type: 'LOG', level: 'warn', text: formatArgs(args) });
      };

      console.error = function(...args) {
        origError(...args);
        const text = formatArgs(args);
        postToParent({ type: 'LOG', level: 'error', text: text });
        if (text.startsWith('panic:') || text.includes('runtime error:')) {
          postToParent({ type: 'PANIC', message: text });
        }
      };

      window.addEventListener('error', function(e) {
        const msg = e.error ? (e.error.stack || e.error.message) : e.message;
        postToParent({ type: 'PANIC', message: 'Uncaught WASM Error: ' + msg });
      });

      window.addEventListener('unhandledrejection', function(e) {
        const msg = e.reason ? (e.reason.stack || e.reason.message || String(e.reason)) : 'Unknown rejection';
        postToParent({ type: 'PANIC', message: 'Unhandled WASM Rejection: ' + msg });
      });

      // 6. Capture-Phase Hotkey & Scroll-Lock Listener
      window.addEventListener('keydown', function(e) {
        if (e.code === 'F8' || e.code === 'Backquote') {
          e.preventDefault();
          e.stopPropagation();
          captureFrameSnapshot(performance.now(), true);
          postToParent({ type: 'TOGGLE_PAUSE' });
          return;
        }
        if (
          e.code === 'Space' ||
          e.code === 'ArrowUp' ||
          e.code === 'ArrowDown' ||
          e.code === 'ArrowLeft' ||
          e.code === 'ArrowRight' ||
          e.code === 'Tab'
        ) {
          e.preventDefault();
        }
      }, { capture: true });

      // 7. Focus & Audio Unlock Tracking
      window.addEventListener('focus', function() {
        postToParent({ type: 'FOCUS_CHANGE', focused: true });
        syncAudioState();
      });
      window.addEventListener('blur', function() {
        postToParent({ type: 'FOCUS_CHANGE', focused: false });
      });
      window.addEventListener('pointerdown', function() {
        window.focus();
        document.body.focus();
        const canvas = window.__ACTIVE_GAME_CANVAS__ || document.querySelector('canvas');
        if (canvas && typeof canvas.focus === 'function') {
          canvas.focus();
        }
        postToParent({ type: 'FOCUS_CHANGE', focused: true });
        syncAudioState();
      }, { capture: true });

      // 8. Parent Message Receiver
      window.addEventListener('message', function(event) {
        const msg = event.data;
        if (!msg || msg.source !== 'playtest-runner-parent' || msg.runnerId !== runnerId) {
          return;
        }

        if (msg.type === 'SET_PAUSED') {
          const nextPaused = Boolean(msg.paused);
          const wasPaused = Boolean(window.__PLAYTEST_PAUSED__);
          if (nextPaused && !wasPaused) {
            captureFrameSnapshot(performance.now(), true);
          }
          window.__PLAYTEST_PAUSED__ = nextPaused;
          syncAudioState();
          if (wasPaused && !nextPaused && pausedCallbacks.length > 0) {
            const pending = pausedCallbacks.splice(0, pausedCallbacks.length);
            origRAF(function(ts) {
              for (let i = 0; i < pending.length; i++) {
                pending[i](ts);
              }
              captureFrameSnapshot(ts, false);
            });
          }
          return;
        }

        if (msg.type === 'SET_MUTED') {
          isMuted = Boolean(msg.muted);
          syncAudioState();
          return;
        }

        if (msg.type === 'CAPTURE_NOW') {
          captureFrameSnapshot(performance.now(), true);
          return;
        }

        if (msg.type === 'DISPATCH_KEY') {
          const code = msg.code || 'Space';
          const key = msg.key || ' ';
          const type = msg.keyEventType || 'keydown';
          const keyCodeMap = {
            ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39,
            Space: 32, KeyW: 87, KeyA: 65, KeyS: 83, KeyD: 68,
            KeyZ: 90, KeyX: 88, Enter: 13
          };
          const keyCode = keyCodeMap[code] || key.toUpperCase().charCodeAt(0) || 0;
          const ev = new KeyboardEvent(type, {
            code: code,
            key: key,
            keyCode: keyCode,
            which: keyCode,
            bubbles: true,
            cancelable: true
          });
          const canvas = window.__ACTIVE_GAME_CANVAS__ || document.querySelector('canvas');
          if (canvas) {
            canvas.focus();
            canvas.dispatchEvent(ev);
          } else {
            window.dispatchEvent(ev);
          }
          return;
        }

        if (msg.type === 'FOCUS_GAME') {
          window.focus();
          document.body.focus();
          const canvas = window.__ACTIVE_GAME_CANVAS__ || document.querySelector('canvas');
          if (canvas && typeof canvas.focus === 'function') {
            canvas.focus();
          }
          postToParent({ type: 'FOCUS_CHANGE', focused: true });
          syncAudioState();
          return;
        }
      });
    })();
  </script>
  <script>
${wasmExecInline}
  </script>
  <script>
    (async function() {
      const cfg = window.__RUNNER_CONFIG__;
      if (!cfg) return;
      const postToParent = cfg.postToParent;

      if (cfg.demoMode) {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 360;
        document.body.appendChild(canvas);
        const ctx = canvas.getContext('2d');

        const keys = {};
        window.addEventListener('keydown', function(e) { keys[e.code] = true; });
        window.addEventListener('keyup', function(e) { keys[e.code] = false; });

        let playerX = 140;
        let playerY = 230;
        let velY = 0;
        let tick = 0;

        console.log('[Playtest Calibration Scene] Ready (640x360 @ 60fps). Use WASD/Arrows + Space.');
        postToParent({ type: 'READY' });

        function step() {
          tick++;
          const speed = 3.5;
          if (keys['ArrowLeft'] || keys['KeyA']) playerX = Math.max(24, playerX - speed);
          if (keys['ArrowRight'] || keys['KeyD']) playerX = Math.min(616, playerX + speed);
          if ((keys['Space'] || keys['ArrowUp'] || keys['KeyW'] || keys['KeyZ']) && playerY >= 230) {
            velY = -9.5;
          }
          playerY += velY;
          if (playerY < 230) {
            velY += 0.48;
          } else {
            playerY = 230;
            velY = 0;
          }

          ctx.fillStyle = '#0F172A';
          ctx.fillRect(0, 0, 640, 360);
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
          ctx.lineWidth = 1;
          for (let x = 0; x < 640; x += 32) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 360); ctx.stroke();
          }
          for (let y = 0; y < 360; y += 32) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(640, y); ctx.stroke();
          }

          ctx.fillStyle = '#1E293B';
          ctx.fillRect(0, 262, 640, 98);
          ctx.fillStyle = '#38BDF8';
          ctx.fillRect(0, 262, 640, 3);

          const obsX = 480 - ((tick * 2.4) % 420);
          ctx.fillStyle = '#F43F5E';
          ctx.fillRect(obsX, 230, 32, 32);
          ctx.strokeStyle = '#FACC15';
          ctx.strokeRect(obsX + 6, 224, 32, 32);

          ctx.fillStyle = '#22C55E';
          ctx.fillRect(playerX - 16, playerY - 32, 32, 32);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(playerX + 4, playerY - 24, 6, 6);

          ctx.fillStyle = '#E2E8F0';
          ctx.font = '600 13px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.fillText('EBITENGINE QA CALIBRATION LOOP | TICK #' + tick, 16, 26);
          ctx.fillStyle = '#94A3B8';
          ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.fillText('POS: (' + Math.round(playerX) + ', ' + Math.round(playerY) + ')  OBS_X: ' + Math.round(obsX), 16, 46);

          window.requestAnimationFrame(step);
        }
        window.requestAnimationFrame(step);
        return;
      }

      if (typeof window.Go !== 'function') {
        postToParent({
          type: 'PANIC',
          message: 'Go WASM runtime (window.Go) was not defined by wasm_exec.js.'
        });
        return;
      }

      try {
        const res = await fetch(cfg.wasmBinaryUrl, { cache: 'no-store' });
        if (!res.ok) {
          throw new Error('Failed to fetch WASM binary (HTTP ' + res.status + ')');
        }
        const wasmBytes = await res.arrayBuffer();
        const go = new window.Go();
        const result = await WebAssembly.instantiate(wasmBytes, go.importObject);
        postToParent({ type: 'READY' });
        await go.run(result.instance);
      } catch (err) {
        const errMsg = err instanceof Error ? (err.stack || err.message) : String(err);
        postToParent({
          type: 'PANIC',
          message: 'Failed to instantiate or run Go WASM binary: ' + errMsg
        });
      }
    })();
  </script>
</body>
</html>`;
}

export async function processSendToChat(body, sidecarApp = null) {
  const sessionId = body.session_id || body.sessionId || getActiveSessionId() || 'standalone';
  const { filename, note, consoleLogs, metadata, buildError, workspace, pkg } = body;
  const image = body.image ?? body.data;

  const sessionDir = resolveSessionBrainDir(sessionId);
  const realSessionDir = fs.realpathSync(sessionDir);

  if (filename !== undefined && filename !== null) {
    if (typeof filename !== 'string' || !SEND_TO_CHAT_FILENAME_REGEX.test(filename)) {
      throw createHttpError(
        `Invalid filename "${filename}" in send-to-chat request. Must match ${SEND_TO_CHAT_FILENAME_REGEX}.`,
        400
      );
    }
  }

  // Payload (B): Compiler build error
  if (typeof buildError === 'string' && buildError.trim().length > 0) {
    const metaObj = metadata && typeof metadata === 'object' ? metadata : {};
    const effectiveWorkspace = workspace || metaObj.workspace || getDefaultWorkspace();
    const effectivePkg = pkg || metaObj.pkg || metaObj.package || '.';

    const lines = [
      '### 🚨 Ebitengine WASM Build Error',
      '',
      `**Workspace**: \`${effectiveWorkspace}\` | **Package**: \`${effectivePkg}\``,
    ];

    if (typeof note === 'string' && note.trim()) {
      lines.push('', `**Note**: ${note.trim()}`);
    }

    lines.push('', '```text', buildError.trim(), '```');
    const messageContent = lines.join('\n');

    await deliverMessageToChat(
      sidecarApp,
      sessionId,
      'Playtest WASM Build Error',
      messageContent
    );

    return {
      success: true,
      mode: 'build-error',
    };
  }

  // Payload (C): Studio UI / DSL / Synthesis Error
  if (typeof body.studioError === 'string' && body.studioError.trim().length > 0) {
    const metaObj = metadata && typeof metadata === 'object' ? metadata : {};
    const effectiveWorkspace = workspace || metaObj.workspace || getDefaultWorkspace();
    const errorTitle =
      typeof body.errorTitle === 'string' && body.errorTitle.trim()
        ? body.errorTitle.trim()
        : 'Game Dev Studio Error';
    const activeTab = typeof metaObj.tab === 'string' && metaObj.tab.trim() ? metaObj.tab.trim() : '';
    const activeFile =
      typeof metaObj.filePath === 'string' && metaObj.filePath.trim()
        ? metaObj.filePath.trim()
        : '';

    const contextParts = [`**Workspace**: \`${effectiveWorkspace}\``];
    if (activeTab) contextParts.push(`**Tab**: \`${activeTab}\``);
    if (activeFile) contextParts.push(`**File**: \`${activeFile}\``);

    const lines = [
      `### ⚠️ Game Dev Studio Error: ${errorTitle}`,
      '',
      contextParts.join(' | '),
    ];

    if (typeof note === 'string' && note.trim()) {
      lines.push('', `**Note**: ${note.trim()}`);
    }

    lines.push('', '```text', body.studioError.trim(), '```');
    const messageContent = lines.join('\n');

    await deliverMessageToChat(
      sidecarApp,
      sessionId,
      `Studio Error: ${errorTitle}`,
      messageContent
    );

    return {
      success: true,
      mode: 'studio-error',
    };
  }

  // Payload (A): Annotated / clean screenshot
  if (image !== undefined && image !== null && image !== '') {
    if (typeof image !== 'string' || !image.trim()) {
      throw createHttpError('Invalid "image" data in send-to-chat request.', 400);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const finalFilename = filename || `playtest-bug-${timestamp}.png`;
    if (!SEND_TO_CHAT_FILENAME_REGEX.test(finalFilename)) {
      throw createHttpError(
        `Invalid filename "${finalFilename}" in send-to-chat request.`,
        400
      );
    }

    const resolvedPath = path.resolve(sessionDir, finalFilename);
    if (!resolvedPath.startsWith(sessionDir + path.sep)) {
      throw createHttpError(
        'Access denied: path traversal attempt in send-to-chat filename.',
        400
      );
    }

    const existingLstat = fs.lstatSync(resolvedPath, { throwIfNoEntry: false });
    if (existingLstat) {
      let realExisting;
      try {
        realExisting = fs.realpathSync(resolvedPath);
      } catch (err) {
        throw createHttpError(
          `Access denied: invalid existing symlink "${finalFilename}": ${err.message}`,
          400
        );
      }
      if (!realExisting.startsWith(realSessionDir + path.sep)) {
        throw createHttpError(
          'Access denied: target file symlink points outside session directory.',
          400
        );
      }
    }

    const rawBase64 = image.includes(',') ? image.split(',')[1] : image;
    const buffer = Buffer.from(rawBase64, 'base64');
    fs.writeFileSync(resolvedPath, buffer);

    const realWrittenPath = fs.realpathSync(resolvedPath);
    if (!realWrittenPath.startsWith(realSessionDir + path.sep)) {
      throw createHttpError(
        'Access denied: resolved file path escapes session directory.',
        400
      );
    }

    const metaObj = metadata && typeof metadata === 'object' ? metadata : {};
    const effectiveWorkspace = metaObj.workspace || workspace || getDefaultWorkspace();
    const effectivePkg = metaObj.pkg || metaObj.package || pkg || '.';
    const effectiveFrameOffset =
      metaObj.frameOffset ?? metaObj.timestamp ?? metaObj.frame ?? 'live';
    const effectiveResolution =
      metaObj.resolution ||
      (metaObj.width && metaObj.height ? `${metaObj.width}x${metaObj.height}` : 'canvas');

    const lines = [`![${finalFilename}](${resolvedPath})`];

    if (typeof note === 'string' && note.trim()) {
      lines.push('', `**Bug Note**: ${note.trim()}`);
    }

    lines.push(
      '',
      `**Workspace**: \`${effectiveWorkspace}\` | **Package**: \`${effectivePkg}\` | **Frame Offset**: \`${effectiveFrameOffset}\` | **Resolution**: \`${effectiveResolution}\``
    );

    let formattedLogs = '';
    if (Array.isArray(consoleLogs)) {
      formattedLogs = consoleLogs
        .map((entry) => (typeof entry === 'string' ? entry : JSON.stringify(entry)))
        .join('\n')
        .trim();
    } else if (typeof consoleLogs === 'string') {
      formattedLogs = consoleLogs.trim();
    }

    if (formattedLogs.length > 0) {
      lines.push('', '### Captured WASM Console / Stderr', '```text', formattedLogs, '```');
    }

    const messageContent = lines.join('\n');
    await deliverMessageToChat(
      sidecarApp,
      sessionId,
      `Playtest Bug: ${finalFilename}`,
      messageContent
    );

    return {
      success: true,
      mode: 'screenshot',
      filePath: resolvedPath,
      filename: finalFilename,
    };
  }

  throw createHttpError(
    'Missing "image" (screenshot) or "buildError" (compiler traceback) in send-to-chat request.',
    400
  );
}

/**
 * Registers all Playtest Studio pages and API routes onto an Antigravity `SidecarApp` instance
 * per the official `/ui-extension` specification.
 */
export function configureSidecarApp(app, ResponseClass) {
  const readDistText = (name) => {
    const filePath = path.join(distPath, name);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      throw createHttpError(
        `Built frontend asset "${name}" not found at "${filePath}". Run "npm run build" first.`,
        500
      );
    }
    return fs.readFileSync(filePath, 'utf-8');
  };

  const wrapApi = (handler) => async (data = {}) => {
    try {
      return await handler(data);
    } catch (err) {
      const status = err.statusCode || 500;
      return new ResponseClass(
        JSON.stringify({
          error: err.message,
          statusCode: status,
          ...(err.compilerOutput !== undefined ? { compilerOutput: err.compilerOutput } : {}),
          ...(err.workspace !== undefined ? { workspace: err.workspace } : {}),
          ...(err.pkg !== undefined ? { pkg: err.pkg } : {}),
          ...(err.exitCode !== undefined ? { exitCode: err.exitCode } : {}),
        }),
        {
          contentType: 'application/json; charset=utf-8',
          status,
        }
      );
    }
  };

  // Static Frontend Routes (re-read on every request per /ui-extension)
  const serveIndexPage = () =>
    new ResponseClass(readDistText('index.html'), {
      contentType: 'text/html; charset=utf-8',
      headers: { 'Cache-Control': 'no-store' },
    });

  app.page('/', serveIndexPage);
  app.page('/index.html', serveIndexPage);
  app.page('/playtest', serveIndexPage);
  app.page('/sound', serveIndexPage);
  app.page('/sprite', serveIndexPage);
  app.page(
    '/app.js',
    () =>
      new ResponseClass(readDistText('app.js'), {
        contentType: 'application/javascript; charset=utf-8',
        headers: { 'Cache-Control': 'no-store' },
      })
  );
  app.api(
    '/styles.css',
    wrapApi(
      () =>
        new ResponseClass(readDistText('styles.css'), {
          contentType: 'text/css; charset=utf-8',
          headers: { 'Cache-Control': 'no-store' },
        })
    ),
    'GET'
  );

  // Status & Health APIs
  app.api(
    '/api/status',
    wrapApi(() => ({
      status: 'ok',
      node: process.version,
      platform: `${os.platform()} ${os.release()}`,
      uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
      activeSessionId: getActiveSessionId(),
      defaultWorkspace: getDefaultWorkspace(),
    })),
    'GET'
  );

  app.api(
    '/api/health',
    wrapApi(() => {
      const cfg = getConfig();
      return {
        status: 'ok',
        port: activeServerPort || cfg.port,
        host: cfg.host,
        activeSessionId: getActiveSessionId(),
        defaultWorkspace: getDefaultWorkspace(),
      };
    }),
    'GET'
  );

  app.api(
    '/api/session/active',
    wrapApi(() => ({ sessionId: getActiveSessionId() })),
    'GET'
  );

  app.api(
    '/api/sessions',
    wrapApi(() => ({ sessions: getRecentSessions() })),
    'GET'
  );

  // Convert file:// workspace URIs with fileURLToPath from node:url per /ui-extension
  app.api(
    '/api/workspace/resolve',
    wrapApi((data) => resolveWorkspaceInfo(data.workspaceUri || data.workspace)),
    'POST'
  );

  // On-demand Go WASM compiler
  app.api(
    '/api/playtest/build',
    wrapApi((data) =>
      compileGoWasm({
        workspace: data.workspace,
        pkg: data.pkg,
      })
    ),
    'POST'
  );

  // Compiled WASM binary stream
  app.api(
    '/api/playtest/wasm',
    wrapApi((data) => {
      const record = resolveCompiledWasm(data.buildId);
      const buf = fs.readFileSync(record.wasmPath);
      return new ResponseClass(buf, {
        contentType: 'application/wasm',
        headers: {
          'Cache-Control': 'no-store',
        },
      });
    }),
    'GET'
  );

  // Go WASM JS runtime
  app.api(
    '/api/playtest/wasm_exec.js',
    wrapApi(() => {
      const wasmExecPath = resolveWasmExecJsPath();
      const content = fs.readFileSync(wasmExecPath, 'utf-8');
      return new ResponseClass(content, {
        contentType: 'application/javascript; charset=utf-8',
        headers: {
          'Cache-Control': 'no-store',
        },
      });
    }),
    'GET'
  );

  // Playtest Runner page
  app.api(
    '/api/playtest/runner',
    wrapApi((data) => {
      const runnerHtml = buildRunnerHtml(data);
      return new ResponseClass(runnerHtml, {
        contentType: 'text/html; charset=utf-8',
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    }),
    'GET'
  );

  // Send Bug / Build Error to active Antigravity conversation
  app.api(
    '/api/send-to-chat',
    wrapApi((data) => processSendToChat(data, app)),
    'POST'
  );

  // Sound Studio APIs (.music & .sfx live synthesis, presets, and validation)
  app.api(
    '/api/sound/files',
    wrapApi((data) => listSoundFiles({ workspace: data.workspace })),
    'GET'
  );
  app.api(
    '/api/sound/presets',
    wrapApi(() => getSoundPresets()),
    'GET'
  );
  app.api(
    '/api/sound/file/read',
    wrapApi((data) => readSoundFile({ filePath: data.filePath })),
    'POST'
  );
  app.api(
    '/api/sound/file/save',
    wrapApi((data) => saveSoundFile({ filePath: data.filePath, content: data.content })),
    'POST'
  );
  app.api(
    '/api/sound/synthesize',
    wrapApi((data) =>
      synthesizeSound({
        dsl: data.dsl,
        type: data.type,
        apple: Boolean(data.apple),
        soloTracks: Array.isArray(data.soloTracks) ? data.soloTracks : [],
        muteTracks: Array.isArray(data.muteTracks) ? data.muteTracks : [],
      })
    ),
    'POST'
  );
  app.api(
    '/api/sound/wav',
    wrapApi((data) => {
      const wavBuf = getSynthesizedWav(data.buildId);
      return new ResponseClass(wavBuf, {
        contentType: 'audio/wav',
        headers: {
          'Cache-Control': 'no-store',
        },
      });
    }),
    'GET'
  );
  app.api(
    '/api/sound/stems',
    wrapApi((data) => {
      const stemsBuf = getSynthesizedStems(data.buildId);
      return new ResponseClass(stemsBuf, {
        contentType: 'application/octet-stream',
        headers: {
          'Cache-Control': 'no-store',
        },
      });
    }),
    'GET'
  );
  app.api(
    '/api/sound/export',
    wrapApi((data) =>
      exportSoundWav({
        dsl: data.dsl,
        type: data.type,
        apple: Boolean(data.apple),
        soloTracks: Array.isArray(data.soloTracks) ? data.soloTracks : [],
        muteTracks: Array.isArray(data.muteTracks) ? data.muteTracks : [],
        outputPath: data.outputPath,
        filePath: data.filePath,
      })
    ),
    'POST'
  );

  // Sprite Studio APIs (.sprite DSL compilation, .png/.json sprite sheet inspection, and AI grid normalization)
  app.api(
    '/api/sprite/files',
    wrapApi((data) => listSpriteFiles({ workspace: data.workspace })),
    'GET'
  );
  app.api(
    '/api/sprite/presets',
    wrapApi(() => getSpritePresets()),
    'GET'
  );
  app.api(
    '/api/sprite/inspect',
    wrapApi((data) =>
      inspectSpriteSheet({
        filePath: data.filePath,
        frameWidth: data.frameWidth,
        frameHeight: data.frameHeight,
        cols: data.cols,
        rows: data.rows,
      })
    ),
    'POST'
  );
  app.api(
    '/api/sprite/compile',
    wrapApi((data) =>
      compileSpriteDsl({
        dsl: data.dsl,
        preset: data.preset,
        filePath: data.filePath,
      })
    ),
    'POST'
  );
  app.api(
    '/api/sprite/normalize',
    wrapApi((data) =>
      normalizeSpriteSheetApi({
        filePath: data.filePath,
        filePaths: data.filePaths,
        frameWidth: data.frameWidth,
        frameHeight: data.frameHeight,
        cols: data.cols,
        rows: data.rows,
        center: data.center !== false,
        ground: data.ground !== false,
        pad: data.pad,
        tolerance: data.tolerance,
        tags: data.tags,
        outputPath: data.outputPath,
      })
    ),
    'POST'
  );
  app.api(
    '/api/sprite/png',
    wrapApi((data) => {
      const pngBuf = getSpriteSheetPng(data.sheetId, data.filePath);
      return new ResponseClass(pngBuf, {
        contentType: 'image/png',
        headers: {
          'Cache-Control': 'no-store',
        },
      });
    }),
    'GET'
  );
  app.api(
    '/api/sprite/file/read',
    wrapApi((data) => readSpriteDslFile({ filePath: data.filePath })),
    'POST'
  );
  app.api(
    '/api/sprite/file/save',
    wrapApi((data) => saveSpriteDslFile({ filePath: data.filePath, content: data.content })),
    'POST'
  );

  // Standardized Session Artifacts & Filesystem APIs
  app.api(
    '/api/artifacts',
    wrapApi((data) => handleGetArtifacts(data)),
    'GET'
  );
  app.api(
    '/api/artifact',
    wrapApi((data) => {
      const res = handleGetArtifact(data);
      if (data.format === 'json') {
        return {
          filename: res.filename,
          ext: res.ext,
          size: res.fileData.length,
          text: res.isText ? res.fileData.toString('utf-8') : undefined,
          base64: res.fileData.toString('base64'),
        };
      }
      return new ResponseClass(res.fileData, {
        contentType: res.contentType,
        status: 200,
        headers: res.headers,
      });
    }),
    'GET'
  );
  app.api(
    '/api/artifact',
    wrapApi((data) => handlePostArtifact(data)),
    'POST'
  );
  app.api(
    '/api/fs/info',
    wrapApi((data) => handleGetFsInfo(data)),
    'GET'
  );
  app.api(
    '/api/fs/list',
    wrapApi((data) => handleGetFsList(data)),
    'GET'
  );
  app.api(
    '/api/fs/save',
    wrapApi((data) => handlePostFsSave(data)),
    'POST'
  );
  app.api(
    '/api/fs/open',
    wrapApi((data) => {
      const res = handleGetFsOpen(data);
      if (data.format === 'json') {
        return {
          path: res.path,
          filePath: res.path,
          fileName: res.fileName,
          filename: res.fileName,
          ext: res.ext,
          size: res.fileData.length,
          text: res.isText ? res.fileData.toString('utf-8') : undefined,
          base64: res.fileData.toString('base64'),
        };
      }
      return new ResponseClass(res.fileData, {
        contentType: res.contentType,
        status: 200,
        headers: {
          'Cache-Control': 'no-cache',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }),
    'GET'
  );

  return app;
}

// Apply CORS and security headers on standalone HTTP responses (used in Vite dev & unit tests)
function applySecurityAndCorsHeaders(req, res) {
  const origin = req.headers?.origin;
  const isAllowedOrigin =
    !origin ||
    /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin) ||
    origin.startsWith('vscode-webview://') ||
    origin.startsWith('sidecar://');

  if (isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    if (origin) res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' data: blob:; frame-ancestors 'self' vscode-webview: sidecar:;"
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

// Standalone HTTP Request Handler (used by `vite dev` middleware and `tests/playtest-server.test.mjs`)
export async function handleRequest(req, res) {
  const startTime = Date.now();
  res.on('finish', () => {
    const elapsed = Date.now() - startTime;
    console.log(
      `[playtest-studio HTTP] ${new Date().toISOString()} ${req.method} ${req.url} -> ${res.statusCode} (${elapsed}ms)`
    );
  });

  if (typeof req.destroy === 'function' && res && typeof res.once === 'function') {
    const origDestroy = req.destroy.bind(req);
    req.destroy = (err) => {
      if (typeof req.pause === 'function') {
        req.pause();
      }
      if (!res.writableEnded) {
        res.setHeader('Connection', 'close');
        res.once('finish', () => origDestroy(err));
        return req;
      }
      return origDestroy(err);
    };
  }

  applySecurityAndCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let config;
  try {
    config = getConfig();
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: err.message }));
    return;
  }

  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
  const pathname = parsedUrl.pathname;
  const searchParams = parsedUrl.searchParams;

  try {
    if ((pathname === '/api/health' || pathname === '/api/status') && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          status: 'ok',
          port: activeServerPort || config.port,
          host: config.host,
          node: process.version,
          platform: `${os.platform()} ${os.release()}`,
          uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
          activeSessionId: getActiveSessionId(),
          defaultWorkspace: getDefaultWorkspace(),
        })
      );
      return;
    }

    if (pathname === '/api/session/active' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ sessionId: getActiveSessionId() }));
      return;
    }

    if (pathname === '/api/sessions' && req.method === 'GET') {
      const sessions = getRecentSessions();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ sessions }));
      return;
    }

    if (pathname === '/api/workspace/resolve' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const info = resolveWorkspaceInfo(body.workspaceUri || body.workspace);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(info));
      return;
    }

    if (pathname === '/api/playtest/build' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      try {
        const result = await compileGoWasm({
          workspace: body.workspace,
          pkg: body.pkg,
        });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (err) {
        if (err.statusCode === 422) {
          res.writeHead(422, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(
            JSON.stringify({
              error: err.message,
              compilerOutput: err.compilerOutput,
              workspace: err.workspace,
              pkg: err.pkg,
              exitCode: err.exitCode,
            })
          );
          return;
        }
        throw err;
      }
      return;
    }

    if (pathname === '/api/playtest/wasm' && (req.method === 'GET' || req.method === 'HEAD')) {
      const buildId = searchParams.get('buildId') || undefined;
      const record = resolveCompiledWasm(buildId);
      const stat = fs.statSync(record.wasmPath);

      res.writeHead(200, {
        'Content-Type': 'application/wasm',
        'Content-Length': stat.size,
        'Cache-Control': 'no-store',
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }

      const stream = fs.createReadStream(record.wasmPath);
      stream.on('error', (err) => {
        console.error('[playtest-studio] Error streaming wasm:', err);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        }
        if (!res.writableEnded) {
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      stream.pipe(res);
      return;
    }

    if (
      pathname === '/api/playtest/wasm_exec.js' &&
      (req.method === 'GET' || req.method === 'HEAD')
    ) {
      const wasmExecPath = resolveWasmExecJsPath();
      const stat = fs.statSync(wasmExecPath);

      res.writeHead(200, {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Content-Length': stat.size,
        'Cache-Control': 'no-store',
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }

      const stream = fs.createReadStream(wasmExecPath);
      stream.on('error', (err) => {
        console.error('[playtest-studio] Error streaming wasm_exec.js:', err);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        }
        if (!res.writableEnded) {
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      stream.pipe(res);
      return;
    }

    if (pathname === '/api/playtest/runner' && req.method === 'GET') {
      const queryObj = Object.fromEntries(searchParams.entries());
      const runnerHtml = buildRunnerHtml(queryObj);
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      });
      res.end(runnerHtml);
      return;
    }

    if (pathname === '/api/send-to-chat' && req.method === 'POST') {
      const body = await parseJsonBody(req, MAX_CHAT_BODY_BYTES);
      const result = await processSendToChat(body, null);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    }

    if (pathname === '/api/sound/files' && req.method === 'GET') {
      const workspace = searchParams.get('workspace') || undefined;
      const result = await listSoundFiles({ workspace });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    }

    if (pathname === '/api/sound/presets' && req.method === 'GET') {
      const result = await getSoundPresets();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    }

    if (pathname === '/api/sound/file/read' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await readSoundFile({ filePath: body.filePath });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    }

    if (pathname === '/api/sound/file/save' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await saveSoundFile({ filePath: body.filePath, content: body.content });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    }

    if (pathname === '/api/sound/synthesize' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await synthesizeSound({
        dsl: body.dsl,
        type: body.type,
        apple: Boolean(body.apple),
        soloTracks: Array.isArray(body.soloTracks) ? body.soloTracks : [],
        muteTracks: Array.isArray(body.muteTracks) ? body.muteTracks : [],
      });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    }

    if (pathname === '/api/sound/wav' && (req.method === 'GET' || req.method === 'HEAD')) {
      const buildId = searchParams.get('buildId') || undefined;
      const wavBuf = getSynthesizedWav(buildId);
      res.writeHead(200, {
        'Content-Type': 'audio/wav',
        'Content-Length': wavBuf.length,
        'Cache-Control': 'no-store',
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      res.end(wavBuf);
      return;
    }

    if (pathname === '/api/sound/stems' && (req.method === 'GET' || req.method === 'HEAD')) {
      const buildId = searchParams.get('buildId') || undefined;
      const stemsBuf = getSynthesizedStems(buildId);
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': stemsBuf.length,
        'Cache-Control': 'no-store',
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      res.end(stemsBuf);
      return;
    }

    if (pathname === '/api/sound/export' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await exportSoundWav({
        dsl: body.dsl,
        type: body.type,
        apple: Boolean(body.apple),
        soloTracks: Array.isArray(body.soloTracks) ? body.soloTracks : [],
        muteTracks: Array.isArray(body.muteTracks) ? body.muteTracks : [],
        outputPath: body.outputPath,
        filePath: body.filePath,
      });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    }

    if (pathname === '/api/sprite/files' && req.method === 'GET') {
      const workspace = searchParams.get('workspace') || undefined;
      const result = await listSpriteFiles({ workspace });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    }

    if (pathname === '/api/sprite/presets' && req.method === 'GET') {
      const result = await getSpritePresets();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    }

    if (pathname === '/api/sprite/inspect' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await inspectSpriteSheet({
        filePath: body.filePath,
        frameWidth: body.frameWidth,
        frameHeight: body.frameHeight,
        cols: body.cols,
        rows: body.rows,
      });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    }

    if (pathname === '/api/sprite/compile' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await compileSpriteDsl({
        dsl: body.dsl,
        preset: body.preset,
        filePath: body.filePath,
      });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    }

    if (pathname === '/api/sprite/normalize' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await normalizeSpriteSheetApi({
        filePath: body.filePath,
        filePaths: body.filePaths,
        frameWidth: body.frameWidth,
        frameHeight: body.frameHeight,
        cols: body.cols,
        rows: body.rows,
        center: body.center !== false,
        ground: body.ground !== false,
        pad: body.pad,
        tolerance: body.tolerance,
        tags: body.tags,
        outputPath: body.outputPath,
      });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    }

    if (pathname === '/api/sprite/png' && (req.method === 'GET' || req.method === 'HEAD')) {
      const sheetId = searchParams.get('sheetId') || undefined;
      const filePath = searchParams.get('filePath') || undefined;
      const pngBuf = getSpriteSheetPng(sheetId, filePath);
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': pngBuf.length,
        'Cache-Control': 'no-store',
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      res.end(pngBuf);
      return;
    }

    if (pathname === '/api/sprite/file/read' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await readSpriteDslFile({ filePath: body.filePath });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    }

    if (pathname === '/api/sprite/file/save' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await saveSpriteDslFile({ filePath: body.filePath, content: body.content });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    }

    if (pathname === '/api/artifacts' && req.method === 'GET') {
      const queryObj = Object.fromEntries(searchParams.entries());
      const result = handleGetArtifacts(queryObj);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    }

    if (pathname === '/api/artifact' && req.method === 'GET') {
      const queryObj = Object.fromEntries(searchParams.entries());
      const result = handleGetArtifact(queryObj);
      if (queryObj.format === 'json') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            filename: result.filename,
            ext: result.ext,
            size: result.fileData.length,
            text: result.isText ? result.fileData.toString('utf-8') : undefined,
            base64: result.fileData.toString('base64'),
          })
        );
        return;
      }
      res.writeHead(200, {
        ...result.headers,
        'Content-Type': result.contentType,
        'Content-Length': result.fileData.length,
      });
      res.end(result.fileData);
      return;
    }

    if (pathname === '/api/artifact' && req.method === 'POST') {
      const body = await parseJsonBody(req, MAX_CHAT_BODY_BYTES);
      const result = handlePostArtifact(body);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    }

    if (pathname === '/api/fs/info' && req.method === 'GET') {
      const queryObj = Object.fromEntries(searchParams.entries());
      const result = handleGetFsInfo(queryObj);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    }

    if (pathname === '/api/fs/list' && req.method === 'GET') {
      const queryObj = Object.fromEntries(searchParams.entries());
      const result = handleGetFsList(queryObj);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    }

    if (pathname === '/api/fs/save' && req.method === 'POST') {
      const body = await parseJsonBody(req, MAX_CHAT_BODY_BYTES);
      const result = handlePostFsSave(body);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    }

    if (pathname === '/api/fs/open' && req.method === 'GET') {
      const queryObj = Object.fromEntries(searchParams.entries());
      const result = handleGetFsOpen(queryObj);
      if (queryObj.format === 'json') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            path: result.path,
            filePath: result.path,
            fileName: result.fileName,
            filename: result.fileName,
            ext: result.ext,
            size: result.fileData.length,
            text: result.isText ? result.fileData.toString('utf-8') : undefined,
            base64: result.fileData.toString('base64'),
          })
        );
        return;
      }
      res.writeHead(200, {
        'Content-Type': result.contentType,
        'Content-Length': result.fileData.length,
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(result.fileData);
      return;
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      if (
        pathname === '/' ||
        pathname === '/index.html' ||
        pathname === '/playtest' ||
        pathname === '/sound' ||
        pathname === '/sprite'
      ) {
        const indexPath = path.join(distPath, 'index.html');
        if (!fs.existsSync(indexPath) || !fs.statSync(indexPath).isFile()) {
          throw createHttpError(
            `Built frontend index.html not found at "${indexPath}". Run "npm run build" first.`,
            500
          );
        }
        const content = fs.readFileSync(indexPath);
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': content.length,
          'Cache-Control': 'no-cache',
        });
        if (req.method === 'HEAD') {
          res.end();
          return;
        }
        res.end(content);
        return;
      }

      if (!pathname.startsWith('/api/') && !pathname.includes('\0') && !pathname.includes('..')) {
        const staticFilePath = path.resolve(distPath, '.' + pathname);
        if (
          staticFilePath.startsWith(distPath + path.sep) &&
          fs.existsSync(staticFilePath) &&
          fs.statSync(staticFilePath).isFile()
        ) {
          const realDist = fs.realpathSync(distPath);
          const realStatic = fs.realpathSync(staticFilePath);
          if (realStatic.startsWith(realDist + path.sep)) {
            const ext = path.extname(realStatic).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';
            const content = fs.readFileSync(realStatic);
            const headers = {
              'Content-Type': contentType,
              'Content-Length': content.length,
              'X-Content-Type-Options': 'nosniff',
            };
            if (ext === '.svg') {
              headers['Content-Security-Policy'] = "default-src 'none'; sandbox";
            }
            res.writeHead(200, headers);
            if (req.method === 'HEAD') {
              res.end();
              return;
            }
            res.end(content);
            return;
          }
        }
      }
    }

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        error: `Resource not found: ${req.method} ${pathname}`,
        pathname,
        statusCode: 404,
      })
    );
  } catch (err) {
    console.error(`[playtest-studio] Error processing ${req.method} ${pathname}:`, err);
    const statusCode = err.statusCode || 500;
    if (!res.headersSent) {
      res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    }
    if (!res.writableEnded) {
      res.end(JSON.stringify({ error: err.message, statusCode }));
    }
  }
}

export function createStudioServer() {
  const srv = http.createServer(handleRequest);
  srv.on('listening', () => {
    const addr = srv.address();
    if (addr && typeof addr === 'object' && addr.port) {
      activeServerPort = addr.port;
    }
  });
  srv.on('close', () => {
    activeServerPort = null;
  });
  return srv;
}

export function startServer(options = {}) {
  const config = getConfig();
  const requestedPort =
    typeof options === 'number'
      ? options
      : options.port !== undefined
      ? options.port
      : config.port;
  const requestedHost =
    (typeof options === 'object' && options !== null && options.host) || config.host || '127.0.0.1';

  const srv = createStudioServer();
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      console.error(`[playtest-studio] Server error on port ${requestedPort}:`, err);
      reject(err);
    };
    srv.once('error', onError);
    srv.listen(requestedPort, requestedHost, () => {
      srv.removeListener('error', onError);
      const addr = srv.address();
      const boundPort = addr && typeof addr === 'object' ? addr.port : requestedPort;
      activeServerPort = boundPort;
      srv.port = boundPort;
      srv.host = requestedHost;
      srv.server = srv;
      console.log(`[playtest-studio sidecar] Listening on http://${requestedHost}:${boundPort}`);
      resolve(srv);
    });
  });
}
