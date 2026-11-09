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
const SPRITE_SCRIPTS_DIR = path.join(REPO_ROOT, 'skills', 'sprite-design', 'scripts');

const uid = typeof process.getuid === 'function' ? process.getuid() : 'default';
const SPRITE_CACHE_DIR = path.join(os.tmpdir(), `agy-sprite-studio-cache-${uid}`);
fs.mkdirSync(SPRITE_CACHE_DIR, { recursive: true, mode: 0o700 });
const MAX_LRU_ENTRIES = 30;

// In-memory LRU map: sheetId -> { sheetId, pngBuffer, report, createdAt }
const sheetCache = new Map();
let latestSheetId = null;

const binaryState = {
  binPath: null,
  maxMtimeMs: 0,
  compilingPromise: null,
};

function createSpriteError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

function normalizeInputPath(inputPath, label = 'filePath') {
  if (!inputPath || typeof inputPath !== 'string' || !inputPath.trim()) {
    throw createSpriteError(`Missing or empty "${label}".`, 400);
  }
  const trimmed = inputPath.trim();
  if (trimmed.includes('\0')) {
    throw createSpriteError(`Invalid "${label}": null byte detected.`, 400);
  }
  if (trimmed.startsWith('file://')) {
    try {
      return path.resolve(fileURLToPath(trimmed));
    } catch (err) {
      throw createSpriteError(`Invalid file:// URI "${trimmed}": ${err.message}`, 400);
    }
  }
  return path.resolve(trimmed);
}

function getGoSourcesMaxMtimeMs(dirPath) {
  if (!fs.existsSync(dirPath)) {
    throw createSpriteError(`Sprite Go scripts directory not found: "${dirPath}"`, 500);
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

export async function ensureSpriteCliBinary() {
  const binName = process.platform === 'win32' ? 'sprite-cli.exe' : 'sprite-cli';
  const targetBinPath = path.join(SPRITE_CACHE_DIR, binName);
  const currentMaxMtime = getGoSourcesMaxMtimeMs(SPRITE_SCRIPTS_DIR);

  if (
    binaryState.binPath === targetBinPath &&
    binaryState.maxMtimeMs === currentMaxMtime &&
    fs.existsSync(targetBinPath)
  ) {
    return targetBinPath;
  }

  if (fs.existsSync(targetBinPath)) {
    try {
      const binStat = fs.statSync(targetBinPath);
      const isOwner = typeof process.getuid !== 'function' || binStat.uid === process.getuid();
      if (isOwner && binStat.isFile() && binStat.size > 0 && binStat.mtimeMs >= currentMaxMtime) {
        binaryState.binPath = targetBinPath;
        binaryState.maxMtimeMs = currentMaxMtime;
        return targetBinPath;
      }
    } catch {
      // Proceed to compile
    }
  }

  if (binaryState.compilingPromise) {
    return binaryState.compilingPromise;
  }

  binaryState.compilingPromise = (async () => {
    fs.mkdirSync(SPRITE_CACHE_DIR, { recursive: true });
    const tempBinPath = `${targetBinPath}.${process.pid}.${Date.now()}.tmp`;

    await new Promise((resolve, reject) => {
      const proc = spawn('go', ['build', '-o', tempBinPath, '.'], {
        cwd: SPRITE_SCRIPTS_DIR,
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
        reject(createSpriteError(`Failed to spawn "go build" for sprite-cli: ${err.message}`, 500));
      });
      proc.on('close', (code) => {
        if (code !== 0) {
          reject(
            createSpriteError(
              `Failed to compile sprite-cli (exit ${code}): ${(stderr || stdout).trim()}`,
              500
            )
          );
          return;
        }
        resolve();
      });
    });

    fs.renameSync(tempBinPath, targetBinPath);
    binaryState.binPath = targetBinPath;
    binaryState.maxMtimeMs = currentMaxMtime;
    return targetBinPath;
  })().finally(() => {
    binaryState.compilingPromise = null;
  });

  return binaryState.compilingPromise;
}

function execCli(binPath, args, { cwd, timeoutMs = 60_000 } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(binPath, args, {
      cwd: cwd || SPRITE_CACHE_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGKILL');
      reject(createSpriteError(`Sprite CLI timed out after ${timeoutMs}ms`, 504));
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
        reject(createSpriteError(`Failed to execute sprite CLI "${binPath}": ${err.message}`, 500));
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

function storeSheetInCache(pngBuffer, report) {
  const sheetId = `spr-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  sheetCache.set(sheetId, {
    sheetId,
    pngBuffer,
    report,
    createdAt: Date.now(),
  });
  latestSheetId = sheetId;

  while (sheetCache.size > MAX_LRU_ENTRIES) {
    const oldestKey = sheetCache.keys().next().value;
    if (!oldestKey) break;
    sheetCache.delete(oldestKey);
  }
  return sheetId;
}

export async function getSpritePresets() {
  return {
    presets: [],
    palettes: [],
    materialRamps: [],
  };
}

const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'vendor',
  '.next',
  '.vite',
  'coverage',
]);

function scanSpriteAssetsInDir(rootDir, maxDepth = 4) {
  const spriteFiles = [];
  const asepriteFiles = [];
  if (!rootDir || !fs.existsSync(rootDir)) {
    return { spriteFiles, asepriteFiles };
  }

  function walk(currentDir, depth) {
    if (depth > maxDepth) return;
    let entries = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          walk(fullPath, depth + 1);
        }
        continue;
      }
      if (!entry.isFile()) continue;
      const lower = entry.name.toLowerCase();
      if (lower.endsWith('.sprite')) {
        spriteFiles.push(fullPath);
      } else if (lower.endsWith('.aseprite') || lower.endsWith('.ase')) {
        asepriteFiles.push(fullPath);
      }
    }
  }

  walk(rootDir, 0);
  return { spriteFiles, asepriteFiles };
}

function parseSpriteContainerSummary(filePath) {
  let content = '';
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }

  let title = '';
  let sheetRel = '';
  let frameSize = '';
  let gridCols = 0;
  let gridRows = 0;
  let tagCount = 0;
  let maxFrameIdx = -1;

  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.replace(/\/\/.*$/, '').trim();
    if (!line) continue;
    const titleMatch = line.match(/^title\s+"([^"]+)"/i);
    if (titleMatch) {
      title = titleMatch[1];
      continue;
    }
    const sheetMatch = line.match(/^sheet\s+"?([^"\s]+)"?/i);
    if (sheetMatch) {
      sheetRel = sheetMatch[1];
      continue;
    }
    const sizeMatch = line.match(/^size\s+(\d+x\d+)/i);
    if (sizeMatch) {
      frameSize = sizeMatch[1].toLowerCase();
      continue;
    }
    const gridMatch = line.match(/^grid\s+(\d+)x(\d+)/i);
    if (gridMatch) {
      gridCols = Number(gridMatch[1]) || 0;
      gridRows = Number(gridMatch[2]) || 0;
      continue;
    }
    if (/^tag\s+/i.test(line)) {
      tagCount += 1;
      const rangeMatch = line.match(/(\d+)\.\.(\d+)/);
      if (rangeMatch) {
        const toIdx = Number(rangeMatch[2]);
        if (toIdx > maxFrameIdx) maxFrameIdx = toIdx;
      }
    }
  }

  let totalFrames = maxFrameIdx >= 0 ? maxFrameIdx + 1 : 0;
  if (totalFrames === 0 && gridCols > 0 && gridRows > 0) {
    totalFrames = gridCols * gridRows;
  }

  return {
    title,
    sheetRel,
    isSheetContainer: Boolean(sheetRel),
    frameSize,
    tagCount,
    totalFrames,
  };
}

export async function listSpriteFiles({ workspace } = {}) {
  const seenSprite = new Set();
  const seenAseprite = new Set();
  const spriteSheets = [];
  const dslFiles = [];

  const searchDirs = [];
  const rawWorkspace =
    workspace && typeof workspace === 'string' && workspace.trim()
      ? workspace.trim()
      : process.env.PLAYTEST_WORKSPACE && process.env.PLAYTEST_WORKSPACE.trim()
      ? process.env.PLAYTEST_WORKSPACE.trim()
      : REPO_ROOT;

  try {
    const resolvedWs = normalizeInputPath(rawWorkspace, 'workspace');
    if (fs.existsSync(resolvedWs) && fs.statSync(resolvedWs).isDirectory()) {
      searchDirs.push(resolvedWs);
    }
  } catch {
    // Ignore invalid workspace URI
  }

  for (const dir of searchDirs) {
    const { spriteFiles, asepriteFiles } = scanSpriteAssetsInDir(dir, 5);

    for (const sPath of spriteFiles) {
      const resolved = path.resolve(sPath);
      if (seenSprite.has(resolved)) continue;
      seenSprite.add(resolved);

      const stem = path.basename(resolved, '.sprite');
      const dirName = path.dirname(resolved);
      const summary = parseSpriteContainerSummary(resolved);
      const companionAse = path.join(dirName, `${stem}.aseprite`);
      const hasAseprite = fs.existsSync(companionAse);

      spriteSheets.push({
        name: path.basename(resolved),
        title: summary?.title || stem,
        path: resolved,
        filePath: resolved,
        sheetFile: summary?.sheetRel || '',
        kind: summary?.isSheetContainer ? 'png' : 'dsl',
        hasManifest: true,
        hasAseprite,
        frameSize: summary?.frameSize || '',
        tagCount: summary?.tagCount || 0,
        totalFrames: summary?.totalFrames || 0,
      });

      dslFiles.push({
        name: path.basename(resolved),
        title: summary?.title || stem,
        path: resolved,
        filePath: resolved,
        kind: 'dsl',
        frameSize: summary?.frameSize || '',
        tagCount: summary?.tagCount || 0,
        totalFrames: summary?.totalFrames || 0,
      });
    }

    for (const aPath of asepriteFiles) {
      const resolved = path.resolve(aPath);
      if (seenAseprite.has(resolved)) continue;
      seenAseprite.add(resolved);

      const ext = path.extname(resolved);
      const stem = path.basename(resolved, ext);
      const dirName = path.dirname(resolved);
      const companionJson = path.join(dirName, `${stem}.json`);
      let frameSize = '';
      let tagCount = 0;
      let totalFrames = 0;

      if (fs.existsSync(companionJson)) {
        try {
          const man = JSON.parse(fs.readFileSync(companionJson, 'utf-8'));
          if (man?.meta?.frameWidth && man?.meta?.frameHeight) {
            frameSize = `${man.meta.frameWidth}x${man.meta.frameHeight}`;
          }
          if (Array.isArray(man?.meta?.frameTags)) {
            tagCount = man.meta.frameTags.length;
          }
          if (Array.isArray(man?.frames)) {
            totalFrames = man.frames.length;
          }
        } catch {
          // Ignore optional companion json parse error
        }
      }

      spriteSheets.push({
        name: path.basename(resolved),
        title: stem,
        path: resolved,
        filePath: resolved,
        kind: 'png',
        hasManifest: true,
        hasAseprite: true,
        frameSize,
        tagCount,
        totalFrames,
      });
    }
  }

  // Sort spriteSheets so .sprite containers come first, with black_cat_anime at the top
  spriteSheets.sort((a, b) => {
    const aIsSprite = a.name.endsWith('.sprite');
    const bIsSprite = b.name.endsWith('.sprite');
    if (aIsSprite !== bIsSprite) return aIsSprite ? -1 : 1;
    if (a.name.startsWith('black_cat_anime')) return -1;
    if (b.name.startsWith('black_cat_anime')) return 1;
    return a.name.localeCompare(b.name);
  });

  return {
    spriteSheets,
    dslFiles,
    presets: [],
    palettes: [],
    materialRamps: [],
  };
}

export async function inspectSpriteSheet({
  filePath,
  frameWidth = 0,
  frameHeight = 0,
  cols = 0,
  rows = 0,
} = {}) {
  const resolved = normalizeInputPath(filePath, 'filePath');
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw createSpriteError(`Sprite sheet file not found: "${resolved}"`, 404);
  }

  const lower = resolved.toLowerCase();
  const isContainer =
    lower.endsWith('.aseprite') || lower.endsWith('.ase') || lower.endsWith('.sprite');
  const tmpId = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const tmpPngPath = isContainer
    ? path.join(SPRITE_CACHE_DIR, `inspect-${tmpId}.png`)
    : '';

  const binPath = await ensureSpriteCliBinary();
  const args = ['inspect-json'];
  if (Number(frameWidth) > 0) {
    args.push('-fw', String(Math.round(Number(frameWidth))));
  }
  if (Number(frameHeight) > 0) {
    args.push('-fh', String(Math.round(Number(frameHeight))));
  }
  if (Number(cols) > 0) {
    args.push('-cols', String(Math.round(Number(cols))));
  }
  if (Number(rows) > 0) {
    args.push('-rows', String(Math.round(Number(rows))));
  }
  if (tmpPngPath) {
    args.push('-png', tmpPngPath);
  }
  args.push(resolved);

  try {
    const { stdout, stderr } = await execCli(binPath, args, {
      cwd: path.dirname(resolved),
    });
    const lines = stdout
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const lastLine = lines[lines.length - 1] || '';

    let report;
    try {
      report = JSON.parse(lastLine);
    } catch {
      throw createSpriteError(
        `Failed to parse inspect-json output for "${resolved}": ${stderr || stdout}`,
        500
      );
    }
    if (report.error) {
      throw createSpriteError(report.error, 422, { report });
    }

    const pngSourcePath =
      tmpPngPath && fs.existsSync(tmpPngPath)
        ? tmpPngPath
        : report.pngPath && fs.existsSync(report.pngPath)
          ? report.pngPath
          : resolved;
    const pngBuffer = fs.readFileSync(pngSourcePath);
    const sheetId = storeSheetInCache(pngBuffer, report);
    const pngDataUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`;

    let dslContent = '';
    if (lower.endsWith('.sprite')) {
      dslContent = fs.readFileSync(resolved, 'utf-8');
    } else if (lower.endsWith('.aseprite') || lower.endsWith('.ase')) {
      const ext = path.extname(resolved);
      const aseFile = path.basename(resolved);
      const tags = report.tags || [];
      const firstDur = tags[0]?.durationMs || 100;
      const isUniform = tags.every((t) => !t.durationMs || t.durationMs === firstDur);
      const tagLines = tags.map((t) => {
        const rawLoop = String(t.loop || 'loop').toLowerCase();
        const loopMode = rawLoop === 'forward' || rawLoop === '' ? 'loop' : rawLoop;
        const fromF = Number(t.fromFrame) || 0;
        const toF = Number(t.toFrame) || 0;
        const loopFromF = Number(t.loopFromFrame) || 0;
        const durToken = isUniform ? '' : ` ${t.durationMs || 100}ms`;
        if (loopFromF > fromF && loopFromF <= toF) {
          const introRange = loopFromF - 1 > fromF ? `${fromF}..${loopFromF - 1}` : `${fromF}`;
          const loopRange = toF > loopFromF ? `${loopFromF}..${toF}` : `${loopFromF}`;
          return `tag ${t.name.padEnd(10)} ${introRange} once, ${loopRange}${durToken} ${loopMode}`;
        }
        const rangeStr = toF > fromF ? `${fromF}..${toF}` : `${fromF}`;
        return `tag ${t.name.padEnd(10)} ${rangeStr}${durToken} ${loopMode}`;
      });
      const headerLines = [
        `title "${report.title || path.basename(resolved, ext)}"`,
        `type ${report.type || 'sprite'}`,
        `sheet "${aseFile}"`,
        `size ${report.width || 64}x${report.height || 64}`,
        `grid ${report.sheetCols || 1}x${report.sheetRows || 1}`,
      ];
      if (isUniform && firstDur > 0) {
        if (1000 % firstDur === 0) {
          headerLines.push(`fps ${1000 / firstDur}`);
        } else {
          headerLines.push(`duration ${firstDur}ms`);
        }
      }
      dslContent = [...headerLines, '', ...tagLines, ''].join('\n');
    }

    return {
      sheetId,
      filePath: resolved,
      fileName: path.basename(resolved),
      kind: lower.endsWith('.aseprite') || lower.endsWith('.ase') ? 'aseprite' : lower.endsWith('.sprite') ? 'sprite' : 'png',
      dsl: dslContent || undefined,
      pngDataUrl,
      report,
    };
  } finally {
    if (tmpPngPath) {
      try {
        if (fs.existsSync(tmpPngPath)) fs.unlinkSync(tmpPngPath);
      } catch {
        // Ignore temp cleanup
      }
    }
  }
}

export async function compileSpriteDsl({ dsl, preset, filePath } = {}) {
  let sourceDsl = typeof dsl === 'string' ? dsl : '';
  let resolvedPath = '';

  if (!sourceDsl.trim() && preset) {
    const catalog = await getSpritePresets();
    const found = (catalog.presets || []).find((p) => p.name === preset);
    if (!found) {
      throw createSpriteError(`Unknown sprite preset "${preset}".`, 404);
    }
    sourceDsl = found.dsl;
  } else if (!sourceDsl.trim() && filePath) {
    resolvedPath = normalizeInputPath(filePath, 'filePath');
    if (!fs.existsSync(resolvedPath)) {
      throw createSpriteError(`Sprite DSL file not found: "${resolvedPath}"`, 404);
    }
    sourceDsl = fs.readFileSync(resolvedPath, 'utf-8');
  }

  if (!sourceDsl.trim()) {
    throw createSpriteError('Missing or empty ".sprite" DSL source.', 400);
  }

  const binPath = await ensureSpriteCliBinary();
  const tmpId = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const tmpDslPath = path.join(SPRITE_CACHE_DIR, `compile-${tmpId}.sprite`);
  const tmpPngPath = path.join(SPRITE_CACHE_DIR, `compile-${tmpId}.png`);

  fs.writeFileSync(tmpDslPath, sourceDsl, 'utf-8');
  try {
    const { stdout, stderr } = await execCli(
      binPath,
      ['synth-json', '-png', tmpPngPath, tmpDslPath],
      { cwd: resolvedPath ? path.dirname(resolvedPath) : SPRITE_SCRIPTS_DIR }
    );
    const lines = stdout
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const lastLine = lines[lines.length - 1] || '';

    let report;
    try {
      report = JSON.parse(lastLine);
    } catch {
      throw createSpriteError(
        `Failed to parse synth-json output: ${stderr || stdout}`,
        422
      );
    }
    if (report.error) {
      throw createSpriteError(report.error, 422, { report });
    }
    if (!fs.existsSync(tmpPngPath)) {
      throw createSpriteError('Sprite compilation succeeded but PNG output was not generated.', 500);
    }

    const pngBuffer = fs.readFileSync(tmpPngPath);
    const sheetId = storeSheetInCache(pngBuffer, report);
    const pngDataUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`;

    return {
      sheetId,
      dsl: sourceDsl,
      filePath: resolvedPath || filePath || '',
      kind: 'dsl',
      pngDataUrl,
      report,
    };
  } finally {
    try {
      if (fs.existsSync(tmpDslPath)) fs.unlinkSync(tmpDslPath);
      if (fs.existsSync(tmpPngPath)) fs.unlinkSync(tmpPngPath);
    } catch {
      // Ignore temp cleanup errors
    }
  }
}

export async function normalizeSpriteSheetApi({
  filePath,
  filePaths,
  frameWidth = 0,
  frameHeight = 0,
  cols = 4,
  rows = 4,
  center = true,
  ground = true,
  pad = 4,
  tolerance = 18,
  tags = [],
  outputPath = '',
} = {}) {
  const rawList = Array.isArray(filePaths) && filePaths.length > 0 ? filePaths : [filePath];
  const resolvedInputs = rawList
    .filter((p) => typeof p === 'string' && p.trim())
    .map((p) => normalizeInputPath(p, 'filePath'));

  if (resolvedInputs.length === 0) {
    throw createSpriteError('Missing input sprite sheet filePath for normalization.', 400);
  }
  for (const p of resolvedInputs) {
    if (!fs.existsSync(p) || !fs.statSync(p).isFile()) {
      throw createSpriteError(`Input sprite sheet not found: "${p}"`, 404);
    }
  }

  const binPath = await ensureSpriteCliBinary();
  const tmpId = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const outPng = outputPath
    ? normalizeInputPath(outputPath, 'outputPath')
    : path.join(SPRITE_CACHE_DIR, `normalized-${tmpId}.png`);
  const outJson = outputPath
    ? path.join(
        path.dirname(outPng),
        `${path.basename(outPng, path.extname(outPng))}.json`
      )
    : path.join(SPRITE_CACHE_DIR, `normalized-${tmpId}.json`);

  const args = [
    'normalize',
    '-report-json',
    `-center=${Boolean(center)}`,
    `-ground=${Boolean(ground)}`,
    '-pad',
    String(Math.max(0, Math.round(Number(pad) || 0))),
    '-tol',
    String(Math.max(1, Math.round(Number(tolerance) || 18))),
    '-out',
    outPng,
    '-json',
    outJson,
  ];
  if (Number(frameWidth) > 0) {
    args.push('-fw', String(Math.round(Number(frameWidth))));
  }
  if (Number(frameHeight) > 0) {
    args.push('-fh', String(Math.round(Number(frameHeight))));
  }
  if (Number(cols) > 0) {
    args.push('-cols', String(Math.round(Number(cols))));
  }
  if (Number(rows) > 0) {
    args.push('-rows', String(Math.round(Number(rows))));
  }
  if (Array.isArray(tags)) {
    for (const t of tags) {
      if (typeof t === 'string' && t.trim()) {
        args.push('-tag', t.trim());
      } else if (t && typeof t === 'object' && t.name) {
        const spec = `${t.name}:${t.fromFrame ?? 0}:${t.toFrame ?? 0}:${t.durationMs ?? 100}:${t.loop || 'forward'}`;
        args.push('-tag', spec);
      }
    }
  }
  args.push(...resolvedInputs);

  try {
    const { stdout, stderr } = await execCli(binPath, args, {
      cwd: path.dirname(resolvedInputs[0]),
    });
    const lines = stdout
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const lastLine = lines[lines.length - 1] || '';

    let report;
    try {
      report = JSON.parse(lastLine);
    } catch {
      throw createSpriteError(
        `Normalization failed: ${stderr || stdout}`,
        422
      );
    }
    if (report.error) {
      throw createSpriteError(report.error, 422, { report });
    }
    if (!fs.existsSync(outPng)) {
      throw createSpriteError('Normalization completed without producing an output PNG.', 500);
    }

    const pngBuffer = fs.readFileSync(outPng);
    const sheetId = storeSheetInCache(pngBuffer, report);
    const pngDataUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`;

    return {
      sheetId,
      filePath: outputPath ? outPng : resolvedInputs[0],
      savedOutputPath: outputPath ? outPng : null,
      kind: 'png',
      pngDataUrl,
      report,
    };
  } finally {
    if (!outputPath) {
      try {
        if (fs.existsSync(outPng)) fs.unlinkSync(outPng);
        if (fs.existsSync(outJson)) fs.unlinkSync(outJson);
      } catch {
        // Ignore temp cleanup
      }
    }
  }
}

export function getSpriteSheetPng(sheetId, filePath) {
  if (sheetId) {
    if (sheetCache.has(sheetId)) {
      return sheetCache.get(sheetId).pngBuffer;
    }
    throw createSpriteError(`Sprite sheet PNG not found for sheetId "${sheetId}".`, 404);
  }
  if (filePath) {
    const resolved = normalizeInputPath(filePath, 'filePath');
    if (!resolved.toLowerCase().endsWith('.png')) {
      throw createSpriteError(`Unsupported image extension for "${resolved}". Expected ".png".`, 400);
    }
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      return fs.readFileSync(resolved);
    }
    throw createSpriteError(`Sprite sheet PNG file not found: "${resolved}"`, 404);
  }
  if (latestSheetId && sheetCache.has(latestSheetId)) {
    return sheetCache.get(latestSheetId).pngBuffer;
  }
  throw createSpriteError('Sprite sheet PNG not found.', 404);
}

export function readSpriteDslFile({ filePath } = {}) {
  const resolved = normalizeInputPath(filePath, 'filePath');
  if (!resolved.toLowerCase().endsWith('.sprite')) {
    throw createSpriteError(
      `Unsupported sprite DSL file extension "${path.extname(resolved)}" for "${resolved}". Expected ".sprite".`,
      400
    );
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw createSpriteError(`Sprite file not found: "${resolved}"`, 404);
  }
  const content = fs.readFileSync(resolved, 'utf-8');
  return {
    filePath: resolved,
    fileName: path.basename(resolved),
    content,
  };
}

export function saveSpriteDslFile({ filePath, content } = {}) {
  const resolved = normalizeInputPath(filePath, 'filePath');
  if (!resolved.toLowerCase().endsWith('.sprite')) {
    throw createSpriteError('Only ".sprite" files can be saved via saveSpriteDslFile.', 400);
  }
  if (typeof content !== 'string' || !content.trim()) {
    throw createSpriteError('Cannot save empty ".sprite" content.', 400);
  }
  if (fs.existsSync(resolved) && fs.lstatSync(resolved).isSymbolicLink()) {
    throw createSpriteError(`Refusing to overwrite symbolic link: "${resolved}"`, 400);
  }
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, content, 'utf-8');
  return {
    saved: true,
    filePath: resolved,
    fileName: path.basename(resolved),
    bytesWritten: Buffer.byteLength(content, 'utf-8'),
  };
}
