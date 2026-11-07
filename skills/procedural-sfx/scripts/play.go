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
		loopFlag := playCmd.Bool("loop", false, "Loop SFX audio playback")
		if err := playCmd.Parse(os.Args[2:]); err != nil {
			fmt.Fprintf(os.Stderr, "Error parsing play flags: %v\n", err)
			os.Exit(1)
		}

		if playCmd.NArg() < 1 {
			fmt.Fprintln(os.Stderr, "Error: Missing DSL sound effect file.")
			fmt.Fprintln(os.Stderr, "Usage: go run ./scripts play [-loop] <cue.sfx>")
			os.Exit(1)
		}
		dslFile := playCmd.Arg(0)
		score, err := LoadDSLFile(dslFile)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error loading DSL file '%s': %v\n", dslFile, err)
			os.Exit(1)
		}

		pcm, err := SynthesizeScore(score)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error synthesizing SFX '%s': %v\n", score.Title, err)
			os.Exit(1)
		}
		pcm = pcm[:len(pcm)&^3]
		fmt.Printf("Playing SFX: '%s' (%s, %d tracks, %.2fs duration, loop=%v)...\n",
			score.Title, score.Type, len(score.Tracks), float64(len(pcm))/float64(BytesPerSecond), *loopFlag)
		playAudio(pcm, *loopFlag)

	case "demo":
		demoCmd := flag.NewFlagSet("demo", flag.ExitOnError)
		loopFlag := demoCmd.Bool("loop", false, "Loop SFX showcase playback")
		if err := demoCmd.Parse(os.Args[2:]); err != nil {
			fmt.Fprintf(os.Stderr, "Error parsing demo flags: %v\n", err)
			os.Exit(1)
		}

		score, err := ParseDSL(DemoSFXShowcaseDSL)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error parsing built-in demo SFX DSL: %v\n", err)
			os.Exit(1)
		}
		pcm, err := SynthesizeScore(score)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error synthesizing demo SFX showcase: %v\n", err)
			os.Exit(1)
		}
		pcm = pcm[:len(pcm)&^3]

		fmt.Printf("Playing Demo SFX Showcase: '%s' (%.2fs duration, loop=%v)...\n",
			score.Title, float64(len(pcm))/float64(BytesPerSecond), *loopFlag)
		playAudio(pcm, *loopFlag)

	case "export":
		exportCmd := flag.NewFlagSet("export", flag.ExitOnError)
		if err := exportCmd.Parse(os.Args[2:]); err != nil {
			fmt.Fprintf(os.Stderr, "Error parsing export flags: %v\n", err)
			os.Exit(1)
		}

		if exportCmd.NArg() < 2 {
			fmt.Fprintln(os.Stderr, "Error: Missing arguments.")
			fmt.Fprintln(os.Stderr, "Usage: go run ./scripts export <cue.sfx> <output.wav>")
			os.Exit(1)
		}
		dslFile := exportCmd.Arg(0)
		wavFile := exportCmd.Arg(1)

		score, err := LoadDSLFile(dslFile)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error loading DSL file '%s': %v\n", dslFile, err)
			os.Exit(1)
		}

		pcm, err := SynthesizeScore(score)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error synthesizing SFX '%s': %v\n", score.Title, err)
			os.Exit(1)
		}
		pcm = pcm[:len(pcm)&^3]
		if err := ExportWAV(wavFile, pcm); err != nil {
			fmt.Fprintf(os.Stderr, "Error exporting WAV: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("Successfully exported '%s' (%.2fs duration) to '%s'\n",
			score.Title, float64(len(pcm))/float64(BytesPerSecond), wavFile)

	default:
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println("Procedural SFX DSL Player & WAV Exporter CLI")
	fmt.Println()
	fmt.Println("Commands:")
	fmt.Println("  go run ./scripts play [-loop] <cue.sfx>     Play a .sfx DSL file (one-off default)")
	fmt.Println("  go run ./scripts demo [-loop]               Play built-in arcade SFX showcase")
	fmt.Println("  go run ./scripts export <cue.sfx> <out.wav> Compile .sfx DSL file and export to WAV")
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

// DemoSFXShowcaseDSL demonstrates classic arcade sound effects (Laser, Coin, Jump, FM Armor Hit, Explosion) in the DSL.
const DemoSFXShowcaseDSL = `
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
