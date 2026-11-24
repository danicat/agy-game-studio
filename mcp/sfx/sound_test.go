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

package sfx

import (
	"fmt"
	"math"
	"os"
	"path/filepath"
	"testing"
)

func sfxFixturePath(name string) string {
	return filepath.Join("..", "..", "tests", "fixtures", "sfx", name)
}

func compileDSL(dslText string) ([]byte, error) {
	score, err := ParseDSL(dslText)
	if err != nil {
		return nil, err
	}
	if err := ValidateScore(score); err != nil {
		return nil, err
	}
	return SynthesizeScore(score)
}

// ExampleParseDSL_laserSFX demonstrates synthesizing a punchy 25% duty pulse laser shot in the SFX DSL.
func ExampleParseDSL_laserSFX() {
	const laserDSL = `
title "Laser Bow Shot"
type sfx

step wave=square freq=950Hz->120Hz dur=150ms duty=0.25 vol=0.30 adsr=0.005,0.04,0.20,0.085 pan=0.0
`
	pcm, err := compileDSL(laserDSL)
	if err != nil {
		panic(err)
	}
	fmt.Printf("Laser SFX Duration: %.2fs (%d bytes)\n", float64(len(pcm))/float64(BytesPerSecond), len(pcm))

	// Output:
	// Laser SFX Duration: 0.15s (26460 bytes)
}

// ExampleParseDSL_explosionSFX demonstrates a multi-layer explosion combining sub-bass drop, LPF noise rumble, and HPF transient crack.
func ExampleParseDSL_explosionSFX() {
	const explosionDSL = `
title "Layered Plasma Explosion"
type sfx

inst sub_drop wave=triangle freq=140Hz->28Hz vol=0.45 adsr=0.005,0.15,0.30,0.45
inst rumble   wave=noise    noise_filter=0.12 vol=0.40 adsr=0.010,0.25,0.20,0.59 lpf=0.25
inst crack    wave=noise    noise_filter=0.85 vol=0.35 adsr=0.001,0.03,0.00,0.04 hpf=0.75

track impact    sub_drop: 140Hz->28Hz:600ms R:250ms
track body      rumble:   rumble:850ms
track transient crack:    crack:80ms R:770ms
`
	pcm, err := compileDSL(explosionDSL)
	if err != nil {
		panic(err)
	}
	fmt.Printf("Explosion SFX Duration: %.2fs (%d bytes)\n", float64(len(pcm))/float64(BytesPerSecond), len(pcm))

	// Output:
	// Explosion SFX Duration: 0.85s (149940 bytes)
}

// ExampleParseDSL_fmMetallicHitSFX demonstrates 2-operator inharmonic FM synthesis for metallic armor impacts.
func ExampleParseDSL_fmMetallicHitSFX() {
	const clangDSL = `
title "Metallic Shield Impact"
type sfx

step wave=fm freq=440Hz->180Hz dur=200ms mod_freq=622Hz mod_index=4.5 vol=0.35 adsr=0.002,0.05,0.15,0.148
`
	pcm, err := compileDSL(clangDSL)
	if err != nil {
		panic(err)
	}
	fmt.Printf("Metallic Hit SFX Duration: %.2fs (%d bytes)\n", float64(len(pcm))/float64(BytesPerSecond), len(pcm))

	// Output:
	// Metallic Hit SFX Duration: 0.20s (35280 bytes)
}

// ExampleExportWAV demonstrates compiling a multi-note Coin Pickup Chime in the SFX DSL and exporting to WAV.
func ExampleExportWAV() {
	const coinDSL = `
title "Coin Pickup Chime"
type sfx

inst chime wave=square duty=0.50 vol=0.20 adsr=0.005,0.02,0.50,0.045
seq chime: B5:70ms E6:220ms
`
	pcm, err := compileDSL(coinDSL)
	if err != nil {
		panic(err)
	}
	tmpFile := "/tmp/coin_test.wav"
	if err := ExportWAV(tmpFile, pcm); err != nil {
		panic(err)
	}
	fmt.Printf("Exported WAV successfully: %s (%d bytes)\n", tmpFile, len(pcm))
	if err := os.Remove(tmpFile); err != nil {
		panic(err)
	}

	// Output:
	// Exported WAV successfully: /tmp/coin_test.wav (51156 bytes)
}

func TestSFXDSLAndDSPPostProcessing(t *testing.T) {
	pcm, err := compileDSL(demoSFXShowcaseDSL)
	if err != nil {
		t.Fatalf("CompileDSL(demoSFXShowcaseDSL) failed: %v", err)
	}
	if len(pcm) == 0 || len(pcm)%4 != 0 {
		t.Fatalf("demoSFXShowcaseDSL produced unaligned or empty PCM (%d bytes)", len(pcm))
	}

	sliced, err := SliceLoopPCM(pcm, 0.05, 0.25)
	if err != nil {
		t.Fatalf("SliceLoopPCM failed: %v", err)
	}
	if len(sliced) == 0 || len(sliced)%4 != 0 {
		t.Fatalf("SliceLoopPCM returned unaligned or empty slice (%d bytes)", len(sliced))
	}

	lpf := ApplyLowPassFilter(sliced, 0.25)
	if len(lpf) != len(sliced) || len(lpf)%4 != 0 {
		t.Fatalf("ApplyLowPassFilter length = %d, want %d", len(lpf), len(sliced))
	}

	hpf := ApplyHighPassFilter(sliced, 0.85)
	if len(hpf) != len(sliced) || len(hpf)%4 != 0 {
		t.Fatalf("ApplyHighPassFilter length = %d, want %d", len(hpf), len(sliced))
	}

	crushed := ApplyBitcrush(sliced, 4, 4)
	if len(crushed) != len(sliced) || len(crushed)%4 != 0 {
		t.Fatalf("ApplyBitcrush length = %d, want %d", len(crushed), len(sliced))
	}
}

func TestPolyBLEPAndSoftClip(t *testing.T) {
	// PolyBLEP test
	if b := polyBLEP(0.5, 0.1); b != 0.0 {
		t.Errorf("polyBLEP middle should be 0.0, got %f", b)
	}
	if b := polyBLEP(0.0, 0.1); b != -1.0 {
		t.Errorf("polyBLEP at 0 should be -1.0, got %f", b)
	}
	if b := polyBLEP(0.05, 0.1); b >= 0.0 {
		t.Errorf("polyBLEP inside ramp should be negative, got %f", b)
	}

	// SoftClip test: identity inside [-0.75, 0.75]
	for _, val := range []float64{-0.75, -0.5, 0.0, 0.5, 0.75} {
		clipped := SoftClip(val)
		if math.Abs(clipped-val) > 1e-6 {
			t.Errorf("SoftClip(%f) = %f, want exact match", val, clipped)
		}
	}
	// SoftClip test: strictly bounded below or equal to 1.0
	for _, val := range []float64{0.8, 1.0, 2.0, 10.0, 100.0} {
		clipped := SoftClip(val)
		if clipped > 1.0 || clipped < 0.75 {
			t.Errorf("SoftClip(%f) = %f, expected in [0.75, 1.0]", val, clipped)
		}
		negClipped := SoftClip(-val)
		if negClipped < -1.0 || negClipped > -0.75 {
			t.Errorf("SoftClip(-%f) = %f, expected in [-1.0, -0.75]", val, negClipped)
		}
	}
}

func TestLFSRNoiseAndPSGWave(t *testing.T) {
	lfsr := NewLFSRNoise(12345)
	var sum float64
	const nSamples = 20000
	for range nSamples {
		sample := lfsr.Next(0)
		if sample != 1.0 && sample != -1.0 {
			t.Fatalf("LFSR bit output should be +/-1.0, got %f", sample)
		}
		sum += sample
	}
	avg := sum / float64(nSamples)
	if math.Abs(avg) > 0.05 {
		t.Errorf("LFSR DC bias too high: %f", avg)
	}

	// Test DSL synthesis with wave=psg_noise
	const psgDSL = `
title "PSG Noise Zap"
type sfx
step wave=psg_noise freq=220Hz dur=100ms vol=0.30 adsr=0.002,0.02,0.1,0.05
`
	pcm, err := compileDSL(psgDSL)
	if err != nil {
		t.Fatalf("CompileDSL psg_noise failed: %v", err)
	}
	rep, err := ValidateProductionSFX(pcm)
	if err != nil {
		t.Fatalf("ValidateProductionSFX failed on psg_noise: %v", err)
	}
	if !rep.Passed {
		t.Fatalf("psg_noise failed validation: %v", rep.Issues)
	}
}

func TestDynamicDutyCycleAndFilterSweeps(t *testing.T) {
	const sweepDSL = `
title "Dynamic Sweeps"
type sfx
inst laser wave=square freq=880Hz->220Hz duty=0.50->0.125 vol=0.30 adsr=0.002,0.04,0.15,0.05 lpf=3000->400 q=2.0
track main laser: laser:120ms
`
	pcm, err := compileDSL(sweepDSL)
	if err != nil {
		t.Fatalf("CompileDSL sweep failed: %v", err)
	}
	rep, err := ValidateProductionSFX(pcm)
	if err != nil {
		t.Fatalf("ValidateProductionSFX failed on dynamic sweeps: %v", err)
	}
	if !rep.Passed {
		t.Fatalf("dynamic sweeps failed validation: %v", rep.Issues)
	}
}

func TestPitchCurves(t *testing.T) {
	for _, curve := range []string{"exp", "lin", "hyper"} {
		dsl := fmt.Sprintf(`
title "Curve Test %s"
type sfx
inst zap wave=square freq=1000Hz->100Hz curve=%s vol=0.25 adsr=0.002,0.03,0.10,0.04
track main zap: zap:80ms
`, curve, curve)
		pcm, err := compileDSL(dsl)
		if err != nil {
			t.Fatalf("CompileDSL curve=%s failed: %v", curve, err)
		}
		rep, err := ValidateProductionSFX(pcm)
		if err != nil || !rep.Passed {
			t.Fatalf("ValidateProductionSFX failed for curve=%s: %v", curve, err)
		}
	}
}

func TestAllSFXPresets(t *testing.T) {
	presets := ListSFXPresets()
	if len(presets) < 18 {
		t.Fatalf("expected at least 18 presets, got %d", len(presets))
	}

	for _, name := range presets {
		dsl := fmt.Sprintf(`
title "Preset Test %s"
type sfx
inst test_inst preset=%s
track main test_inst: test_inst:120ms
`, name, name)
		pcm, err := compileDSL(dsl)
		if err != nil {
			t.Fatalf("CompileDSL preset %q failed: %v", name, err)
		}
		rep, err := ValidateProductionSFX(pcm)
		if err != nil || !rep.Passed {
			t.Fatalf("preset %q failed validation: %v (issues: %v)", name, err, rep.Issues)
		}
	}
}

func TestCuratedSFXLibrary(t *testing.T) {
	sfxFiles := []string{
		"laser_arcade.sfx",
		"plasma_gun.sfx",
		"explosion_arcade.sfx",
		"explosion_deep.sfx",
		"coin_pickup.sfx",
		"gem_shimmer.sfx",
		"jump_arcade.sfx",
		"jump_spring.sfx",
		"sword_clash.sfx",
		"shield_deflect.sfx",
		"hit_punch.sfx",
		"hit_damage.sfx",
		"powerup_fanfare.sfx",
		"ui_select.sfx",
		"ui_confirm.sfx",
		"ui_error.sfx",
		"footstep_stone.sfx",
		"engine_thruster.sfx",
	}

	for _, file := range sfxFiles {
		t.Run(file, func(t *testing.T) {
			score, err := LoadDSLFile(sfxFixturePath(file))
			if err != nil {
				t.Fatalf("LoadDSLFile(%q) failed: %v", file, err)
			}
			if err := ValidateScore(score); err != nil {
				t.Fatalf("ValidateScore(%q) failed: %v", file, err)
			}
			pcm, err := SynthesizeScore(score)
			if err != nil {
				t.Fatalf("SynthesizeScore(%q) failed: %v", file, err)
			}
			rep, err := ValidateProductionSFX(pcm)
			if err != nil || !rep.Passed {
				t.Fatalf("ValidateProductionSFX(%q) failed: %v (issues: %v)", file, err, rep.Issues)
			}
		})
	}
}

func TestMutedTrackZeroVolume(t *testing.T) {
	const mutedDSL = `
title "Muted Cue"
type sfx
inst silent preset=arcade_laser vol=0
track main silent: 950Hz->110Hz:100ms
`
	pcm, err := compileDSL(mutedDSL)
	if err != nil {
		t.Fatalf("compileDSL(mutedDSL) failed: %v", err)
	}
	if len(pcm) == 0 || len(pcm)%4 != 0 {
		t.Fatalf("expected non-empty 4-byte aligned PCM, got %d bytes", len(pcm))
	}
	for i, b := range pcm {
		if b != 0 {
			t.Fatalf("expected silence for vol=0 at byte %d, got %d", i, b)
		}
	}
}

const demoSFXShowcaseDSL = `
title "Arcade SFX Showcase (Laser, Coin, Jump, Armor Clang, Explosion)"
type sfx

inst laser     wave=square   duty=0.25 vol=0.30 adsr=0.005,0.04,0.20,0.085
inst coin      wave=square   duty=0.50 vol=0.25 adsr=0.005,0.02,0.50,0.045
inst jump      wave=square   duty=0.25 vol=0.28 adsr=0.005,0.05,0.60,0.060
inst clang     wave=fm       mod_freq=587Hz mod_index=4.5 vol=0.30 adsr=0.002,0.06,0.15,0.12
inst boom      wave=noise    noise_filter=0.12 vol=0.40 adsr=0.010,0.25,0.20,0.59 lpf=0.30

seq:
  laser(950Hz->120Hz):150ms R:150ms |
  coin(B5):70ms coin(E6):220ms R:150ms |
  jump(180Hz->620Hz):180ms R:150ms |
  clang(420Hz->190Hz):200ms R:150ms |
  boom:850ms
`
