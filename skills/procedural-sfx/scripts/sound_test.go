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

package main

import (
	"fmt"
	"os"
	"testing"
)

// ExampleCompileDSL_laserSFX demonstrates synthesizing a punchy 25% duty pulse laser shot in the SFX DSL.
func ExampleCompileDSL_laserSFX() {
	const laserDSL = `
title "Laser Bow Shot"
type sfx

step wave=square freq=950Hz->120Hz dur=150ms duty=0.25 vol=0.30 adsr=0.005,0.04,0.20,0.085 pan=0.0
`
	pcm, err := CompileDSL(laserDSL)
	if err != nil {
		panic(err)
	}
	fmt.Printf("Laser SFX Duration: %.2fs (%d bytes)\n", float64(len(pcm))/float64(BytesPerSecond), len(pcm))

	// Output:
	// Laser SFX Duration: 0.15s (26460 bytes)
}

// ExampleCompileDSL_explosionSFX demonstrates a multi-layer explosion combining sub-bass drop, LPF noise rumble, and HPF transient crack.
func ExampleCompileDSL_explosionSFX() {
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
	pcm, err := CompileDSL(explosionDSL)
	if err != nil {
		panic(err)
	}
	fmt.Printf("Explosion SFX Duration: %.2fs (%d bytes)\n", float64(len(pcm))/float64(BytesPerSecond), len(pcm))

	// Output:
	// Explosion SFX Duration: 0.85s (149940 bytes)
}

// ExampleCompileDSL_fmMetallicHitSFX demonstrates 2-operator inharmonic FM synthesis for metallic armor impacts.
func ExampleCompileDSL_fmMetallicHitSFX() {
	const clangDSL = `
title "Metallic Shield Impact"
type sfx

step wave=fm freq=440Hz->180Hz dur=200ms mod_freq=622Hz mod_index=4.5 vol=0.35 adsr=0.002,0.05,0.15,0.148
`
	pcm, err := CompileDSL(clangDSL)
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
	pcm, err := CompileDSL(coinDSL)
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
	pcm, err := CompileDSL(DemoSFXShowcaseDSL)
	if err != nil {
		t.Fatalf("CompileDSL(DemoSFXShowcaseDSL) failed: %v", err)
	}
	if len(pcm) == 0 || len(pcm)%4 != 0 {
		t.Fatalf("DemoSFXShowcaseDSL produced unaligned or empty PCM (%d bytes)", len(pcm))
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
