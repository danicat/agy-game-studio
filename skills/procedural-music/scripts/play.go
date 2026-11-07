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
	"bufio"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"time"

	"github.com/hajimehoshi/ebiten/v2/audio"
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	command := os.Args[1]

	switch command {
	case "play":
		playCmd := flag.NewFlagSet("play", flag.ExitOnError)
		loopFlag := playCmd.Bool("loop", false, "Loop BGM audio playback")
		appleFlag := playCmd.Bool("apple", false, "Render using macOS Apple CoreAudio real instruments")
		if err := playCmd.Parse(os.Args[2:]); err != nil {
			fmt.Fprintf(os.Stderr, "Error parsing play flags: %v\n", err)
			os.Exit(1)
		}

		if playCmd.NArg() < 1 {
			fmt.Fprintln(os.Stderr, "Error: Missing DSL music file.")
			fmt.Fprintln(os.Stderr, "Usage: go run ./scripts play [-loop] [-apple] <song.music>")
			os.Exit(1)
		}
		dslFile := playCmd.Arg(0)
		score, err := LoadDSLFile(dslFile)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error loading DSL file '%s': %v\n", dslFile, err)
			os.Exit(1)
		}
		if *appleFlag {
			score.SynthEngine = "apple"
		}

		pcm, err := SynthesizeScore(score)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error synthesizing score '%s': %v\n", score.Title, err)
			os.Exit(1)
		}
		pcm = pcm[:len(pcm)&^3]
		engineName := score.SynthEngine
		if engineName == "" {
			engineName = "default"
		}
		fmt.Printf("Playing music: '%s' (%s, synth=%s, %.0f BPM, %d tracks, %.2fs duration, loop=%v)...\n",
			score.Title, score.Type, engineName, score.BPM, len(score.Tracks), float64(len(pcm))/float64(BytesPerSecond), *loopFlag)
		playAudio(pcm, *loopFlag)

	case "demo":
		demoCmd := flag.NewFlagSet("demo", flag.ExitOnError)
		loopFlag := demoCmd.Bool("loop", false, "Loop BGM audio playback")
		appleFlag := demoCmd.Bool("apple", false, "Render using macOS Apple CoreAudio real instruments")
		if err := demoCmd.Parse(os.Args[2:]); err != nil {
			fmt.Fprintf(os.Stderr, "Error parsing demo flags: %v\n", err)
			os.Exit(1)
		}

		score, err := ParseDSL(DemoStageBGMDSL)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error parsing built-in demo DSL: %v\n", err)
			os.Exit(1)
		}
		if *appleFlag {
			score.SynthEngine = "apple"
		}
		pcm, err := SynthesizeScore(score)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error synthesizing demo soundtrack: %v\n", err)
			os.Exit(1)
		}
		pcm = pcm[:len(pcm)&^3]
		engineName := score.SynthEngine
		if engineName == "" {
			engineName = "default"
		}

		fmt.Printf("Playing Demo Soundtrack: '%s' (synth=%s, %.0f BPM, %.2fs duration, loop=%v)...\n",
			score.Title, engineName, score.BPM, float64(len(pcm))/float64(BytesPerSecond), *loopFlag)
		playAudio(pcm, *loopFlag)

	case "export":
		exportCmd := flag.NewFlagSet("export", flag.ExitOnError)
		appleFlag := exportCmd.Bool("apple", false, "Render using macOS Apple CoreAudio real instruments")
		if err := exportCmd.Parse(os.Args[2:]); err != nil {
			fmt.Fprintf(os.Stderr, "Error parsing export flags: %v\n", err)
			os.Exit(1)
		}

		if exportCmd.NArg() < 2 {
			fmt.Fprintln(os.Stderr, "Error: Missing arguments.")
			fmt.Fprintln(os.Stderr, "Usage: go run ./scripts export [-apple] <song.music> <output.wav>")
			os.Exit(1)
		}
		dslFile := exportCmd.Arg(0)
		wavFile := exportCmd.Arg(1)

		score, err := LoadDSLFile(dslFile)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error loading DSL file '%s': %v\n", dslFile, err)
			os.Exit(1)
		}
		if *appleFlag {
			score.SynthEngine = "apple"
		}

		pcm, err := SynthesizeScore(score)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error synthesizing score '%s': %v\n", score.Title, err)
			os.Exit(1)
		}
		pcm = pcm[:len(pcm)&^3]
		if err := ExportWAV(wavFile, pcm); err != nil {
			fmt.Fprintf(os.Stderr, "Error exporting WAV: %v\n", err)
			os.Exit(1)
		}
		engineName := score.SynthEngine
		if engineName == "" {
			engineName = "default"
		}
		fmt.Printf("Successfully exported '%s' (synth=%s, %.2fs duration) to '%s'\n",
			score.Title, engineName, float64(len(pcm))/float64(BytesPerSecond), wavFile)

	case "validate":
		valCmd := flag.NewFlagSet("validate", flag.ExitOnError)
		minCh := valCmd.Int("min-channels", 8, "Minimum required channels for production BGM")
		minDur := valCmd.Float64("min-duration", 30.0, "Minimum required duration in seconds for production BGM")
		if err := valCmd.Parse(os.Args[2:]); err != nil {
			fmt.Fprintf(os.Stderr, "Error parsing validate flags: %v\n", err)
			os.Exit(1)
		}
		if valCmd.NArg() < 1 {
			fmt.Fprintln(os.Stderr, "Error: Missing DSL music file.")
			fmt.Fprintln(os.Stderr, "Usage: go run ./scripts validate [-min-channels 8] [-min-duration 30] <song.music>")
			os.Exit(1)
		}
		dslFile := valCmd.Arg(0)
		score, err := LoadDSLFile(dslFile)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error loading DSL file '%s': %v\n", dslFile, err)
			os.Exit(1)
		}
		if err := ValidateProductionBGM(score, *minCh, *minDur); err != nil {
			fmt.Fprintf(os.Stderr, "Validation FAILED for '%s': %v\n", dslFile, err)
			os.Exit(1)
		}
		var totalSec float64
		if len(score.Tracks) > 0 {
			for _, ev := range score.Tracks[0].Events {
				totalSec += ev.DurationSec
			}
		}
		fmt.Printf("Validation PASSED: '%s' (%d channels, %.2fs duration, zero drift, zero harmonic clashes)\n",
			score.Title, len(score.Tracks), totalSec)

	default:
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println("Procedural Music DSL Player, Validator & WAV Exporter CLI")
	fmt.Println()
	fmt.Println("Commands:")
	fmt.Println("  go run ./scripts play [-loop] [-apple] <song.music>            Play a .music DSL file")
	fmt.Println("  go run ./scripts demo [-loop] [-apple]                         Play built-in 16-bar Genesis soundtrack")
	fmt.Println("  go run ./scripts export [-apple] <song.music> <out.wav>        Compile .music DSL file and export to WAV")
	fmt.Println("  go run ./scripts validate <song.music>                         Validate music theory, consonance, channels & duration")
}

func playAudio(pcm []byte, loop bool) {
	alignedLen := len(pcm) &^ 3
	if alignedLen == 0 {
		fmt.Fprintf(os.Stderr, "Playback error: PCM buffer is empty or smaller than 4-byte stereo frame (%d bytes)\n", len(pcm))
		os.Exit(1)
	}
	pcm = pcm[:alignedLen]

	audioCtx := audio.NewContext(SampleRate)
	sys := NewSoundSystem(audioCtx)
	if err := sys.Play(pcm, loop); err != nil {
		fmt.Fprintf(os.Stderr, "Playback error: %v\n", err)
		os.Exit(1)
	}

	if loop {
		fmt.Println("Looping playback active. Press ENTER to stop...")
		reader := bufio.NewReader(os.Stdin)
		if _, err := reader.ReadString('\n'); err != nil && !errors.Is(err, io.EOF) {
			sys.Stop()
			fmt.Fprintf(os.Stderr, "Error reading stdin: %v\n", err)
			os.Exit(1)
		}
		sys.Stop()
	} else {
		duration := time.Duration(float64(alignedLen)/float64(BytesPerSecond)*1000) * time.Millisecond
		time.Sleep(duration + 100*time.Millisecond)
	}
}

// DemoStageBGMDSL defines a complete 16-bar, 6-channel YM2612-style stage theme in the Music DSL.
const DemoStageBGMDSL = `
title "16-Bit Genesis Stage Theme"
type song
bpm 130
time 4/4

# 1. YM2612 6-Channel Instrument Palette
inst lead    wave=sawtooth vol=0.12 pan=-0.20 adsr=0.02,0.05,0.70,0.05 vib=5.5,4.5
inst counter wave=square   vol=0.08 pan=0.25  adsr=0.02,0.05,0.60,0.05 duty=0.25
inst pad     wave=sawtooth vol=0.06 pan=0.00  adsr=0.20,0.20,0.85,0.25 lpf=0.35
inst bass    wave=square   vol=0.13 pan=0.00  adsr=0.01,0.05,0.50,0.03 duty=0.50
inst arp     wave=triangle vol=0.07 pan=-0.40 adsr=0.008,0.04,0.35,0.02
inst kick    wave=sine     vol=0.14 pan=0.00  adsr=0.002,0.05,0.10,0.03 freq=130Hz->38Hz noise=0.10,0.25
inst snare   wave=noise    vol=0.08 pan=0.20  adsr=0.002,0.05,0.10,0.03 noise_filter=0.50
inst hat     wave=noise    vol=0.04 pan=0.30  adsr=0.001,0.02,0.05,0.01 noise_filter=0.95

# 2. Reusable 4-Bar Phrase Patterns (Am -> F -> Dm -> E7)
pattern lead_theme_a =
  A4:8 C5:8 E5:8 A5:8 C5:8 E5:8 A4:8 E5:8 |
  F4:8 A4:8 C5:8 F5:8 A4:8 C5:8 F4:8 C5:8 |
  D4:8 F4:8 A4:8 D5:8 F4:8 A4:8 D4:8 A4:8 |
  E4:8 G#4:8 B4:8 E5:8 G#4:8 B4:8 E4:8 B4:8

pattern lead_theme_b =
  A5:8 E5:8 C5:8 A5:8 E6:8 C6:8 B5:8 A5:8 |
  F5:8 C5:8 A4:8 F5:8 C6:8 A5:8 G5:8 F5:8 |
  D5:8 A4:8 F4:8 D5:8 A5:8 F5:8 E5:8 D5:8 |
  E5:8 B4:8 G#4:8 E5:8 B5:8 G#5:8 F#5:8 E5:8

pattern counter_phrase =
  E4:8 C4:8 A4:8 E4:8 C4:8 A4:8 E4:8 E4:8 |
  C4:8 A3:8 F4:8 C4:8 A3:8 F4:8 C4:8 C4:8 |
  A3:8 F3:8 D4:8 A3:8 F3:8 D4:8 A3:8 A3:8 |
  B3:8 G#3:8 E4:8 B3:8 G#3:8 E4:8 B3:8 B3:8

pattern pad_chords =
  [A3 C4 E4]:1 | [F3 A3 C4]:1 | [D3 F3 A3]:1 | [E3 G#3 B3]:1

pattern bass_gallop =
  (A1:16 A2:16)*8 | (F1:16 F2:16)*8 | (D1:16 D2:16)*8 | (E1:16 E2:16)*8

pattern arp_motion =
  (A4:16 C5:16 E5:16 A5:16 A5:16 E5:16 C5:16 A4:16)*2 |
  (F4:16 A4:16 C5:16 F5:16 F5:16 C5:16 A4:16 F4:16)*2 |
  (D4:16 F4:16 A4:16 D5:16 D5:16 A4:16 F4:16 D4:16)*2 |
  (E4:16 G#4:16 B4:16 E5:16 E5:16 B4:16 G#4:16 E4:16)*2

pattern drums_groove =
  (kick:16 hat:32 R:32 snare:16 hat:32 R:32)*16

# 3. 16-Bar Polyphonic Arrangement (4 x 4-Bar Sections)
track ch1_lead    lead:    lead_theme_a * 2 | lead_theme_b * 2
track ch2_counter counter: counter_phrase * 4
track ch3_pad     pad:     pad_chords * 4
track ch4_bass    bass:    bass_gallop * 4
track ch5_arp     arp:     arp_motion * 4
track ch6_drums:           drums_groove * 4
`
