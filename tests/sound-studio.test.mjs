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

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  listSoundFiles,
  getSoundPresets,
  readSoundFile,
  saveSoundFile,
  synthesizeSound,
  getSynthesizedWav,
  getSynthesizedStems,
  exportSoundWav,
  filterDslTracks,
} from '../server/services/sound_service.mjs';

describe('Sound Studio Service & Fast Go Synth CLI Tests', () => {
  let tempDir;

  before(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sound-studio-test-'));
  });

  after(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('listSoundFiles returns the built-in .music library, 18 .sfx library files, and workspace sound files', async () => {
    const subDir = path.join(tempDir, 'audio');
    fs.mkdirSync(subDir, { recursive: true });
    const customSfxPath = path.join(subDir, 'custom_zap.sfx');
    fs.writeFileSync(
      customSfxPath,
      'title "Custom Zap"\ntype sfx\ninst zap preset=arcade_laser\ntrack main zap: zap:100ms\n',
      'utf-8'
    );

    const res = await listSoundFiles({ workspace: tempDir });
    assert.ok(Array.isArray(res.musicLibrary), 'musicLibrary should be an array');
    assert.ok(
      res.musicLibrary.length >= 7,
      `Expected at least 7 .music library files, got ${res.musicLibrary.length}`
    );
    assert.ok(
      res.musicLibrary.some((f) => f.name === 'battle_theme.music'),
      'musicLibrary should include battle_theme.music'
    );

    assert.ok(Array.isArray(res.sfxLibrary), 'sfxLibrary should be an array');
    assert.equal(res.sfxLibrary.length, 18, 'Expected all 18 built-in .sfx library files');
    assert.ok(
      res.sfxLibrary.some((f) => f.name === 'laser_arcade.sfx'),
      'sfxLibrary should include laser_arcade.sfx'
    );

    assert.ok(Array.isArray(res.workspaceFiles), 'workspaceFiles should be an array');
    assert.equal(res.workspaceFiles.length, 1);
    assert.equal(res.workspaceFiles[0].name, 'custom_zap.sfx');
    assert.equal(res.workspaceFiles[0].title, 'Custom Zap');
    assert.equal(res.workspaceFiles[0].type, 'sfx');
  });

  it('getSoundPresets returns all 18 SFX presets and music presets metadata', async () => {
    const presets = await getSoundPresets();
    assert.ok(Array.isArray(presets.sfxPresets), 'sfxPresets should be an array');
    assert.equal(presets.sfxPresets.length, 18, 'Expected 18 SFX presets');

    const laserPreset = presets.sfxPresets.find((p) => p.name === 'arcade_laser');
    assert.ok(laserPreset, 'arcade_laser preset should exist');
    assert.equal(laserPreset.wave, 'square');
    assert.ok(laserPreset.startFreq > laserPreset.endFreq);
    assert.ok(laserPreset.volume > 0);

    assert.ok(presets.musicPresets && typeof presets.musicPresets === 'object');
    assert.ok(Array.isArray(presets.musicPresets.waveTypes));
    assert.ok(presets.musicPresets.waveTypes.includes('ym2612_guitar'));
    assert.ok(Array.isArray(presets.musicPresets.ym2612Presets));
    assert.ok(Array.isArray(presets.musicPresets.tempoMarkings));
  });

  it('readSoundFile and saveSoundFile read/write .sfx and .music files and fail fast on invalid paths', async () => {
    const { sfxLibrary } = await listSoundFiles();
    const laserEntry = sfxLibrary.find((f) => f.name === 'laser_arcade.sfx');
    assert.ok(laserEntry);

    const readRes = await readSoundFile({ filePath: laserEntry.filePath });
    assert.equal(readRes.fileName, 'laser_arcade.sfx');
    assert.equal(readRes.type, 'sfx');
    assert.ok(readRes.content.includes('arcade_laser'));

    const savedPath = path.join(tempDir, 'saved_cue.sfx');
    const saveRes = await saveSoundFile({ filePath: savedPath, content: readRes.content });
    assert.equal(saveRes.saved, true);
    assert.equal(saveRes.filePath, savedPath);
    assert.ok(saveRes.bytes > 0);

    await assert.rejects(
      () => readSoundFile({ filePath: path.join(tempDir, 'nonexistent.sfx') }),
      /does not exist/
    );
    await assert.rejects(
      () => saveSoundFile({ filePath: path.join(tempDir, 'invalid.txt'), content: 'bad' }),
      /extension must be/
    );
  });

  it('synthesizeSound compiles laser_arcade.sfx and a .music score with RIFF WAVE headers and track metadata', async () => {
    const { sfxLibrary } = await listSoundFiles();
    const laserEntry = sfxLibrary.find((f) => f.name === 'laser_arcade.sfx');
    const laserFile = await readSoundFile({ filePath: laserEntry.filePath });

    // 1. Synthesize .sfx cue
    const sfxSynth = await synthesizeSound({ dsl: laserFile.content, type: 'sfx' });
    assert.ok(sfxSynth.buildId, 'buildId should be returned for valid SFX');
    assert.ok(sfxSynth.wavSizeBytes > 44, 'WAV size should exceed 44-byte RIFF header');
    assert.equal(sfxSynth.report.passed, true, `SFX validation should pass: ${sfxSynth.report.issues}`);
    assert.equal(sfxSynth.report.type, 'sfx');
    assert.equal(sfxSynth.report.boundaryClean, true);
    assert.ok(sfxSynth.report.durationSec > 0.05);
    assert.ok(Array.isArray(sfxSynth.report.tracks) && sfxSynth.report.tracks.length >= 1);

    const sfxWav = getSynthesizedWav(sfxSynth.buildId);
    assert.equal(sfxWav.length, sfxSynth.wavSizeBytes);
    assert.equal(sfxWav.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.equal(sfxWav.subarray(8, 12).toString('ascii'), 'WAVE');
    assert.equal(sfxWav.subarray(12, 16).toString('ascii'), 'fmt ');

    // 2. Synthesize multi-track .music score
    const musicDsl = `
title "Sound Studio Test Song"
type song
bpm 120
time 4/4

inst lead wave=ym2612_brass vol=0.16 pan=-0.20
inst bass wave=ym2612_bass  vol=0.20 pan=0.00
inst pad  wave=ym2612_strings vol=0.10 pan=0.25

track ch1_lead lead: C5:4 E5:4 G5:4 C6:4 | G5:2 E5:2
track ch2_bass bass: C2:4 C2:4 G1:4 G1:4 | C2:2 C2:2
track ch3_pad  pad:  [C4 E4 G4]:1        | [C4 E4 G4]:1
`;
    const musicSynth = await synthesizeSound({ dsl: musicDsl, type: 'music' });
    assert.ok(musicSynth.buildId, 'buildId should be returned for valid .music score');
    assert.equal(musicSynth.report.passed, true, `Music validation should pass: ${musicSynth.report.issues}`);
    assert.equal(musicSynth.report.title, 'Sound Studio Test Song');
    assert.equal(musicSynth.report.bpm, 120);
    assert.equal(musicSynth.report.tracks.length, 3);
    assert.equal(musicSynth.report.tracks[0].name, 'ch1_lead');
    assert.equal(musicSynth.report.tracks[0].defaultInst, 'lead');
    assert.equal(musicSynth.report.tracks[0].waveType, 'ym2612_brass');

    const musicWav = getSynthesizedWav(musicSynth.buildId);
    assert.equal(musicWav.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.equal(musicWav.subarray(8, 12).toString('ascii'), 'WAVE');

    // Verify per-track binary stems bundle ("STEM" magic + sampleRate + trackCount + per-track PCM)
    assert.equal(musicSynth.hasStems, true, 'music synthesis should return hasStems: true');
    const stemsBuf = getSynthesizedStems(musicSynth.buildId);
    assert.equal(stemsBuf.subarray(0, 4).toString('ascii'), 'STEM');
    assert.equal(stemsBuf.readUInt32LE(4), 44100);
    assert.equal(stemsBuf.readUInt32LE(8), 3);

    let offset = 12;
    const stemTrackNames = [];
    for (let i = 0; i < 3; i++) {
      const nameLen = stemsBuf.readUInt16LE(offset);
      offset += 2;
      const trackName = stemsBuf.subarray(offset, offset + nameLen).toString('utf8');
      offset += nameLen;
      const pcmLen = stemsBuf.readUInt32LE(offset);
      offset += 4;
      assert.ok(pcmLen > 0 && pcmLen % 4 === 0, `Stem "${trackName}" PCM must be non-empty and 4-byte aligned`);
      stemTrackNames.push(trackName);
      offset += pcmLen;
    }
    assert.deepEqual(stemTrackNames, ['ch1_lead', 'ch2_bass', 'ch3_pad']);
    assert.equal(offset, stemsBuf.length, 'Stems buffer length should match exact end of last track stem');

    // 3. Export WAV directly to disk
    const exportedWavPath = path.join(tempDir, 'exported_song.wav');
    const expRes = await exportSoundWav({
      dsl: musicDsl,
      type: 'music',
      outputPath: exportedWavPath,
    });
    assert.equal(expRes.exported, true);
    assert.ok(fs.existsSync(exportedWavPath));
    const diskBuf = fs.readFileSync(exportedWavPath);
    assert.equal(diskBuf.subarray(0, 4).toString('ascii'), 'RIFF');
  });

  it('synthesizeSound with soloTracks and muteTracks modifies synthesized audio output accurately', async () => {
    const stereoSplitDsl = `
title "Stereo Pan Solo/Mute Verification"
type song
bpm 120
time 4/4

inst left_inst  wave=square   vol=0.25 pan=-1.0
inst right_inst wave=sawtooth vol=0.25 pan=1.0

track left_tr  left_inst:  A4:4 C5:4 E5:4 A5:4
track right_tr right_inst: E3:4 G3:4 B3:4 E4:4
`;

    const fullRes = await synthesizeSound({ dsl: stereoSplitDsl, type: 'music' });
    const soloLeftRes = await synthesizeSound({
      dsl: stereoSplitDsl,
      type: 'music',
      soloTracks: ['left_tr'],
    });
    const muteLeftRes = await synthesizeSound({
      dsl: stereoSplitDsl,
      type: 'music',
      muteTracks: ['left_tr'],
    });

    assert.equal(fullRes.report.passed, true);
    assert.equal(soloLeftRes.report.passed, true);
    assert.equal(muteLeftRes.report.passed, true);

    // Full mix has signal in both channels; soloing left_tr silences right channel (-120 dBFS);
    // muting left_tr silences left channel (-120 dBFS).
    assert.ok(fullRes.report.peakLeftDBFS > -30, 'Full mix should have active left channel');
    assert.ok(fullRes.report.peakRightDBFS > -30, 'Full mix should have active right channel');

    assert.ok(soloLeftRes.report.peakLeftDBFS > -30, 'Solo left_tr should have active left channel');
    assert.equal(
      soloLeftRes.report.peakRightDBFS,
      -120,
      'Solo left_tr (pan=-1.0) should have silent right channel (-120 dBFS)'
    );

    assert.equal(
      muteLeftRes.report.peakLeftDBFS,
      -120,
      'Mute left_tr should leave only right_tr (pan=+1.0), silencing left channel'
    );
    assert.ok(muteLeftRes.report.peakRightDBFS > -30, 'Mute left_tr should have active right channel');

    // Also verify WAV buffers differ between full, soloLeft, and muteLeft
    const fullWav = getSynthesizedWav(fullRes.buildId);
    const soloWav = getSynthesizedWav(soloLeftRes.buildId);
    const muteWav = getSynthesizedWav(muteLeftRes.buildId);
    assert.equal(Buffer.compare(fullWav, soloWav) !== 0, true);
    assert.equal(Buffer.compare(soloWav, muteWav) !== 0, true);

    // And verify report.tracks still lists both tracks for the UI mixer
    assert.equal(soloLeftRes.report.tracks.length, 2);
    assert.equal(muteLeftRes.report.tracks.length, 2);
  });

  it('synthesizeSound with invalid DSL syntax returns passed: false and line-indexed error in report.issues without crashing', async () => {
    const brokenDsl = `
title "Broken DSL"
type sfx
inst bad_inst wave=nonexistent_wave_type vol=0.5
track main bad_inst: A4:100ms
`;

    const res = await synthesizeSound({ dsl: brokenDsl, type: 'sfx' });
    assert.equal(res.buildId, null);
    assert.equal(res.wavSizeBytes, 0);
    assert.equal(res.report.passed, false);
    assert.ok(Array.isArray(res.report.issues));
    assert.ok(res.report.issues.length > 0);
    assert.match(res.report.issues[0], /line 4|unsupported wave type/i);
  });

  it('synthesizeSound compiles .sfx with single-value noise_blend and filter sweep without noise= syntax error', async () => {
    const sfxWithGritDsl = `
title "Grit Blend Test"
type sfx
inst cue preset=arcade_laser wave=square freq=880Hz->110Hz vol=0.30 lpf=2400->480 noise_blend=0.60
track main cue: 880Hz->110Hz:180ms
`;
    const res = await synthesizeSound({ dsl: sfxWithGritDsl, type: 'sfx' });
    assert.equal(res.report.passed, true, `Expected noise_blend SFX to pass, got issues: ${res.report.issues}`);
    assert.ok(res.buildId);
    assert.ok(res.wavSizeBytes > 44);
  });

  it('synthesizeSound compiles all Friendly Music Instrument wave/gm archetypes and preserves real track metadata on gaiares_level2.music', async () => {
    const multiArchetypeDsl = `
title "All YM2612 & PSG Archetypes Test"
type song
bpm 134
time 4/4

inst gtr   wave=ym2612_guitar gm=overdriven_guitar vol=0.17 pan=-0.20
inst rgtr  wave=ym2612_rhythm_guitar gm=distortion_guitar vol=0.14 pan=0.30
inst brs   wave=ym2612_brass gm=synth_brass_1 vol=0.14 pan=-0.35
inst ep    wave=ym2612_epiano gm=epiano1 vol=0.12 pan=0.25
inst bell  wave=ym2612_bell gm=vibraphone vol=0.12 pan=-0.15
inst str   wave=ym2612_strings gm=string_ensemble_1 vol=0.10 pan=0.20
inst chr   wave=ym2612_choir gm=choir_aahs vol=0.10 pan=-0.20
inst flt   wave=ym2612_flute gm=flute vol=0.12 pan=0.15
inst bass  wave=ym2612_bass gm=electric_bass vol=0.19 pan=0.00
inst sbass wave=ym2612_slap_bass gm=slap_bass_1 vol=0.18 pan=0.00
inst sub   wave=sub_bass gm=synth_bass_2 vol=0.12 pan=0.00
inst psg1  wave=psg_square gm=lead_square vol=0.07 pan=-0.45
inst psg2  wave=psg_arp gm=clavinet vol=0.07 pan=0.45

track t_gtr  gtr:  E4:4 G4:4 F#4:4 A4:4
track t_rgtr rgtr: [E3 B3]:2 [D3 A3]:2
track t_brs  brs:  B4:2 A4:2
track t_ep   ep:   G4:2 F#4:2
track t_bell bell: E5:2 D5:2
track t_str  str:  [E4 G4 B4]:2 [D4 F#4 A4]:2
track t_chr  chr:  [E4 G4 B4]:2 [D4 F#4 A4]:2
track t_flt  flt:  B5:2 A5:2
track t_bass bass: E2:4 E2:4 D2:4 D2:4
track t_sbas sbass: E2:2 D2:2
track t_sub  sub:  E1:2 D1:2
track t_psg1 psg1: E5:4 G5:4 F#5:4 A5:4
track t_psg2 psg2: [E5 G5 B5]:2 [D5 F#5 A5]:2
`;
    const res = await synthesizeSound({ dsl: multiArchetypeDsl, type: 'music' });
    assert.equal(res.report.passed, true, `All music archetypes should compile cleanly: ${res.report.issues}`);
    assert.equal(res.report.tracks.length, 13);

    // Also verify gaiares_level2.music retains exact track waveType and volume even when tracks are muted/soloed
    const { musicLibrary } = await listSoundFiles();
    const gaiaresEntry = musicLibrary.find((f) => f.name === 'gaiares_level2.music');
    assert.ok(gaiaresEntry, 'gaiares_level2.music should exist in musicLibrary');
    const gaiaresFile = await readSoundFile({ filePath: gaiaresEntry.filePath });

    const soloRes = await synthesizeSound({
      dsl: gaiaresFile.content,
      type: 'music',
      soloTracks: ['ch01_fm_lead'],
    });
    assert.equal(soloRes.report.passed, true);
    const trackMap = new Map(soloRes.report.tracks.map((t) => [t.name, t]));
    assert.equal(trackMap.get('ch01_fm_lead')?.waveType, 'ym2612_guitar');
    assert.equal(trackMap.get('ch02_fm_lead_echo')?.waveType, 'ym2612_rhythm_guitar');
    assert.equal(trackMap.get('ch03_high_bell')?.waveType, 'ym2612_bell');
    assert.equal(trackMap.get('ch04_fm_epiano')?.waveType, 'ym2612_epiano');
    assert.equal(trackMap.get('ch05_brass_pad')?.waveType, 'ym2612_brass');
    assert.equal(trackMap.get('ch06_choir_pad')?.waveType, 'ym2612_strings');
    assert.equal(trackMap.get('ch07_psg_arp')?.waveType, 'psg_arp');
    assert.equal(trackMap.get('ch08_psg_arp_echo')?.waveType, 'psg_square');
    assert.equal(trackMap.get('ch09_fm_bass')?.waveType, 'ym2612_bass');
    assert.equal(trackMap.get('ch10_sub_bass')?.waveType, 'sub_bass');
    assert.equal(trackMap.get('ch11_drums_main')?.waveType, 'kick');
  });
});
