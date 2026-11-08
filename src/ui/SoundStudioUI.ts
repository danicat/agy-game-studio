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

import { StudioNotifier } from './PlaytestStudioUI.ts';
import { getSessionId, getWorkspacePath, sidecarFetch } from '../utils/api.ts';

export interface SoundFileEntry {
  name: string;
  path: string;
  filePath?: string;
  title?: string;
  type: 'music' | 'sfx';
}

export interface SoundFilesCatalog {
  musicLibrary: SoundFileEntry[];
  sfxLibrary: SoundFileEntry[];
  workspaceFiles: SoundFileEntry[];
}

export interface SFXPresetInfo {
  name: string;
  wave: string;
  startFreq: number;
  endFreq: number;
  pitchCurve: string;
  dutyStart: number;
  dutyEnd: number;
  lpfStart: number;
  lpfEnd: number;
  hpfStart: number;
  hpfEnd: number;
  q: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  volume: number;
}

export interface SoundTrackReport {
  name: string;
  defaultInst: string;
  waveType: string;
  volume: number;
  pan: number;
  eventCount: number;
}

export interface SoundValidationReport {
  passed: boolean;
  error?: string;
  title?: string;
  type?: string;
  bpm?: number;
  durationSec?: number;
  peakLeftDBFS?: number;
  peakRightDBFS?: number;
  rmsDBFS?: number;
  dcOffset?: number;
  lowFreqEnergyPct?: number;
  boundaryClean?: boolean;
  issues: string[];
  tracks?: SoundTrackReport[];
}

export interface SynthesizeResponse {
  buildId: string;
  wavSizeBytes: number;
  report: SoundValidationReport;
  hasStems?: boolean;
  stemsUrl?: string | null;
}

export interface SoundStudioOptions {
  rootEl: HTMLElement;
  onSwitchToPlaytest?: () => void;
}

type VisualizerMode = 'waveform' | 'spectrum';

interface SfxShaperState {
  title: string;
  preset: string;
  wave: string;
  startFreq: number;
  endFreq: number;
  durationMs: number;
  brightnessHz: number;
  gritPct: number;
  volume: number;
  pitchCurve: string;
}

interface SoundHistorySnapshot {
  dsl: string;
  soloTracks: string[];
  muteTracks: string[];
  useAppleSynth: boolean;
}

interface SavedDocModeState {
  filePath: string;
  fileName: string;
  dsl: string;
  soloTracks: string[];
  muteTracks: string[];
  useAppleSynth: boolean;
  initialSnapshot: SoundHistorySnapshot | null;
  undoStack: SoundHistorySnapshot[];
  redoStack: SoundHistorySnapshot[];
}

interface FriendlyPresetMeta {
  id: string;
  label: string;
  fileName: string;
}

const FRIENDLY_SFX_PRESETS: FriendlyPresetMeta[] = [
  { id: 'arcade_laser', label: 'Laser', fileName: 'laser_arcade.sfx' },
  { id: 'plasma_gun', label: 'Plasma', fileName: 'plasma_gun.sfx' },
  { id: 'explosion_arcade', label: '8-Bit Boom', fileName: 'explosion_arcade.sfx' },
  { id: 'explosion_deep', label: 'Deep Boom', fileName: 'explosion_deep.sfx' },
  { id: 'jump_arcade', label: 'Jump', fileName: 'jump_arcade.sfx' },
  { id: 'jump_spring', label: 'Spring', fileName: 'jump_spring.sfx' },
  { id: 'coin_pickup', label: 'Coin', fileName: 'coin_pickup.sfx' },
  { id: 'gem_shimmer', label: 'Gem', fileName: 'gem_shimmer.sfx' },
  { id: 'sword_clash', label: 'Sword', fileName: 'sword_clash.sfx' },
  { id: 'shield_deflect', label: 'Shield', fileName: 'shield_deflect.sfx' },
  { id: 'hit_punch', label: 'Punch', fileName: 'hit_punch.sfx' },
  { id: 'hit_damage', label: 'Damage', fileName: 'hit_damage.sfx' },
  { id: 'powerup_fanfare', label: 'Fanfare', fileName: 'powerup_fanfare.sfx' },
  { id: 'ui_select', label: 'Menu Tick', fileName: 'ui_select.sfx' },
  { id: 'ui_confirm', label: 'Confirm', fileName: 'ui_confirm.sfx' },
  { id: 'ui_error', label: 'Error', fileName: 'ui_error.sfx' },
  { id: 'footstep_stone', label: 'Footstep', fileName: 'footstep_stone.sfx' },
  { id: 'engine_thruster', label: 'Thruster', fileName: 'engine_thruster.sfx' }
];

const FRIENDLY_SFX_TONES: Array<{ id: string; label: string }> = [
  { id: 'square', label: 'Square' },
  { id: 'sawtooth', label: 'Saw' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'sine', label: 'Sine' },
  { id: 'fm', label: 'Metallic FM' },
  { id: 'psg_noise', label: '8-Bit Noise' }
];

const FRIENDLY_MUSIC_INSTRUMENTS: Array<{ id: string; label: string; dslWave: string }> = [
  { id: 'ym2612_guitar', label: 'FM Lead Guitar', dslWave: 'wave=ym2612_guitar gm=overdriven_guitar' },
  { id: 'ym2612_rhythm_guitar', label: 'FM Rhythm Guitar', dslWave: 'wave=ym2612_rhythm_guitar gm=distortion_guitar' },
  { id: 'ym2612_brass', label: 'FM Synth Brass', dslWave: 'wave=ym2612_brass gm=synth_brass_1' },
  { id: 'ym2612_epiano', label: 'FM Electric Piano', dslWave: 'wave=ym2612_epiano gm=epiano1' },
  { id: 'ym2612_bell', label: 'FM Crystal Bell', dslWave: 'wave=ym2612_bell gm=vibraphone' },
  { id: 'ym2612_strings', label: 'FM Strings Pad', dslWave: 'wave=ym2612_strings gm=string_ensemble_1' },
  { id: 'ym2612_choir', label: 'FM Choir Pad', dslWave: 'wave=ym2612_choir gm=choir_aahs' },
  { id: 'ym2612_flute', label: 'FM Flute', dslWave: 'wave=ym2612_flute gm=flute' },
  { id: 'ym2612_bass', label: 'FM Synth Bass', dslWave: 'wave=ym2612_bass gm=electric_bass' },
  { id: 'ym2612_slap_bass', label: 'FM Slap Bass', dslWave: 'wave=ym2612_slap_bass gm=slap_bass_1' },
  { id: 'sub_bass', label: 'Deep Sub Bass', dslWave: 'wave=sub_bass gm=synth_bass_2' },
  { id: 'psg_square', label: 'PSG Chiptune Square', dslWave: 'wave=psg_square gm=lead_square' },
  { id: 'psg_arp', label: 'PSG Fast Arpeggio', dslWave: 'wave=psg_arp gm=clavinet' },
  { id: 'square', label: 'Square Lead', dslWave: 'wave=square duty=0.25 gm=lead_square' },
  { id: 'pulse', label: 'Pulse Lead', dslWave: 'wave=pulse duty=0.25 gm=lead_square' },
  { id: 'sawtooth', label: 'Sawtooth Lead', dslWave: 'wave=sawtooth gm=lead_sawtooth' },
  { id: 'triangle', label: 'Warm Triangle', dslWave: 'wave=triangle gm=ocarina' },
  { id: 'sine', label: 'Pure Sine', dslWave: 'wave=sine gm=ocarina' },
  { id: 'fm', label: '2-Op FM Synth', dslWave: 'wave=fm gm=epiano2' },
  { id: 'piano', label: 'Grand Piano', dslWave: 'wave=piano gm=acoustic_grand_piano' },
  { id: 'epiano', label: 'Rhodes E-Piano', dslWave: 'wave=epiano gm=epiano1' },
  { id: 'organ', label: 'Pipe / Rock Organ', dslWave: 'wave=organ gm=church_organ' },
  { id: 'guitar', label: 'Acoustic Guitar', dslWave: 'wave=guitar gm=acoustic_guitar' },
  { id: 'harp', label: 'Orchestral Harp', dslWave: 'wave=harp gm=orchestral_harp' },
  { id: 'violin', label: 'Solo Violin', dslWave: 'wave=violin gm=violin' },
  { id: 'cello', label: 'Solo Cello', dslWave: 'wave=cello gm=cello' },
  { id: 'strings', label: 'String Ensemble', dslWave: 'wave=strings gm=string_ensemble_1' },
  { id: 'voice', label: 'Choir Voice', dslWave: 'wave=voice gm=choir_aahs' },
  { id: 'flute', label: 'Concert Flute', dslWave: 'wave=flute gm=flute' },
  { id: 'oboe', label: 'Oboe', dslWave: 'wave=oboe gm=oboe' },
  { id: 'clarinet', label: 'Clarinet', dslWave: 'wave=clarinet gm=clarinet' },
  { id: 'shakuhachi', label: 'Shakuhachi', dslWave: 'wave=shakuhachi gm=shakuhachi' },
  { id: 'brass', label: 'Brass Section', dslWave: 'wave=brass gm=brass_section' },
  { id: 'trumpet', label: 'Trumpet', dslWave: 'wave=trumpet gm=trumpet' },
  { id: 'horn', label: 'French Horn', dslWave: 'wave=horn gm=french_horn' },
  { id: 'koto', label: 'Koto', dslWave: 'wave=koto gm=koto' },
  { id: 'shamisen', label: 'Shamisen', dslWave: 'wave=shamisen gm=shamisen' },
  { id: 'bell', label: 'Tubular Bell', dslWave: 'wave=bell gm=tubular_bells' }
];

const CLASSICAL_TEMPO_MARKINGS: Record<string, number> = {
  larghissimo: 24,
  grave: 42,
  largo: 50,
  lento: 56,
  larghetto: 63,
  adagio: 70,
  adagietto: 76,
  marcia_moderato: 84,
  andante: 88,
  andantino: 96,
  moderato: 112,
  allegretto: 120,
  allegro_moderato: 124,
  allegro: 138,
  vivace: 160,
  vivacissimo: 172,
  allegrissimo: 176,
  presto: 188,
  prestissimo: 208
};

const DRUM_WAVE_TYPES = new Set([
  'noise',
  'kick',
  'snare',
  'tom',
  'hat',
  'open_hat',
  'crash',
  'ym2612_kick',
  'ym2612_snare',
  'ym2612_tom',
  'ym2612_hat',
  'ym2612_open_hat',
  'ym2612_crash'
]);

function normalizeMusicWaveId(raw: string): string {
  const w = (raw || '').trim().toLowerCase();
  switch (w) {
    case 'sine':
    case 'sin':
      return 'sine';
    case 'square':
    case 'sq':
      return 'square';
    case 'pulse':
      return 'pulse';
    case 'triangle':
    case 'tri':
      return 'triangle';
    case 'sawtooth':
    case 'saw':
      return 'sawtooth';
    case 'noise':
    case 'white_noise':
      return 'noise';
    case 'fm':
    case 'fm2':
      return 'fm';
    case 'piano':
    case 'grand_piano':
      return 'piano';
    case 'epiano':
    case 'rhodes':
      return 'epiano';
    case 'organ':
    case 'pipe_organ':
    case 'church_organ':
      return 'organ';
    case 'guitar':
    case 'acoustic_guitar':
      return 'guitar';
    case 'harp':
    case 'pluck':
      return 'harp';
    case 'violin':
      return 'violin';
    case 'cello':
      return 'cello';
    case 'strings':
    case 'ensemble':
      return 'strings';
    case 'voice':
    case 'choir':
    case 'vocal':
      return 'voice';
    case 'flute':
      return 'flute';
    case 'oboe':
      return 'oboe';
    case 'clarinet':
      return 'clarinet';
    case 'shakuhachi':
      return 'shakuhachi';
    case 'brass':
    case 'brass_ensemble':
      return 'brass';
    case 'trumpet':
      return 'trumpet';
    case 'horn':
    case 'french_horn':
      return 'horn';
    case 'koto':
      return 'koto';
    case 'shamisen':
      return 'shamisen';
    case 'bell':
    case 'chime':
      return 'bell';
    case 'ym2612_guitar':
    case 'overdriven_guitar':
    case 'distortion_guitar':
    case 'electric_guitar':
    case 'fm_guitar':
      return 'ym2612_guitar';
    case 'ym2612_rhythm_guitar':
    case 'rhythm_guitar':
    case 'power_guitar':
    case 'muted_guitar':
      return 'ym2612_rhythm_guitar';
    case 'ym2612_bass':
    case 'synth_bass':
    case 'fm_bass':
    case 'bass':
      return 'ym2612_bass';
    case 'ym2612_slap_bass':
    case 'slap_bass':
      return 'ym2612_slap_bass';
    case 'sub_bass':
      return 'sub_bass';
    case 'ym2612_brass':
    case 'fm_brass':
    case 'synth_brass':
    case 'polysynth':
      return 'ym2612_brass';
    case 'ym2612_epiano':
    case 'fm_epiano':
    case 'dx7':
      return 'ym2612_epiano';
    case 'ym2612_strings':
    case 'fm_strings':
    case 'synth_strings':
      return 'ym2612_strings';
    case 'ym2612_choir':
    case 'fm_choir':
    case 'ym2612_voice':
      return 'ym2612_choir';
    case 'ym2612_flute':
    case 'fm_flute':
      return 'ym2612_flute';
    case 'ym2612_bell':
    case 'fm_bell':
      return 'ym2612_bell';
    case 'psg_square':
    case 'psg_pulse':
    case 'sn76489':
      return 'psg_square';
    case 'psg_arp':
      return 'psg_arp';
    default:
      return w || 'ym2612_brass';
  }
}

function normalizeSfxToneId(raw: string): string {
  const w = (raw || '').trim().toLowerCase();
  if (w === 'pulse' || w === 'sq' || w === 'square' || w === 'psg_square') return 'square';
  if (w === 'saw' || w === 'sawtooth') return 'sawtooth';
  if (w === 'tri' || w === 'triangle') return 'triangle';
  if (w === 'sin' || w === 'sine') return 'sine';
  if (w === 'fm' || w === 'fm2') return 'fm';
  if (w === 'noise' || w === 'psg_noise' || w === 'lfsr' || w === 'white_noise') return 'psg_noise';
  return 'square';
}

function noteNameToHz(token: string): number | null {
  const m = token.trim().match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
  if (!m) return null;
  const baseMap: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11
  };
  let semi = baseMap[m[1].toUpperCase()];
  if (semi === undefined) return null;
  if (m[2] === '#') semi += 1;
  else if (m[2] === 'b') semi -= 1;
  const octave = parseInt(m[3], 10);
  const midi = (octave + 1) * 12 + semi;
  return Math.round(440 * Math.pow(2, (midi - 69) / 12));
}

const FALLBACK_SFX_PRESETS: SFXPresetInfo[] = [
  { name: 'arcade_laser', wave: 'square', startFreq: 950, endFreq: 110, pitchCurve: 'exp', dutyStart: 0.5, dutyEnd: 0.125, lpfStart: 0, lpfEnd: 0, hpfStart: 0, hpfEnd: 0, q: 1, attack: 0.002, decay: 0.06, sustain: 0.25, release: 0.04, volume: 0.28 },
  { name: 'plasma_gun', wave: 'sawtooth', startFreq: 1200, endFreq: 180, pitchCurve: 'exp', dutyStart: 0.5, dutyEnd: 0.5, lpfStart: 3500, lpfEnd: 400, hpfStart: 0, hpfEnd: 0, q: 2.2, attack: 0.002, decay: 0.08, sustain: 0.2, release: 0.05, volume: 0.30 },
  { name: 'explosion_arcade', wave: 'psg_noise', startFreq: 180, endFreq: 25, pitchCurve: 'exp', dutyStart: 0.5, dutyEnd: 0.5, lpfStart: 1200, lpfEnd: 150, hpfStart: 0, hpfEnd: 0, q: 1.5, attack: 0.003, decay: 0.28, sustain: 0.15, release: 0.22, volume: 0.36 },
  { name: 'explosion_deep', wave: 'sine', startFreq: 120, endFreq: 24, pitchCurve: 'exp', dutyStart: 0.5, dutyEnd: 0.5, lpfStart: 0, lpfEnd: 0, hpfStart: 0, hpfEnd: 0, q: 1, attack: 0.004, decay: 0.35, sustain: 0.2, release: 0.25, volume: 0.40 },
  { name: 'jump_arcade', wave: 'square', startFreq: 160, endFreq: 620, pitchCurve: 'exp', dutyStart: 0.5, dutyEnd: 0.5, lpfStart: 0, lpfEnd: 0, hpfStart: 0, hpfEnd: 0, q: 1, attack: 0.003, decay: 0.04, sustain: 0.55, release: 0.05, volume: 0.26 },
  { name: 'jump_spring', wave: 'triangle', startFreq: 120, endFreq: 480, pitchCurve: 'exp', dutyStart: 0.5, dutyEnd: 0.5, lpfStart: 0, lpfEnd: 0, hpfStart: 0, hpfEnd: 0, q: 1, attack: 0.004, decay: 0.06, sustain: 0.45, release: 0.06, volume: 0.28 },
  { name: 'coin_pickup', wave: 'square', startFreq: 988, endFreq: 1319, pitchCurve: 'exp', dutyStart: 0.5, dutyEnd: 0.5, lpfStart: 0, lpfEnd: 0, hpfStart: 0, hpfEnd: 0, q: 1, attack: 0.002, decay: 0.025, sustain: 0.35, release: 0.035, volume: 0.22 },
  { name: 'gem_shimmer', wave: 'fm', startFreq: 1568, endFreq: 1568, pitchCurve: 'exp', dutyStart: 0.5, dutyEnd: 0.5, lpfStart: 0, lpfEnd: 0, hpfStart: 0, hpfEnd: 0, q: 1, attack: 0.001, decay: 0.06, sustain: 0.15, release: 0.12, volume: 0.20 },
  { name: 'sword_clash', wave: 'fm', startFreq: 520, endFreq: 210, pitchCurve: 'exp', dutyStart: 0.5, dutyEnd: 0.5, lpfStart: 0, lpfEnd: 0, hpfStart: 0, hpfEnd: 0, q: 1, attack: 0.001, decay: 0.04, sustain: 0.08, release: 0.1, volume: 0.32 },
  { name: 'shield_deflect', wave: 'fm', startFreq: 880, endFreq: 440, pitchCurve: 'exp', dutyStart: 0.5, dutyEnd: 0.5, lpfStart: 0, lpfEnd: 0, hpfStart: 0, hpfEnd: 0, q: 1, attack: 0.001, decay: 0.05, sustain: 0.1, release: 0.08, volume: 0.28 },
  { name: 'hit_punch', wave: 'triangle', startFreq: 180, endFreq: 45, pitchCurve: 'hyper', dutyStart: 0.5, dutyEnd: 0.5, lpfStart: 0, lpfEnd: 0, hpfStart: 0, hpfEnd: 0, q: 1, attack: 0.001, decay: 0.05, sustain: 0.1, release: 0.05, volume: 0.38 },
  { name: 'hit_damage', wave: 'sawtooth', startFreq: 220, endFreq: 65, pitchCurve: 'exp', dutyStart: 0.5, dutyEnd: 0.5, lpfStart: 0, lpfEnd: 0, hpfStart: 0, hpfEnd: 0, q: 1, attack: 0.002, decay: 0.06, sustain: 0.15, release: 0.05, volume: 0.32 },
  { name: 'powerup_fanfare', wave: 'square', startFreq: 523, endFreq: 1046, pitchCurve: 'exp', dutyStart: 0.25, dutyEnd: 0.5, lpfStart: 0, lpfEnd: 0, hpfStart: 0, hpfEnd: 0, q: 1, attack: 0.003, decay: 0.04, sustain: 0.5, release: 0.06, volume: 0.24 },
  { name: 'ui_select', wave: 'sine', startFreq: 880, endFreq: 1100, pitchCurve: 'lin', dutyStart: 0.5, dutyEnd: 0.5, lpfStart: 0, lpfEnd: 0, hpfStart: 0, hpfEnd: 0, q: 1, attack: 0.001, decay: 0.015, sustain: 0.05, release: 0.015, volume: 0.18 },
  { name: 'ui_confirm', wave: 'square', startFreq: 659, endFreq: 1319, pitchCurve: 'exp', dutyStart: 0.5, dutyEnd: 0.5, lpfStart: 0, lpfEnd: 0, hpfStart: 0, hpfEnd: 0, q: 1, attack: 0.002, decay: 0.025, sustain: 0.3, release: 0.03, volume: 0.20 },
  { name: 'ui_error', wave: 'sawtooth', startFreq: 150, endFreq: 110, pitchCurve: 'lin', dutyStart: 0.5, dutyEnd: 0.5, lpfStart: 0, lpfEnd: 0, hpfStart: 0, hpfEnd: 0, q: 1, attack: 0.002, decay: 0.05, sustain: 0.4, release: 0.04, volume: 0.25 },
  { name: 'footstep_stone', wave: 'noise', startFreq: 320, endFreq: 110, pitchCurve: 'exp', dutyStart: 0.5, dutyEnd: 0.5, lpfStart: 1400, lpfEnd: 400, hpfStart: 0, hpfEnd: 0, q: 1, attack: 0.001, decay: 0.025, sustain: 0.05, release: 0.02, volume: 0.20 },
  { name: 'engine_thruster', wave: 'psg_noise', startFreq: 110, endFreq: 110, pitchCurve: 'exp', dutyStart: 0.5, dutyEnd: 0.5, lpfStart: 0, lpfEnd: 0, hpfStart: 0, hpfEnd: 0, q: 1, attack: 0.01, decay: 0.08, sustain: 0.65, release: 0.08, volume: 0.22 }
];

const DEFAULT_SFX_DSL = `title "Arcade Pulse Laser"
type sfx

inst laser preset=arcade_laser duty=0.50->0.125 vol=0.32
track main laser: 950Hz->110Hz:140ms
`;

const DEFAULT_MUSIC_DSL = `title "Neon Stage Groove"
type song
tempo allegro 132
time 4/4

inst lead   wave=ym2612_brass gm=synth_brass_1 vol=0.22 pan=-0.15
inst pad    wave=ym2612_epiano gm=epiano1 vol=0.16 pan=0.25
inst bass   wave=ym2612_slap_bass gm=slap_bass_1 vol=0.26 pan=0.0
inst kick   wave=ym2612_kick vol=0.20 pan=0.0

pattern hook = A4:8 C5:8 E5:4 D5:8 C5:8 G4:4 | F4:8 A4:8 C5:4 B4:8 G4:8 E4:4
pattern chords = [A3 C4 E4]:2 [G3 B3 D4]:2 | [F3 A3 C4]:2 [E3 G3 B3]:2
pattern bassline = A1:8 A2:8 A1:8 G1:8 G1:8 G2:8 G1:8 E1:8 | F1:8 F2:8 F1:8 E1:8 E1:8 E2:8 E1:8 G1:8
pattern beat = (kick:8 hat:8 snare:8 hat:8)*2 | (kick:8 hat:8 snare:8 hat:8)*2

track lead_ch lead:     (hook)*2
track pad_ch pad:       (chords)*2
track bass_ch bass:     (bassline)*2
track drum_ch kick:     (beat)*2
`;

function ensureModernWebPolyfills(): void {
  if (typeof window === 'undefined' || typeof HTMLElement === 'undefined') return;
  if (!('popover' in HTMLElement.prototype)) {
    const cdnPopover = 'https://unpkg.com/@oddbird/popover-polyfill@latest/dist/popover.min.js';
    import(/* @vite-ignore */ cdnPopover).catch(() => {});
  }
  if (
    typeof document !== 'undefined' &&
    document.documentElement &&
    !('anchorName' in document.documentElement.style)
  ) {
    const cdnAnchor = 'https://unpkg.com/@oddbird/css-anchor-positioning';
    import(/* @vite-ignore */ cdnAnchor).catch(() => {});
  }
  if (
    typeof HTMLButtonElement !== 'undefined' &&
    !Object.prototype.hasOwnProperty.call(HTMLButtonElement.prototype, 'interestForElement')
  ) {
    const cdnInterest = 'https://unpkg.com/interestfor@latest';
    import(/* @vite-ignore */ cdnInterest).catch(() => {});
  }
}

export class SoundStudioUI {
  private rootEl: HTMLElement;

  // Toolbar controls
  private tabSfxBtn!: HTMLButtonElement;
  private tabMusicBtn!: HTMLButtonElement;
  private fileSelectEl!: HTMLSelectElement;
  private playBtnEl!: HTMLButtonElement;
  private undoBtnEl!: HTMLButtonElement;
  private redoBtnEl!: HTMLButtonElement;
  private resetBtnEl!: HTMLButtonElement;
  private loopBtnEl!: HTMLButtonElement;
  private saveBtnEl!: HTMLButtonElement;
  private exportBtnEl!: HTMLButtonElement;

  // Popover controls
  private engineYmBtn!: HTMLButtonElement;
  private engineAppleBtn!: HTMLButtonElement;
  private vizWaveformBtn!: HTMLButtonElement;
  private vizSpectrumBtn!: HTMLButtonElement;
  private diagnosticsContainerEl!: HTMLElement;
  private editorTextarea!: HTMLTextAreaElement;

  // Visualizer & transport
  private canvasEl!: HTMLCanvasElement;
  private statusPillBtn!: HTMLButtonElement;
  private timeReadoutEl!: HTMLElement;
  private scrubSliderEl!: HTMLInputElement;

  // Human control containers
  private sfxShaperPaneEl!: HTMLElement;
  private sfxPresetGridEl!: HTMLElement;
  private sfxToneGroupEl!: HTMLElement;
  private sfxStartFreqSlider!: HTMLInputElement;
  private sfxStartFreqVal!: HTMLElement;
  private sfxEndFreqSlider!: HTMLInputElement;
  private sfxEndFreqVal!: HTMLElement;
  private sfxDurSlider!: HTMLInputElement;
  private sfxDurVal!: HTMLElement;
  private sfxBrightSlider!: HTMLInputElement;
  private sfxBrightVal!: HTMLElement;
  private sfxGritSlider!: HTMLInputElement;
  private sfxGritVal!: HTMLElement;

  private musicMixerPaneEl!: HTMLElement;
  private musicBpmSlider!: HTMLInputElement;
  private musicBpmVal!: HTMLElement;
  private musicBankChipBtn!: HTMLButtonElement;
  private musicBankAppleBtn!: HTMLButtonElement;
  private trackListEl!: HTMLElement;

  // Bottom prompt bar
  private chatNoteInputEl!: HTMLInputElement;
  private sendChatBtnEl!: HTMLButtonElement;

  // State
  private catalog: SoundFilesCatalog = {
    musicLibrary: [],
    sfxLibrary: [],
    workspaceFiles: []
  };
  private sfxPresets: SFXPresetInfo[] = [...FALLBACK_SFX_PRESETS];
  private activeFilePath: string = '';
  private activeFileName: string = 'laser_arcade.sfx';
  private activeDocType: 'music' | 'sfx' = 'sfx';
  private useAppleSynth = false;
  private loopEnabled = false;
  private visualizerMode: VisualizerMode = 'waveform';
  private soloTracks: Set<string> = new Set();
  private muteTracks: Set<string> = new Set();
  private trackMetaCache: Map<string, { waveType: string; volume: number; pan: number }> = new Map();
  private trackStemBuffers: Map<string, AudioBuffer> = new Map();
  private trackStemPeaks: Map<string, Float32Array> = new Map();
  private trackStemBaseMeta: Map<string, { volume: number; pan: number }> = new Map();
  private trackLiveMeta: Map<string, { volume: number; pan: number }> = new Map();
  private activeStemNodes: Map<
    string,
    { source: AudioBufferSourceNode; gain: GainNode; pan: StereoPannerNode }
  > = new Map();
  private masterLimiterNode: WaveShaperNode | null = null;
  private lastSynthesizedNonMixerDsl: string = '';
  private exportWavNeedsResynth = false;
  private lastBuildId: string = '';
  private lastReport: SoundValidationReport | null = null;
  private isSynthesizing = false;
  private pendingSynthRequest: { autoPlay: boolean; preservePlayhead: boolean } | null = null;
  private realtimeDebounceTimer: number | null = null;
  private dslDirty = true;

  // Undo / Redo / Reset History
  private undoStack: SoundHistorySnapshot[] = [];
  private redoStack: SoundHistorySnapshot[] = [];
  private initialSnapshot: SoundHistorySnapshot | null = null;
  private sliderDragSnapshotTaken = false;
  private modeSavedState: Record<'sfx' | 'music', SavedDocModeState | null> = {
    sfx: null,
    music: null
  };

  private sfxState: SfxShaperState = {
    title: 'Arcade Laser',
    preset: 'arcade_laser',
    wave: 'square',
    startFreq: 950,
    endFreq: 110,
    durationMs: 140,
    brightnessHz: 8000,
    gritPct: 0,
    volume: 0.35,
    pitchCurve: 'exp'
  };

  // WebAudio
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private decodedBuffer: AudioBuffer | null = null;
  private isPlaying = false;
  private playStartCtxTime = 0;
  private playOffsetSec = 0;
  private rafId: number | null = null;

  constructor(options: SoundStudioOptions) {
    this.rootEl = options.rootEl;
    ensureModernWebPolyfills();
    this.renderLayout();
    this.bindEvents();
    this.initializeStudio();
  }

  private renderLayout(): void {
    this.rootEl.innerHTML = `
      <div class="sound-studio-shell">
        <!-- Single-Row Minimalist Toolbar -->
        <header class="sound-toolbar">
          <div class="sound-toolbar-main">
            <div class="sound-mode-tabs" role="tablist" aria-label="Sound Studio Mode">
              <button
                type="button"
                id="tab-sound-sfx"
                class="sound-mode-tab active"
                role="tab"
                aria-selected="true"
                aria-controls="sound-sfx-shaper"
                tabindex="0"
              >
                SFX
              </button>
              <button
                type="button"
                id="tab-sound-music"
                class="sound-mode-tab"
                role="tab"
                aria-selected="false"
                aria-controls="sound-music-mixer"
                tabindex="-1"
              >
                Music
              </button>
            </div>

            <select
              id="sound-file-select"
              class="sound-file-select"
              aria-label="Select sound effect or music track"
            >
              <option value="">Select sound effect...</option>
            </select>

            <button
              type="button"
              id="btn-sound-play"
              class="btn btn-primary sound-play-btn"
            >
              Play
            </button>
          </div>

          <div class="sound-toolbar-edges">
            <button
              type="button"
              id="btn-sound-undo"
              class="icon sound-icon-btn"
              style="--icon: var(--icon-undo);"
              aria-label="Undo change"
              interestfor="tip-sound-undo"
              disabled
            ></button>
            <div id="tip-sound-undo" popover="hint" class="sound-hint-tooltip">Undo (⌘Z)</div>

            <button
              type="button"
              id="btn-sound-redo"
              class="icon sound-icon-btn"
              style="--icon: var(--icon-redo);"
              aria-label="Redo change"
              interestfor="tip-sound-redo"
              disabled
            ></button>
            <div id="tip-sound-redo" popover="hint" class="sound-hint-tooltip">Redo (⇧⌘Z)</div>

            <button
              type="button"
              id="btn-sound-reset"
              class="icon sound-icon-btn"
              style="--icon: var(--icon-reset);"
              aria-label="Reset changes"
              interestfor="tip-sound-reset"
              disabled
            ></button>
            <div id="tip-sound-reset" popover="hint" class="sound-hint-tooltip">Reset to original</div>

            <span class="sound-toolbar-divider" aria-hidden="true"></span>

            <button
              type="button"
              id="btn-sound-loop"
              class="icon sound-icon-btn"
              style="--icon: var(--icon-repeat);"
              aria-label="Loop playback"
              aria-pressed="false"
              interestfor="tip-sound-loop"
            ></button>
            <div id="tip-sound-loop" popover="hint" class="sound-hint-tooltip">Loop playback</div>

            <button
              type="button"
              id="btn-sound-new-trigger"
              class="icon sound-icon-btn"
              style="--icon: var(--icon-plus);"
              popovertarget="sound-new-menu"
              aria-label="New sound or song"
              interestfor="tip-sound-new"
            ></button>
            <div id="tip-sound-new" popover="hint" class="sound-hint-tooltip">New sound or song</div>

            <button
              type="button"
              id="btn-sound-settings-trigger"
              class="icon sound-icon-btn"
              style="--icon: var(--icon-tune);"
              popovertarget="sound-settings-menu"
              aria-label="Audio settings and diagnostics"
              interestfor="tip-sound-settings"
            ></button>
            <div id="tip-sound-settings" popover="hint" class="sound-hint-tooltip">Settings &amp; Code</div>

            <button
              type="button"
              id="btn-sound-save"
              class="icon sound-icon-btn"
              style="--icon: var(--icon-save);"
              aria-label="Save file"
              interestfor="tip-sound-save"
            ></button>
            <div id="tip-sound-save" popover="hint" class="sound-hint-tooltip">Save to project</div>

            <button
              type="button"
              id="btn-sound-export"
              class="icon sound-icon-btn"
              style="--icon: var(--icon-download);"
              aria-label="Download WAV"
              interestfor="tip-sound-export"
            ></button>
            <div id="tip-sound-export" popover="hint" class="sound-hint-tooltip">Download WAV</div>
          </div>
        </header>

        <!-- Light-Dismiss Popover: New Sound / Song -->
        <div id="sound-new-menu" popover="auto" class="sound-popover-panel">
          <button type="button" id="btn-sound-new-sfx" class="sound-popover-action">
            New Sound Effect (.sfx)
          </button>
          <button type="button" id="btn-sound-new-music" class="sound-popover-action">
            New Music Track (.music)
          </button>
        </div>

        <!-- Light-Dismiss Popover: Settings, Diagnostics & Raw DSL Code -->
        <aside id="sound-settings-menu" popover="auto" class="sound-popover-panel sound-settings-popover">
          <div class="sound-popover-section">
            <span class="sound-popover-label">Visualizer</span>
            <div class="sound-segmented-group">
              <button type="button" id="btn-viz-waveform" class="sound-seg-btn active">Waveform</button>
              <button type="button" id="btn-viz-spectrum" class="sound-seg-btn">Spectrum</button>
            </div>
          </div>

          <div class="sound-popover-section">
            <span class="sound-popover-label">Music Synth Engine</span>
            <div class="sound-segmented-group">
              <button type="button" id="btn-engine-ym2612" class="sound-seg-btn active">16-Bit YM2612</button>
              <button type="button" id="btn-engine-apple" class="sound-seg-btn">Real Instruments</button>
            </div>
          </div>

          <details class="sound-popover-details" id="sound-diagnostics-details">
            <summary>Audio Quality &amp; Diagnostics</summary>
            <div id="sound-diagnostics-body" class="sound-diagnostics-body"></div>
          </details>

          <details class="sound-popover-details">
            <summary>Advanced: DSL Source Code</summary>
            <div class="sound-dsl-drawer-body">
              <textarea
                id="sound-dsl-textarea"
                class="sound-dsl-textarea"
                spellcheck="false"
                aria-label="Procedural audio DSL source"
              ></textarea>
              <button type="button" id="btn-apply-raw-dsl" class="btn btn-secondary sound-apply-dsl-btn">
                Apply Code
              </button>
            </div>
          </details>
        </aside>

        <!-- Forefront Hero Stage (80%+ of screen) -->
        <main class="sound-hero-stage">
          <!-- 1. Interactive Waveform & Transport Card -->
          <section class="sound-wave-card" aria-label="Audio Waveform Player">
            <div class="sound-wave-canvas-wrap">
              <canvas id="sound-visualizer-canvas" width="900" height="140"></canvas>
              <div class="sound-wave-overlay">
                <span id="sound-time-readout" class="sound-time-pill">0.00s</span>
                <button
                  type="button"
                  id="btn-sound-status-pill"
                  class="sound-status-pill pass"
                  popovertarget="sound-settings-menu"
                  title="Click to inspect audio diagnostics"
                >
                  Ready
                </button>
              </div>
            </div>
            <input
              type="range"
              id="sound-scrub-slider"
              class="sound-scrub-slider"
              min="0"
              max="1000"
              step="1"
              value="0"
              aria-label="Playback position"
            />
          </section>

          <!-- 2A. Human-Friendly Sound Effect Shaper (visible for .sfx) -->
          <section
            id="sound-sfx-shaper"
            class="sound-controls-card"
            role="tabpanel"
            aria-labelledby="tab-sound-sfx"
          >
            <div class="sound-preset-strip" id="sound-sfx-preset-grid" aria-label="Sound Effect Presets"></div>

            <div class="sound-tone-row">
              <span class="sound-control-label">Tone</span>
              <div class="sound-tone-group" id="sound-sfx-tone-group"></div>
            </div>

            <div class="sound-sliders-grid">
              <label class="sound-slider-field">
                <div class="sound-slider-header">
                  <span>Start Pitch</span>
                  <strong id="val-sfx-start-freq">950 Hz</strong>
                </div>
                <input type="range" id="slider-sfx-start-freq" min="40" max="2000" step="5" value="950" />
              </label>

              <label class="sound-slider-field">
                <div class="sound-slider-header">
                  <span>End Pitch</span>
                  <strong id="val-sfx-end-freq">110 Hz</strong>
                </div>
                <input type="range" id="slider-sfx-end-freq" min="20" max="2000" step="5" value="110" />
              </label>

              <label class="sound-slider-field">
                <div class="sound-slider-header">
                  <span>Length</span>
                  <strong id="val-sfx-dur">140 ms</strong>
                </div>
                <input type="range" id="slider-sfx-dur" min="30" max="1000" step="10" value="140" />
              </label>

              <label class="sound-slider-field">
                <div class="sound-slider-header">
                  <span>Brightness</span>
                  <strong id="val-sfx-bright">Open</strong>
                </div>
                <input type="range" id="slider-sfx-bright" min="200" max="8000" step="100" value="8000" />
              </label>

              <label class="sound-slider-field">
                <div class="sound-slider-header">
                  <span>Grit</span>
                  <strong id="val-sfx-grit">0%</strong>
                </div>
                <input type="range" id="slider-sfx-grit" min="0" max="90" step="5" value="0" />
              </label>
            </div>
          </section>

          <!-- 2B. Human-Friendly Song Mixer (visible for .music) -->
          <section
            id="sound-music-mixer"
            class="sound-controls-card hidden"
            role="tabpanel"
            aria-labelledby="tab-sound-music"
          >
            <div class="sound-music-top-bar">
              <label class="sound-slider-field sound-tempo-field">
                <div class="sound-slider-header">
                  <span>Tempo</span>
                  <strong id="val-music-bpm">132 BPM</strong>
                </div>
                <input type="range" id="slider-music-bpm" min="40" max="220" step="1" value="132" />
              </label>

              <div class="sound-bank-switch">
                <span class="sound-control-label">Instruments</span>
                <div class="sound-segmented-group">
                  <button type="button" id="btn-music-bank-chip" class="sound-seg-btn active">16-Bit Chiptune</button>
                  <button type="button" id="btn-music-bank-apple" class="sound-seg-btn">Real Instruments</button>
                </div>
              </div>
            </div>

            <div id="sound-track-list" class="sound-track-list"></div>
          </section>
        </main>

        <!-- Bottom Prompt Bar -->
        <footer class="sound-prompt-bar">
          <input
            type="text"
            id="sound-chat-note-input"
            class="sound-prompt-input"
            placeholder="Describe a sound or ask to change the song..."
            aria-label="Prompt to modify sound or song"
          />
          <button
            type="button"
            id="btn-sound-send-chat"
            class="btn btn-primary sound-send-btn"
          >
            Send
          </button>
        </footer>
      </div>
    `;

    this.tabSfxBtn = this.rootEl.querySelector('#tab-sound-sfx') as HTMLButtonElement;
    this.tabMusicBtn = this.rootEl.querySelector('#tab-sound-music') as HTMLButtonElement;
    this.fileSelectEl = this.rootEl.querySelector('#sound-file-select') as HTMLSelectElement;
    this.playBtnEl = this.rootEl.querySelector('#btn-sound-play') as HTMLButtonElement;
    this.undoBtnEl = this.rootEl.querySelector('#btn-sound-undo') as HTMLButtonElement;
    this.redoBtnEl = this.rootEl.querySelector('#btn-sound-redo') as HTMLButtonElement;
    this.resetBtnEl = this.rootEl.querySelector('#btn-sound-reset') as HTMLButtonElement;
    this.loopBtnEl = this.rootEl.querySelector('#btn-sound-loop') as HTMLButtonElement;
    this.saveBtnEl = this.rootEl.querySelector('#btn-sound-save') as HTMLButtonElement;
    this.exportBtnEl = this.rootEl.querySelector('#btn-sound-export') as HTMLButtonElement;

    this.engineYmBtn = this.rootEl.querySelector('#btn-engine-ym2612') as HTMLButtonElement;
    this.engineAppleBtn = this.rootEl.querySelector('#btn-engine-apple') as HTMLButtonElement;
    this.vizWaveformBtn = this.rootEl.querySelector('#btn-viz-waveform') as HTMLButtonElement;
    this.vizSpectrumBtn = this.rootEl.querySelector('#btn-viz-spectrum') as HTMLButtonElement;
    this.diagnosticsContainerEl = this.rootEl.querySelector('#sound-diagnostics-body') as HTMLElement;
    this.editorTextarea = this.rootEl.querySelector('#sound-dsl-textarea') as HTMLTextAreaElement;

    this.canvasEl = this.rootEl.querySelector('#sound-visualizer-canvas') as HTMLCanvasElement;
    this.statusPillBtn = this.rootEl.querySelector('#btn-sound-status-pill') as HTMLButtonElement;
    this.timeReadoutEl = this.rootEl.querySelector('#sound-time-readout') as HTMLElement;
    this.scrubSliderEl = this.rootEl.querySelector('#sound-scrub-slider') as HTMLInputElement;

    this.sfxShaperPaneEl = this.rootEl.querySelector('#sound-sfx-shaper') as HTMLElement;
    this.sfxPresetGridEl = this.rootEl.querySelector('#sound-sfx-preset-grid') as HTMLElement;
    this.sfxToneGroupEl = this.rootEl.querySelector('#sound-sfx-tone-group') as HTMLElement;
    this.sfxStartFreqSlider = this.rootEl.querySelector('#slider-sfx-start-freq') as HTMLInputElement;
    this.sfxStartFreqVal = this.rootEl.querySelector('#val-sfx-start-freq') as HTMLElement;
    this.sfxEndFreqSlider = this.rootEl.querySelector('#slider-sfx-end-freq') as HTMLInputElement;
    this.sfxEndFreqVal = this.rootEl.querySelector('#val-sfx-end-freq') as HTMLElement;
    this.sfxDurSlider = this.rootEl.querySelector('#slider-sfx-dur') as HTMLInputElement;
    this.sfxDurVal = this.rootEl.querySelector('#val-sfx-dur') as HTMLElement;
    this.sfxBrightSlider = this.rootEl.querySelector('#slider-sfx-bright') as HTMLInputElement;
    this.sfxBrightVal = this.rootEl.querySelector('#val-sfx-bright') as HTMLElement;
    this.sfxGritSlider = this.rootEl.querySelector('#slider-sfx-grit') as HTMLInputElement;
    this.sfxGritVal = this.rootEl.querySelector('#val-sfx-grit') as HTMLElement;

    this.musicMixerPaneEl = this.rootEl.querySelector('#sound-music-mixer') as HTMLElement;
    this.musicBpmSlider = this.rootEl.querySelector('#slider-music-bpm') as HTMLInputElement;
    this.musicBpmVal = this.rootEl.querySelector('#val-music-bpm') as HTMLElement;
    this.musicBankChipBtn = this.rootEl.querySelector('#btn-music-bank-chip') as HTMLButtonElement;
    this.musicBankAppleBtn = this.rootEl.querySelector('#btn-music-bank-apple') as HTMLButtonElement;
    this.trackListEl = this.rootEl.querySelector('#sound-track-list') as HTMLElement;

    this.chatNoteInputEl = this.rootEl.querySelector('#sound-chat-note-input') as HTMLInputElement;
    this.sendChatBtnEl = this.rootEl.querySelector('#btn-sound-send-chat') as HTMLButtonElement;

    this.renderSfxPresetChips();
    this.renderSfxToneButtons();
  }

  private renderSfxPresetChips(): void {
    this.sfxPresetGridEl.innerHTML = FRIENDLY_SFX_PRESETS.map(
      (p) => `
        <button
          type="button"
          class="sound-preset-chip ${this.sfxState.preset === p.id ? 'active' : ''}"
          data-preset="${p.id}"
        >
          ${p.label}
        </button>
      `
    ).join('');

    this.sfxPresetGridEl.querySelectorAll('.sound-preset-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const presetId = (btn as HTMLElement).getAttribute('data-preset') || '';
        if (presetId) {
          this.applySfxPreset(presetId);
        }
      });
    });
  }

  private renderSfxToneButtons(): void {
    this.sfxToneGroupEl.innerHTML = FRIENDLY_SFX_TONES.map(
      (t) => `
        <button
          type="button"
          class="sound-tone-btn ${this.sfxState.wave === t.id ? 'active' : ''}"
          data-wave="${t.id}"
        >
          ${t.label}
        </button>
      `
    ).join('');

    this.sfxToneGroupEl.querySelectorAll('.sound-tone-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const wave = (btn as HTMLElement).getAttribute('data-wave') || 'square';
        if (this.sfxState.wave === wave) return;
        this.recordHistoryBeforeChange();
        this.sfxState.wave = wave;
        this.renderSfxToneButtons();
        this.updateSfxDslInPlace('wave');
        void this.synthesizeAndPlay(true, false);
      });
    });
  }

  private captureSnapshot(): SoundHistorySnapshot {
    return {
      dsl: this.editorTextarea.value,
      soloTracks: Array.from(this.soloTracks),
      muteTracks: Array.from(this.muteTracks),
      useAppleSynth: this.useAppleSynth
    };
  }

  private snapshotsEqual(a: SoundHistorySnapshot | null, b: SoundHistorySnapshot | null): boolean {
    if (!a || !b) return false;
    return (
      a.dsl === b.dsl &&
      a.useAppleSynth === b.useAppleSynth &&
      a.soloTracks.join(',') === b.soloTracks.join(',') &&
      a.muteTracks.join(',') === b.muteTracks.join(',')
    );
  }

  private resetHistoryBaseline(): void {
    this.initialSnapshot = this.captureSnapshot();
    this.undoStack = [];
    this.redoStack = [];
    this.sliderDragSnapshotTaken = false;
    this.updateHistoryButtonsUI();
  }

  private recordHistoryBeforeChange(): void {
    const current = this.captureSnapshot();
    const top = this.undoStack.length > 0 ? this.undoStack[this.undoStack.length - 1] : null;
    if (!this.snapshotsEqual(current, top)) {
      this.undoStack.push(current);
      if (this.undoStack.length > 50) {
        this.undoStack.shift();
      }
    }
    this.redoStack = [];
    this.updateHistoryButtonsUI();
  }

  private updateHistoryButtonsUI(): void {
    if (!this.undoBtnEl || !this.redoBtnEl || !this.resetBtnEl) return;
    const current = this.captureSnapshot();
    this.undoBtnEl.disabled = this.undoStack.length === 0;
    this.redoBtnEl.disabled = this.redoStack.length === 0;
    this.resetBtnEl.disabled =
      !this.initialSnapshot || this.snapshotsEqual(current, this.initialSnapshot);
  }

  private stripMixerPropsFromDsl(dsl: string): string {
    return dsl
      .split('\n')
      .map((raw) => {
        const trimmed = raw.trim();
        if (/^(?:inst|patch)\b/i.test(trimmed)) {
          const stripped = trimmed
            .replace(/\b(?:vol|volume)=[^\s]+/gi, '')
            .replace(/\bpan=[^\s]+/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
          const autoDrumMatch = stripped.match(/^(?:inst|patch)\s+([^\s]+)\s+wave=([^\s]+)$/i);
          if (
            autoDrumMatch &&
            autoDrumMatch[1].toLowerCase() === autoDrumMatch[2].toLowerCase() &&
            DRUM_WAVE_TYPES.has(autoDrumMatch[1].toLowerCase())
          ) {
            return '';
          }
          return stripped;
        }
        return trimmed;
      })
      .filter(Boolean)
      .join('\n');
  }

  private syncLiveTrackMetaFromDsl(dsl: string): void {
    const tracks = this.lastReport?.tracks || [];
    for (const tr of tracks) {
      const base = this.trackStemBaseMeta.get(tr.name) || {
        volume: tr.volume > 0 ? tr.volume : 0.2,
        pan: tr.pan || 0
      };
      const isDrum =
        /drum|perc|toms/i.test(tr.name) ||
        DRUM_WAVE_TYPES.has((tr.waveType || '').toLowerCase());
      const effectiveInstName = tr.defaultInst || (isDrum ? 'kick' : tr.name);
      const escapedInst = effectiveInstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const instLineMatch = dsl.match(
        new RegExp(`^\\s*(?:inst|patch)\\s+${escapedInst}\\b(.*)$`, 'm')
      );
      const instLine = instLineMatch ? instLineMatch[1] : '';
      const volMatch = instLine.match(/\b(?:vol|volume)=([0-9.]+)/i);
      const panMatch = instLine.match(/\bpan=([-+0-9.]+)/i);

      const liveVol = volMatch ? Number(volMatch[1]) : base.volume;
      const livePan = panMatch ? Number(panMatch[1]) : base.pan;
      this.trackLiveMeta.set(tr.name, { volume: liveVol, pan: livePan });

      const cached = this.trackMetaCache.get(tr.name);
      if (cached) {
        cached.volume = liveVol;
        cached.pan = livePan;
      }
    }
  }

  private applySnapshot(snap: SoundHistorySnapshot): void {
    this.sliderDragSnapshotTaken = false;
    const isMixerOnlyChange =
      this.activeDocType === 'music' &&
      this.trackStemBuffers.size > 0 &&
      snap.useAppleSynth === this.useAppleSynth &&
      this.stripMixerPropsFromDsl(snap.dsl) === this.lastSynthesizedNonMixerDsl;

    this.editorTextarea.value = snap.dsl;
    this.soloTracks = new Set(snap.soloTracks);
    this.muteTracks = new Set(snap.muteTracks);
    this.useAppleSynth = snap.useAppleSynth;
    this.engineYmBtn.classList.toggle('active', !snap.useAppleSynth);
    this.engineAppleBtn.classList.toggle('active', snap.useAppleSynth);
    this.musicBankChipBtn.classList.toggle('active', !snap.useAppleSynth);
    this.musicBankAppleBtn.classList.toggle('active', snap.useAppleSynth);

    if (isMixerOnlyChange) {
      this.dslDirty = false;
      this.exportWavNeedsResynth = true;
      this.syncLiveTrackMetaFromDsl(snap.dsl);
      if (this.lastReport?.tracks) {
        this.renderMusicTrackMixer(this.lastReport.tracks);
      }
      this.applyLiveTrackMixerState();
      this.updateHistoryButtonsUI();
      return;
    }

    this.dslDirty = true;
    this.syncControlsFromDsl(snap.dsl);
    this.updateHistoryButtonsUI();
    void this.synthesizeAndPlay(true, this.activeDocType === 'music');
  }

  public undo(): void {
    if (this.undoStack.length === 0) return;
    const current = this.captureSnapshot();
    const prev = this.undoStack.pop()!;
    this.redoStack.push(current);
    this.applySnapshot(prev);
  }

  public redo(): void {
    if (this.redoStack.length === 0) return;
    const current = this.captureSnapshot();
    const next = this.redoStack.pop()!;
    this.undoStack.push(current);
    this.applySnapshot(next);
  }

  public resetChanges(): void {
    if (!this.initialSnapshot) return;
    const current = this.captureSnapshot();
    if (this.snapshotsEqual(current, this.initialSnapshot)) return;
    this.recordHistoryBeforeChange();
    this.applySnapshot({
      dsl: this.initialSnapshot.dsl,
      soloTracks: [...this.initialSnapshot.soloTracks],
      muteTracks: [...this.initialSnapshot.muteTracks],
      useAppleSynth: this.initialSnapshot.useAppleSynth
    });
  }

  private scheduleRealtimeSynthesize(autoPlay: boolean, preservePlayhead: boolean): void {
    if (this.realtimeDebounceTimer !== null) {
      window.clearTimeout(this.realtimeDebounceTimer);
    }
    this.realtimeDebounceTimer = window.setTimeout(() => {
      this.realtimeDebounceTimer = null;
      void this.synthesizeAndPlay(autoPlay, preservePlayhead);
    }, 110);
  }

  private bindEvents(): void {
    this.tabSfxBtn.addEventListener('click', () => {
      void this.switchDocTypeTab('sfx', false);
    });

    this.tabMusicBtn.addEventListener('click', () => {
      void this.switchDocTypeTab('music', false);
    });

    const handleTabKeydown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        let targetType: 'sfx' | 'music';
        if (e.key === 'Home') {
          targetType = 'sfx';
        } else if (e.key === 'End') {
          targetType = 'music';
        } else {
          targetType = this.activeDocType === 'sfx' ? 'music' : 'sfx';
        }
        const targetBtn = targetType === 'sfx' ? this.tabSfxBtn : this.tabMusicBtn;
        targetBtn.focus();
        void this.switchDocTypeTab(targetType, false);
      }
    };

    this.tabSfxBtn.addEventListener('keydown', handleTabKeydown);
    this.tabMusicBtn.addEventListener('keydown', handleTabKeydown);

    this.fileSelectEl.addEventListener('change', () => {
      const selectedPath = this.fileSelectEl.value;
      if (selectedPath) {
        void this.loadFileFromPath(selectedPath, true);
      }
    });

    this.playBtnEl.addEventListener('click', () => {
      if (this.isPlaying) {
        this.stopPlayback();
      } else if (this.decodedBuffer && !this.dslDirty) {
        const startOffset =
          this.playOffsetSec > 0 && this.playOffsetSec < this.decodedBuffer.duration - 0.05
            ? this.playOffsetSec
            : 0;
        void this.startBufferPlayback(startOffset);
      } else {
        void this.synthesizeAndPlay(true, false);
      }
    });

    this.undoBtnEl.addEventListener('click', () => this.undo());
    this.redoBtnEl.addEventListener('click', () => this.redo());
    this.resetBtnEl.addEventListener('click', () => this.resetChanges());

    window.addEventListener('pointerup', () => {
      this.sliderDragSnapshotTaken = false;
    });
    window.addEventListener('pointercancel', () => {
      this.sliderDragSnapshotTaken = false;
    });

    this.rootEl.addEventListener('keydown', (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) {
        if ((target as HTMLInputElement).type === 'text' || target.tagName === 'TEXTAREA') {
          return;
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          this.redo();
        } else {
          this.undo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        this.redo();
      }
    });

    this.loopBtnEl.addEventListener('click', () => {
      this.loopEnabled = !this.loopEnabled;
      this.loopBtnEl.classList.toggle('active', this.loopEnabled);
      this.loopBtnEl.setAttribute('aria-pressed', String(this.loopEnabled));
      if (this.sourceNode) {
        this.sourceNode.loop = this.loopEnabled;
      }
      for (const node of this.activeStemNodes.values()) {
        node.source.loop = this.loopEnabled;
      }
    });

    this.rootEl.querySelector('#btn-sound-new-sfx')?.addEventListener('click', () => {
      this.closePopover('#sound-new-menu');
      this.loadTemplate('sfx');
    });

    this.rootEl.querySelector('#btn-sound-new-music')?.addEventListener('click', () => {
      this.closePopover('#sound-new-menu');
      this.loadTemplate('music');
    });

    const setAppleEngine = (useApple: boolean) => {
      if (this.useAppleSynth === useApple) return;
      this.recordHistoryBeforeChange();
      this.useAppleSynth = useApple;
      this.engineYmBtn.classList.toggle('active', !useApple);
      this.engineAppleBtn.classList.toggle('active', useApple);
      this.musicBankChipBtn.classList.toggle('active', !useApple);
      this.musicBankAppleBtn.classList.toggle('active', useApple);
      this.dslDirty = true;
      this.updateHistoryButtonsUI();
      if (this.activeDocType === 'music') {
        void this.synthesizeAndPlay(true, true);
      }
    };

    this.engineYmBtn.addEventListener('click', () => setAppleEngine(false));
    this.engineAppleBtn.addEventListener('click', () => setAppleEngine(true));
    this.musicBankChipBtn.addEventListener('click', () => setAppleEngine(false));
    this.musicBankAppleBtn.addEventListener('click', () => setAppleEngine(true));

    this.vizWaveformBtn.addEventListener('click', () => {
      this.visualizerMode = 'waveform';
      this.vizWaveformBtn.classList.add('active');
      this.vizSpectrumBtn.classList.remove('active');
      this.drawVisualizerFrame();
    });

    this.vizSpectrumBtn.addEventListener('click', () => {
      this.visualizerMode = 'spectrum';
      this.vizSpectrumBtn.classList.add('active');
      this.vizWaveformBtn.classList.remove('active');
      this.drawVisualizerFrame();
    });

    this.saveBtnEl.addEventListener('click', () => void this.saveCurrentFile());
    this.exportBtnEl.addEventListener('click', () => void this.exportCurrentWav());

    this.rootEl.querySelector('#btn-apply-raw-dsl')?.addEventListener('click', () => {
      this.syncControlsFromDsl(this.editorTextarea.value);
      this.dslDirty = true;
      this.updateHistoryButtonsUI();
      void this.synthesizeAndPlay(true, this.activeDocType === 'music');
    });

    this.editorTextarea.addEventListener('focus', () => {
      this.recordHistoryBeforeChange();
    });

    this.editorTextarea.addEventListener('input', () => {
      this.dslDirty = true;
      this.updateHistoryButtonsUI();
    });

    // SFX Shaper Sliders: live value labels + real-time debounced synthesis on input, final on change
    const bindSfxSlider = (
      slider: HTMLInputElement,
      field: 'startFreq' | 'endFreq' | 'durationMs' | 'brightnessHz' | 'gritPct',
      updateState: (val: number) => void
    ) => {
      slider.addEventListener('pointerdown', () => {
        if (!this.sliderDragSnapshotTaken) {
          this.recordHistoryBeforeChange();
          this.sliderDragSnapshotTaken = true;
        }
      });
      slider.addEventListener('input', () => {
        if (!this.sliderDragSnapshotTaken) {
          this.recordHistoryBeforeChange();
          this.sliderDragSnapshotTaken = true;
        }
        updateState(Number(slider.value));
        this.updateSfxShaperLabels();
        this.updateSfxDslInPlace(field);
        this.updateHistoryButtonsUI();
        this.scheduleRealtimeSynthesize(true, false);
      });
      slider.addEventListener('change', () => {
        this.sliderDragSnapshotTaken = false;
        if (this.realtimeDebounceTimer !== null) {
          window.clearTimeout(this.realtimeDebounceTimer);
          this.realtimeDebounceTimer = null;
        }
        updateState(Number(slider.value));
        this.updateSfxShaperLabels();
        this.updateSfxDslInPlace(field);
        this.updateHistoryButtonsUI();
        void this.synthesizeAndPlay(true, false);
      });
    };

    bindSfxSlider(this.sfxStartFreqSlider, 'startFreq', (v) => {
      this.sfxState.startFreq = v;
    });
    bindSfxSlider(this.sfxEndFreqSlider, 'endFreq', (v) => {
      this.sfxState.endFreq = v;
    });
    bindSfxSlider(this.sfxDurSlider, 'durationMs', (v) => {
      this.sfxState.durationMs = v;
    });
    bindSfxSlider(this.sfxBrightSlider, 'brightnessHz', (v) => {
      this.sfxState.brightnessHz = v;
    });
    bindSfxSlider(this.sfxGritSlider, 'gritPct', (v) => {
      this.sfxState.gritPct = v;
    });

    // Music Tempo Slider: live BPM update + real-time playback without resetting playhead
    this.musicBpmSlider.addEventListener('pointerdown', () => {
      if (!this.sliderDragSnapshotTaken) {
        this.recordHistoryBeforeChange();
        this.sliderDragSnapshotTaken = true;
      }
    });
    this.musicBpmSlider.addEventListener('input', () => {
      if (!this.sliderDragSnapshotTaken) {
        this.recordHistoryBeforeChange();
        this.sliderDragSnapshotTaken = true;
      }
      const bpm = Number(this.musicBpmSlider.value) || 120;
      this.musicBpmVal.textContent = `${bpm} BPM`;
      this.updateMusicBpmInDsl(bpm);
      this.updateHistoryButtonsUI();
      this.scheduleRealtimeSynthesize(true, true);
    });
    this.musicBpmSlider.addEventListener('change', () => {
      this.sliderDragSnapshotTaken = false;
      if (this.realtimeDebounceTimer !== null) {
        window.clearTimeout(this.realtimeDebounceTimer);
        this.realtimeDebounceTimer = null;
      }
      const bpm = Number(this.musicBpmSlider.value) || 120;
      this.musicBpmVal.textContent = `${bpm} BPM`;
      this.updateMusicBpmInDsl(bpm);
      this.updateHistoryButtonsUI();
      void this.synthesizeAndPlay(true, true);
    });

    // Scrubbing & clicking waveform
    this.scrubSliderEl.addEventListener('input', () => {
      if (!this.decodedBuffer) return;
      const ratio = Number(this.scrubSliderEl.value) / 1000;
      const targetSec = ratio * this.decodedBuffer.duration;
      this.playOffsetSec = targetSec;
      this.updateTimeReadout(targetSec, this.decodedBuffer.duration);
      if (this.isPlaying) {
        void this.startBufferPlayback(targetSec);
      } else {
        this.drawVisualizerFrame();
      }
    });

    this.canvasEl.addEventListener('click', (e) => {
      if (!this.decodedBuffer) {
        void this.synthesizeAndPlay(true, false);
        return;
      }
      const rect = this.canvasEl.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const targetSec = ratio * this.decodedBuffer.duration;
      this.playOffsetSec = targetSec;
      void this.startBufferPlayback(targetSec);
    });

    this.sendChatBtnEl.addEventListener('click', () => void this.sendToChat());
    this.chatNoteInputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void this.sendToChat();
      }
    });
  }

  private closePopover(selector: string): void {
    const el = this.rootEl.querySelector(selector) as any;
    if (el && typeof el.hidePopover === 'function') {
      try {
        el.hidePopover();
      } catch {
        // Ignore if not open
      }
    }
  }

  private async initializeStudio(): Promise<void> {
    this.setDslContent(DEFAULT_SFX_DSL, 'laser_arcade.sfx', '', 'sfx');
    this.resetHistoryBaseline();
    this.drawVisualizerFrame();

    await Promise.all([this.refreshPresetsCatalog(), this.refreshFilesCatalog()]);

    const params = new URLSearchParams(window.location.search);
    const fileParam = params.get('file') || params.get('path') || params.get('uri');
    if (fileParam && fileParam.trim()) {
      await this.loadFileFromPath(fileParam.trim(), true);
      return;
    }

    const firstSfx =
      this.catalog.sfxLibrary.find((f) => f.name === 'laser_arcade.sfx') ||
      this.catalog.sfxLibrary[0];
    if (firstSfx) {
      await this.loadFileFromPath(firstSfx.path || firstSfx.filePath || '', false);
      await this.synthesizeAndPlay(false, false);
    } else {
      await this.synthesizeAndPlay(false, false);
    }
  }

  public async refreshFilesCatalog(): Promise<void> {
    try {
      const ws = getWorkspacePath();
      const query = ws ? `?workspace=${encodeURIComponent(ws)}` : '';
      const res = await sidecarFetch(`/api/sound/files${query}`, {
        method: 'GET',
        cache: 'no-store'
      });
      if (!res.ok) return;
      const data = (await res.json()) as Partial<SoundFilesCatalog>;
      this.catalog = {
        workspaceFiles: Array.isArray(data.workspaceFiles) ? data.workspaceFiles : [],
        sfxLibrary: Array.isArray(data.sfxLibrary) ? data.sfxLibrary : [],
        musicLibrary: Array.isArray(data.musicLibrary) ? data.musicLibrary : []
      };
      this.renderFileSelectOptions();
    } catch {
      // Ignore catalog fetch error
    }
  }

  private async refreshPresetsCatalog(): Promise<void> {
    try {
      const res = await sidecarFetch('/api/sound/presets', {
        method: 'GET',
        cache: 'no-store'
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.sfxPresets) && data.sfxPresets.length > 0) {
        this.sfxPresets = data.sfxPresets;
      }
    } catch {
      // Keep fallback presets
    }
  }

  private renderFileSelectOptions(): void {
    const isMusic = this.activeDocType === 'music';
    const placeholder = isMusic ? 'Select music track...' : 'Select sound effect...';
    const groups: string[] = [`<option value="">${placeholder}</option>`];

    const matchingWorkspaceFiles = this.catalog.workspaceFiles.filter((f) => {
      const p = (f.name || f.path || f.filePath || '').toLowerCase();
      if (isMusic) {
        return f.type === 'music' || p.endsWith('.music');
      }
      return f.type === 'sfx' || p.endsWith('.sfx');
    });

    if (matchingWorkspaceFiles.length > 0) {
      const items = matchingWorkspaceFiles
        .map((f) => {
          const p = f.path || f.filePath || '';
          const selected = p === this.activeFilePath ? 'selected' : '';
          return `<option value="${this.escapeHtml(p)}" ${selected}>${this.escapeHtml(f.title || f.name)}</option>`;
        })
        .join('');
      const groupLabel = isMusic ? 'Project Music' : 'Project SFX';
      groups.push(`<optgroup label="${groupLabel}">${items}</optgroup>`);
    }

    if (!isMusic && this.catalog.sfxLibrary.length > 0) {
      const items = this.catalog.sfxLibrary
        .map((f) => {
          const p = f.path || f.filePath || '';
          const selected = p === this.activeFilePath ? 'selected' : '';
          return `<option value="${this.escapeHtml(p)}" ${selected}>${this.escapeHtml(f.title || f.name)}</option>`;
        })
        .join('');
      groups.push(`<optgroup label="Sound Effects (${this.catalog.sfxLibrary.length})">${items}</optgroup>`);
    }

    if (isMusic && this.catalog.musicLibrary.length > 0) {
      const items = this.catalog.musicLibrary
        .map((f) => {
          const p = f.path || f.filePath || '';
          const selected = p === this.activeFilePath ? 'selected' : '';
          return `<option value="${this.escapeHtml(p)}" ${selected}>${this.escapeHtml(f.title || f.name)}</option>`;
        })
        .join('');
      groups.push(`<optgroup label="Music Tracks (${this.catalog.musicLibrary.length})">${items}</optgroup>`);
    }

    this.fileSelectEl.innerHTML = groups.join('');
  }

  private saveCurrentModeState(): void {
    const currentDsl = this.editorTextarea?.value || '';
    if (!currentDsl.trim()) return;
    this.modeSavedState[this.activeDocType] = {
      filePath: this.activeFilePath,
      fileName: this.activeFileName,
      dsl: currentDsl,
      soloTracks: Array.from(this.soloTracks),
      muteTracks: Array.from(this.muteTracks),
      useAppleSynth: this.useAppleSynth,
      initialSnapshot: this.initialSnapshot
        ? {
            dsl: this.initialSnapshot.dsl,
            soloTracks: [...this.initialSnapshot.soloTracks],
            muteTracks: [...this.initialSnapshot.muteTracks],
            useAppleSynth: this.initialSnapshot.useAppleSynth
          }
        : null,
      undoStack: this.undoStack.map((s) => ({
        dsl: s.dsl,
        soloTracks: [...s.soloTracks],
        muteTracks: [...s.muteTracks],
        useAppleSynth: s.useAppleSynth
      })),
      redoStack: this.redoStack.map((s) => ({
        dsl: s.dsl,
        soloTracks: [...s.soloTracks],
        muteTracks: [...s.muteTracks],
        useAppleSynth: s.useAppleSynth
      }))
    };
  }

  private syncModeTabsUI(): void {
    if (!this.tabSfxBtn || !this.tabMusicBtn) return;
    const isSfx = this.activeDocType === 'sfx';
    this.tabSfxBtn.classList.toggle('active', isSfx);
    this.tabSfxBtn.setAttribute('aria-selected', String(isSfx));
    this.tabSfxBtn.setAttribute('tabindex', isSfx ? '0' : '-1');

    this.tabMusicBtn.classList.toggle('active', !isSfx);
    this.tabMusicBtn.setAttribute('aria-selected', String(!isSfx));
    this.tabMusicBtn.setAttribute('tabindex', !isSfx ? '0' : '-1');
  }

  public async switchDocTypeTab(targetType: 'sfx' | 'music', autoPlay = false): Promise<void> {
    if (this.activeDocType === targetType) return;

    this.saveCurrentModeState();
    this.stopPlayback();

    const saved = this.modeSavedState[targetType];
    if (saved) {
      this.soloTracks = new Set(saved.soloTracks);
      this.muteTracks = new Set(saved.muteTracks);
      this.useAppleSynth = saved.useAppleSynth;
      this.engineYmBtn.classList.toggle('active', !saved.useAppleSynth);
      this.engineAppleBtn.classList.toggle('active', saved.useAppleSynth);
      this.musicBankChipBtn.classList.toggle('active', !saved.useAppleSynth);
      this.musicBankAppleBtn.classList.toggle('active', saved.useAppleSynth);

      this.trackMetaCache.clear();
      this.trackStemBuffers.clear();
      this.trackStemPeaks.clear();
      this.trackStemBaseMeta.clear();
      this.trackLiveMeta.clear();
      this.exportWavNeedsResynth = false;
      this.playOffsetSec = 0;

      this.setDslContent(saved.dsl, saved.fileName, saved.filePath, targetType);
      this.initialSnapshot = saved.initialSnapshot;
      this.undoStack = saved.undoStack;
      this.redoStack = saved.redoStack;
      this.sliderDragSnapshotTaken = false;
      this.updateHistoryButtonsUI();
      this.renderFileSelectOptions();
      await this.synthesizeAndPlay(autoPlay, false);
      return;
    }

    if (targetType === 'music') {
      const firstMusic =
        this.catalog.workspaceFiles.find(
          (f) => f.type === 'music' || (f.name || '').toLowerCase().endsWith('.music')
        ) || this.catalog.musicLibrary[0];
      if (firstMusic && (firstMusic.path || firstMusic.filePath)) {
        await this.loadFileFromPath(firstMusic.path || firstMusic.filePath || '', autoPlay);
        if (!autoPlay) {
          await this.synthesizeAndPlay(false, false);
        }
        return;
      }
      this.loadTemplate('music');
      return;
    }

    const firstSfx =
      this.catalog.sfxLibrary.find((f) => f.name === 'laser_arcade.sfx') ||
      this.catalog.sfxLibrary[0];
    if (firstSfx && (firstSfx.path || firstSfx.filePath)) {
      await this.loadFileFromPath(firstSfx.path || firstSfx.filePath || '', autoPlay);
      if (!autoPlay) {
        await this.synthesizeAndPlay(false, false);
      }
      return;
    }
    this.loadTemplate('sfx');
  }

  public async loadFileFromPath(filePath: string, autoPlay = true): Promise<void> {
    try {
      const res = await sidecarFetch('/api/sound/file/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Failed to load file "${filePath}"`);
      }

      const content = typeof data.content === 'string' ? data.content : '';
      const fileName = data.fileName || filePath.split(/[\\/]/).pop() || 'untitled.sfx';
      const detectedType: 'music' | 'sfx' =
        data.type === 'music' || fileName.endsWith('.music') ? 'music' : 'sfx';

      if (detectedType !== this.activeDocType) {
        this.saveCurrentModeState();
      }
      this.stopPlayback();

      this.soloTracks.clear();
      this.muteTracks.clear();
      this.trackMetaCache.clear();
      this.trackStemBuffers.clear();
      this.trackStemPeaks.clear();
      this.trackStemBaseMeta.clear();
      this.trackLiveMeta.clear();
      this.exportWavNeedsResynth = false;
      this.playOffsetSec = 0;
      this.setDslContent(content, fileName, data.filePath || filePath, detectedType);
      this.resetHistoryBaseline();
      this.renderFileSelectOptions();

      if (autoPlay) {
        await this.synthesizeAndPlay(true, false);
      }
    } catch (err: any) {
      StudioNotifier.error('Failed to Load Audio File', err?.message || String(err));
    }
  }

  private loadTemplate(type: 'music' | 'sfx'): void {
    if (type !== this.activeDocType) {
      this.saveCurrentModeState();
    }
    this.stopPlayback();
    this.soloTracks.clear();
    this.muteTracks.clear();
    this.trackMetaCache.clear();
    this.trackStemBuffers.clear();
    this.trackStemPeaks.clear();
    this.trackStemBaseMeta.clear();
    this.trackLiveMeta.clear();
    this.exportWavNeedsResynth = false;
    this.playOffsetSec = 0;
    if (type === 'music') {
      this.setDslContent(DEFAULT_MUSIC_DSL, 'new_song.music', '', 'music');
    } else {
      this.setDslContent(DEFAULT_SFX_DSL, 'new_cue.sfx', '', 'sfx');
    }
    this.resetHistoryBaseline();
    this.renderFileSelectOptions();
    void this.synthesizeAndPlay(true, false);
  }

  private applySfxPreset(presetName: string): void {
    const friendly = FRIENDLY_SFX_PRESETS.find((f) => f.id === presetName);
    const targetFileName = friendly?.fileName || `${presetName}.sfx`;
    const libEntry = this.catalog.sfxLibrary.find(
      (f) => f.name === targetFileName || f.name === `${presetName}.sfx`
    );

    if (libEntry && (libEntry.path || libEntry.filePath)) {
      void this.loadFileFromPath(libEntry.path || libEntry.filePath || '', true);
      return;
    }

    this.recordHistoryBeforeChange();
    const preset = this.sfxPresets.find((p) => p.name === presetName) || FALLBACK_SFX_PRESETS[0];

    this.sfxState = {
      title: friendly ? friendly.label : preset.name,
      preset: preset.name,
      wave: normalizeSfxToneId(preset.wave || 'square'),
      startFreq: Math.round(preset.startFreq || 440),
      endFreq: Math.round(preset.endFreq || preset.startFreq || 220),
      durationMs: Math.round(
        ((preset.attack || 0.01) + (preset.decay || 0.08) + (preset.release || 0.06)) * 1000
      ),
      brightnessHz: preset.lpfStart > 0 ? Math.round(preset.lpfStart) : 8000,
      gritPct: preset.wave === 'noise' || preset.wave === 'psg_noise' ? 60 : 0,
      volume: Number((preset.volume || 0.32).toFixed(2)),
      pitchCurve: preset.pitchCurve || 'exp'
    };

    const dsl = [
      `title "${this.sfxState.title}"`,
      `type sfx`,
      ``,
      `inst cue preset=${preset.name} vol=${this.sfxState.volume.toFixed(2)}`,
      `track main cue: ${this.sfxState.startFreq}Hz->${this.sfxState.endFreq}Hz:${this.sfxState.durationMs}ms`,
      ``
    ].join('\n');

    this.editorTextarea.value = dsl;
    this.dslDirty = true;
    this.syncSfxShaperInputs();
    this.updateHistoryButtonsUI();
    void this.synthesizeAndPlay(true, false);
  }

  private setDslContent(
    content: string,
    fileName: string,
    filePath: string,
    docType: 'music' | 'sfx'
  ): void {
    this.editorTextarea.value = content;
    this.activeFileName = fileName;
    this.activeFilePath = filePath;
    this.activeDocType = docType;
    this.dslDirty = true;

    this.syncModeTabsUI();
    this.sfxShaperPaneEl.classList.toggle('hidden', docType !== 'sfx');
    this.musicMixerPaneEl.classList.toggle('hidden', docType !== 'music');

    this.syncControlsFromDsl(content);
  }

  private parseMusicBpmFromDsl(dsl: string): number {
    const tempoLine = dsl.match(/^\s*(?:tempo|bpm)\s+([^\n#]+)/im);
    if (!tempoLine) return 120;
    const tokens = tempoLine[1].trim().split(/\s+/);
    let bpm = 120;
    for (const tok of tokens) {
      const num = Number(tok);
      if (!Number.isNaN(num) && num >= 20 && num <= 300) {
        return Math.round(num);
      }
      const lower = tok.toLowerCase();
      if (CLASSICAL_TEMPO_MARKINGS[lower] !== undefined) {
        bpm = CLASSICAL_TEMPO_MARKINGS[lower];
      }
    }
    return bpm;
  }

  private syncControlsFromDsl(dsl: string): void {
    if (this.activeDocType === 'sfx') {
      const titleMatch = dsl.match(/^\s*title\s+"?([^"\n]+)"?/im);
      const lines = dsl.split('\n');
      const instLines: Array<{ name: string; attrs: string }> = [];
      const trackLines: Array<{ name: string; defaultInst: string; body: string }> = [];

      for (const raw of lines) {
        const cleaned = raw.replace(/#.*$/, '').trim();
        if (!cleaned) continue;
        const instM = cleaned.match(/^(?:inst|patch)\s+([^\s]+)\s+(.*)$/i);
        if (instM) {
          instLines.push({ name: instM[1], attrs: instM[2] });
          continue;
        }
        const trackM = cleaned.match(/^track\s+([^\s:]+)(?:\s+([^\s:]+))?\s*:\s*(.*)$/i);
        if (trackM) {
          trackLines.push({
            name: trackM[1],
            defaultInst: trackM[2] || '',
            body: trackM[3]
          });
        }
      }

      const primaryInst =
        instLines.find((l) => /\bpreset=/i.test(l.attrs)) ||
        instLines[instLines.length - 1] || { name: 'cue', attrs: '' };
      const primaryTrack =
        trackLines.find((t) => t.defaultInst === primaryInst.name) ||
        trackLines[trackLines.length - 1] || { name: 'main', defaultInst: primaryInst.name, body: '' };

      const presetMatch = primaryInst.attrs.match(/\bpreset=([a-zA-Z0-9_]+)/i);
      const presetId = presetMatch ? presetMatch[1] : '';
      const presetRef = this.sfxPresets.find((p) => p.name === presetId);

      const waveMatch = primaryInst.attrs.match(/\bwave=([a-zA-Z0-9_]+)/i);
      const rawWave = waveMatch ? waveMatch[1] : presetRef?.wave || 'square';

      this.sfxState.title = titleMatch ? titleMatch[1].trim() : 'Custom Sound';
      this.sfxState.preset = presetId;
      this.sfxState.wave = normalizeSfxToneId(rawWave);

      const volMatch = primaryInst.attrs.match(/\b(?:vol|volume)=([0-9.]+)/i);
      this.sfxState.volume = volMatch
        ? Number(volMatch[1])
        : Number((presetRef?.volume || 0.32).toFixed(2));

      // Extract duration across primary track tokens
      const durMatches = Array.from(primaryTrack.body.matchAll(/:(\d+(?:\.\d+)?)ms\b/gi));
      if (durMatches.length > 0) {
        const totalMs = durMatches.reduce((acc, m) => acc + Number(m[1]), 0);
        this.sfxState.durationMs = Math.round(Math.max(30, Math.min(1000, totalMs)));
      } else if (presetRef) {
        this.sfxState.durationMs = Math.round(
          ((presetRef.attack || 0.01) + (presetRef.decay || 0.08) + (presetRef.release || 0.06)) *
            1000
        );
      }

      // Extract startFreq & endFreq
      const sweepMatch =
        primaryTrack.body.match(/(\d+(?:\.\d+)?)Hz->(\d+(?:\.\d+)?)Hz/i) ||
        primaryInst.attrs.match(/\bfreq=(\d+(?:\.\d+)?)Hz->(\d+(?:\.\d+)?)Hz/i);
      const singleHzMatch =
        primaryTrack.body.match(/(\d+(?:\.\d+)?)Hz\b/i) ||
        primaryInst.attrs.match(/\bfreq=(\d+(?:\.\d+)?)Hz\b/i);

      if (sweepMatch) {
        this.sfxState.startFreq = Math.round(Number(sweepMatch[1]));
        this.sfxState.endFreq = Math.round(Number(sweepMatch[2]));
      } else if (singleHzMatch) {
        this.sfxState.startFreq = Math.round(Number(singleHzMatch[1]));
        this.sfxState.endFreq = Math.round(Number(singleHzMatch[1]));
      } else {
        // Check for musical note tokens (e.g. B5:75ms E6:240ms or G6:60ms B6:60ms D7:70ms G7:250ms)
        const noteTokens = Array.from(
          primaryTrack.body.matchAll(/\b([A-Ga-g][#b]?\d+)(?::\d+(?:\.\d+)?ms)?\b/g)
        );
        if (noteTokens.length > 0) {
          const firstHz = noteNameToHz(noteTokens[0][1]) || presetRef?.startFreq || 440;
          const lastHz =
            noteNameToHz(noteTokens[noteTokens.length - 1][1]) || presetRef?.endFreq || firstHz;
          this.sfxState.startFreq = firstHz;
          this.sfxState.endFreq = lastHz;
        } else if (presetRef) {
          this.sfxState.startFreq = Math.round(presetRef.startFreq || 440);
          this.sfxState.endFreq = Math.round(presetRef.endFreq || presetRef.startFreq || 220);
        }
      }

      // Brightness (LPF)
      const lpfMatch =
        primaryInst.attrs.match(/\blpf=(\d+(?:\.\d+)?)/i) ||
        primaryInst.attrs.match(/\bcutoff=(\d+(?:\.\d+)?)/i);
      if (lpfMatch) {
        const val = Number(lpfMatch[1]);
        this.sfxState.brightnessHz =
          val <= 1.0 ? Math.round(200 + val * 7800) : Math.round(val);
      } else if (presetRef && presetRef.lpfStart > 0) {
        this.sfxState.brightnessHz = Math.round(presetRef.lpfStart);
      } else {
        this.sfxState.brightnessHz = 8000;
      }

      // Grit (noise_blend or noise=filter,blend)
      const noiseBlendMatch = primaryInst.attrs.match(/\bnoise_blend=(\d+(?:\.\d+)?)/i);
      const noisePairMatch = primaryInst.attrs.match(
        /\bnoise=\d+(?:\.\d+)?,(\d+(?:\.\d+)?)/i
      );
      if (noiseBlendMatch) {
        this.sfxState.gritPct = Math.round(Number(noiseBlendMatch[1]) * 100);
      } else if (noisePairMatch) {
        this.sfxState.gritPct = Math.round(Number(noisePairMatch[1]) * 100);
      } else if (this.sfxState.wave === 'psg_noise') {
        this.sfxState.gritPct = 60;
      } else {
        this.sfxState.gritPct = 0;
      }

      this.syncSfxShaperInputs();
    } else {
      const bpm = this.parseMusicBpmFromDsl(dsl);
      this.musicBpmSlider.value = String(Math.max(40, Math.min(220, bpm)));
      this.musicBpmVal.textContent = `${bpm} BPM`;
    }
  }

  private syncSfxShaperInputs(): void {
    this.sfxStartFreqSlider.value = String(Math.max(40, Math.min(2000, this.sfxState.startFreq)));
    this.sfxEndFreqSlider.value = String(Math.max(20, Math.min(2000, this.sfxState.endFreq)));
    this.sfxDurSlider.value = String(Math.max(30, Math.min(1000, this.sfxState.durationMs)));
    this.sfxBrightSlider.value = String(Math.max(200, Math.min(8000, this.sfxState.brightnessHz)));
    this.sfxGritSlider.value = String(Math.max(0, Math.min(90, this.sfxState.gritPct)));

    this.updateSfxShaperLabels();
    this.renderSfxPresetChips();
    this.renderSfxToneButtons();
  }

  private updateSfxShaperLabels(): void {
    this.sfxStartFreqVal.textContent = `${this.sfxState.startFreq} Hz`;
    this.sfxEndFreqVal.textContent = `${this.sfxState.endFreq} Hz`;
    this.sfxDurVal.textContent = `${this.sfxState.durationMs} ms`;
    this.sfxBrightVal.textContent =
      this.sfxState.brightnessHz >= 7800 ? 'Open' : `${this.sfxState.brightnessHz} Hz`;
    this.sfxGritVal.textContent = `${this.sfxState.gritPct}%`;
  }

  private updateSfxDslInPlace(
    changedField: 'wave' | 'startFreq' | 'endFreq' | 'durationMs' | 'brightnessHz' | 'gritPct'
  ): void {
    const s = this.sfxState;
    const rawLines = this.editorTextarea.value.split('\n');

    // Find primary inst line (prefer the one with preset= or the last inst line)
    let primaryInstIdx = -1;
    let primaryInstName = '';
    for (let i = 0; i < rawLines.length; i++) {
      const cleaned = rawLines[i].replace(/#.*$/, '').trim();
      const m = cleaned.match(/^(?:inst|patch)\s+([^\s]+)\s+(.*)$/i);
      if (m) {
        if (primaryInstIdx === -1 || /\bpreset=/i.test(m[2])) {
          primaryInstIdx = i;
          primaryInstName = m[1];
        }
      }
    }

    if (primaryInstIdx === -1) {
      // Fallback if editor had no inst lines
      const parts: string[] = ['inst cue'];
      if (s.preset) parts.push(`preset=${s.preset}`);
      parts.push(`wave=${s.wave}`);
      if (s.brightnessHz < 7800) {
        const endCut = Math.max(120, Math.round(s.brightnessHz * 0.25));
        parts.push(`lpf=${s.brightnessHz}->${endCut}`);
      }
      if (s.gritPct > 0 && s.wave !== 'psg_noise' && s.wave !== 'noise') {
        parts.push(`noise_blend=${(s.gritPct / 100).toFixed(2)}`);
      }
      parts.push(`vol=${s.volume.toFixed(2)}`);
      this.editorTextarea.value = [
        `title "${s.title}"`,
        `type sfx`,
        ``,
        parts.join(' '),
        `track main cue: ${s.startFreq}Hz->${s.endFreq}Hz:${s.durationMs}ms`,
        ``
      ].join('\n');
      this.dslDirty = true;
      return;
    }

    // 1. Update primary inst line if wave, brightnessHz, gritPct, or pitch (for inst-level freq) changed
    let instLine = rawLines[primaryInstIdx].replace(/\bnoise=\d+(?:\.\d+)?(?!\s*,)/g, '').trim();

    if (changedField === 'wave') {
      if (/\bwave=[^\s]+/i.test(instLine)) {
        instLine = instLine.replace(/\bwave=[^\s]+/i, `wave=${s.wave}`);
      } else {
        instLine = `${instLine} wave=${s.wave}`;
      }
    } else if (changedField === 'brightnessHz') {
      const endCut = Math.max(120, Math.round(s.brightnessHz * 0.25));
      if (s.brightnessHz >= 7800) {
        instLine = instLine.replace(/\s*\b(?:lpf|cutoff)=[^\s]+/gi, '');
      } else if (/\b(?:lpf|cutoff)=[^\s]+/i.test(instLine)) {
        instLine = instLine.replace(
          /\b(?:lpf|cutoff)=[^\s]+/i,
          `lpf=${s.brightnessHz}->${endCut}`
        );
      } else {
        instLine = `${instLine} lpf=${s.brightnessHz}->${endCut}`;
      }
    } else if (changedField === 'gritPct') {
      instLine = instLine.replace(/\s*\bnoise_blend=[^\s]+/gi, '');
      if (s.gritPct > 0) {
        instLine = `${instLine} noise_blend=${(s.gritPct / 100).toFixed(2)}`;
      }
    }

    rawLines[primaryInstIdx] = instLine.replace(/\s+/g, ' ').trim();

    // 2. Find primary track line
    let primaryTrackIdx = -1;
    for (let i = 0; i < rawLines.length; i++) {
      const cleaned = rawLines[i].replace(/#.*$/, '').trim();
      const tm = cleaned.match(/^track\s+([^\s:]+)(?:\s+([^\s:]+))?\s*:\s*(.*)$/i);
      if (tm) {
        if (primaryTrackIdx === -1 || tm[2] === primaryInstName) {
          primaryTrackIdx = i;
        }
      }
    }

    if (primaryTrackIdx !== -1) {
      if (changedField === 'durationMs') {
        // Scale durations across all tracks proportionally so multi-track / multi-note SFX stay synchronized
        const trackLine = rawLines[primaryTrackIdx];
        const durTokens = Array.from(trackLine.matchAll(/:(\d+(?:\.\d+)?)ms\b/gi));
        const currentTotal = durTokens.reduce((acc, m) => acc + Number(m[1]), 0);
        const scale = currentTotal > 0 ? s.durationMs / currentTotal : 1;

        for (let i = 0; i < rawLines.length; i++) {
          if (/^\s*track\s+/i.test(rawLines[i])) {
            rawLines[i] = rawLines[i].replace(/:(\d+(?:\.\d+)?)ms\b/gi, (_m, dStr) => {
              const scaled = Math.max(10, Math.round(Number(dStr) * scale));
              return `:${scaled}ms`;
            });
          }
        }
      } else if (changedField === 'startFreq' || changedField === 'endFreq') {
        const trLine = rawLines[primaryTrackIdx];
        if (/(\d+(?:\.\d+)?)Hz->(\d+(?:\.\d+)?)Hz/i.test(trLine)) {
          rawLines[primaryTrackIdx] = trLine.replace(
            /(\d+(?:\.\d+)?)Hz->(\d+(?:\.\d+)?)Hz/gi,
            `${s.startFreq}Hz->${s.endFreq}Hz`
          );
        } else {
          // Replace track body with explicit frequency sweep of total duration
          rawLines[primaryTrackIdx] = trLine.replace(
            /^(\s*track\s+[^\s:]+(?:\s+[^\s:]+)?\s*:\s*).*$/i,
            `$1${s.startFreq}Hz->${s.endFreq}Hz:${s.durationMs}ms`
          );
        }
      }
    }

    this.editorTextarea.value = rawLines.join('\n');
    this.dslDirty = true;
  }

  private updateMusicBpmInDsl(newBpm: number): void {
    let dsl = this.editorTextarea.value;
    if (/^\s*tempo\s+/im.test(dsl)) {
      dsl = dsl.replace(
        /^(\s*tempo\s+(?:[a-zA-Z_]+)?)(?:\s+\d+(?:\.\d+)?)?\s*$/im,
        (_m, prefix) => `${prefix.trimEnd()} ${newBpm}`
      );
    } else if (/^\s*bpm\s+/im.test(dsl)) {
      dsl = dsl.replace(/^(\s*bpm\s+)(\d+(?:\.\d+)?)/im, `$1${newBpm}`);
    } else {
      dsl = `bpm ${newBpm}\n` + dsl;
    }
    this.editorTextarea.value = dsl;
    this.dslDirty = true;
  }

  private updateMusicInstProperty(
    instName: string,
    defaultWave: string,
    propUpdater: (line: string) => string
  ): void {
    const lines = this.editorTextarea.value.split('\n');
    const escaped = instName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`^(\\s*(?:inst|patch)\\s+${escaped}\\b.*)$`);
    let updated = false;
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        lines[i] = propUpdater(lines[i]);
        updated = true;
        break;
      }
    }
    if (!updated) {
      // Insert explicit inst declaration (e.g. for default drum instruments like kick) before first pattern or track
      const baseWave = DRUM_WAVE_TYPES.has(defaultWave) ? defaultWave : 'ym2612_brass';
      const newLine = propUpdater(`inst ${instName} wave=${baseWave}`);
      let insertIdx = lines.findIndex((l) => /^\s*(?:pattern|track)\b/i.test(l));
      if (insertIdx === -1) insertIdx = lines.length;
      lines.splice(insertIdx, 0, newLine);
    }
    this.editorTextarea.value = lines.join('\n');
    this.dslDirty = true;
  }

  public async synthesizeAndPlay(autoPlay = true, preservePlayhead = false): Promise<void> {
    if (this.isSynthesizing) {
      this.pendingSynthRequest = {
        autoPlay: autoPlay || Boolean(this.pendingSynthRequest?.autoPlay),
        preservePlayhead: preservePlayhead || Boolean(this.pendingSynthRequest?.preservePlayhead)
      };
      return;
    }
    const dsl = this.editorTextarea.value.trim();
    if (!dsl) return;

    this.isSynthesizing = true;
    this.playBtnEl.disabled = true;
    if (!this.isPlaying) {
      this.playBtnEl.textContent = '...';
    }

    try {
      const res = await sidecarFetch('/api/sound/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dsl,
          type: this.activeDocType,
          apple: this.activeDocType === 'music' ? this.useAppleSynth : false,
          soloTracks: Array.from(this.soloTracks),
          muteTracks: Array.from(this.muteTracks)
        })
      });

      const data = (await res.json().catch(() => ({}))) as Partial<SynthesizeResponse> & {
        error?: string;
      };

      if (data.report) {
        this.lastReport = data.report;
        this.renderDiagnosticsAndStatus(data.report);
        if (this.activeDocType === 'music') {
          if (
            typeof data.report.bpm === 'number' &&
            data.report.bpm > 0 &&
            document.activeElement !== this.musicBpmSlider
          ) {
            const realBpm = Math.round(data.report.bpm);
            this.musicBpmSlider.value = String(Math.max(40, Math.min(220, realBpm)));
            this.musicBpmVal.textContent = `${realBpm} BPM`;
          }
          this.trackStemBaseMeta.clear();
          this.trackLiveMeta.clear();
          for (const tr of data.report.tracks || []) {
            const vol = typeof tr.volume === 'number' && tr.volume > 0 ? tr.volume : 0.2;
            const pan = typeof tr.pan === 'number' ? tr.pan : 0.0;
            this.trackStemBaseMeta.set(tr.name, { volume: vol, pan });
            this.trackLiveMeta.set(tr.name, { volume: vol, pan });
          }
          this.syncLiveTrackMetaFromDsl(this.editorTextarea.value);
          this.lastSynthesizedNonMixerDsl = this.stripMixerPropsFromDsl(dsl);
          this.exportWavNeedsResynth = false;
          this.renderMusicTrackMixer(data.report.tracks || []);
        }
      }

      if (!res.ok || !data.buildId) {
        const errMsg =
          data.report?.error ||
          data.error ||
          (data.report?.issues && data.report.issues[0]) ||
          `Synthesis failed (HTTP ${res.status})`;
        this.statusPillBtn.textContent = 'Check Code';
        this.statusPillBtn.className = 'sound-status-pill fail';
        StudioNotifier.error('Synthesis Issue', errMsg);
        return;
      }

      this.lastBuildId = data.buildId;
      this.dslDirty = false;

      const ctx = this.ensureAudioContext();
      let audioBuffer: AudioBuffer | null = null;

      if (this.activeDocType === 'music' && data.hasStems) {
        const stemsRes = await sidecarFetch(
          `/api/sound/stems?buildId=${encodeURIComponent(data.buildId)}`,
          { method: 'GET', cache: 'no-store' }
        );
        if (stemsRes.ok) {
          const stemsBuf = await stemsRes.arrayBuffer();
          audioBuffer = this.decodeStemsBinary(stemsBuf, ctx);
        }
      }

      if (!audioBuffer) {
        this.trackStemBuffers.clear();
        this.trackStemPeaks.clear();
        const wavRes = await sidecarFetch(
          `/api/sound/wav?buildId=${encodeURIComponent(data.buildId)}`,
          { method: 'GET', cache: 'no-store' }
        );
        if (!wavRes.ok) {
          throw new Error(`Failed to fetch audio stream (HTTP ${wavRes.status})`);
        }
        const arrayBuf = await wavRes.arrayBuffer();
        audioBuffer = await ctx.decodeAudioData(arrayBuf.slice(0));
      }

      const prevDuration = this.decodedBuffer?.duration || 0;
      const livePlayheadSec = this.getCurrentPlayheadSec();
      const liveRatio =
        prevDuration > 0 ? Math.max(0, Math.min(1, livePlayheadSec / prevDuration)) : 0;
      const wasPlaying = this.isPlaying;

      this.decodedBuffer = audioBuffer;

      let targetOffsetSec = 0;
      if (preservePlayhead && this.activeDocType === 'music' && audioBuffer.duration > 0) {
        if (prevDuration > 0 && Math.abs(audioBuffer.duration - prevDuration) > 0.05) {
          targetOffsetSec = liveRatio * audioBuffer.duration;
        } else {
          targetOffsetSec = Math.min(livePlayheadSec, Math.max(0, audioBuffer.duration - 0.05));
        }
        if (targetOffsetSec >= audioBuffer.duration - 0.05) {
          targetOffsetSec = 0;
        }
      }

      this.playOffsetSec = targetOffsetSec;
      this.updateTimeReadout(targetOffsetSec, audioBuffer.duration);

      if (autoPlay || (preservePlayhead && wasPlaying)) {
        await this.startBufferPlayback(targetOffsetSec);
      } else {
        this.drawVisualizerFrame();
      }
    } catch (err: any) {
      StudioNotifier.error('Audio Synthesis Error', err?.message || String(err));
    } finally {
      this.isSynthesizing = false;
      this.playBtnEl.disabled = false;
      this.playBtnEl.textContent = this.isPlaying ? 'Stop' : 'Play';

      if (this.pendingSynthRequest) {
        const nextReq = this.pendingSynthRequest;
        this.pendingSynthRequest = null;
        void this.synthesizeAndPlay(nextReq.autoPlay, nextReq.preservePlayhead);
      }
    }
  }

  private decodeStemsBinary(buf: ArrayBuffer, ctx: AudioContext): AudioBuffer | null {
    const view = new DataView(buf);
    if (buf.byteLength < 12) return null;
    const magic = String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2),
      view.getUint8(3)
    );
    if (magic !== 'STEM') return null;

    const sampleRate = view.getUint32(4, true) || 44100;
    const trackCount = view.getUint32(8, true);
    const decoder = new TextDecoder('utf-8');

    this.trackStemBuffers.clear();
    this.trackStemPeaks.clear();

    const peakBins = 900;
    let offset = 12;
    let longestBuffer: AudioBuffer | null = null;

    for (let i = 0; i < trackCount; i++) {
      if (offset + 2 > buf.byteLength) break;
      const nameLen = view.getUint16(offset, true);
      offset += 2;
      if (offset + nameLen + 4 > buf.byteLength) break;
      const trackName = decoder.decode(new Uint8Array(buf, offset, nameLen));
      offset += nameLen;
      const pcmByteLen = view.getUint32(offset, true);
      offset += 4;
      if (offset + pcmByteLen > buf.byteLength) break;

      const numFrames = Math.floor(pcmByteLen / 4);
      if (numFrames > 0) {
        const audioBuf = ctx.createBuffer(2, numFrames, sampleRate);
        const ch0 = audioBuf.getChannelData(0);
        const ch1 = audioBuf.getChannelData(1);
        let bytePtr = offset;
        for (let f = 0; f < numFrames; f++) {
          ch0[f] = view.getInt16(bytePtr, true) / 32768.0;
          ch1[f] = view.getInt16(bytePtr + 2, true) / 32768.0;
          bytePtr += 4;
        }
        this.trackStemBuffers.set(trackName, audioBuf);

        const peaks = new Float32Array(peakBins);
        const step = Math.max(1, Math.floor(numFrames / peakBins));
        for (let x = 0; x < peakBins; x++) {
          const startIdx = x * step;
          let maxAbs = 0;
          for (let j = 0; j < step && startIdx + j < numFrames; j += 4) {
            const v = Math.max(Math.abs(ch0[startIdx + j]), Math.abs(ch1[startIdx + j]));
            if (v > maxAbs) maxAbs = v;
          }
          peaks[x] = maxAbs;
        }
        this.trackStemPeaks.set(trackName, peaks);

        if (!longestBuffer || audioBuf.duration > longestBuffer.duration) {
          longestBuffer = audioBuf;
        }
      }
      offset += pcmByteLen;
    }

    return longestBuffer;
  }

  private computeTrackMixerNodesState(trackName: string): {
    gain: number;
    pan: number;
    monoDownmix: boolean;
    peakScale: number;
  } {
    const isAudible =
      (this.soloTracks.size === 0 || this.soloTracks.has(trackName)) &&
      !this.muteTracks.has(trackName);
    if (!isAudible) {
      return { gain: 0, pan: 0, monoDownmix: false, peakScale: 0 };
    }

    const base = this.trackStemBaseMeta.get(trackName) || { volume: 0.2, pan: 0.0 };
    const live = this.trackLiveMeta.get(trackName) || base;

    const baseVol = Math.max(0.005, base.volume || 0.2);
    const volRatio = Math.max(0, live.volume / baseVol);

    const basePan = Math.max(-1, Math.min(1, base.pan || 0));
    const livePan = Math.max(-1, Math.min(1, live.pan || 0));
    const panChanged = Math.abs(livePan - basePan) > 0.005;

    if (!panChanged) {
      return {
        gain: volRatio,
        pan: 0,
        monoDownmix: false,
        peakScale: volRatio
      };
    }

    const baseAngle = ((basePan + 1) * Math.PI) / 4;
    const monoSumFactor = (Math.cos(baseAngle) + Math.sin(baseAngle)) * 0.5;
    const panComp = monoSumFactor > 0.05 ? 1.0 / monoSumFactor : 1.0;

    return {
      gain: volRatio * panComp,
      pan: livePan,
      monoDownmix: true,
      peakScale: volRatio
    };
  }

  private syncMixerButtonsDOM(): void {
    if (!this.trackListEl) return;
    this.trackListEl.querySelectorAll('.sound-ms-btn').forEach((btn) => {
      const el = btn as HTMLElement;
      const track = el.getAttribute('data-track') || '';
      const action = el.getAttribute('data-action');
      if (action === 'mute') {
        el.classList.toggle('active', this.muteTracks.has(track));
      } else if (action === 'solo') {
        el.classList.toggle('active', this.soloTracks.has(track));
      }
    });
  }

  private applyLiveTrackMixerState(): void {
    const now = this.audioCtx ? this.audioCtx.currentTime : 0;
    for (const [trackName, nodes] of this.activeStemNodes.entries()) {
      const state = this.computeTrackMixerNodesState(trackName);
      const targetChannelCount = state.monoDownmix ? 1 : 2;
      const targetChannelMode: ChannelCountMode = state.monoDownmix ? 'explicit' : 'max';
      if (nodes.pan.channelCount !== targetChannelCount) {
        nodes.pan.channelCount = targetChannelCount;
        nodes.pan.channelCountMode = targetChannelMode;
      }
      if (this.audioCtx) {
        nodes.gain.gain.cancelScheduledValues(now);
        nodes.gain.gain.setValueAtTime(nodes.gain.gain.value, now);
        nodes.gain.gain.setTargetAtTime(state.gain, now, 0.003);
        if (state.gain === 0) {
          nodes.gain.gain.setValueAtTime(0, now + 0.015);
        }
        nodes.pan.pan.cancelScheduledValues(now);
        nodes.pan.pan.setValueAtTime(nodes.pan.pan.value, now);
        nodes.pan.pan.setTargetAtTime(state.pan, now, 0.003);
      } else {
        nodes.gain.gain.value = state.gain;
        nodes.pan.pan.value = state.pan;
      }
    }
    this.drawVisualizerFrame();
  }

  private renderMusicTrackMixer(tracks: SoundTrackReport[]): void {
    if (tracks.length === 0) {
      this.trackListEl.innerHTML = `<div class="sound-empty-note">No tracks found in song.</div>`;
      return;
    }

    // Cache live track metadata from Go synthesis report when track was active
    for (const tr of tracks) {
      if (tr.eventCount > 0 && tr.waveType) {
        this.trackMetaCache.set(tr.name, {
          waveType: tr.waveType,
          volume: tr.volume,
          pan: tr.pan
        });
      }
    }

    // If user is actively dragging a mixer slider, do not destroy DOM nodes under pointer
    const activeEl = document.activeElement;
    if (
      activeEl &&
      this.trackListEl.contains(activeEl) &&
      activeEl.tagName === 'INPUT' &&
      this.sliderDragSnapshotTaken
    ) {
      return;
    }

    const dsl = this.editorTextarea.value;

    this.trackListEl.innerHTML = tracks
      .map((tr) => {
        const isMuted = this.muteTracks.has(tr.name);
        const isSolo = this.soloTracks.has(tr.name);
        const cached = this.trackMetaCache.get(tr.name);

        const isDrum =
          /drum|perc|toms/i.test(tr.name) ||
          DRUM_WAVE_TYPES.has((tr.waveType || '').toLowerCase()) ||
          DRUM_WAVE_TYPES.has((cached?.waveType || '').toLowerCase());

        const effectiveInstName = tr.defaultInst || (isDrum ? 'kick' : tr.name);
        const escapedInst = effectiveInstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const instLineMatch = dsl.match(
          new RegExp(`^\\s*(?:inst|patch)\\s+${escapedInst}\\b(.*)$`, 'm')
        );
        const instLine = instLineMatch ? instLineMatch[1] : '';

        const waveMatch = instLine.match(/\bwave=([^\s]+)/i);
        const volMatch = instLine.match(/\b(?:vol|volume)=([0-9.]+)/i);
        const panMatch = instLine.match(/\bpan=([-+0-9.]+)/i);

        const rawWave = waveMatch
          ? waveMatch[1]
          : tr.eventCount > 0 && tr.waveType
            ? tr.waveType
            : cached?.waveType || tr.waveType || 'ym2612_brass';

        const currentInstId = normalizeMusicWaveId(rawWave);

        const realVol = volMatch
          ? Number(volMatch[1])
          : tr.eventCount > 0 && tr.volume > 0
            ? tr.volume
            : cached?.volume ?? tr.volume ?? 0.2;

        const realPan = panMatch
          ? Number(panMatch[1])
          : tr.eventCount > 0
            ? tr.pan
            : cached?.pan ?? tr.pan ?? 0.0;

        const volPct = Math.round(Math.max(1, Math.min(100, realVol * 100)));
        const panVal = Math.round(Math.max(-100, Math.min(100, realPan * 100)));

        const instOptions = isDrum
          ? `<option value="kick" selected>Drum Kit</option>`
          : FRIENDLY_MUSIC_INSTRUMENTS.map((inst) => {
              const sel = currentInstId === inst.id ? 'selected' : '';
              return `<option value="${inst.id}" ${sel}>${inst.label}</option>`;
            }).join('');

        return `
          <div class="sound-mixer-row" data-track="${this.escapeHtml(tr.name)}" data-inst="${this.escapeHtml(effectiveInstName)}" data-wave="${this.escapeHtml(rawWave)}">
            <div class="sound-mixer-left">
              <button
                type="button"
                class="sound-ms-btn mute ${isMuted ? 'active' : ''}"
                data-action="mute"
                data-track="${this.escapeHtml(tr.name)}"
                title="Mute ${this.escapeHtml(tr.name)}"
              >M</button>
              <button
                type="button"
                class="sound-ms-btn solo ${isSolo ? 'active' : ''}"
                data-action="solo"
                data-track="${this.escapeHtml(tr.name)}"
                title="Solo ${this.escapeHtml(tr.name)}"
              >S</button>
              <span class="sound-track-title">${this.escapeHtml(tr.name)}</span>
            </div>

            <select
              class="sound-inst-select"
              data-track="${this.escapeHtml(tr.name)}"
              data-inst="${this.escapeHtml(effectiveInstName)}"
              data-wave="${this.escapeHtml(rawWave)}"
              aria-label="Instrument for ${this.escapeHtml(tr.name)}"
              ${isDrum ? 'disabled' : ''}
            >
              ${instOptions}
            </select>

            <label class="sound-mini-slider" title="Track Volume (${volPct}%)">
              <span>Vol</span>
              <input
                type="range"
                class="track-vol-slider"
                data-track="${this.escapeHtml(tr.name)}"
                data-inst="${this.escapeHtml(effectiveInstName)}"
                data-wave="${this.escapeHtml(rawWave)}"
                min="1"
                max="100"
                step="1"
                value="${volPct}"
              />
            </label>

            <label class="sound-mini-slider" title="Stereo Pan (${panVal})">
              <span>Pan</span>
              <input
                type="range"
                class="track-pan-slider"
                data-track="${this.escapeHtml(tr.name)}"
                data-inst="${this.escapeHtml(effectiveInstName)}"
                data-wave="${this.escapeHtml(rawWave)}"
                min="-100"
                max="100"
                step="1"
                value="${panVal}"
              />
            </label>
          </div>
        `;
      })
      .join('');

    // Bind Mute / Solo (instant <1ms WebAudio stem mute/solo when stems are loaded)
    this.trackListEl.querySelectorAll('.sound-ms-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const el = btn as HTMLElement;
        const track = el.getAttribute('data-track') || '';
        const action = el.getAttribute('data-action');
        if (!track) return;

        this.recordHistoryBeforeChange();
        if (action === 'mute') {
          if (this.muteTracks.has(track)) {
            this.muteTracks.delete(track);
          } else {
            this.muteTracks.add(track);
            this.soloTracks.delete(track);
          }
        } else if (action === 'solo') {
          if (this.soloTracks.has(track)) {
            this.soloTracks.delete(track);
          } else {
            this.soloTracks.add(track);
            this.muteTracks.delete(track);
          }
        }
        this.syncMixerButtonsDOM();
        this.updateHistoryButtonsUI();
        if (this.trackStemBuffers.size > 0) {
          this.exportWavNeedsResynth = true;
          this.applyLiveTrackMixerState();
        } else {
          void this.synthesizeAndPlay(true, true);
        }
      });
    });

    // Bind Instrument Select (updates wave= and gm= with valid .music archetypes, preserves playhead)
    this.trackListEl.querySelectorAll('.sound-inst-select').forEach((sel) => {
      sel.addEventListener('change', () => {
        const selectEl = sel as HTMLSelectElement;
        const trackName = selectEl.getAttribute('data-track') || '';
        const instName = selectEl.getAttribute('data-inst') || '';
        const defaultWave = selectEl.getAttribute('data-wave') || 'ym2612_brass';
        const chosenId = selectEl.value;
        const spec = FRIENDLY_MUSIC_INSTRUMENTS.find((i) => i.id === chosenId);
        if (!instName || !spec) return;

        this.recordHistoryBeforeChange();
        this.updateMusicInstProperty(instName, defaultWave, (line) => {
          const cleaned = line
            .replace(/\b(wave|wave_type|preset|gm|duty)=[^\s]+/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
          return `${cleaned} ${spec.dslWave}`;
        });
        const cached = this.trackMetaCache.get(trackName);
        if (cached) {
          cached.waveType = spec.id;
        }
        this.updateHistoryButtonsUI();
        void this.synthesizeAndPlay(true, true);
      });
    });

    // Bind Volume Sliders (instant <1ms WebAudio GainNode update when stems are loaded)
    this.trackListEl.querySelectorAll('.track-vol-slider').forEach((slider) => {
      const inputEl = slider as HTMLInputElement;
      const applyVol = (valNum: number) => {
        const trackName = inputEl.getAttribute('data-track') || '';
        const instName = inputEl.getAttribute('data-inst') || '';
        const defaultWave = inputEl.getAttribute('data-wave') || 'ym2612_brass';
        if (!instName) return;
        const volNum = Number((valNum / 100).toFixed(2));
        const vol = volNum.toFixed(2);
        this.updateMusicInstProperty(instName, defaultWave, (line) => {
          if (/\b(?:vol|volume)=[^\s]+/i.test(line)) {
            return line.replace(/\b(?:vol|volume)=[^\s]+/i, `vol=${vol}`);
          }
          return `${line} vol=${vol}`;
        });
        const cached = this.trackMetaCache.get(trackName);
        if (cached) {
          cached.volume = volNum;
        }
        const live = this.trackLiveMeta.get(trackName) ||
          this.trackStemBaseMeta.get(trackName) || { volume: volNum, pan: 0 };
        this.trackLiveMeta.set(trackName, { volume: volNum, pan: live.pan });
        if (inputEl.parentElement) {
          inputEl.parentElement.title = `Track Volume (${Math.round(valNum)}%)`;
        }
        if (this.trackStemBuffers.size > 0) {
          this.dslDirty = false;
          this.exportWavNeedsResynth = true;
        }
      };

      inputEl.addEventListener('pointerdown', () => {
        if (!this.sliderDragSnapshotTaken) {
          this.recordHistoryBeforeChange();
          this.sliderDragSnapshotTaken = true;
        }
      });
      inputEl.addEventListener('input', () => {
        if (!this.sliderDragSnapshotTaken) {
          this.recordHistoryBeforeChange();
          this.sliderDragSnapshotTaken = true;
        }
        applyVol(Number(inputEl.value));
        this.updateHistoryButtonsUI();
        if (this.trackStemBuffers.size > 0) {
          this.applyLiveTrackMixerState();
        } else {
          this.scheduleRealtimeSynthesize(true, true);
        }
      });
      inputEl.addEventListener('change', () => {
        this.sliderDragSnapshotTaken = false;
        if (this.realtimeDebounceTimer !== null) {
          window.clearTimeout(this.realtimeDebounceTimer);
          this.realtimeDebounceTimer = null;
        }
        applyVol(Number(inputEl.value));
        this.updateHistoryButtonsUI();
        if (this.trackStemBuffers.size > 0) {
          this.applyLiveTrackMixerState();
        } else {
          void this.synthesizeAndPlay(true, true);
        }
      });
    });

    // Bind Pan Sliders (instant <1ms WebAudio StereoPannerNode update when stems are loaded)
    this.trackListEl.querySelectorAll('.track-pan-slider').forEach((slider) => {
      const inputEl = slider as HTMLInputElement;
      const applyPan = (valNum: number) => {
        const trackName = inputEl.getAttribute('data-track') || '';
        const instName = inputEl.getAttribute('data-inst') || '';
        const defaultWave = inputEl.getAttribute('data-wave') || 'ym2612_brass';
        if (!instName) return;
        const panNum = Number((valNum / 100).toFixed(2));
        const pan = panNum.toFixed(2);
        this.updateMusicInstProperty(instName, defaultWave, (line) => {
          if (/\bpan=[^\s]+/i.test(line)) {
            return line.replace(/\bpan=[^\s]+/i, `pan=${pan}`);
          }
          return `${line} pan=${pan}`;
        });
        const cached = this.trackMetaCache.get(trackName);
        if (cached) {
          cached.pan = panNum;
        }
        const live = this.trackLiveMeta.get(trackName) ||
          this.trackStemBaseMeta.get(trackName) || { volume: 0.2, pan: panNum };
        this.trackLiveMeta.set(trackName, { volume: live.volume, pan: panNum });
        if (inputEl.parentElement) {
          inputEl.parentElement.title = `Stereo Pan (${Math.round(valNum)})`;
        }
        if (this.trackStemBuffers.size > 0) {
          this.dslDirty = false;
          this.exportWavNeedsResynth = true;
        }
      };

      inputEl.addEventListener('pointerdown', () => {
        if (!this.sliderDragSnapshotTaken) {
          this.recordHistoryBeforeChange();
          this.sliderDragSnapshotTaken = true;
        }
      });
      inputEl.addEventListener('input', () => {
        if (!this.sliderDragSnapshotTaken) {
          this.recordHistoryBeforeChange();
          this.sliderDragSnapshotTaken = true;
        }
        applyPan(Number(inputEl.value));
        this.updateHistoryButtonsUI();
        if (this.trackStemBuffers.size > 0) {
          this.applyLiveTrackMixerState();
        } else {
          this.scheduleRealtimeSynthesize(true, true);
        }
      });
      inputEl.addEventListener('change', () => {
        this.sliderDragSnapshotTaken = false;
        if (this.realtimeDebounceTimer !== null) {
          window.clearTimeout(this.realtimeDebounceTimer);
          this.realtimeDebounceTimer = null;
        }
        applyPan(Number(inputEl.value));
        this.updateHistoryButtonsUI();
        if (this.trackStemBuffers.size > 0) {
          this.applyLiveTrackMixerState();
        } else {
          void this.synthesizeAndPlay(true, true);
        }
      });
    });
  }

  private renderDiagnosticsAndStatus(rep: SoundValidationReport): void {
    const passed = Boolean(rep.passed);
    const peakL = typeof rep.peakLeftDBFS === 'number' ? rep.peakLeftDBFS.toFixed(1) : '0.0';
    this.statusPillBtn.className = `sound-status-pill ${passed ? 'pass' : 'fail'}`;
    this.statusPillBtn.textContent = passed
      ? `✓ Clean · ${peakL} dB`
      : `⚠ ${rep.issues?.length || 1} issue${(rep.issues?.length || 1) > 1 ? 's' : ''}`;

    const rms = typeof rep.rmsDBFS === 'number' ? `${rep.rmsDBFS.toFixed(1)} dB` : '-';
    const dc = typeof rep.dcOffset === 'number' ? rep.dcOffset.toFixed(4) : '0.0000';
    const extra =
      this.activeDocType === 'music'
        ? `Low-Freq Energy: ${(rep.lowFreqEnergyPct ?? 0).toFixed(1)}%`
        : `Boundaries: ${rep.boundaryClean !== false ? 'Zero-click' : 'Click risk'}`;

    const issuesHtml =
      rep.issues && rep.issues.length > 0
        ? `<ul class="sound-issues-list">${rep.issues
            .map((iss) => `<li>${this.escapeHtml(iss)}</li>`)
            .join('')}</ul>`
        : `<p class="sound-pass-note">Passes all headroom and anti-click checks.</p>`;

    this.diagnosticsContainerEl.innerHTML = `
      <div class="sound-diag-summary">
        <span>Peak: <strong>${peakL} dBFS</strong></span>
        <span>RMS: <strong>${rms}</strong></span>
        <span>DC: <strong>${dc}</strong></span>
        <span>${extra}</span>
      </div>
      ${issuesHtml}
    `;
  }

  private ensureAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtx();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.78;
      this.analyser.connect(this.audioCtx.destination);

      // Soft-knee tanh limiter matching Go's MixTracksPCM master bus (knee = 28000 / 32768)
      const limiter = this.audioCtx.createWaveShaper();
      const curveLen = 65537;
      const curve = new Float32Array(curveLen);
      const knee = 28000.0 / 32768.0;
      const headroom = 4767.0 / 32768.0;
      for (let i = 0; i < curveLen; i++) {
        const x = (i * 2) / (curveLen - 1) - 1;
        const absX = Math.abs(x);
        if (absX <= knee) {
          curve[i] = x;
        } else {
          const excess = (absX - knee) / headroom;
          const compressed = knee + headroom * Math.tanh(excess);
          curve[i] = x < 0 ? -compressed : compressed;
        }
      }
      limiter.curve = curve;
      limiter.oversample = 'none';
      limiter.connect(this.analyser);
      this.masterLimiterNode = limiter;
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  private async startBufferPlayback(offsetSec = 0): Promise<void> {
    if (!this.decodedBuffer) return;
    const ctx = this.ensureAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    this.stopSourceNodeOnly();

    const clampedOffset = Math.max(
      0,
      Math.min(offsetSec, Math.max(0, this.decodedBuffer.duration - 0.005))
    );
    this.playOffsetSec = clampedOffset;
    this.playStartCtxTime = ctx.currentTime;
    this.isPlaying = true;
    this.playBtnEl.textContent = 'Stop';

    if (this.activeDocType === 'music' && this.trackStemBuffers.size > 0) {
      const startAt = ctx.currentTime;
      const destNode = this.masterLimiterNode || this.analyser!;
      let primarySrc: AudioBufferSourceNode | null = null;

      for (const [trackName, stemBuf] of this.trackStemBuffers.entries()) {
        const src = ctx.createBufferSource();
        src.buffer = stemBuf;
        src.loop = this.loopEnabled;

        const gainNode = ctx.createGain();
        const panNode = ctx.createStereoPanner();
        const state = this.computeTrackMixerNodesState(trackName);

        gainNode.gain.value = state.gain;
        panNode.channelCount = state.monoDownmix ? 1 : 2;
        panNode.channelCountMode = state.monoDownmix ? 'explicit' : 'max';
        panNode.pan.value = state.pan;

        src.connect(gainNode);
        gainNode.connect(panNode);
        panNode.connect(destNode);

        this.activeStemNodes.set(trackName, {
          source: src,
          gain: gainNode,
          pan: panNode
        });

        if (!primarySrc || stemBuf.duration >= (primarySrc.buffer?.duration || 0)) {
          primarySrc = src;
        }
      }

      if (primarySrc) {
        this.sourceNode = primarySrc;
        primarySrc.onended = () => {
          if (this.sourceNode === primarySrc && !this.loopEnabled) {
            this.isPlaying = false;
            this.playOffsetSec = 0;
            this.playBtnEl.textContent = 'Play';
            if (this.decodedBuffer) {
              this.updateTimeReadout(0, this.decodedBuffer.duration);
            }
            this.drawVisualizerFrame();
          }
        };
      }

      for (const node of this.activeStemNodes.values()) {
        const trackOffset = Math.min(
          clampedOffset,
          Math.max(0, (node.source.buffer?.duration || 0) - 0.005)
        );
        node.source.start(startAt, trackOffset);
      }

      this.startVisualizerLoop();
      return;
    }

    const src = ctx.createBufferSource();
    src.buffer = this.decodedBuffer;
    src.loop = this.loopEnabled;
    src.connect(this.analyser!);
    this.sourceNode = src;

    src.onended = () => {
      if (this.sourceNode === src && !this.loopEnabled) {
        this.isPlaying = false;
        this.playOffsetSec = 0;
        this.playBtnEl.textContent = 'Play';
        if (this.decodedBuffer) {
          this.updateTimeReadout(0, this.decodedBuffer.duration);
        }
        this.drawVisualizerFrame();
      }
    };

    src.start(0, clampedOffset);
    this.startVisualizerLoop();
  }

  private stopSourceNodeOnly(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.onended = null;
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch {
        // Ignore already stopped
      }
      this.sourceNode = null;
    }
    if (this.activeStemNodes.size > 0) {
      for (const node of this.activeStemNodes.values()) {
        try {
          node.source.onended = null;
          node.source.stop();
        } catch {
          // Ignore already stopped
        }
        try {
          node.source.disconnect();
          node.gain.disconnect();
          node.pan.disconnect();
        } catch {
          // Ignore disconnect errors
        }
      }
      this.activeStemNodes.clear();
    }
  }

  public stopPlayback(): void {
    this.stopSourceNodeOnly();
    this.isPlaying = false;
    this.playOffsetSec = 0;
    if (this.playBtnEl) {
      this.playBtnEl.textContent = 'Play';
    }
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.decodedBuffer) {
      this.updateTimeReadout(0, this.decodedBuffer.duration);
    }
    this.drawVisualizerFrame();
  }

  private getCurrentPlayheadSec(): number {
    if (!this.decodedBuffer) return 0;
    if (!this.isPlaying || !this.audioCtx) {
      return this.playOffsetSec;
    }
    const elapsed = this.audioCtx.currentTime - this.playStartCtxTime + this.playOffsetSec;
    const dur = this.decodedBuffer.duration || 1;
    return this.loopEnabled ? elapsed % dur : Math.min(dur, elapsed);
  }

  private startVisualizerLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
    const tick = () => {
      if (this.decodedBuffer) {
        const cur = this.getCurrentPlayheadSec();
        this.updateTimeReadout(cur, this.decodedBuffer.duration);
      }
      this.drawVisualizerFrame();
      if (this.isPlaying) {
        this.rafId = requestAnimationFrame(tick);
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private updateTimeReadout(currentSec: number, totalSec: number): void {
    this.timeReadoutEl.textContent = `${currentSec.toFixed(2)}s / ${totalSec.toFixed(2)}s`;
    if (totalSec > 0) {
      const ratio = Math.max(0, Math.min(1, currentSec / totalSec));
      this.scrubSliderEl.value = String(Math.round(ratio * 1000));
    } else {
      this.scrubSliderEl.value = '0';
    }
  }

  private drawVisualizerFrame(): void {
    const canvas = this.canvasEl;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (this.visualizerMode === 'spectrum') {
      this.drawSpectrumView(ctx, w, h);
    } else {
      this.drawWaveformView(ctx, w, h);
    }
  }

  private drawWaveformView(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const midY = h / 2;

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(w, midY);
    ctx.stroke();

    if (this.activeDocType === 'music' && this.trackStemPeaks.size > 0) {
      ctx.fillStyle = 'rgba(99, 102, 241, 0.32)';
      const activeTracks: Array<{ peaks: Float32Array; scale: number }> = [];
      for (const [trackName, peaks] of this.trackStemPeaks.entries()) {
        const state = this.computeTrackMixerNodesState(trackName);
        if (state.peakScale > 0) {
          activeTracks.push({ peaks, scale: state.peakScale });
        }
      }
      const knee = 28000.0 / 32768.0;
      const headroom = 4767.0 / 32768.0;
      for (let x = 0; x < w; x++) {
        let sumPeak = 0;
        for (let t = 0; t < activeTracks.length; t++) {
          const item = activeTracks[t];
          const binIdx = Math.min(
            item.peaks.length - 1,
            Math.floor((x / w) * item.peaks.length)
          );
          sumPeak += item.peaks[binIdx] * item.scale;
        }
        if (sumPeak > knee) {
          sumPeak = knee + headroom * Math.tanh((sumPeak - knee) / headroom);
        }
        const barH = Math.min(midY - 6, sumPeak * (midY - 8));
        ctx.fillRect(x, midY - barH, 1, barH * 2);
      }
    } else if (this.decodedBuffer) {
      const ch0 = this.decodedBuffer.getChannelData(0);
      const ch1 = this.decodedBuffer.numberOfChannels > 1 ? this.decodedBuffer.getChannelData(1) : ch0;
      const totalSamples = ch0.length;
      const step = Math.max(1, Math.floor(totalSamples / w));

      ctx.fillStyle = 'rgba(99, 102, 241, 0.32)';
      ctx.strokeStyle = 'rgba(129, 140, 248, 0.9)';
      ctx.lineWidth = 1.25;
      ctx.beginPath();

      for (let x = 0; x < w; x++) {
        const startIdx = x * step;
        let maxAbs = 0;
        for (let j = 0; j < step && startIdx + j < totalSamples; j += 4) {
          const v = Math.max(Math.abs(ch0[startIdx + j]), Math.abs(ch1[startIdx + j]));
          if (v > maxAbs) maxAbs = v;
        }
        const barH = Math.min(midY - 6, maxAbs * (midY - 8));
        ctx.fillRect(x, midY - barH, 1, barH * 2);
      }
    }

    if (this.isPlaying && this.analyser) {
      const timeData = new Uint8Array(this.analyser.fftSize);
      this.analyser.getByteTimeDomainData(timeData);

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const sliceWidth = w / timeData.length;
      let x = 0;
      for (let i = 0; i < timeData.length; i++) {
        const v = timeData[i] / 128.0;
        const y = (v * h) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.stroke();
    }

    if (this.decodedBuffer && this.decodedBuffer.duration > 0) {
      const curSec = this.getCurrentPlayheadSec();
      const playX = Math.max(0, Math.min(w, (curSec / this.decodedBuffer.duration) * w));
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playX, 0);
      ctx.lineTo(playX, h);
      ctx.stroke();
    }
  }

  private drawSpectrumView(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const bassRatio = 0.24;
    const bassMaxX = Math.floor(w * bassRatio);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';
    ctx.fillRect(0, 0, bassMaxX, h);

    if (this.analyser && this.isPlaying) {
      const freqBins = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(freqBins);

      const numBars = 64;
      const barWidth = w / numBars;
      for (let i = 0; i < numBars; i++) {
        const norm = i / numBars;
        const binIdx = Math.min(
          freqBins.length - 1,
          Math.floor(Math.pow(norm, 2.0) * (freqBins.length * 0.45))
        );
        const mag = freqBins[binIdx] / 255.0;
        const barH = Math.max(2, mag * (h - 16));
        const x = i * barWidth;
        const y = h - barH;

        ctx.fillStyle = x < bassMaxX ? '#10b981' : '#6366f1';
        ctx.fillRect(x + 1, y, Math.max(2, barWidth - 2), barH);
      }
    }
  }

  private async saveCurrentFile(): Promise<void> {
    const content = this.editorTextarea.value;
    if (!content.trim()) return;

    let targetPath = this.activeFilePath;
    if (!targetPath) {
      const ws = getWorkspacePath() || '';
      const defaultPath = ws ? `${ws.replace(/\/+$/, '')}/${this.activeFileName}` : this.activeFileName;
      const prompted = window.prompt('Save file path:', defaultPath);
      if (!prompted || !prompted.trim()) return;
      targetPath = prompted.trim();
    }

    this.saveBtnEl.disabled = true;
    try {
      const res = await sidecarFetch('/api/sound/file/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: targetPath, content })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Failed to save (HTTP ${res.status})`);
      }
      this.activeFilePath = data.filePath || targetPath;
      this.activeFileName = this.activeFilePath.split(/[\\/]/).pop() || this.activeFileName;
      StudioNotifier.success(`Saved ${this.activeFileName}`);
      await this.refreshFilesCatalog();
    } catch (err: any) {
      StudioNotifier.error('Save Failed', err?.message || String(err));
    } finally {
      this.saveBtnEl.disabled = false;
    }
  }

  private async exportCurrentWav(): Promise<void> {
    let targetBuildId = this.lastBuildId;

    if (
      !targetBuildId ||
      this.dslDirty ||
      (this.activeDocType === 'music' &&
        (this.exportWavNeedsResynth || this.soloTracks.size > 0 || this.muteTracks.size > 0))
    ) {
      const dsl = this.editorTextarea.value.trim();
      if (!dsl) return;
      const res = await sidecarFetch('/api/sound/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dsl,
          type: this.activeDocType,
          apple: this.activeDocType === 'music' ? this.useAppleSynth : false,
          soloTracks: Array.from(this.soloTracks),
          muteTracks: Array.from(this.muteTracks)
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.buildId) {
        StudioNotifier.error(
          'Export Failed',
          data.error || data.report?.error || 'Could not synthesize WAV for export'
        );
        return;
      }
      targetBuildId = data.buildId;
      this.exportWavNeedsResynth = false;
    }

    const baseName = this.activeFileName.replace(/\.(music|sfx)$/i, '') || 'sound_export';
    const wavFileName = `${baseName}.wav`;

    const a = document.createElement('a');
    a.href = `/api/sound/wav?buildId=${encodeURIComponent(targetBuildId)}`;
    a.download = wavFileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    StudioNotifier.success(`Downloaded ${wavFileName}`);
  }

  private async sendToChat(): Promise<void> {
    const dsl = this.editorTextarea.value.trim();
    const note = this.chatNoteInputEl.value.trim();
    if (!dsl && !note) return;

    this.sendChatBtnEl.disabled = true;
    try {
      const fileLabel = this.activeFilePath || this.activeFileName;
      const summaryMarkdown = [
        `### Sound Studio: \`${fileLabel}\``,
        note ? `\n**Request**: ${note}` : '',
        `\n\`\`\`${this.activeDocType}`,
        dsl,
        `\`\`\``
      ]
        .filter(Boolean)
        .join('\n');

      const sessionId = window.sidecar?.conversationId || getSessionId() || 'standalone';

      if (window.sidecar?.agent?.sendMessage) {
        await window.sidecar.agent.sendMessage(
          summaryMarkdown,
          sessionId !== 'standalone' ? sessionId : undefined
        );
      } else {
        const res = await sidecarFetch('/api/send-to-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            buildError: summaryMarkdown,
            note,
            workspace: getWorkspacePath() || '.'
          })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to send (HTTP ${res.status})`);
        }
      }

      StudioNotifier.success('Sent to chat');
      this.chatNoteInputEl.value = '';
    } catch (err: any) {
      StudioNotifier.error('Failed to Send', err?.message || String(err));
    } finally {
      this.sendChatBtnEl.disabled = false;
    }
  }

  private escapeHtml(str: string): string {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
