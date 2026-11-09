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

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  listSpriteFiles,
  getSpritePresets,
  inspectSpriteSheet,
  compileSpriteDsl,
  getSpriteSheetPng,
} from '../server/services/sprite_service.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

describe('Sprite Studio Service & Fast Go Sprite CLI Tests', () => {
  test('getSpritePresets returns empty presets array', async () => {
    const catalog = await getSpritePresets();
    assert.ok(Array.isArray(catalog.presets), 'presets must be an array');
    assert.equal(catalog.presets.length, 0, 'expected 0 built-in sprite presets');
  });

  test('listSpriteFiles discovers only black_cat_anime .sprite and .aseprite containers and ignores .png files', async () => {
    const result = await listSpriteFiles({ workspace: REPO_ROOT });
    assert.ok(Array.isArray(result.spriteSheets), 'spriteSheets must be an array');
    assert.ok(Array.isArray(result.dslFiles), 'dslFiles must be an array');
    assert.equal(result.spriteSheets.length, 2, 'expected only black_cat_anime.sprite and black_cat_anime.aseprite');

    // Must never list arbitrary PNG images like playtest-studio-ready.png
    const anyRawPng = result.spriteSheets.find((s) => s.name.endsWith('.png'));
    assert.equal(anyRawPng, undefined, 'spriteSheets must only list .sprite or .aseprite containers');

    const blackCatSprite = result.spriteSheets.find((s) => s.name === 'black_cat_anime.sprite');
    assert.ok(blackCatSprite, 'expected black_cat_anime.sprite container in spriteSheets');
    assert.equal(blackCatSprite.frameSize, '256x256');
    assert.equal(blackCatSprite.tagCount, 8);
    assert.equal(blackCatSprite.totalFrames, 32);

    const blackCatAse = result.spriteSheets.find((s) => s.name === 'black_cat_anime.aseprite');
    assert.ok(blackCatAse, 'expected black_cat_anime.aseprite container in spriteSheets');
  });

  test('inspectSpriteSheet inspects .sprite container and .aseprite container with pngDataUrl and dsl', async () => {
    const spriteContainerPath = path.join(REPO_ROOT, 'skills', 'sprite-design', 'scripts', 'black_cat_anime.sprite');
    const inspectedSprite = await inspectSpriteSheet({ filePath: spriteContainerPath });
    assert.ok(inspectedSprite.sheetId, 'expected non-empty sheetId for .sprite container');
    assert.ok(inspectedSprite.pngDataUrl?.startsWith('data:image/png;base64,'), 'expected pngDataUrl');
    assert.ok(inspectedSprite.dsl?.includes('sheet "black_cat_anime.png"'), 'expected .sprite dsl content');
    assert.equal(inspectedSprite.report.width, 256);
    assert.equal(inspectedSprite.report.height, 256);
    assert.equal(inspectedSprite.report.totalFrames, 32);
    assert.equal(inspectedSprite.report.tags.length, 8);

    const asePath = path.join(REPO_ROOT, 'skills', 'sprite-design', 'scripts', 'black_cat_anime.aseprite');
    const inspectedAse = await inspectSpriteSheet({ filePath: asePath });
    assert.ok(inspectedAse.sheetId, 'expected non-empty sheetId for .aseprite container');
    assert.ok(inspectedAse.pngDataUrl?.startsWith('data:image/png;base64,'), 'expected pngDataUrl for .aseprite');
    assert.ok(inspectedAse.dsl?.includes('sheet "black_cat_anime.aseprite"'), 'expected direct .aseprite dsl header');
    assert.ok(inspectedAse.dsl?.includes('tag run        8 once, 9..11 loop'), 'expected once+loop intro tag from .aseprite binary');
    assert.equal(inspectedAse.report.width, 256);
    assert.equal(inspectedAse.report.totalFrames, 32);
    assert.equal(inspectedAse.report.tags.length, 8);

    const pngBuf = getSpriteSheetPng(inspectedAse.sheetId);
    assert.ok(Buffer.isBuffer(pngBuf) && pngBuf.length > 1000, 'expected valid PNG buffer');
    assert.equal(pngBuf[0], 0x89);
    assert.equal(pngBuf[1], 0x50);
    assert.equal(pngBuf[2], 0x4e);
    assert.equal(pngBuf[3], 0x47);
  });

  test('compileSpriteDsl compiles black_cat_anime.sprite and returns QA report + cached PNG', async () => {
    const spriteContainerPath = path.join(REPO_ROOT, 'skills', 'sprite-design', 'scripts', 'black_cat_anime.sprite');
    const compiled = await compileSpriteDsl({ filePath: spriteContainerPath });
    assert.ok(compiled.sheetId);
    assert.equal(compiled.report.passed, true);
    assert.equal(compiled.report.width, 256);
    assert.equal(compiled.report.height, 256);
    assert.equal(compiled.report.tags.length, 8);

    const pngBuf = getSpriteSheetPng(compiled.sheetId);
    assert.ok(pngBuf.length > 1000);
  });
});
