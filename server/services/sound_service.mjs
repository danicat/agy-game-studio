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

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const MUSIC_SCRIPTS_DIR = path.join(REPO_ROOT, 'skills', 'procedural-music', 'scripts');
const SFX_SCRIPTS_DIR = path.join(REPO_ROOT, 'skills', 'procedural-sfx', 'scripts');

const uid = typeof process.getuid === 'function' ? process.getuid() : 'default';
const SOUND_CACHE_DIR = path.join(os.tmpdir(), `agy-sound-studio-cache-${uid}`);
fs.mkdirSync(SOUND_CACHE_DIR, { recursive: true, mode: 0o700 });
const MAX_LRU_ENTRIES = 25;

// In-memory LRU map: buildId -> { buildId, wavBuffer, report, createdAt }
const wavCache = new Map();
let latestBuildId = null;

// Track compilation state per engine ('music' | 'sfx')
const binaryState = {
  music: { binPath: null, maxMtimeMs: 0, compilingPromise: null },
  sfx: { binPath: null, maxMtimeMs: 0, compilingPromise: null },
};

let cachedPresets = null;

function createSoundError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

function normalizeInputPath(inputPath, label = 'filePath') {
  if (!inputPath || typeof inputPath !== 'string' || !inputPath.trim()) {
    throw createSoundError(`Missing or empty "${label}".`, 400);
  }
  const trimmed = inputPath.trim();
  if (trimmed.includes('\0')) {
    throw createSoundError(`Invalid "${label}": null byte detected.`, 400);
  }
  if (trimmed.startsWith('file://')) {
    try {
      return path.resolve(fileURLToPath(trimmed));
    } catch (err) {
      throw createSoundError(`Invalid file:// URI "${trimmed}": ${err.message}`, 400);
    }
  }
  return path.resolve(trimmed);
}

/**
 * Computes the maximum mtimeMs of all non-test .go files in a directory.
 */
function getGoSourcesMaxMtimeMs(dirPath) {
  if (!fs.existsSync(dirPath)) {
    throw createSoundError(`Go scripts directory not found: "${dirPath}"`, 500);
  }
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  let maxMtime = 0;
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.go') && !entry.name.endsWith('_test.go')) {
      const stat = fs.statSync(path.join(dirPath, entry.name));
      if (stat.mtimeMs > maxMtime) {
        maxMtime = stat.mtimeMs;
      }
    }
  }
  return maxMtime;
}

/**
 * Ensures the Go CLI binary for 'music' or 'sfx' is compiled and up to date with source .go mtimes.
 */
export async function ensureCliBinary(kind) {
  const isMusic = kind === 'music';
  const scriptsDir = isMusic ? MUSIC_SCRIPTS_DIR : SFX_SCRIPTS_DIR;
  const binName = isMusic ? 'music-cli' : 'sfx-cli';
  const targetBinPath = path.join(SOUND_CACHE_DIR, binName);
  const state = isMusic ? binaryState.music : binaryState.sfx;

  const currentMaxMtime = getGoSourcesMaxMtimeMs(scriptsDir);
  if (
    state.binPath === targetBinPath &&
    state.maxMtimeMs === currentMaxMtime &&
    fs.existsSync(targetBinPath)
  ) {
    return targetBinPath;
  }

  // Also check if binary already exists on disk from a previous process and is newer than all .go sources
  if (fs.existsSync(targetBinPath)) {
    try {
      const binStat = fs.statSync(targetBinPath);
      const isOwner = typeof process.getuid !== 'function' || binStat.uid === process.getuid();
      if (isOwner && binStat.isFile() && binStat.size > 0 && binStat.mtimeMs >= currentMaxMtime) {
        state.binPath = targetBinPath;
        state.maxMtimeMs = currentMaxMtime;
        return targetBinPath;
      }
    } catch {
      // Proceed to compile
    }
  }

  if (state.compilingPromise) {
    return state.compilingPromise;
  }

  state.compilingPromise = (async () => {
    fs.mkdirSync(SOUND_CACHE_DIR, { recursive: true });
    const tempBinPath = `${targetBinPath}.${process.pid}.${Date.now()}.tmp`;

    await new Promise((resolve, reject) => {
      const proc = spawn('go', ['build', '-o', tempBinPath, '.'], {
        cwd: scriptsDir,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';
      let stdout = '';
      proc.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      proc.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      proc.on('error', (err) => {
        reject(createSoundError(`Failed to spawn "go build" for ${binName}: ${err.message}`, 500));
      });
      proc.on('close', (code) => {
        if (code !== 0) {
          reject(
            createSoundError(
              `Failed to compile ${binName} (exit ${code}): ${(stderr || stdout).trim()}`,
              500
            )
          );
          return;
        }
        resolve();
      });
    });

    fs.renameSync(tempBinPath, targetBinPath);
    state.binPath = targetBinPath;
    state.maxMtimeMs = currentMaxMtime;
    return targetBinPath;
  })().finally(() => {
    state.compilingPromise = null;
  });

  return state.compilingPromise;
}

/**
 * Executes a compiled CLI binary and returns { code, stdout, stderr }.
 */
function execCli(binPath, args, { cwd, timeoutMs = 60_000 } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(binPath, args, {
      cwd: cwd || SOUND_CACHE_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGKILL');
      reject(createSoundError(`Sound CLI timed out after ${timeoutMs}ms`, 504));
    }, timeoutMs);

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      if (!timedOut) {
        reject(createSoundError(`Failed to execute sound CLI "${binPath}": ${err.message}`, 500));
      }
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (!timedOut) {
        resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() });
      }
    });
  });
}

const TOP_LEVEL_DIRECTIVES = new Set([
  'title',
  'type',
  'synth',
  'engine',
  'bpm',
  'tempo',
  'time',
  'filter',
  'bitcrush',
  'loop',
  'inst',
  'patch',
  'pattern',
  'track',
  'seq',
  'step',
]);

function stripComment(line) {
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (ch === '#' && (i === 0 || line[i - 1] === ' ' || line[i - 1] === '\t')) {
        return line.slice(0, i);
      }
      if (ch === '/' && i + 1 < line.length && line[i + 1] === '/') {
        return line.slice(0, i);
      }
    }
  }
  return line;
}

/**
 * Extracts basic metadata (title, type) from DSL source text.
 */
export function inspectDslHeader(dslText, fallbackPath = '') {
  let title = '';
  let detectedType = '';
  let hasStepOrSeq = false;

  const lines = String(dslText || '').split('\n');
  for (const raw of lines) {
    const cleaned = stripComment(raw).trim();
    if (!cleaned) continue;
    const match = cleaned.match(/^([a-zA-Z_:]+)(?:\s+(.*))?$/);
    if (!match) continue;
    let kw = match[1].toLowerCase();
    let rest = (match[2] || '').trim();
    if (kw.startsWith('seq:')) {
      hasStepOrSeq = true;
      continue;
    }
    if (kw === 'seq' || kw === 'step') {
      hasStepOrSeq = true;
    } else if (kw === 'title' && rest && !title) {
      title = rest.replace(/^["']|["']$/g, '');
    } else if (kw === 'type' && rest && !detectedType) {
      const val = rest.replace(/^["']|["']$/g, '').toLowerCase();
      if (val === 'sfx') detectedType = 'sfx';
      else if (val === 'song' || val === 'music') detectedType = 'music';
    }
  }

  if (!detectedType && fallbackPath) {
    if (fallbackPath.toLowerCase().endsWith('.sfx')) {
      detectedType = 'sfx';
    } else if (fallbackPath.toLowerCase().endsWith('.music')) {
      detectedType = 'music';
    }
  }
  if (!detectedType) {
    detectedType = hasStepOrSeq ? 'sfx' : 'music';
  }
  if (!title && fallbackPath) {
    title = path.basename(fallbackPath, path.extname(fallbackPath));
  }
  return { title: title || 'Untitled', type: detectedType };
}

const WAVE_ARCHETYPE_DEFAULTS = {
  ym2612_guitar: { volume: 0.16, pan: -0.12 },
  ym2612_rhythm_guitar: { volume: 0.10, pan: 0.36 },
  ym2612_bell: { volume: 0.06, pan: 0.25 },
  ym2612_epiano: { volume: 0.13, pan: -0.24 },
  ym2612_brass: { volume: 0.12, pan: 0.20 },
  ym2612_strings: { volume: 0.10, pan: -0.30 },
  ym2612_choir: { volume: 0.10, pan: -0.30 },
  ym2612_flute: { volume: 0.12, pan: -0.15 },
  psg_arp: { volume: 0.072, pan: -0.44 },
  psg_square: { volume: 0.05, pan: 0.48 },
  ym2612_bass: { volume: 0.24, pan: 0.0 },
  ym2612_slap_bass: { volume: 0.25, pan: 0.0 },
  sub_bass: { volume: 0.22, pan: 0.0 },
  kick: { volume: 0.19, pan: 0.0 },
  ym2612_kick: { volume: 0.19, pan: 0.0 },
  snare: { volume: 0.14, pan: 0.08 },
  ym2612_snare: { volume: 0.14, pan: 0.08 },
  tom: { volume: 0.14, pan: 0.0 },
  ym2612_tom: { volume: 0.14, pan: 0.0 },
  hat: { volume: 0.08, pan: -0.15 },
  ym2612_hat: { volume: 0.08, pan: -0.15 },
  open_hat: { volume: 0.09, pan: -0.15 },
  ym2612_open_hat: { volume: 0.09, pan: -0.15 },
  crash: { volume: 0.11, pan: 0.20 },
  ym2612_crash: { volume: 0.11, pan: 0.20 },
};

/**
 * Parses declared track names and their default instruments from raw DSL text so UI track lists
 * remain complete even when soloTracks/muteTracks filter out tracks during synthesis.
 */
function parseDeclaredTracksFromDsl(dslText) {
  const instMap = new Map([
    ['kick', { waveType: 'kick', volume: 0.19, pan: 0.0 }],
    ['snare', { waveType: 'snare', volume: 0.14, pan: 0.08 }],
    ['tom_hi', { waveType: 'tom', volume: 0.14, pan: -0.25 }],
    ['tom_mid', { waveType: 'tom', volume: 0.14, pan: 0.0 }],
    ['tom_low', { waveType: 'tom', volume: 0.14, pan: 0.25 }],
    ['hat', { waveType: 'ym2612_hat', volume: 0.08, pan: -0.15 }],
    ['open_hat', { waveType: 'ym2612_open_hat', volume: 0.09, pan: -0.15 }],
    ['crash', { waveType: 'crash', volume: 0.11, pan: 0.20 }],
  ]);
  const tracks = [];
  const trackByName = new Map();

  const lines = String(dslText || '').split('\n');
  for (const raw of lines) {
    const cleaned = stripComment(raw).trim();
    if (!cleaned) continue;
    const spaceIdx = cleaned.search(/\s/);
    const firstWord = spaceIdx === -1 ? cleaned : cleaned.slice(0, spaceIdx);
    const remainder = spaceIdx === -1 ? '' : cleaned.slice(spaceIdx + 1).trim();
    const lower = firstWord.toLowerCase();

    if (lower === 'inst' || lower === 'patch') {
      const sp = remainder.search(/\s/);
      if (sp !== -1) {
        const instName = remainder.slice(0, sp).trim();
        const attrs = remainder.slice(sp + 1).trim();
        const waveMatch = attrs.match(/\b(?:wave|wave_type|preset)=([^\s]+)/i);
        const waveType = waveMatch ? waveMatch[1] : 'sine';
        const arch = WAVE_ARCHETYPE_DEFAULTS[waveType] || { volume: 0.2, pan: 0.0 };
        const volMatch = attrs.match(/\b(?:vol|volume)=([0-9.]+)/i);
        const panMatch = attrs.match(/\bpan=([-+0-9.]+)/i);
        instMap.set(instName, {
          waveType,
          volume: volMatch ? Number(volMatch[1]) : arch.volume,
          pan: panMatch ? Number(panMatch[1]) : arch.pan,
        });
      }
    } else if (lower === 'track') {
      const colonIdx = remainder.indexOf(':');
      if (colonIdx !== -1) {
        const headerParts = remainder.slice(0, colonIdx).trim().split(/\s+/);
        const trackName = headerParts[0];
        const isDrumName = trackName && /drum|perc|toms/i.test(trackName);
        const defaultInst = headerParts[1] || (isDrumName ? 'kick' : '');
        if (trackName && !trackByName.has(trackName)) {
          const instInfo =
            instMap.get(defaultInst) ||
            (isDrumName
              ? { waveType: 'kick', volume: 0.19, pan: 0.0 }
              : { waveType: 'sine', volume: 0.2, pan: 0.0 });
          const tr = {
            name: trackName,
            defaultInst,
            waveType: instInfo.waveType,
            volume: instInfo.volume,
            pan: instInfo.pan,
            eventCount: 1,
          };
          trackByName.set(trackName, tr);
          tracks.push(tr);
        }
      }
    } else if (lower === 'seq' || lower.startsWith('seq:')) {
      if (!trackByName.has('seq')) {
        const tr = {
          name: 'seq',
          defaultInst: '',
          waveType: 'square',
          volume: 0.25,
          pan: 0.0,
          eventCount: 1,
        };
        trackByName.set('seq', tr);
        tracks.push(tr);
      }
    } else if (lower === 'step') {
      if (!trackByName.has('_steps')) {
        const waveMatch = remainder.match(/\b(?:wave|wave_type|preset)=([^\s]+)/i);
        const volMatch = remainder.match(/\b(?:vol|volume)=([0-9.]+)/i);
        const panMatch = remainder.match(/\bpan=([-+0-9.]+)/i);
        const tr = {
          name: '_steps',
          defaultInst: '_step',
          waveType: waveMatch ? waveMatch[1] : 'square',
          volume: volMatch ? Number(volMatch[1]) : 0.25,
          pan: panMatch ? Number(panMatch[1]) : 0.0,
          eventCount: 1,
        };
        trackByName.set('_steps', tr);
        tracks.push(tr);
      }
    }
  }
  return tracks;
}

/**
 * Filters or comments out muted / non-soloed tracks in a `.music` or `.sfx` DSL string.
 * Preserves line numbers so any DSL error messages still report exact line numbers!
 */
export function filterDslTracks(dsl, { soloTracks = [], muteTracks = [] } = {}) {
  const dslText = String(dsl || '');
  const soloList = Array.isArray(soloTracks) ? soloTracks.map((s) => String(s).trim()).filter(Boolean) : [];
  const muteList = Array.isArray(muteTracks) ? muteTracks.map((s) => String(s).trim()).filter(Boolean) : [];

  if (soloList.length === 0 && muteList.length === 0) {
    return dslText;
  }

  const soloSet = new Set(soloList);
  const muteSet = new Set(muteList);

  const shouldMuteTrack = (name) => {
    if (soloSet.size > 0 && !soloSet.has(name)) {
      return true;
    }
    if (muteSet.has(name)) {
      return true;
    }
    return false;
  };

  const lines = dslText.split('\n');
  const outLines = [];
  let currentDirective = '';
  let currentTrackMuted = false;
  let keptPlayableCount = 0;

  for (const rawLine of lines) {
    const cleaned = stripComment(rawLine).trim();
    if (!cleaned) {
      outLines.push(rawLine);
      continue;
    }

    const spaceIdx = cleaned.search(/\s/);
    const firstWord = spaceIdx === -1 ? cleaned : cleaned.slice(0, spaceIdx);
    const remainder = spaceIdx === -1 ? '' : cleaned.slice(spaceIdx + 1).trim();
    let lowerWord = firstWord.toLowerCase();
    if (lowerWord.startsWith('seq:')) {
      lowerWord = 'seq';
    }

    if (TOP_LEVEL_DIRECTIVES.has(lowerWord)) {
      currentDirective = lowerWord;
      if (lowerWord === 'track') {
        const colonIdx = remainder.indexOf(':');
        const headerText = colonIdx >= 0 ? remainder.slice(0, colonIdx) : remainder;
        const headerFields = headerText.trim().split(/\s+/);
        const trackName = headerFields[0] || '';
        currentTrackMuted = shouldMuteTrack(trackName);
        if (currentTrackMuted) {
          outLines.push(`# [muted] ${rawLine}`);
        } else {
          keptPlayableCount++;
          outLines.push(rawLine);
        }
      } else if (lowerWord === 'seq') {
        currentTrackMuted = shouldMuteTrack('seq');
        if (currentTrackMuted) {
          outLines.push(`# [muted] ${rawLine}`);
        } else {
          keptPlayableCount++;
          outLines.push(rawLine);
        }
      } else if (lowerWord === 'step') {
        currentTrackMuted = shouldMuteTrack('_steps') || shouldMuteTrack('step');
        if (currentTrackMuted) {
          outLines.push(`# [muted] ${rawLine}`);
        } else {
          keptPlayableCount++;
          outLines.push(rawLine);
        }
      } else {
        currentTrackMuted = false;
        outLines.push(rawLine);
      }
    } else {
      // Continuation line of pattern, track, or seq
      if ((currentDirective === 'track' || currentDirective === 'seq') && currentTrackMuted) {
        outLines.push(`# [muted] ${rawLine}`);
      } else {
        outLines.push(rawLine);
      }
    }
  }

  if (keptPlayableCount === 0) {
    outLines.push('inst _silent_placeholder wave=sine vol=0.01 adsr=0.001,0.01,0.0,0.01');
    outLines.push('track _muted _silent_placeholder: R:100ms');
  }

  return outLines.join('\n');
}

function scanLibraryDirectory(dirPath, expectedExt, typeLabel) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  const entries = fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(expectedExt))
    .sort((a, b) => a.name.localeCompare(b.name));

  return entries.map((entry) => {
    const fullPath = path.join(dirPath, entry.name);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const { title } = inspectDslHeader(content, fullPath);
    return {
      path: fullPath,
      filePath: fullPath,
      name: entry.name,
      fileName: entry.name,
      title,
      type: typeLabel,
    };
  });
}

function scanWorkspaceForSoundFiles(workspaceDir, maxDepth = 5) {
  const results = [];
  const skipDirs = new Set(['.git', 'node_modules', 'dist', '.next', 'build', 'coverage']);

  function walk(currentDir, depth) {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.') continue;
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) {
          walk(fullPath, depth + 1);
        }
      } else if (entry.isFile() && (entry.name.endsWith('.music') || entry.name.endsWith('.sfx'))) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const { title, type } = inspectDslHeader(content, fullPath);
          results.push({
            path: fullPath,
            filePath: fullPath,
            name: entry.name,
            fileName: entry.name,
            relativePath: path.relative(workspaceDir, fullPath),
            title,
            type,
          });
        } catch {
          // Ignore unreadable file
        }
      }
    }
  }

  walk(workspaceDir, 0);
  return results;
}

/**
 * 1. Lists all `.music` and `.sfx` files in `workspace` (up to depth 5), plus built-in library metadata.
 */
export async function listSoundFiles({ workspace } = {}) {
  const musicLibrary = scanLibraryDirectory(MUSIC_SCRIPTS_DIR, '.music', 'music');
  const sfxLibrary = scanLibraryDirectory(SFX_SCRIPTS_DIR, '.sfx', 'sfx');

  const rawWorkspace =
    workspace && typeof workspace === 'string' && workspace.trim()
      ? workspace.trim()
      : process.env.PLAYTEST_WORKSPACE && process.env.PLAYTEST_WORKSPACE.trim()
      ? process.env.PLAYTEST_WORKSPACE.trim()
      : REPO_ROOT;

  let workspaceFiles = [];
  try {
    const resolvedWorkspace = normalizeInputPath(rawWorkspace, 'workspace');
    if (fs.existsSync(resolvedWorkspace) && fs.statSync(resolvedWorkspace).isDirectory()) {
      workspaceFiles = scanWorkspaceForSoundFiles(resolvedWorkspace, 5);
    }
  } catch {
    workspaceFiles = [];
  }

  return {
    musicLibrary,
    sfxLibrary,
    workspaceFiles,
  };
}

/**
 * 2. Calls `presets-json` on both cached binaries and returns `{ sfxPresets, musicPresets }`.
 */
export async function getSoundPresets() {
  if (cachedPresets) {
    return cachedPresets;
  }

  const [sfxBin, musicBin] = await Promise.all([
    ensureCliBinary('sfx'),
    ensureCliBinary('music'),
  ]);

  const [sfxRes, musicRes] = await Promise.all([
    execCli(sfxBin, ['presets-json'], { cwd: SFX_SCRIPTS_DIR }),
    execCli(musicBin, ['presets-json'], { cwd: MUSIC_SCRIPTS_DIR }),
  ]);

  if (sfxRes.code !== 0) {
    throw createSoundError(`sfx-cli presets-json failed: ${sfxRes.stderr || sfxRes.stdout}`, 500);
  }
  if (musicRes.code !== 0) {
    throw createSoundError(`music-cli presets-json failed: ${musicRes.stderr || musicRes.stdout}`, 500);
  }

  let sfxPresets;
  let musicPresets;
  try {
    sfxPresets = JSON.parse(sfxRes.stdout);
  } catch (err) {
    throw createSoundError(`Failed to parse sfx-cli presets-json output: ${err.message}`, 500);
  }
  try {
    musicPresets = JSON.parse(musicRes.stdout);
  } catch (err) {
    throw createSoundError(`Failed to parse music-cli presets-json output: ${err.message}`, 500);
  }

  cachedPresets = { sfxPresets, musicPresets };
  return cachedPresets;
}

/**
 * 3. Reads a `.music` or `.sfx` file from disk, detects `type` (`music` vs `sfx`), and returns `{ filePath, fileName, type, content }`.
 */
export async function readSoundFile(input) {
  const rawPath = typeof input === 'string' ? input : input?.filePath;
  const resolvedPath = normalizeInputPath(rawPath, 'filePath');

  const ext = path.extname(resolvedPath).toLowerCase();
  if (ext !== '.music' && ext !== '.sfx') {
    throw createSoundError(
      `Unsupported sound file extension "${ext}" for "${resolvedPath}". Expected ".music" or ".sfx".`,
      400
    );
  }

  if (!fs.existsSync(resolvedPath)) {
    throw createSoundError(`Sound file does not exist: "${resolvedPath}".`, 404);
  }

  const stat = fs.statSync(resolvedPath);
  if (!stat.isFile()) {
    throw createSoundError(`Sound path is not a regular file: "${resolvedPath}".`, 400);
  }

  const content = fs.readFileSync(resolvedPath, 'utf-8');
  const { title, type } = inspectDslHeader(content, resolvedPath);

  return {
    filePath: resolvedPath,
    fileName: path.basename(resolvedPath),
    title,
    type: ext === '.sfx' ? 'sfx' : ext === '.music' ? 'music' : type,
    content,
  };
}

/**
 * 4. Writes `content` to `filePath` (must end in `.music` or `.sfx`) and returns `{ saved: true, filePath, bytes }`.
 */
export async function saveSoundFile({ filePath, content } = {}) {
  const resolvedPath = normalizeInputPath(filePath, 'filePath');
  const ext = path.extname(resolvedPath).toLowerCase();
  if (ext !== '.music' && ext !== '.sfx') {
    throw createSoundError(
      `Cannot save sound file "${resolvedPath}": extension must be ".music" or ".sfx".`,
      400
    );
  }
  if (typeof content !== 'string') {
    throw createSoundError('Missing or invalid "content" string for saveSoundFile.', 400);
  }

  const lstat = fs.lstatSync(resolvedPath, { throwIfNoEntry: false });
  if (lstat && lstat.isSymbolicLink()) {
    throw createSoundError(`Cannot overwrite symlink at "${resolvedPath}".`, 403);
  }

  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, content, 'utf-8');
  const bytes = Buffer.byteLength(content, 'utf-8');

  return {
    saved: true,
    filePath: resolvedPath,
    bytes,
  };
}

function storeWavInLruCache(buildId, entry) {
  if (wavCache.has(buildId)) {
    wavCache.delete(buildId);
  }
  wavCache.set(buildId, entry);
  latestBuildId = buildId;

  while (wavCache.size > MAX_LRU_ENTRIES) {
    const oldestKey = wavCache.keys().next().value;
    if (oldestKey === undefined) break;
    wavCache.delete(oldestKey);
  }

  // Keep large multi-track stemsBuffer only on the 3 most recent builds to bound memory usage
  const keys = Array.from(wavCache.keys());
  for (let i = 0; i < keys.length - 3; i++) {
    const oldEntry = wavCache.get(keys[i]);
    if (oldEntry && oldEntry.stemsBuffer) {
      oldEntry.stemsBuffer = null;
    }
  }
}

/**
 * 5. Synthesizes `.music` or `.sfx` DSL text using the pre-compiled Go binary, caches the WAV in an LRU map,
 * and returns `{ buildId, report, wavSizeBytes, wavUrl }`.
 */
export async function synthesizeSound({
  dsl,
  type,
  apple = false,
  soloTracks = [],
  muteTracks = [],
} = {}) {
  if (typeof dsl !== 'string') {
    throw createSoundError('Missing or invalid "dsl" string for synthesizeSound.', 400);
  }

  const headerInfo = inspectDslHeader(dsl);
  let resolvedType = headerInfo.type;
  if (typeof type === 'string' && type.trim()) {
    const lowerType = type.trim().toLowerCase();
    if (lowerType === 'sfx') resolvedType = 'sfx';
    else if (lowerType === 'music' || lowerType === 'song') resolvedType = 'music';
  }

  const isMusic = resolvedType === 'music';
  const binPath = await ensureCliBinary(isMusic ? 'music' : 'sfx');
  const scriptsDir = isMusic ? MUSIC_SCRIPTS_DIR : SFX_SCRIPTS_DIR;

  const filteredDsl = isMusic ? dsl : filterDslTracks(dsl, { soloTracks, muteTracks });
  const declaredTracks = parseDeclaredTracksFromDsl(dsl);

  fs.mkdirSync(SOUND_CACHE_DIR, { recursive: true });
  const buildId = crypto.randomUUID();
  const ext = isMusic ? '.music' : '.sfx';
  const tempDslPath = path.join(SOUND_CACHE_DIR, `${buildId}${ext}`);
  const tempWavPath = path.join(SOUND_CACHE_DIR, `${buildId}.wav`);
  const tempStemsPath = isMusic ? path.join(SOUND_CACHE_DIR, `${buildId}.stems`) : null;

  fs.writeFileSync(tempDslPath, filteredDsl, 'utf-8');

  try {
    const cliArgs = ['synth-json'];
    if (apple && isMusic) {
      cliArgs.push('-apple');
    }
    if (isMusic && Array.isArray(soloTracks) && soloTracks.length > 0) {
      cliArgs.push('-solo', soloTracks.join(','));
    }
    if (isMusic && Array.isArray(muteTracks) && muteTracks.length > 0) {
      cliArgs.push('-mute', muteTracks.join(','));
    }
    if (tempStemsPath) {
      cliArgs.push('-stems', tempStemsPath);
    }
    cliArgs.push('-out', tempWavPath, tempDslPath);

    const { stdout, stderr } = await execCli(binPath, cliArgs, { cwd: scriptsDir });
    const rawJsonLine = stdout.split('\n').find((line) => line.trim().startsWith('{')) || stdout;

    let report;
    try {
      report = JSON.parse(rawJsonLine);
    } catch {
      const fallbackMsg = stderr || stdout || 'Synthesis failed to emit valid JSON report';
      report = {
        passed: false,
        error: fallbackMsg,
        issues: [fallbackMsg],
        tracks: declaredTracks,
      };
    }

    if (!Array.isArray(report.issues)) {
      report.issues = report.error ? [report.error] : [];
    }
    if (!Array.isArray(report.tracks)) {
      report.tracks = [];
    }

    // If tracks were filtered by solo/mute, preserve the full track list in report.tracks
    // while keeping eventCounts from the synthesized tracks.
    if (
      (Array.isArray(soloTracks) && soloTracks.length > 0) ||
      (Array.isArray(muteTracks) && muteTracks.length > 0)
    ) {
      const synthTrackMap = new Map(report.tracks.map((t) => [t.name, t]));
      if (declaredTracks.length > 0) {
        report.tracks = declaredTracks.map((decl) => synthTrackMap.get(decl.name) || decl);
      }
      if (filteredDsl.includes('_silent_placeholder')) {
        report.issues = report.issues.filter((msg) => !/effectively silent/i.test(msg));
        if (!report.error && report.issues.length === 0) {
          report.passed = true;
        }
      }
    }

    let wavBuffer = null;
    if (fs.existsSync(tempWavPath)) {
      wavBuffer = fs.readFileSync(tempWavPath);
    }
    let stemsBuffer = null;
    if (tempStemsPath && fs.existsSync(tempStemsPath)) {
      stemsBuffer = fs.readFileSync(tempStemsPath);
    }

    if (wavBuffer && wavBuffer.length > 0) {
      const hasStems = Boolean(stemsBuffer && stemsBuffer.length > 0);
      storeWavInLruCache(buildId, {
        buildId,
        wavBuffer,
        stemsBuffer: hasStems ? stemsBuffer : null,
        report,
        createdAt: Date.now(),
      });
      return {
        buildId,
        report,
        wavSizeBytes: wavBuffer.length,
        wavUrl: `/api/sound/wav?buildId=${buildId}`,
        hasStems,
        stemsUrl: hasStems ? `/api/sound/stems?buildId=${buildId}` : null,
      };
    }

    return {
      buildId: null,
      report,
      wavSizeBytes: 0,
      wavUrl: null,
      hasStems: false,
      stemsUrl: null,
    };
  } finally {
    try {
      if (fs.existsSync(tempDslPath)) fs.unlinkSync(tempDslPath);
    } catch {
      // Ignore cleanup error
    }
    try {
      if (fs.existsSync(tempWavPath)) fs.unlinkSync(tempWavPath);
    } catch {
      // Ignore cleanup error
    }
    try {
      if (tempStemsPath && fs.existsSync(tempStemsPath)) fs.unlinkSync(tempStemsPath);
    } catch {
      // Ignore cleanup error
    }
  }
}

/**
 * 6. Returns the cached WAV `Buffer` for `buildId` so `/api/sound/wav?buildId=...` can stream `audio/wav`.
 */
export function getSynthesizedWav(buildId) {
  const targetId = buildId ? String(buildId).trim() : latestBuildId;
  if (!targetId) {
    throw createSoundError('Missing buildId and no synthesized WAV is cached yet.', 404);
  }

  const entry = wavCache.get(targetId);
  if (!entry || !Buffer.isBuffer(entry.wavBuffer)) {
    throw createSoundError(`Synthesized WAV for buildId "${targetId}" not found in cache.`, 404);
  }

  // Refresh LRU order on access
  wavCache.delete(targetId);
  wavCache.set(targetId, entry);

  return entry.wavBuffer;
}

/**
 * 6b. Returns the cached multi-track stems `Buffer` for `buildId` so `/api/sound/stems?buildId=...` can stream binary stems.
 */
export function getSynthesizedStems(buildId) {
  const targetId = buildId ? String(buildId).trim() : latestBuildId;
  if (!targetId) {
    throw createSoundError('Missing buildId and no synthesized stems are cached yet.', 404);
  }

  const entry = wavCache.get(targetId);
  if (!entry || !Buffer.isBuffer(entry.stemsBuffer)) {
    throw createSoundError(`Synthesized stems for buildId "${targetId}" not found in cache.`, 404);
  }

  // Refresh LRU order on access
  wavCache.delete(targetId);
  wavCache.set(targetId, entry);

  return entry.stemsBuffer;
}

/**
 * 7. Synthesizes `dsl` directly to `outputPath` on disk and returns `{ exported: true, outputPath, report }`.
 */
export async function exportSoundWav({
  dsl,
  type,
  apple = false,
  soloTracks = [],
  muteTracks = [],
  outputPath,
  filePath,
} = {}) {
  const targetPath = outputPath || filePath;
  const resolvedOut = normalizeInputPath(targetPath, 'outputPath');
  if (!resolvedOut.toLowerCase().endsWith('.wav')) {
    throw createSoundError(`Export outputPath "${resolvedOut}" must end in ".wav".`, 400);
  }
  if (typeof dsl !== 'string' || !dsl.trim()) {
    throw createSoundError('Missing or empty "dsl" string for exportSoundWav.', 400);
  }

  const { buildId, report, wavSizeBytes } = await synthesizeSound({
    dsl,
    type,
    apple,
    soloTracks,
    muteTracks,
  });

  if (!buildId || wavSizeBytes === 0) {
    const errDetail =
      report?.error ||
      (Array.isArray(report?.issues) && report.issues.join('; ')) ||
      'Synthesis produced no WAV output';
    throw createSoundError(`Failed to export WAV: ${errDetail}`, 422, { report });
  }

  const wavBuffer = getSynthesizedWav(buildId);

  const lstat = fs.lstatSync(resolvedOut, { throwIfNoEntry: false });
  if (lstat && lstat.isSymbolicLink()) {
    throw createSoundError(`Cannot overwrite symlink at "${resolvedOut}".`, 403);
  }

  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });
  fs.writeFileSync(resolvedOut, wavBuffer);

  return {
    exported: true,
    outputPath: resolvedOut,
    bytes: wavBuffer.length,
    report,
  };
}
