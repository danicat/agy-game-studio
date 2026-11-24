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

package music

import (
	"bufio"
	"encoding/binary"
	"fmt"
	"math"
	"os"
	"sort"
	"strings"
)

// TrackMetadata describes a single polyphonic track in a Score for the Sound Studio UI.
type TrackMetadata struct {
	Name        string  `json:"name"`
	DefaultInst string  `json:"defaultInst"`
	WaveType    string  `json:"waveType"`
	Volume      float64 `json:"volume"`
	Pan         float64 `json:"pan"`
	EventCount  int     `json:"eventCount"`
}

// SynthReport is the structured result returned by Synthesize.
type SynthReport struct {
	Passed           bool            `json:"passed"`
	Error            string          `json:"error,omitempty"`
	Title            string          `json:"title"`
	Type             string          `json:"type"`
	BPM              float64         `json:"bpm"`
	DurationSec      float64         `json:"durationSec"`
	PeakLeftDBFS     float64         `json:"peakLeftDBFS"`
	PeakRightDBFS    float64         `json:"peakRightDBFS"`
	PeakDBFS         float64         `json:"peakDBFS"`
	RMSLeftDBFS      float64         `json:"rmsLeftDBFS"`
	RMSRightDBFS     float64         `json:"rmsRightDBFS"`
	RMSDBFS          float64         `json:"rmsDBFS"`
	DCOffset         float64         `json:"dcOffset"`
	DCOffsetL        float64         `json:"dcOffsetL"`
	DCOffsetR        float64         `json:"dcOffsetR"`
	LowFreqEnergyPct float64         `json:"lowFreqEnergyPct"`
	BoundaryClean    bool            `json:"boundaryClean"`
	Issues           []string        `json:"issues"`
	Tracks           []TrackMetadata `json:"tracks"`
	WavPath          string          `json:"wavPath,omitempty"`
}

// YMPresetInfo describes a YM2612/PSG FM instrument preset.
type YMPresetInfo struct {
	Name      string  `json:"name"`
	Algorithm uint8   `json:"algorithm"`
	Feedback  uint8   `json:"feedback"`
	Gain      float64 `json:"gain"`
	IsPSG     bool    `json:"isPSG"`
}

// TempoInfo pairs a classical tempo marking with its BPM value.
type TempoInfo struct {
	Marking string  `json:"marking"`
	BPM     float64 `json:"bpm"`
}

// PresetsCatalog enumerates available music wave archetypes, YM2612 presets, and tempo markings.
type PresetsCatalog struct {
	WaveTypes     []string       `json:"waveTypes"`
	YM2612Presets []YMPresetInfo `json:"ym2612Presets"`
	TempoMarkings []TempoInfo    `json:"tempoMarkings"`
}

// ValidateReport summarizes production BGM validation checks.
type ValidateReport struct {
	Passed      bool     `json:"passed"`
	Title       string   `json:"title"`
	Channels    int      `json:"channels"`
	DurationSec float64  `json:"durationSec"`
	Issues      []string `json:"issues"`
}

// SynthesizeOptions configures headless .music DSL synthesis.
type SynthesizeOptions struct {
	DSL          string
	FilePath     string
	Apple        bool
	SoloTracks   []string
	MuteTracks   []string
	OutWavPath   string
	OutStemsPath string
}

// SynthesizeScoreStemsWithOptions renders a parsed Score into both a master mix and per-track stem buffers.
func SynthesizeScoreStemsWithOptions(score *Score, useApple bool) ([]byte, [][]byte, error) {
	if score == nil {
		return nil, nil, fmt.Errorf("synthesize score: score is nil")
	}
	sc := *score
	if useApple {
		sc.SynthEngine = "apple"
	}
	return SynthesizeScoreWithStems(&sc)
}

// ExportStemsBinary writes all rendered per-track 16-bit 44.1kHz stereo PCM stems into a single framed binary file.
func ExportStemsBinary(filename string, tracks []Track, trackPCMs [][]byte) (retErr error) {
	f, err := os.Create(filename)
	if err != nil {
		return err
	}
	defer func() {
		if closeErr := f.Close(); closeErr != nil && retErr == nil {
			retErr = closeErr
		}
	}()

	bw := bufio.NewWriterSize(f, 256*1024)
	if _, err := bw.WriteString("STEM"); err != nil {
		return err
	}
	var hdr [8]byte
	binary.LittleEndian.PutUint32(hdr[0:4], uint32(SampleRate))
	count := min(len(trackPCMs), len(tracks))
	binary.LittleEndian.PutUint32(hdr[4:8], uint32(count))
	if _, err := bw.Write(hdr[:]); err != nil {
		return err
	}

	var lenBuf [4]byte
	var nameLenBuf [2]byte
	for i := range count {
		nameBytes := []byte(tracks[i].Name)
		if len(nameBytes) > 65535 {
			nameBytes = nameBytes[:65535]
		}
		binary.LittleEndian.PutUint16(nameLenBuf[:], uint16(len(nameBytes)))
		if _, err := bw.Write(nameLenBuf[:]); err != nil {
			return err
		}
		if _, err := bw.Write(nameBytes); err != nil {
			return err
		}

		pcm := trackPCMs[i]
		alignedLen := len(pcm) &^ 3
		binary.LittleEndian.PutUint32(lenBuf[:], uint32(alignedLen))
		if _, err := bw.Write(lenBuf[:]); err != nil {
			return err
		}
		if alignedLen > 0 {
			if _, err := bw.Write(pcm[:alignedLen]); err != nil {
				return err
			}
		}
	}
	return bw.Flush()
}

func safeDBFS(amp float64) float64 {
	if amp <= 1e-6 || math.IsNaN(amp) || math.IsInf(amp, 0) {
		return -120.0
	}
	return math.Round(20.0*math.Log10(amp)*100.0) / 100.0
}

func safeRound(val float64, decimals int) float64 {
	if math.IsNaN(val) || math.IsInf(val, 0) {
		return 0.0
	}
	pow := math.Pow(10, float64(decimals))
	return math.Round(val*pow) / pow
}

func synthErrorReport(err error) SynthReport {
	msg := "unknown error"
	if err != nil {
		msg = err.Error()
	}
	return SynthReport{
		Passed: false,
		Error:  msg,
		Issues: []string{msg},
		Tracks: []TrackMetadata{},
	}
}

func extractTrackMetadata(score *Score) []TrackMetadata {
	if score == nil || len(score.Tracks) == 0 {
		return []TrackMetadata{}
	}
	tracks := make([]TrackMetadata, 0, len(score.Tracks))
	for _, tr := range score.Tracks {
		meta := TrackMetadata{
			Name:        tr.Name,
			DefaultInst: tr.DefaultInst,
			WaveType:    "sine",
			Volume:      0.2,
			Pan:         0.0,
			EventCount:  len(tr.Events),
		}
		if tr.DefaultInst != "" {
			if inst, ok := score.Instruments[tr.DefaultInst]; ok {
				meta.WaveType = inst.WaveType
				meta.Volume = safeRound(inst.Volume, 4)
				meta.Pan = safeRound(inst.Pan, 4)
			}
		} else {
			for _, ev := range tr.Events {
				if !ev.IsRest && ev.Inst.WaveType != "" {
					if meta.DefaultInst == "" {
						meta.DefaultInst = ev.Inst.Name
					}
					meta.WaveType = ev.Inst.WaveType
					meta.Volume = safeRound(ev.Inst.Volume, 4)
					meta.Pan = safeRound(ev.Inst.Pan, 4)
					break
				}
			}
		}
		tracks = append(tracks, meta)
	}
	return tracks
}

func loadMusicScore(dsl, filePath string) (*Score, error) {
	if strings.TrimSpace(dsl) != "" {
		return ParseDSL(dsl)
	}
	if strings.TrimSpace(filePath) != "" {
		return LoadDSLFile(filePath)
	}
	return nil, fmt.Errorf("missing DSL text or filePath")
}

// Synthesize parses, synthesizes, and analyzes a .music DSL score, optionally writing WAV and stems files.
func Synthesize(opts SynthesizeOptions) SynthReport {
	score, err := loadMusicScore(opts.DSL, opts.FilePath)
	if err != nil {
		return synthErrorReport(err)
	}

	issues := []string{}
	if err := ValidateScoreTheory(score); err != nil {
		issues = append(issues, err.Error())
	}

	pcm, trackPCMs, err := SynthesizeScoreStemsWithOptions(score, opts.Apple)
	if err != nil {
		return synthErrorReport(err)
	}
	pcm = pcm[:len(pcm)&^3]

	// Export all unfiltered per-track stems so the WebAudio mixer has every channel.
	if opts.OutStemsPath != "" {
		if err := ExportStemsBinary(opts.OutStemsPath, score.Tracks, trackPCMs); err != nil {
			return synthErrorReport(fmt.Errorf("export stems: %w", err))
		}
	}

	soloSet := make(map[string]bool)
	for _, s := range opts.SoloTracks {
		if trimmed := strings.TrimSpace(s); trimmed != "" {
			soloSet[trimmed] = true
		}
	}
	muteSet := make(map[string]bool)
	for _, m := range opts.MuteTracks {
		if trimmed := strings.TrimSpace(m); trimmed != "" {
			muteSet[trimmed] = true
		}
	}
	hasSoloOrMute := len(soloSet) > 0 || len(muteSet) > 0
	if hasSoloOrMute {
		maxLen := len(pcm) &^ 3
		audiblePCMs := make([][]byte, 0, len(trackPCMs))
		for i, tr := range score.Tracks {
			if i >= len(trackPCMs) {
				break
			}
			if aligned := len(trackPCMs[i]) &^ 3; aligned > maxLen {
				maxLen = aligned
			}
			if len(soloSet) > 0 && !soloSet[tr.Name] {
				continue
			}
			if muteSet[tr.Name] {
				continue
			}
			audiblePCMs = append(audiblePCMs, trackPCMs[i])
		}
		if len(audiblePCMs) == 0 {
			pcm = make([]byte, maxLen)
		} else {
			pcm = MixTracksPCM(audiblePCMs)
			pcm = pcm[:len(pcm)&^3]
		}
	}

	if opts.OutWavPath != "" {
		if err := ExportWAV(opts.OutWavPath, pcm); err != nil {
			return synthErrorReport(fmt.Errorf("export WAV: %w", err))
		}
	}

	alignedLen := len(pcm) &^ 3
	numFrames := alignedLen / BytesPerFrame
	durationSec := float64(numFrames) / float64(SampleRate)

	var sumL, sumR float64
	var sumSqL, sumSqR float64
	var maxAbsL, maxAbsR float64
	var lpState, sumSqLow, sumSqMono float64
	const lpAlpha = 0.035 // ~250 Hz cutoff at 44.1 kHz

	for i := 0; i < alignedLen; i += 4 {
		sL := float64(int16(uint16(pcm[i])|(uint16(pcm[i+1])<<8))) / 32768.0
		sR := float64(int16(uint16(pcm[i+2])|(uint16(pcm[i+3])<<8))) / 32768.0

		sumL += sL
		sumR += sR
		sumSqL += sL * sL
		sumSqR += sR * sR

		absL := math.Abs(sL)
		if absL > maxAbsL {
			maxAbsL = absL
		}
		absR := math.Abs(sR)
		if absR > maxAbsR {
			maxAbsR = absR
		}

		mono := (sL + sR) * 0.5
		lpState += lpAlpha * (mono - lpState)
		sumSqLow += lpState * lpState
		sumSqMono += mono * mono
	}

	var dcL, dcR, rmsL, rmsR float64
	if numFrames > 0 {
		dcL = sumL / float64(numFrames)
		dcR = sumR / float64(numFrames)
		rmsL = math.Sqrt(sumSqL / float64(numFrames))
		rmsR = math.Sqrt(sumSqR / float64(numFrames))
	}
	peakMax := math.Max(maxAbsL, maxAbsR)
	rmsMax := math.Max(rmsL, rmsR)

	lowFreqEnergyPct := 0.0
	if sumSqMono > 1e-12 {
		lowFreqEnergyPct = (sumSqLow / sumSqMono) * 100.0
	}

	boundaryClean := true
	if numFrames > 0 {
		startL := int16(uint16(pcm[0]) | (uint16(pcm[1]) << 8))
		startR := int16(uint16(pcm[2]) | (uint16(pcm[3]) << 8))
		lastIdx := (numFrames - 1) * BytesPerFrame
		endL := int16(uint16(pcm[lastIdx]) | (uint16(pcm[lastIdx+1]) << 8))
		endR := int16(uint16(pcm[lastIdx+2]) | (uint16(pcm[lastIdx+3]) << 8))
		if math.Abs(float64(startL)) > 4000 || math.Abs(float64(startR)) > 4000 ||
			math.Abs(float64(endL)) > 4000 || math.Abs(float64(endR)) > 4000 {
			boundaryClean = false
		}
	}

	if alignedLen == 0 {
		issues = append(issues, "PCM buffer is empty (0 bytes)")
	} else if peakMax < 0.005 && !hasSoloOrMute {
		issues = append(issues, fmt.Sprintf("signal is effectively silent (peak: %.4f, %.1f dBFS)", peakMax, safeDBFS(peakMax)))
	}
	if math.Abs(dcL) > 0.05 || math.Abs(dcR) > 0.05 {
		issues = append(issues, fmt.Sprintf("excessive DC offset (L: %+.4f, R: %+.4f)", dcL, dcR))
	}

	return SynthReport{
		Passed:           len(issues) == 0,
		Title:            score.Title,
		Type:             score.Type,
		BPM:              safeRound(score.BPM, 2),
		DurationSec:      safeRound(durationSec, 4),
		PeakLeftDBFS:     safeDBFS(maxAbsL),
		PeakRightDBFS:    safeDBFS(maxAbsR),
		PeakDBFS:         safeDBFS(peakMax),
		RMSLeftDBFS:      safeDBFS(rmsL),
		RMSRightDBFS:     safeDBFS(rmsR),
		RMSDBFS:          safeDBFS(rmsMax),
		DCOffset:         safeRound((dcL+dcR)/2.0, 5),
		DCOffsetL:        safeRound(dcL, 5),
		DCOffsetR:        safeRound(dcR, 5),
		LowFreqEnergyPct: safeRound(lowFreqEnergyPct, 2),
		BoundaryClean:    boundaryClean,
		Issues:           issues,
		Tracks:           extractTrackMetadata(score),
		WavPath:          opts.OutWavPath,
	}
}

// Validate checks a .music DSL score against production BGM music-theory, timing drift, and duration rules.
func Validate(dsl, filePath string, minChannels int, minDurationSec float64) ValidateReport {
	if minChannels <= 0 {
		minChannels = 8
	}
	if minDurationSec <= 0 {
		minDurationSec = 30.0
	}

	score, err := loadMusicScore(dsl, filePath)
	if err != nil {
		return ValidateReport{
			Passed: false,
			Issues: []string{err.Error()},
		}
	}

	var totalSec float64
	if len(score.Tracks) > 0 {
		for _, ev := range score.Tracks[0].Events {
			totalSec += ev.DurationSec
		}
	}

	issues := []string{}
	if err := ValidateProductionBGM(score, minChannels, minDurationSec); err != nil {
		issues = append(issues, err.Error())
	}

	return ValidateReport{
		Passed:      len(issues) == 0,
		Title:       score.Title,
		Channels:    len(score.Tracks),
		DurationSec: safeRound(totalSec, 4),
		Issues:      issues,
	}
}

// BuildPresetsCatalog returns available music wave types, YM2612 FM patches, and classical tempo markings.
func BuildPresetsCatalog() PresetsCatalog {
	waveTypes := []string{
		"sine", "square", "pulse", "triangle", "sawtooth", "noise", "fm",
		"piano", "epiano", "organ", "guitar", "overdriven_guitar", "rhythm_guitar",
		"synth_bass", "sub_bass", "slap_bass", "harp", "violin", "cello", "strings",
		"voice", "flute", "oboe", "clarinet", "shakuhachi", "brass", "trumpet", "horn",
		"koto", "shamisen", "bell",
		"ym2612_guitar", "ym2612_rhythm_guitar", "ym2612_bass", "ym2612_slap_bass",
		"ym2612_brass", "ym2612_epiano", "ym2612_strings", "ym2612_choir", "ym2612_flute", "ym2612_bell",
		"psg_square", "psg_arp",
		"kick", "snare", "tom", "hat", "open_hat", "crash",
		"ym2612_kick", "ym2612_snare", "ym2612_tom", "ym2612_hat", "ym2612_open_hat", "ym2612_crash",
	}

	ymKeys := make([]string, 0, len(ym2612PatchCatalog))
	for k := range ym2612PatchCatalog {
		ymKeys = append(ymKeys, k)
	}
	sort.Strings(ymKeys)
	ymPresets := make([]YMPresetInfo, 0, len(ymKeys))
	for _, k := range ymKeys {
		p := ym2612PatchCatalog[k]
		ymPresets = append(ymPresets, YMPresetInfo{
			Name:      p.Name,
			Algorithm: p.ALG,
			Feedback:  p.FB,
			Gain:      p.Gain,
			IsPSG:     p.IsPSG,
		})
	}

	tempoKeys := make([]string, 0, len(classicalTempoMarkings))
	for k := range classicalTempoMarkings {
		tempoKeys = append(tempoKeys, k)
	}
	sort.Slice(tempoKeys, func(i, j int) bool {
		return classicalTempoMarkings[tempoKeys[i]] < classicalTempoMarkings[tempoKeys[j]]
	})
	tempos := make([]TempoInfo, 0, len(tempoKeys))
	for _, k := range tempoKeys {
		tempos = append(tempos, TempoInfo{
			Marking: k,
			BPM:     classicalTempoMarkings[k],
		})
	}

	return PresetsCatalog{
		WaveTypes:     waveTypes,
		YM2612Presets: ymPresets,
		TempoMarkings: tempos,
	}
}
