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
	"strings"
)

// TrackMetadata describes a single polyphonic track in an SFX Score for the Sound Studio UI.
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

// PresetInfo describes one built-in SFX archetype preset.
type PresetInfo struct {
	Name       string  `json:"name"`
	Wave       string  `json:"wave"`
	StartFreq  float64 `json:"startFreq"`
	EndFreq    float64 `json:"endFreq"`
	PitchCurve string  `json:"pitchCurve"`
	DutyStart  float64 `json:"dutyStart"`
	DutyEnd    float64 `json:"dutyEnd"`
	LPFStart   float64 `json:"lpfStart"`
	LPFEnd     float64 `json:"lpfEnd"`
	HPFStart   float64 `json:"hpfStart"`
	HPFEnd     float64 `json:"hpfEnd"`
	Q          float64 `json:"q"`
	Attack     float64 `json:"attack"`
	Decay      float64 `json:"decay"`
	Sustain    float64 `json:"sustain"`
	Release    float64 `json:"release"`
	Volume     float64 `json:"volume"`
}

// SynthesizeOptions configures headless .sfx DSL synthesis.
type SynthesizeOptions struct {
	DSL        string
	FilePath   string
	OutWavPath string
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

// Synthesize parses, synthesizes, and validates a .sfx DSL cue, optionally writing a WAV file.
func Synthesize(opts SynthesizeOptions) SynthReport {
	var score *Score
	var err error
	if strings.TrimSpace(opts.DSL) != "" {
		score, err = ParseDSL(opts.DSL)
	} else if strings.TrimSpace(opts.FilePath) != "" {
		score, err = LoadDSLFile(opts.FilePath)
	} else {
		return synthErrorReport(fmt.Errorf("missing DSL text or filePath"))
	}
	if err != nil {
		return synthErrorReport(err)
	}

	issues := []string{}
	if err := ValidateScore(score); err != nil {
		issues = append(issues, err.Error())
	}

	pcm, err := SynthesizeScore(score)
	if err != nil {
		return synthErrorReport(err)
	}
	pcm = pcm[:len(pcm)&^3]

	if opts.OutWavPath != "" {
		if err := ExportWAV(opts.OutWavPath, pcm); err != nil {
			return synthErrorReport(fmt.Errorf("export WAV: %w", err))
		}
	}

	valRep, _ := ValidateProductionSFX(pcm)
	if len(valRep.Issues) > 0 {
		issues = append(issues, valRep.Issues...)
	}

	alignedLen := len(pcm) &^ 3
	var lpState, sumSqLow, sumSqMono float64
	const lpAlpha = 0.035
	for i := 0; i < alignedLen; i += 4 {
		sL := float64(int16(uint16(pcm[i])|(uint16(pcm[i+1])<<8))) / 32768.0
		sR := float64(int16(uint16(pcm[i+2])|(uint16(pcm[i+3])<<8))) / 32768.0
		mono := (sL + sR) * 0.5
		lpState += lpAlpha * (mono - lpState)
		sumSqLow += lpState * lpState
		sumSqMono += mono * mono
	}
	lowFreqEnergyPct := 0.0
	if sumSqMono > 1e-12 {
		lowFreqEnergyPct = (sumSqLow / sumSqMono) * 100.0
	}

	boundaryClean := math.Abs(float64(valRep.StartSampleLeft)) <= 300 &&
		math.Abs(float64(valRep.StartSampleRight)) <= 300 &&
		math.Abs(float64(valRep.EndSampleLeft)) <= 300 &&
		math.Abs(float64(valRep.EndSampleRight)) <= 300

	return SynthReport{
		Passed:           len(issues) == 0 && valRep.Passed,
		Title:            score.Title,
		Type:             score.Type,
		BPM:              safeRound(score.BPM, 2),
		DurationSec:      safeRound(valRep.DurationSec, 4),
		PeakLeftDBFS:     safeDBFS(valRep.PeakLeft),
		PeakRightDBFS:    safeDBFS(valRep.PeakRight),
		PeakDBFS:         safeRound(valRep.PeakDBFS, 2),
		RMSLeftDBFS:      safeDBFS(valRep.RMSLeft),
		RMSRightDBFS:     safeDBFS(valRep.RMSRight),
		RMSDBFS:          safeRound(valRep.RMSDBFS, 2),
		DCOffset:         safeRound((valRep.DCOffsetLeft+valRep.DCOffsetRight)/2.0, 5),
		DCOffsetL:        safeRound(valRep.DCOffsetLeft, 5),
		DCOffsetR:        safeRound(valRep.DCOffsetRight, 5),
		LowFreqEnergyPct: safeRound(lowFreqEnergyPct, 2),
		BoundaryClean:    boundaryClean,
		Issues:           issues,
		Tracks:           extractTrackMetadata(score),
		WavPath:          opts.OutWavPath,
	}
}

// BuildPresetsCatalog returns all 18 built-in SFX archetype presets.
func BuildPresetsCatalog() []PresetInfo {
	names := ListSFXPresets()
	out := make([]PresetInfo, 0, len(names))
	for _, name := range names {
		p, ok := GetSFXPreset(name)
		if !ok {
			continue
		}
		curve := p.PitchCurve
		if curve == "" {
			curve = "exp"
		}
		q := p.ResonanceQ
		if q <= 0 {
			q = 0.707
		}
		dutyStart := p.DutyStart
		dutyEnd := p.DutyEnd
		if dutyStart <= 0 && p.DutyCycle > 0 {
			dutyStart = p.DutyCycle
		}
		if dutyEnd <= 0 && dutyStart > 0 {
			dutyEnd = dutyStart
		}
		out = append(out, PresetInfo{
			Name:       name,
			Wave:       p.WaveType,
			StartFreq:  safeRound(p.DefaultStartFreq, 2),
			EndFreq:    safeRound(p.DefaultEndFreq, 2),
			PitchCurve: curve,
			DutyStart:  safeRound(dutyStart, 3),
			DutyEnd:    safeRound(dutyEnd, 3),
			LPFStart:   safeRound(p.LPFStart, 2),
			LPFEnd:     safeRound(p.LPFEnd, 2),
			HPFStart:   safeRound(p.HPFStart, 2),
			HPFEnd:     safeRound(p.HPFEnd, 2),
			Q:          safeRound(q, 3),
			Attack:     safeRound(p.Attack, 4),
			Decay:      safeRound(p.Decay, 4),
			Sustain:    safeRound(p.Sustain, 4),
			Release:    safeRound(p.Release, 4),
			Volume:     safeRound(p.Volume, 4),
		})
	}
	return out
}
