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
	"bytes"
	"encoding/binary"
	"fmt"
	"io"
	"math"
	"math/rand"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/hajimehoshi/ebiten/v2/audio"
)

const (
	SampleRate      = 44100
	NumChannels     = 2
	BytesPerSample  = 2
	BytesPerFrame   = NumChannels * BytesPerSample // 4 bytes per stereo frame
	BytesPerSecond  = SampleRate * BytesPerFrame   // 176,400 bytes/sec
	maxRepeatFactor = 1024
	maxPatternDepth = 32
)

// ============================================================================
// 1. PROCEDURAL AUDIO & MUSIC DSL AST DEFINITIONS
// ============================================================================

// Instrument defines a reusable synthesizer patch in the DSL (`inst <name> ...`).
type Instrument struct {
	Name               string
	WaveType           string  // "sine", "square", "triangle", "sawtooth", "noise", "fm"
	Volume             float64 // 0.0 to 1.0
	Pan                float64 // -1.0 (left) to +1.0 (right)
	DutyCycle          float64 // Pulse width (0.0 to 1.0) for square waves
	Attack             float64 // ADSR Attack in seconds
	Decay              float64 // ADSR Decay in seconds
	Sustain            float64 // ADSR Sustain amplitude (0.0 to 1.0)
	Release            float64 // ADSR Release in seconds
	VibratoFreq        float64 // Vibrato LFO rate in Hz
	VibratoDepth       float64 // Vibrato LFO depth in Hz
	ModRatio           float64 // FM modulator frequency multiplier relative to carrier
	ModFreq            float64 // Fixed FM modulator frequency in Hz (if ModRatio == 0)
	ModIndex           float64 // FM modulation index
	NoiseFilter        float64 // Single-pole LPF coefficient for noise (0.0 to 1.0]
	NoiseBlend         float64 // Blend between oscillator (0.0) and filtered noise (1.0)
	DefaultStartFreq   float64 // Default starting frequency in Hz (for drum/SFX triggers)
	DefaultEndFreq     float64 // Default ending frequency in Hz (for frequency sweeps)
	LPF                float64 // Optional per-instrument low-pass filter alpha (0.0 to 1.0]
	HPF                float64 // Optional per-instrument high-pass filter alpha (0.0 to 1.0)
	BitcrushBits       int     // Optional per-instrument bit depth (1..16)
	BitcrushDownsample int     // Optional per-instrument downsample factor (>=1)
}

// PitchSweep represents a stationary note (StartFreq == EndFreq) or a continuous pitch glide.
type PitchSweep struct {
	StartFreq float64
	EndFreq   float64
}

// NoteEvent represents a single resolved musical note, chord, sweep, or rest on a timeline.
type NoteEvent struct {
	IsRest      bool
	Inst        Instrument
	Pitches     []PitchSweep
	DurationSec float64
}

// Track represents a named polyphonic channel in a Score.
type Track struct {
	Name        string
	DefaultInst string
	Events      []NoteEvent
}

// Score represents a parsed and validated DSL script (`.music` or `.sfx`).
type Score struct {
	Title                    string
	Type                     string // "song" or "sfx"
	BPM                      float64
	TimeSigNum               int
	TimeSigDen               int
	Instruments              map[string]Instrument
	Patterns                 map[string][]dslNode
	Tracks                   []Track
	GlobalLPF                float64
	GlobalHPF                float64
	GlobalBitcrushBits       int
	GlobalBitcrushDownsample int
	HasLoopSlice             bool
	LoopStartSec             float64
	LoopEndSec               float64
}

// ============================================================================
// 2. DSL LEXER & RECURSIVE-DESCENT PARSER
// ============================================================================

type dslTokenKind int

const (
	tokAtom dslTokenKind = iota
	tokPipe
	tokLParen
	tokRParen
	tokRepeat
	tokTranspose
)

type dslToken struct {
	kind   dslTokenKind
	text   string
	number int
}

type dslNode struct {
	isGroup   bool
	atom      string
	children  []dslNode
	repeat    int
	transpose int
}

// LoadDSLFile reads and parses a `.music` or `.sfx` DSL file from disk.
func LoadDSLFile(filepath string) (*Score, error) {
	data, err := os.ReadFile(filepath)
	if err != nil {
		return nil, fmt.Errorf("load DSL file %q: %w", filepath, err)
	}
	return ParseDSL(string(data))
}

// CompileDSL parses a DSL script and synthesizes it into a 4-byte aligned 16-bit 44.1kHz stereo PCM buffer.
func CompileDSL(dslText string) ([]byte, error) {
	score, err := ParseDSL(dslText)
	if err != nil {
		return nil, err
	}
	return SynthesizeScore(score)
}

// ParseDSL parses a procedural music or SFX DSL script into a validated Score AST.
func ParseDSL(dslText string) (*Score, error) {
	score := &Score{
		Title:       "Untitled",
		Type:        "song",
		BPM:         120.0,
		TimeSigNum:  4,
		TimeSigDen:  4,
		Instruments: make(map[string]Instrument),
		Patterns:    make(map[string][]dslNode),
	}

	rawLines := strings.Split(dslText, "\n")
	type logicalStatement struct {
		lineNum int
		keyword string
		rest    string
	}

	var stmts []logicalStatement
	for idx, raw := range rawLines {
		lineNum := idx + 1
		cleaned := stripDSLComment(raw)
		trimmed := strings.TrimSpace(cleaned)
		if trimmed == "" {
			continue
		}

		firstWord, remainder := splitFirstWord(trimmed)
		lowerWord := strings.ToLower(firstWord)
		if strings.HasPrefix(lowerWord, "seq:") {
			remainder = strings.TrimSpace(firstWord[3:] + " " + remainder)
			lowerWord = "seq"
		}

		if isTopLevelDirective(lowerWord) {
			stmts = append(stmts, logicalStatement{
				lineNum: lineNum,
				keyword: lowerWord,
				rest:    strings.TrimSpace(remainder),
			})
		} else {
			if len(stmts) == 0 {
				return nil, fmt.Errorf("line %d: unexpected token %q before any directive", lineNum, firstWord)
			}
			prev := &stmts[len(stmts)-1]
			if prev.keyword == "pattern" || prev.keyword == "track" || prev.keyword == "seq" {
				prev.rest += " " + trimmed
			} else {
				return nil, fmt.Errorf("line %d: unknown directive %q (or unexpected continuation after %q)", lineNum, firstWord, prev.keyword)
			}
		}
	}

	var stepEvents []NoteEvent

	for _, st := range stmts {
		switch st.keyword {
		case "title":
			if st.rest == "" {
				return nil, fmt.Errorf("line %d: 'title' requires a non-empty string", st.lineNum)
			}
			score.Title = unquoteDSLString(st.rest)

		case "type":
			val := strings.ToLower(unquoteDSLString(st.rest))
			if val != "song" && val != "sfx" {
				return nil, fmt.Errorf("line %d: invalid type %q (must be 'song' or 'sfx')", st.lineNum, st.rest)
			}
			score.Type = val

		case "bpm":
			bpm, err := strconv.ParseFloat(st.rest, 64)
			if err != nil || bpm <= 0 || bpm > 1000 {
				return nil, fmt.Errorf("line %d: invalid bpm %q (must be a number between 1 and 1000)", st.lineNum, st.rest)
			}
			score.BPM = bpm

		case "time":
			parts := strings.Split(st.rest, "/")
			if len(parts) != 2 {
				return nil, fmt.Errorf("line %d: invalid time signature %q (expected <num>/<den>, e.g. 4/4)", st.lineNum, st.rest)
			}
			num, err1 := strconv.Atoi(strings.TrimSpace(parts[0]))
			den, err2 := strconv.Atoi(strings.TrimSpace(parts[1]))
			if err1 != nil || err2 != nil || num <= 0 || den <= 0 {
				return nil, fmt.Errorf("line %d: invalid time signature %q", st.lineNum, st.rest)
			}
			score.TimeSigNum = num
			score.TimeSigDen = den

		case "filter":
			fields := strings.Fields(st.rest)
			if len(fields) != 2 {
				return nil, fmt.Errorf("line %d: 'filter' requires '<lpf|hpf> <alpha>'", st.lineNum)
			}
			kind := strings.ToLower(fields[0])
			alpha, err := strconv.ParseFloat(fields[1], 64)
			if err != nil {
				return nil, fmt.Errorf("line %d: invalid filter alpha %q: %w", st.lineNum, fields[1], err)
			}
			switch kind {
			case "lpf":
				if alpha <= 0 || alpha > 1.0 {
					return nil, fmt.Errorf("line %d: lpf alpha must be in (0.0, 1.0], got %v", st.lineNum, alpha)
				}
				score.GlobalLPF = alpha
			case "hpf":
				if alpha <= 0 || alpha >= 1.0 {
					return nil, fmt.Errorf("line %d: hpf alpha must be in (0.0, 1.0), got %v", st.lineNum, alpha)
				}
				score.GlobalHPF = alpha
			default:
				return nil, fmt.Errorf("line %d: unknown filter type %q (expected 'lpf' or 'hpf')", st.lineNum, kind)
			}

		case "bitcrush":
			fields := strings.Fields(st.rest)
			if len(fields) != 2 {
				return nil, fmt.Errorf("line %d: 'bitcrush' requires '<bits 1..16> <downsample >=1>'", st.lineNum)
			}
			bits, err1 := strconv.Atoi(fields[0])
			down, err2 := strconv.Atoi(fields[1])
			if err1 != nil || err2 != nil || bits < 1 || bits > 16 || down < 1 {
				return nil, fmt.Errorf("line %d: invalid bitcrush arguments %q (bits must be 1..16, downsample >= 1)", st.lineNum, st.rest)
			}
			score.GlobalBitcrushBits = bits
			score.GlobalBitcrushDownsample = down

		case "loop":
			fields := strings.Fields(st.rest)
			if len(fields) != 2 {
				return nil, fmt.Errorf("line %d: 'loop' requires '<startDur> <endDur>'", st.lineNum)
			}
			startSec, err1 := ParseDuration(fields[0], score.BPM)
			endSec, err2 := ParseDuration(fields[1], score.BPM)
			if err1 != nil || err2 != nil || startSec < 0 || endSec <= startSec {
				return nil, fmt.Errorf("line %d: invalid loop range %q (expected 0 <= start < end)", st.lineNum, st.rest)
			}
			score.HasLoopSlice = true
			score.LoopStartSec = startSec
			score.LoopEndSec = endSec

		case "inst", "patch":
			instName, attrText := splitFirstWord(st.rest)
			if instName == "" {
				return nil, fmt.Errorf("line %d: 'inst' requires an instrument name and attributes", st.lineNum)
			}
			if _, exists := score.Instruments[instName]; exists {
				return nil, fmt.Errorf("line %d: duplicate instrument definition %q", st.lineNum, instName)
			}
			inst, _, err := parseInstrumentOrStepAttrs(instName, attrText, score.BPM, false)
			if err != nil {
				return nil, fmt.Errorf("line %d (inst %s): %w", st.lineNum, instName, err)
			}
			score.Instruments[instName] = inst

		case "pattern":
			eqIdx := strings.IndexByte(st.rest, '=')
			if eqIdx < 0 {
				return nil, fmt.Errorf("line %d: 'pattern' requires '<name> = <events...>'", st.lineNum)
			}
			patName := strings.TrimSpace(st.rest[:eqIdx])
			patBody := strings.TrimSpace(st.rest[eqIdx+1:])
			if patName == "" || patBody == "" {
				return nil, fmt.Errorf("line %d: 'pattern' requires both a name and a non-empty body", st.lineNum)
			}
			if _, exists := score.Patterns[patName]; exists {
				return nil, fmt.Errorf("line %d: duplicate pattern definition %q", st.lineNum, patName)
			}
			if _, isInst := score.Instruments[patName]; isInst {
				return nil, fmt.Errorf("line %d: pattern name %q conflicts with an instrument of the same name", st.lineNum, patName)
			}
			nodes, err := parsePatternNodes(patBody)
			if err != nil {
				return nil, fmt.Errorf("line %d (pattern %s): %w", st.lineNum, patName, err)
			}
			score.Patterns[patName] = nodes

		case "track":
			colonIdx := strings.IndexByte(st.rest, ':')
			if colonIdx < 0 {
				return nil, fmt.Errorf("line %d: 'track' requires '<name> [instrument]: <events...>'", st.lineNum)
			}
			headerFields := strings.Fields(st.rest[:colonIdx])
			bodyText := strings.TrimSpace(st.rest[colonIdx+1:])
			if len(headerFields) < 1 || len(headerFields) > 2 {
				return nil, fmt.Errorf("line %d: invalid track header %q (expected 'track <name> [instrument]:')", st.lineNum, st.rest[:colonIdx])
			}
			trackName := headerFields[0]
			defaultInst := ""
			if len(headerFields) == 2 {
				defaultInst = headerFields[1]
				if _, ok := score.Instruments[defaultInst]; !ok {
					return nil, fmt.Errorf("line %d: track %q references unknown instrument %q", st.lineNum, trackName, defaultInst)
				}
			}
			if bodyText == "" {
				return nil, fmt.Errorf("line %d: track %q has an empty body", st.lineNum, trackName)
			}
			nodes, err := parsePatternNodes(bodyText)
			if err != nil {
				return nil, fmt.Errorf("line %d (track %s): %w", st.lineNum, trackName, err)
			}
			events, err := score.expandNodesToEvents(nodes, defaultInst, 0, make(map[string]bool))
			if err != nil {
				return nil, fmt.Errorf("line %d (track %s): %w", st.lineNum, trackName, err)
			}
			score.appendTrackEvents(trackName, defaultInst, events)

		case "seq":
			colonIdx := strings.IndexByte(st.rest, ':')
			var defaultInst, bodyText string
			if colonIdx >= 0 {
				header := strings.TrimSpace(st.rest[:colonIdx])
				bodyText = strings.TrimSpace(st.rest[colonIdx+1:])
				if header != "" {
					defaultInst = header
					if _, ok := score.Instruments[defaultInst]; !ok {
						return nil, fmt.Errorf("line %d: seq references unknown instrument %q", st.lineNum, defaultInst)
					}
				}
			} else {
				bodyText = strings.TrimSpace(st.rest)
			}
			if bodyText == "" {
				return nil, fmt.Errorf("line %d: 'seq' has an empty body", st.lineNum)
			}
			nodes, err := parsePatternNodes(bodyText)
			if err != nil {
				return nil, fmt.Errorf("line %d (seq): %w", st.lineNum, err)
			}
			events, err := score.expandNodesToEvents(nodes, defaultInst, 0, make(map[string]bool))
			if err != nil {
				return nil, fmt.Errorf("line %d (seq): %w", st.lineNum, err)
			}
			score.appendTrackEvents("seq", defaultInst, events)

		case "step":
			inst, durSec, err := parseInstrumentOrStepAttrs("_step", st.rest, score.BPM, true)
			if err != nil {
				return nil, fmt.Errorf("line %d (step): %w", st.lineNum, err)
			}
			startFreq := inst.DefaultStartFreq
			endFreq := inst.DefaultEndFreq
			if startFreq <= 0 && inst.WaveType != "noise" {
				return nil, fmt.Errorf("line %d (step): non-noise step requires 'freq=<pitchOrHz>' or 'freq=<start>-><end>'", st.lineNum)
			}
			if startFreq <= 0 {
				startFreq = 440.0
				endFreq = 440.0
			}
			stepEvents = append(stepEvents, NoteEvent{
				IsRest:      false,
				Inst:        inst,
				Pitches:     []PitchSweep{{StartFreq: startFreq, EndFreq: endFreq}},
				DurationSec: durSec,
			})
		}
	}

	if len(stepEvents) > 0 {
		score.appendTrackEvents("_steps", "", stepEvents)
	}

	if len(score.Tracks) == 0 {
		return nil, fmt.Errorf("parse DSL: score %q contains no tracks, sequences, or steps", score.Title)
	}

	return score, nil
}

func (s *Score) appendTrackEvents(name, defaultInst string, events []NoteEvent) {
	for i := range s.Tracks {
		if s.Tracks[i].Name == name {
			if s.Tracks[i].DefaultInst == "" && defaultInst != "" {
				s.Tracks[i].DefaultInst = defaultInst
			}
			s.Tracks[i].Events = append(s.Tracks[i].Events, events...)
			return
		}
	}
	s.Tracks = append(s.Tracks, Track{
		Name:        name,
		DefaultInst: defaultInst,
		Events:      events,
	})
}

func isTopLevelDirective(word string) bool {
	switch word {
	case "title", "type", "bpm", "time", "filter", "bitcrush", "loop", "inst", "patch", "pattern", "track", "seq", "step":
		return true
	default:
		return false
	}
}

func stripDSLComment(line string) string {
	inQuotes := false
	for i := 0; i < len(line); i++ {
		if line[i] == '"' {
			inQuotes = !inQuotes
		} else if !inQuotes {
			if line[i] == '#' && (i == 0 || line[i-1] == ' ' || line[i-1] == '\t') {
				return line[:i]
			}
			if line[i] == '/' && i+1 < len(line) && line[i+1] == '/' {
				return line[:i]
			}
		}
	}
	return line
}

func splitFirstWord(s string) (string, string) {
	s = strings.TrimSpace(s)
	for i := 0; i < len(s); i++ {
		if s[i] == ' ' || s[i] == '\t' {
			return s[:i], strings.TrimSpace(s[i+1:])
		}
	}
	return s, ""
}

func unquoteDSLString(s string) string {
	s = strings.TrimSpace(s)
	if len(s) >= 2 && ((s[0] == '"' && s[len(s)-1] == '"') || (s[0] == '\'' && s[len(s)-1] == '\'')) {
		return s[1 : len(s)-1]
	}
	return s
}

func parseInstrumentOrStepAttrs(name, attrText string, bpm float64, isStep bool) (Instrument, float64, error) {
	inst := Instrument{
		Name:        name,
		Volume:      0.2,
		Pan:         0.0,
		DutyCycle:   0.5,
		Attack:      0.005,
		Decay:       0.04,
		Sustain:     0.7,
		Release:     0.03,
		NoiseFilter: 1.0,
	}
	var durSec float64
	hasWave := false
	hasDur := false
	hasExplicitNoiseBlend := false

	fields := strings.Fields(attrText)
	if len(fields) == 0 {
		return inst, 0, fmt.Errorf("missing attributes")
	}

	for _, field := range fields {
		eq := strings.IndexByte(field, '=')
		if eq <= 0 || eq == len(field)-1 {
			return inst, 0, fmt.Errorf("malformed attribute %q (expected key=value)", field)
		}
		key := strings.ToLower(field[:eq])
		val := field[eq+1:]

		switch key {
		case "wave", "wave_type":
			w, err := normalizeWaveType(val)
			if err != nil {
				return inst, 0, err
			}
			inst.WaveType = w
			hasWave = true

		case "vol", "volume":
			v, err := strconv.ParseFloat(val, 64)
			if err != nil || v < 0.0 || v > 1.0 {
				return inst, 0, fmt.Errorf("invalid volume %q (must be 0.0 to 1.0)", val)
			}
			inst.Volume = v

		case "pan":
			p, err := strconv.ParseFloat(val, 64)
			if err != nil || p < -1.0 || p > 1.0 {
				return inst, 0, fmt.Errorf("invalid pan %q (must be -1.0 to +1.0)", val)
			}
			inst.Pan = p

		case "duty", "duty_cycle":
			d, err := strconv.ParseFloat(val, 64)
			if err != nil || d <= 0.0 || d >= 1.0 {
				return inst, 0, fmt.Errorf("invalid duty cycle %q (must be in (0.0, 1.0))", val)
			}
			inst.DutyCycle = d

		case "adsr":
			parts := strings.Split(val, ",")
			if len(parts) != 4 {
				return inst, 0, fmt.Errorf("invalid adsr %q (expected attack,decay,sustain,release)", val)
			}
			a, err1 := parseSecondsOrDuration(parts[0], bpm)
			d, err2 := parseSecondsOrDuration(parts[1], bpm)
			s, err3 := strconv.ParseFloat(parts[2], 64)
			r, err4 := parseSecondsOrDuration(parts[3], bpm)
			if err1 != nil || err2 != nil || err3 != nil || err4 != nil || a < 0 || d < 0 || s < 0 || s > 1.0 || r < 0 {
				return inst, 0, fmt.Errorf("invalid adsr values %q", val)
			}
			inst.Attack = a
			inst.Decay = d
			inst.Sustain = s
			inst.Release = r

		case "attack":
			a, err := parseSecondsOrDuration(val, bpm)
			if err != nil || a < 0 {
				return inst, 0, fmt.Errorf("invalid attack %q", val)
			}
			inst.Attack = a

		case "decay":
			d, err := parseSecondsOrDuration(val, bpm)
			if err != nil || d < 0 {
				return inst, 0, fmt.Errorf("invalid decay %q", val)
			}
			inst.Decay = d

		case "sustain":
			s, err := strconv.ParseFloat(val, 64)
			if err != nil || s < 0 || s > 1.0 {
				return inst, 0, fmt.Errorf("invalid sustain %q (must be 0.0 to 1.0)", val)
			}
			inst.Sustain = s

		case "release":
			r, err := parseSecondsOrDuration(val, bpm)
			if err != nil || r < 0 {
				return inst, 0, fmt.Errorf("invalid release %q", val)
			}
			inst.Release = r

		case "vib", "vibrato":
			parts := strings.Split(val, ",")
			if len(parts) != 2 {
				return inst, 0, fmt.Errorf("invalid vibrato %q (expected rateHz,depthHz)", val)
			}
			vf, err1 := parseHzNumber(parts[0])
			vd, err2 := parseHzNumber(parts[1])
			if err1 != nil || err2 != nil || vf < 0 || vd < 0 {
				return inst, 0, fmt.Errorf("invalid vibrato parameters %q", val)
			}
			inst.VibratoFreq = vf
			inst.VibratoDepth = vd

		case "freq", "sweep", "pitch":
			sweep, err := parsePitchOrSweep(val)
			if err != nil {
				return inst, 0, fmt.Errorf("invalid freq/sweep %q: %w", val, err)
			}
			inst.DefaultStartFreq = sweep.StartFreq
			inst.DefaultEndFreq = sweep.EndFreq

		case "dur", "duration":
			d, err := ParseDuration(val, bpm)
			if err != nil || d <= 0 {
				return inst, 0, fmt.Errorf("invalid duration %q: %w", val, err)
			}
			durSec = d
			hasDur = true

		case "fm":
			parts := strings.Split(val, ",")
			if len(parts) != 2 {
				return inst, 0, fmt.Errorf("invalid fm %q (expected ratioOrHz,modIndex)", val)
			}
			mi, err2 := strconv.ParseFloat(parts[1], 64)
			if err2 != nil || mi < 0 {
				return inst, 0, fmt.Errorf("invalid fm mod_index in %q", val)
			}
			inst.ModIndex = mi
			if strings.HasSuffix(strings.ToLower(parts[0]), "hz") {
				mf, err1 := parseHzNumber(parts[0])
				if err1 != nil || mf <= 0 {
					return inst, 0, fmt.Errorf("invalid fm mod_freq in %q", val)
				}
				inst.ModFreq = mf
			} else {
				mr, err1 := strconv.ParseFloat(parts[0], 64)
				if err1 != nil || mr <= 0 {
					return inst, 0, fmt.Errorf("invalid fm mod_ratio in %q", val)
				}
				inst.ModRatio = mr
			}

		case "mod_ratio":
			mr, err := strconv.ParseFloat(val, 64)
			if err != nil || mr <= 0 {
				return inst, 0, fmt.Errorf("invalid mod_ratio %q", val)
			}
			inst.ModRatio = mr

		case "mod_freq":
			mf, err := parseHzNumber(val)
			if err != nil || mf <= 0 {
				return inst, 0, fmt.Errorf("invalid mod_freq %q", val)
			}
			inst.ModFreq = mf

		case "mod_index":
			mi, err := strconv.ParseFloat(val, 64)
			if err != nil || mi < 0 {
				return inst, 0, fmt.Errorf("invalid mod_index %q", val)
			}
			inst.ModIndex = mi

		case "noise":
			parts := strings.Split(val, ",")
			if len(parts) != 2 {
				return inst, 0, fmt.Errorf("invalid noise %q (expected filterCoeff,blend)", val)
			}
			nf, err1 := strconv.ParseFloat(parts[0], 64)
			nb, err2 := strconv.ParseFloat(parts[1], 64)
			if err1 != nil || err2 != nil || nf <= 0 || nf > 1.0 || nb < 0 || nb > 1.0 {
				return inst, 0, fmt.Errorf("invalid noise parameters %q (filter in (0,1], blend in [0,1])", val)
			}
			inst.NoiseFilter = nf
			inst.NoiseBlend = nb
			hasExplicitNoiseBlend = true

		case "noise_filter":
			nf, err := strconv.ParseFloat(val, 64)
			if err != nil || nf <= 0 || nf > 1.0 {
				return inst, 0, fmt.Errorf("invalid noise_filter %q (must be in (0.0, 1.0])", val)
			}
			inst.NoiseFilter = nf

		case "noise_blend":
			nb, err := strconv.ParseFloat(val, 64)
			if err != nil || nb < 0 || nb > 1.0 {
				return inst, 0, fmt.Errorf("invalid noise_blend %q (must be in [0.0, 1.0])", val)
			}
			inst.NoiseBlend = nb
			hasExplicitNoiseBlend = true

		case "lpf":
			alpha, err := strconv.ParseFloat(val, 64)
			if err != nil || alpha <= 0 || alpha > 1.0 {
				return inst, 0, fmt.Errorf("invalid lpf %q (must be in (0.0, 1.0])", val)
			}
			inst.LPF = alpha

		case "hpf":
			alpha, err := strconv.ParseFloat(val, 64)
			if err != nil || alpha <= 0 || alpha >= 1.0 {
				return inst, 0, fmt.Errorf("invalid hpf %q (must be in (0.0, 1.0))", val)
			}
			inst.HPF = alpha

		case "bitcrush":
			parts := strings.Split(val, ",")
			if len(parts) != 2 {
				return inst, 0, fmt.Errorf("invalid bitcrush %q (expected bits,downsample)", val)
			}
			bits, err1 := strconv.Atoi(parts[0])
			down, err2 := strconv.Atoi(parts[1])
			if err1 != nil || err2 != nil || bits < 1 || bits > 16 || down < 1 {
				return inst, 0, fmt.Errorf("invalid bitcrush %q (bits 1..16, downsample >= 1)", val)
			}
			inst.BitcrushBits = bits
			inst.BitcrushDownsample = down

		default:
			return inst, 0, fmt.Errorf("unknown attribute %q", key)
		}
	}

	if !hasWave {
		return inst, 0, fmt.Errorf("missing required 'wave=<type>' attribute")
	}
	if inst.WaveType == "noise" && !hasExplicitNoiseBlend {
		inst.NoiseBlend = 1.0
	}
	if isStep && !hasDur {
		return inst, 0, fmt.Errorf("missing required 'dur=<duration>' attribute on step")
	}
	return inst, durSec, nil
}

func normalizeWaveType(w string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(w)) {
	case "sine", "sin":
		return "sine", nil
	case "square", "sq", "pulse":
		return "square", nil
	case "triangle", "tri":
		return "triangle", nil
	case "sawtooth", "saw":
		return "sawtooth", nil
	case "noise":
		return "noise", nil
	case "fm":
		return "fm", nil
	default:
		return "", fmt.Errorf("unsupported wave type %q (valid: sine, square, pulse, triangle, sawtooth, noise, fm)", w)
	}
}

func parseHzNumber(s string) (float64, error) {
	trimmed := strings.TrimSpace(s)
	lower := strings.ToLower(trimmed)
	if strings.HasSuffix(lower, "hz") {
		trimmed = strings.TrimSpace(trimmed[:len(trimmed)-2])
	}
	return strconv.ParseFloat(trimmed, 64)
}

func parseSecondsOrDuration(s string, bpm float64) (float64, error) {
	trimmed := strings.TrimSpace(s)
	lower := strings.ToLower(trimmed)
	if strings.HasSuffix(lower, "ms") || strings.HasSuffix(lower, "s") {
		return ParseDuration(trimmed, bpm)
	}
	return strconv.ParseFloat(trimmed, 64)
}

// ParseDuration converts a DSL duration token (e.g. "4", "8", "16.", "8t", "1/4", "2b", "150ms", "0.5s")
// into exact seconds at the given BPM.
func ParseDuration(token string, bpm float64) (float64, error) {
	s := strings.TrimSpace(token)
	if s == "" {
		return 0, fmt.Errorf("empty duration token")
	}
	if bpm <= 0 {
		bpm = 120.0
	}
	beatSec := 60.0 / bpm
	lower := strings.ToLower(s)

	if strings.HasSuffix(lower, "ms") {
		ms, err := strconv.ParseFloat(strings.TrimSpace(s[:len(s)-2]), 64)
		if err != nil || ms <= 0 {
			return 0, fmt.Errorf("invalid millisecond duration %q", token)
		}
		return ms / 1000.0, nil
	}
	if strings.HasSuffix(lower, "s") {
		sec, err := strconv.ParseFloat(strings.TrimSpace(s[:len(s)-1]), 64)
		if err != nil || sec <= 0 {
			return 0, fmt.Errorf("invalid second duration %q", token)
		}
		return sec, nil
	}
	if strings.HasSuffix(lower, "b") {
		beats, err := strconv.ParseFloat(strings.TrimSpace(s[:len(s)-1]), 64)
		if err != nil || beats <= 0 {
			return 0, fmt.Errorf("invalid beat duration %q", token)
		}
		return beats * beatSec, nil
	}

	multiplier := 1.0
	for len(s) > 0 {
		if s[len(s)-1] == '.' {
			multiplier *= 1.5
			s = s[:len(s)-1]
		} else if s[len(s)-1] == 't' || s[len(s)-1] == 'T' {
			multiplier *= (2.0 / 3.0)
			s = s[:len(s)-1]
		} else {
			break
		}
	}

	if slashIdx := strings.IndexByte(s, '/'); slashIdx > 0 {
		num, err1 := strconv.ParseFloat(s[:slashIdx], 64)
		den, err2 := strconv.ParseFloat(s[slashIdx+1:], 64)
		if err1 != nil || err2 != nil || num <= 0 || den <= 0 {
			return 0, fmt.Errorf("invalid fractional duration %q", token)
		}
		beats := (4.0 * num / den) * multiplier
		return beats * beatSec, nil
	}

	subdiv, err := strconv.ParseFloat(s, 64)
	if err != nil || subdiv <= 0 {
		return 0, fmt.Errorf("invalid note subdivision duration %q", token)
	}
	beats := (4.0 / subdiv) * multiplier
	return beats * beatSec, nil
}

// PitchToFreq converts scientific pitch notation (e.g. "A4", "C#5", "Bb3", "F2") or "<num>Hz" into Hz.
func PitchToFreq(pitch string) (float64, error) {
	s := strings.TrimSpace(pitch)
	if s == "" {
		return 0, fmt.Errorf("empty pitch")
	}
	lower := strings.ToLower(s)
	if strings.HasSuffix(lower, "hz") {
		hz, err := strconv.ParseFloat(strings.TrimSpace(s[:len(s)-2]), 64)
		if err != nil || hz <= 0 || hz > 22050 {
			return 0, fmt.Errorf("invalid frequency %q (must be in (0, 22050] Hz)", pitch)
		}
		return hz, nil
	}

	noteChar := s[0]
	var semitone int
	switch noteChar {
	case 'C', 'c':
		semitone = 0
	case 'D', 'd':
		semitone = 2
	case 'E', 'e':
		semitone = 4
	case 'F', 'f':
		semitone = 5
	case 'G', 'g':
		semitone = 7
	case 'A', 'a':
		semitone = 9
	case 'B', 'b':
		semitone = 11
	default:
		return 0, fmt.Errorf("invalid pitch %q (expected note A..G or <num>Hz)", pitch)
	}

	idx := 1
	if idx < len(s) {
		switch s[idx] {
		case '#', 's', 'S':
			semitone++
			idx++
		case 'b', 'B':
			semitone--
			idx++
		}
	}
	if idx >= len(s) {
		return 0, fmt.Errorf("pitch %q is missing octave number (e.g. %s4)", pitch, s)
	}
	octave, err := strconv.Atoi(s[idx:])
	if err != nil || octave < -1 || octave > 9 {
		return 0, fmt.Errorf("invalid octave in pitch %q (expected -1..9)", pitch)
	}

	midi := (octave+1)*12 + semitone
	freq := 440.0 * math.Pow(2.0, float64(midi-69)/12.0)
	return freq, nil
}

func parsePitchOrSweep(spec string) (PitchSweep, error) {
	if arrowIdx := strings.Index(spec, "->"); arrowIdx > 0 {
		left := strings.TrimSpace(spec[:arrowIdx])
		right := strings.TrimSpace(spec[arrowIdx+2:])
		startHz, err1 := PitchToFreq(left)
		if err1 != nil {
			return PitchSweep{}, err1
		}
		endHz, err2 := PitchToFreq(right)
		if err2 != nil {
			return PitchSweep{}, err2
		}
		return PitchSweep{StartFreq: startHz, EndFreq: endHz}, nil
	}
	hz, err := PitchToFreq(spec)
	if err != nil {
		return PitchSweep{}, err
	}
	return PitchSweep{StartFreq: hz, EndFreq: hz}, nil
}

func tokenizePatternBody(input string) ([]dslToken, error) {
	var tokens []dslToken
	i := 0
	n := len(input)

	for i < n {
		c := input[i]
		if c == ' ' || c == '\t' || c == '\r' || c == '\n' {
			i++
			continue
		}
		if c == '|' {
			tokens = append(tokens, dslToken{kind: tokPipe, text: "|"})
			i++
			continue
		}
		if c == '(' {
			tokens = append(tokens, dslToken{kind: tokLParen, text: "("})
			i++
			continue
		}
		if c == ')' {
			tokens = append(tokens, dslToken{kind: tokRParen, text: ")"})
			i++
			continue
		}
		if c == '*' {
			i++
			for i < n && (input[i] == ' ' || input[i] == '\t') {
				i++
			}
			startNum := i
			for i < n && input[i] >= '0' && input[i] <= '9' {
				i++
			}
			if startNum == i {
				return nil, fmt.Errorf("expected repeat count integer after '*'")
			}
			rep, err := strconv.Atoi(input[startNum:i])
			if err != nil || rep <= 0 || rep > maxRepeatFactor {
				return nil, fmt.Errorf("invalid repeat count %q (must be 1..%d)", input[startNum:i], maxRepeatFactor)
			}
			tokens = append(tokens, dslToken{kind: tokRepeat, number: rep})
			continue
		}
		if c == '@' {
			i++
			startNum := i
			if i < n && (input[i] == '+' || input[i] == '-') {
				i++
			}
			for i < n && input[i] >= '0' && input[i] <= '9' {
				i++
			}
			semi, err := strconv.Atoi(input[startNum:i])
			if err != nil || semi < -48 || semi > 48 {
				return nil, fmt.Errorf("invalid semitone transpose '@%s' (expected e.g. @+12 or @-7)", input[startNum:i])
			}
			tokens = append(tokens, dslToken{kind: tokTranspose, number: semi})
			continue
		}

		// Scan an atom token (which may contain [...] chord brackets or inst(...) pitch args)
		start := i
		for i < n {
			ch := input[i]
			if ch == ' ' || ch == '\t' || ch == '\r' || ch == '\n' || ch == '|' || ch == ')' || ch == '*' || ch == '@' {
				break
			}
			if ch == '(' {
				//Attached '(' is an instrument argument list like kick(150Hz->40Hz):8
				closeIdx := strings.IndexByte(input[i:], ')')
				if closeIdx < 0 {
					return nil, fmt.Errorf("unclosed '(' in token starting at %q", input[start:])
				}
				i += closeIdx + 1
				continue
			}
			if ch == '[' {
				closeIdx := strings.IndexByte(input[i:], ']')
				if closeIdx < 0 {
					return nil, fmt.Errorf("unclosed '[' in chord token starting at %q", input[start:])
				}
				i += closeIdx + 1
				continue
			}
			i++
		}
		atomText := strings.TrimSpace(input[start:i])
		if atomText == "" {
			return nil, fmt.Errorf("unexpected character %q", string(input[i]))
		}
		tokens = append(tokens, dslToken{kind: tokAtom, text: atomText})
	}
	return tokens, nil
}

func parsePatternNodes(body string) ([]dslNode, error) {
	tokens, err := tokenizePatternBody(body)
	if err != nil {
		return nil, err
	}
	pos := 0
	nodes, err := parseNodeList(tokens, &pos, false)
	if err != nil {
		return nil, err
	}
	if len(nodes) == 0 {
		return nil, fmt.Errorf("pattern or track contains no musical events")
	}
	return nodes, nil
}

func parseNodeList(tokens []dslToken, pos *int, insideGroup bool) ([]dslNode, error) {
	var nodes []dslNode
	for *pos < len(tokens) {
		tok := tokens[*pos]
		switch tok.kind {
		case tokPipe:
			*pos++
		case tokRParen:
			if !insideGroup {
				return nil, fmt.Errorf("unmatched ')' in pattern")
			}
			*pos++
			return nodes, nil
		case tokLParen:
			*pos++
			children, err := parseNodeList(tokens, pos, true)
			if err != nil {
				return nil, err
			}
			if len(children) == 0 {
				return nil, fmt.Errorf("empty group '()' is not allowed")
			}
			node := dslNode{isGroup: true, children: children, repeat: 1}
			for *pos < len(tokens) && (tokens[*pos].kind == tokRepeat || tokens[*pos].kind == tokTranspose) {
				if tokens[*pos].kind == tokRepeat {
					node.repeat *= tokens[*pos].number
				} else {
					node.transpose += tokens[*pos].number
				}
				*pos++
			}
			nodes = append(nodes, node)
		case tokAtom:
			*pos++
			node := dslNode{isGroup: false, atom: tok.text, repeat: 1}
			for *pos < len(tokens) && (tokens[*pos].kind == tokRepeat || tokens[*pos].kind == tokTranspose) {
				if tokens[*pos].kind == tokRepeat {
					node.repeat *= tokens[*pos].number
				} else {
					node.transpose += tokens[*pos].number
				}
				*pos++
			}
			nodes = append(nodes, node)
		case tokRepeat:
			return nil, fmt.Errorf("unexpected '*%d' without a preceding note, pattern, or group", tok.number)
		case tokTranspose:
			return nil, fmt.Errorf("unexpected '@%d' without a preceding note, pattern, or group", tok.number)
		}
	}
	if insideGroup {
		return nil, fmt.Errorf("unclosed '(' in pattern")
	}
	return nodes, nil
}

func (s *Score) expandNodesToEvents(nodes []dslNode, defaultInst string, transposeSemi int, activePatterns map[string]bool) ([]NoteEvent, error) {
	if len(activePatterns) > maxPatternDepth {
		return nil, fmt.Errorf("maximum pattern nesting depth (%d) exceeded", maxPatternDepth)
	}
	var out []NoteEvent
	defaultStepDur := "4" // Default to quarter note if duration suffix is omitted

	for _, node := range nodes {
		totalTranspose := transposeSemi + node.transpose
		if node.isGroup {
			subEvents, err := s.expandNodesToEvents(node.children, defaultInst, totalTranspose, activePatterns)
			if err != nil {
				return nil, err
			}
			for r := 0; r < node.repeat; r++ {
				out = append(out, subEvents...)
			}
			continue
		}

		// Check if node.atom is a pattern reference
		if patNodes, isPat := s.Patterns[node.atom]; isPat {
			if activePatterns[node.atom] {
				return nil, fmt.Errorf("cyclic pattern reference detected involving %q", node.atom)
			}
			activePatterns[node.atom] = true
			patEvents, err := s.expandNodesToEvents(patNodes, defaultInst, totalTranspose, activePatterns)
			delete(activePatterns, node.atom)
			if err != nil {
				return nil, fmt.Errorf("in pattern %q: %w", node.atom, err)
			}
			for r := 0; r < node.repeat; r++ {
				out = append(out, patEvents...)
			}
			continue
		}

		// Otherwise parse atom as an event (Rest, Chord, Instrument Trigger, or Pitch/Sweep)
		ev, usedDurStr, err := s.parseSingleAtomEvent(node.atom, defaultInst, defaultStepDur, totalTranspose)
		if err != nil {
			return nil, err
		}
		if usedDurStr != "" {
			defaultStepDur = usedDurStr
		}
		for r := 0; r < node.repeat; r++ {
			out = append(out, ev)
		}
	}
	return out, nil
}

func (s *Score) parseSingleAtomEvent(atom, defaultInst, fallbackDur string, transposeSemi int) (NoteEvent, string, error) {
	head := atom
	durStr := ""

	// Split ':duration' suffix (making sure we split outside ']' or ')')
	lastBracket := strings.LastIndexAny(atom, "])")
	colonIdx := -1
	if lastBracket >= 0 {
		if rel := strings.IndexByte(atom[lastBracket+1:], ':'); rel >= 0 {
			colonIdx = lastBracket + 1 + rel
		}
	} else {
		colonIdx = strings.IndexByte(atom, ':')
	}

	if colonIdx >= 0 {
		head = strings.TrimSpace(atom[:colonIdx])
		durStr = strings.TrimSpace(atom[colonIdx+1:])
		if durStr == "" {
			return NoteEvent{}, "", fmt.Errorf("missing duration after ':' in token %q", atom)
		}
	}

	effectiveDurStr := durStr
	if effectiveDurStr == "" {
		effectiveDurStr = fallbackDur
	}
	durSec, err := ParseDuration(effectiveDurStr, s.BPM)
	if err != nil {
		return NoteEvent{}, "", fmt.Errorf("in token %q: %w", atom, err)
	}

	// 1. Check for Rest ('R', 'r', '_', '.')
	if head == "R" || head == "r" || head == "_" || head == "." {
		return NoteEvent{
			IsRest:      true,
			DurationSec: durSec,
		}, durStr, nil
	}

	transposeMultiplier := 1.0
	if transposeSemi != 0 {
		transposeMultiplier = math.Pow(2.0, float64(transposeSemi)/12.0)
	}

	// 2. Check for Chord '[p1 p2 ...]' or 'inst[p1 p2 ...]'
	if openBr := strings.IndexByte(head, '['); openBr >= 0 && strings.HasSuffix(head, "]") {
		instName := strings.TrimSpace(head[:openBr])
		if instName == "" {
			instName = defaultInst
		}
		if instName == "" {
			return NoteEvent{}, "", fmt.Errorf("chord token %q requires a track default instrument or 'inst[...]' prefix", atom)
		}
		inst, ok := s.Instruments[instName]
		if !ok {
			return NoteEvent{}, "", fmt.Errorf("chord token %q references unknown instrument %q", atom, instName)
		}
		inner := strings.ReplaceAll(head[openBr+1:len(head)-1], ",", " ")
		pitchTokens := strings.Fields(inner)
		if len(pitchTokens) == 0 {
			return NoteEvent{}, "", fmt.Errorf("empty chord %q", atom)
		}
		var sweeps []PitchSweep
		for _, pt := range pitchTokens {
			sw, err := parsePitchOrSweep(pt)
			if err != nil {
				return NoteEvent{}, "", fmt.Errorf("in chord %q: %w", atom, err)
			}
			sw.StartFreq *= transposeMultiplier
			sw.EndFreq *= transposeMultiplier
			sweeps = append(sweeps, sw)
		}
		return NoteEvent{
			IsRest:      false,
			Inst:        inst,
			Pitches:     sweeps,
			DurationSec: durSec,
		}, durStr, nil
	}

	// 3. Check for Instrument Trigger with explicit pitch/sweep: 'inst(pitchOrSweep)'
	if openPar := strings.IndexByte(head, '('); openPar > 0 && strings.HasSuffix(head, ")") {
		instName := strings.TrimSpace(head[:openPar])
		inst, ok := s.Instruments[instName]
		if !ok {
			return NoteEvent{}, "", fmt.Errorf("token %q references unknown instrument %q", atom, instName)
		}
		inner := strings.TrimSpace(head[openPar+1 : len(head)-1])
		sw, err := parsePitchOrSweep(inner)
		if err != nil {
			return NoteEvent{}, "", fmt.Errorf("in instrument trigger %q: %w", atom, err)
		}
		sw.StartFreq *= transposeMultiplier
		sw.EndFreq *= transposeMultiplier
		return NoteEvent{
			IsRest:      false,
			Inst:        inst,
			Pitches:     []PitchSweep{sw},
			DurationSec: durSec,
		}, durStr, nil
	}

	// 4. Check for bare Instrument Trigger: 'kick:8', 'snare:16', 'hat:16'
	if inst, ok := s.Instruments[head]; ok {
		startHz := inst.DefaultStartFreq
		endHz := inst.DefaultEndFreq
		if startHz <= 0 {
			startHz = 440.0
			endHz = 440.0
		}
		return NoteEvent{
			IsRest:      false,
			Inst:        inst,
			Pitches:     []PitchSweep{{StartFreq: startHz * transposeMultiplier, EndFreq: endHz * transposeMultiplier}},
			DurationSec: durSec,
		}, durStr, nil
	}

	// 5. Otherwise, parse as a Pitch or Frequency Sweep using the track's default instrument
	sw, err := parsePitchOrSweep(head)
	if err != nil {
		return NoteEvent{}, "", fmt.Errorf("unrecognized note, pattern, or instrument %q: %w", atom, err)
	}
	if defaultInst == "" {
		return NoteEvent{}, "", fmt.Errorf("pitch token %q used on a track without a default instrument", atom)
	}
	inst, ok := s.Instruments[defaultInst]
	if !ok {
		return NoteEvent{}, "", fmt.Errorf("unknown default instrument %q", defaultInst)
	}
	sw.StartFreq *= transposeMultiplier
	sw.EndFreq *= transposeMultiplier

	return NoteEvent{
		IsRest:      false,
		Inst:        inst,
		Pitches:     []PitchSweep{sw},
		DurationSec: durSec,
	}, durStr, nil
}

// ============================================================================
// 3. DRIFT-FREE DSP SYNTHESIS & 4-BYTE ALIGNED PCM MIXING
// ============================================================================

// AlignPCMBytes enforces 4-byte stereo frame alignment (16-bit Left + 16-bit Right)
// required by Ebitengine's audio.Context to prevent runtime panics on odd byte counts.
func AlignPCMBytes(n int) int {
	return n &^ 3
}

// AlignPCMOffset enforces 4-byte stereo frame alignment on int64 stream seek/loop offsets.
func AlignPCMOffset(offset int64) int64 {
	return offset &^ 3
}

// SynthesizeScore renders all tracks of a parsed Score into a 4-byte aligned 16-bit 44.1kHz stereo PCM buffer.
func SynthesizeScore(score *Score) ([]byte, error) {
	if score == nil || len(score.Tracks) == 0 {
		return nil, fmt.Errorf("synthesize score: score is nil or has no tracks")
	}

	var trackPCMs [][]byte
	for _, tr := range score.Tracks {
		pcm := synthesizeTrackEvents(tr.Events)
		if len(pcm) > 0 {
			trackPCMs = append(trackPCMs, pcm)
		}
	}
	if len(trackPCMs) == 0 {
		return nil, fmt.Errorf("synthesize score: rendered tracks produced 0 PCM bytes")
	}

	mixed := MixTracksPCM(trackPCMs)

	if score.GlobalLPF > 0 {
		mixed = ApplyLowPassFilter(mixed, score.GlobalLPF)
	}
	if score.GlobalHPF > 0 {
		mixed = ApplyHighPassFilter(mixed, score.GlobalHPF)
	}
	if score.GlobalBitcrushBits > 0 {
		mixed = ApplyBitcrush(mixed, score.GlobalBitcrushBits, score.GlobalBitcrushDownsample)
	}
	if score.HasLoopSlice {
		sliced, err := SliceLoopPCM(mixed, score.LoopStartSec, score.LoopEndSec)
		if err != nil {
			return nil, err
		}
		mixed = sliced
	}

	return mixed[:len(mixed)&^3], nil
}

// synthesizeTrackEvents renders a sequence of NoteEvents using cumulative sample rounding
// so multi-bar tracks with different subdivisions never accumulate floating-point timing drift.
func synthesizeTrackEvents(events []NoteEvent) []byte {
	var totalSec float64
	for _, ev := range events {
		if ev.DurationSec > 0 {
			totalSec += ev.DurationSec
		}
	}
	totalSamples := int(math.Round(totalSec * SampleRate))
	if totalSamples <= 0 {
		return nil
	}

	buf := make([]byte, (totalSamples*BytesPerFrame)&^3)
	cursorSec := 0.0

	for eventIdx, ev := range events {
		if ev.DurationSec <= 0 {
			continue
		}
		startSample := int(math.Round(cursorSec * SampleRate))
		cursorSec += ev.DurationSec
		endSample := int(math.Round(cursorSec * SampleRate))
		if endSample > totalSamples {
			endSample = totalSamples
		}
		numSamples := endSample - startSample
		if numSamples <= 0 || ev.IsRest || len(ev.Pitches) == 0 {
			continue
		}

		sliceBytes := buf[startSample*BytesPerFrame : endSample*BytesPerFrame]
		renderNoteEventInto(sliceBytes, numSamples, ev, int64(eventIdx)*7919+int64(startSample))
	}

	return buf[:len(buf)&^3]
}

func renderNoteEventInto(out []byte, numSamples int, ev NoteEvent, rngSeed int64) {
	inst := ev.Inst
	durSec := float64(numSamples) / SampleRate

	pan := inst.Pan
	if pan < -1.0 {
		pan = -1.0
	} else if pan > 1.0 {
		pan = 1.0
	}
	leftPan := math.Cos((pan + 1.0) * math.Pi / 4.0)
	rightPan := math.Sin((pan + 1.0) * math.Pi / 4.0)

	vol := inst.Volume
	if vol <= 0 {
		vol = 0.2
	}
	numVoices := len(ev.Pitches)
	voiceScale := 1.0 / math.Sqrt(float64(numVoices))

	phases := make([]float64, numVoices)
	modPhases := make([]float64, numVoices)
	var filterVal float64
	rng := rand.New(rand.NewSource(rngSeed))

	filterCoeff := inst.NoiseFilter
	if filterCoeff <= 0 || filterCoeff > 1.0 {
		filterCoeff = 1.0
	}
	blend := inst.NoiseBlend
	if blend < 0 {
		blend = 0
	} else if blend > 1.0 {
		blend = 1.0
	}

	for i := 0; i < numSamples; i++ {
		t := float64(i) / SampleRate
		progress := t / durSec

		var voiceSum float64
		for vIdx, sw := range ev.Pitches {
			var currentFreq float64
			if sw.StartFreq == sw.EndFreq {
				currentFreq = sw.StartFreq
			} else if sw.StartFreq > 0 && sw.EndFreq > 0 {
				currentFreq = sw.StartFreq * math.Pow(sw.EndFreq/sw.StartFreq, progress)
			} else {
				currentFreq = sw.StartFreq + progress*(sw.EndFreq-sw.StartFreq)
			}

			if inst.VibratoFreq > 0 && inst.VibratoDepth > 0 {
				currentFreq += math.Sin(2.0*math.Pi*inst.VibratoFreq*t) * inst.VibratoDepth
			}

			phases[vIdx] += currentFreq / SampleRate
			for phases[vIdx] >= 1.0 {
				phases[vIdx] -= 1.0
			}
			phase := phases[vIdx]

			var modFreq float64
			if inst.ModRatio > 0 {
				modFreq = currentFreq * inst.ModRatio
			} else if inst.ModFreq > 0 {
				modFreq = inst.ModFreq
			} else if inst.WaveType == "fm" {
				modFreq = currentFreq * 2.0
			}
			if modFreq > 0 {
				modPhases[vIdx] += modFreq / SampleRate
				for modPhases[vIdx] >= 1.0 {
					modPhases[vIdx] -= 1.0
				}
			}

			var oscAmp float64
			switch inst.WaveType {
			case "fm":
				modIndex := inst.ModIndex
				if modIndex <= 0 {
					modIndex = 2.0
				}
				modSample := math.Sin(2.0 * math.Pi * modPhases[vIdx])
				oscAmp = math.Sin(2.0*math.Pi*phase + modIndex*modSample)
			case "sine":
				oscAmp = math.Sin(2.0 * math.Pi * phase)
			case "square":
				duty := inst.DutyCycle
				if duty <= 0 || duty >= 1.0 {
					duty = 0.5
				}
				if phase < duty {
					oscAmp = 1.0
				} else {
					oscAmp = -1.0
				}
			case "triangle":
				if phase < 0.5 {
					oscAmp = 4.0*phase - 1.0
				} else {
					oscAmp = 3.0 - 4.0*phase
				}
			case "sawtooth":
				oscAmp = 2.0*phase - 1.0
			default:
				oscAmp = math.Sin(2.0 * math.Pi * phase)
			}

			voiceSum += oscAmp * voiceScale
		}

		rawNoise := rng.Float64()*2.0 - 1.0
		filterVal += filterCoeff * (rawNoise - filterVal)

		amp := (1.0-blend)*voiceSum + blend*filterVal
		env := getEnvelope(t, durSec, inst.Attack, inst.Decay, inst.Sustain, inst.Release)
		finalAmp := amp * env * vol

		leftVal := int16(math.Max(-1.0, math.Min(1.0, finalAmp*leftPan)) * 32760)
		rightVal := int16(math.Max(-1.0, math.Min(1.0, finalAmp*rightPan)) * 32760)

		idx := i * BytesPerFrame
		out[idx] = byte(leftVal)
		out[idx+1] = byte(leftVal >> 8)
		out[idx+2] = byte(rightVal)
		out[idx+3] = byte(rightVal >> 8)
	}

	if inst.LPF > 0 {
		filtered := ApplyLowPassFilter(out, inst.LPF)
		copy(out, filtered)
	}
	if inst.HPF > 0 {
		filtered := ApplyHighPassFilter(out, inst.HPF)
		copy(out, filtered)
	}
	if inst.BitcrushBits > 0 {
		crushed := ApplyBitcrush(out, inst.BitcrushBits, inst.BitcrushDownsample)
		copy(out, crushed)
	}
}

// MixTracksPCM sums multiple stereo 16-bit PCM byte slices with 32-bit hard clamping and 4-byte alignment.
func MixTracksPCM(tracks [][]byte) []byte {
	maxLen := 0
	for _, t := range tracks {
		aligned := len(t) &^ 3
		if aligned > maxLen {
			maxLen = aligned
		}
	}
	maxLen &= ^3
	result := make([]byte, maxLen)

	for i := 0; i < maxLen; i += 2 {
		var sum int32
		for _, t := range tracks {
			alignedTrackLen := len(t) &^ 3
			if i+1 < alignedTrackLen {
				sample := int16(uint16(t[i]) | (uint16(t[i+1]) << 8))
				sum += int32(sample)
			}
		}
		if sum > 32767 {
			sum = 32767
		} else if sum < -32768 {
			sum = -32768
		}
		result[i] = byte(sum)
		result[i+1] = byte(sum >> 8)
	}
	return result
}

// SliceLoopPCM extracts a 4-byte aligned stereo PCM loop region between startSec and endSec.
func SliceLoopPCM(pcm []byte, startSec, endSec float64) ([]byte, error) {
	alignedTotal := len(pcm) &^ 3
	if alignedTotal == 0 {
		return nil, fmt.Errorf("slice loop PCM: input buffer is empty or smaller than 4 bytes (%d bytes)", len(pcm))
	}
	if startSec < 0 || endSec <= startSec {
		return nil, fmt.Errorf("slice loop PCM: invalid time range [%.4fs, %.4fs]", startSec, endSec)
	}

	startByte := int(startSec*BytesPerSecond) &^ 3
	endByte := int(endSec*BytesPerSecond) &^ 3
	if endByte > alignedTotal {
		endByte = alignedTotal
	}
	sliceLen := (endByte - startByte) &^ 3
	if sliceLen <= 0 {
		return nil, fmt.Errorf("slice loop PCM: computed 4-byte aligned slice length is %d bytes for range [%.4fs, %.4fs]", sliceLen, startSec, endSec)
	}

	reader := bytes.NewReader(pcm[:alignedTotal])
	if _, err := reader.Seek(int64(startByte)&^3, io.SeekStart); err != nil {
		return nil, fmt.Errorf("slice loop PCM seek failed: %w", err)
	}
	out := make([]byte, sliceLen)
	if _, err := io.ReadFull(reader, out); err != nil {
		return nil, fmt.Errorf("slice loop PCM read failed: %w", err)
	}
	return out, nil
}

// ApplyLowPassFilter applies a single-pole IIR low-pass filter (alpha in (0.0, 1.0]) to a 16-bit stereo PCM buffer.
func ApplyLowPassFilter(pcm []byte, alpha float64) []byte {
	alignedLen := len(pcm) &^ 3
	if alignedLen == 0 {
		return nil
	}
	if alpha <= 0 {
		alpha = 0.01
	} else if alpha > 1.0 {
		alpha = 1.0
	}

	out := make([]byte, alignedLen)
	var prevL, prevR float64
	for i := 0; i < alignedLen; i += 4 {
		inL := float64(int16(uint16(pcm[i]) | (uint16(pcm[i+1]) << 8)))
		inR := float64(int16(uint16(pcm[i+2]) | (uint16(pcm[i+3]) << 8)))

		prevL += alpha * (inL - prevL)
		prevR += alpha * (inR - prevR)

		outL := int16(math.Max(-32768, math.Min(32767, prevL)))
		outR := int16(math.Max(-32768, math.Min(32767, prevR)))

		out[i] = byte(outL)
		out[i+1] = byte(outL >> 8)
		out[i+2] = byte(outR)
		out[i+3] = byte(outR >> 8)
	}
	return out
}

// ApplyHighPassFilter applies a single-pole IIR high-pass filter (alpha in (0.0, 1.0)) to a 16-bit stereo PCM buffer.
func ApplyHighPassFilter(pcm []byte, alpha float64) []byte {
	alignedLen := len(pcm) &^ 3
	if alignedLen == 0 {
		return nil
	}
	if alpha <= 0 {
		alpha = 0.01
	} else if alpha >= 1.0 {
		alpha = 0.999
	}

	out := make([]byte, alignedLen)
	var prevInL, prevInR, prevOutL, prevOutR float64
	for i := 0; i < alignedLen; i += 4 {
		inL := float64(int16(uint16(pcm[i]) | (uint16(pcm[i+1]) << 8)))
		inR := float64(int16(uint16(pcm[i+2]) | (uint16(pcm[i+3]) << 8)))

		prevOutL = alpha * (prevOutL + inL - prevInL)
		prevOutR = alpha * (prevOutR + inR - prevInR)
		prevInL = inL
		prevInR = inR

		outL := int16(math.Max(-32768, math.Min(32767, prevOutL)))
		outR := int16(math.Max(-32768, math.Min(32767, prevOutR)))

		out[i] = byte(outL)
		out[i+1] = byte(outL >> 8)
		out[i+2] = byte(outR)
		out[i+3] = byte(outR >> 8)
	}
	return out
}

// ApplyBitcrush reduces amplitude resolution to bitDepth (1..16) and holds samples for downsample frames (>=1).
func ApplyBitcrush(pcm []byte, bitDepth int, downsample int) []byte {
	alignedLen := len(pcm) &^ 3
	if alignedLen == 0 {
		return nil
	}
	if bitDepth < 1 {
		bitDepth = 1
	} else if bitDepth > 16 {
		bitDepth = 16
	}
	if downsample < 1 {
		downsample = 1
	}

	shift := uint(16 - bitDepth)
	out := make([]byte, alignedLen)
	var holdL, holdR int16
	frameIdx := 0

	for i := 0; i < alignedLen; i += 4 {
		if frameIdx%downsample == 0 {
			inL := int16(uint16(pcm[i]) | (uint16(pcm[i+1]) << 8))
			inR := int16(uint16(pcm[i+2]) | (uint16(pcm[i+3]) << 8))
			if shift > 0 {
				holdL = (inL >> shift) << shift
				holdR = (inR >> shift) << shift
			} else {
				holdL = inL
				holdR = inR
			}
		}
		out[i] = byte(holdL)
		out[i+1] = byte(holdL >> 8)
		out[i+2] = byte(holdR)
		out[i+3] = byte(holdR >> 8)
		frameIdx++
	}
	return out
}

func getEnvelope(t, duration, attack, decay, sustain, release float64) float64 {
	if t < 0 || t > duration {
		return 0.0
	}
	if attack+decay+release > duration {
		rampUp := duration * 0.1
		if t < rampUp {
			return t / rampUp
		}
		return 1.0 - (t-rampUp)/(duration-rampUp)
	}
	if t < attack {
		if attack > 0 {
			return t / attack
		}
		return 1.0
	}
	if t < attack+decay {
		if decay > 0 {
			progress := (t - attack) / decay
			return 1.0 - (1.0-sustain)*progress
		}
		return sustain
	}
	if t < duration-release {
		return sustain
	}
	timeInRelease := t - (duration - release)
	if release > 0 {
		progress := timeInRelease / release
		if progress > 1.0 {
			progress = 1.0
		}
		return sustain * (1.0 - progress)
	}
	return 0.0
}

// ============================================================================
// 4. SOUND SYSTEM DRIVER (BGM & RATE-LIMITED SFX PLAYBACK ENGINE)
// ============================================================================

// SoundSystem manages Ebitengine BGM playback and rate-limited polyphonic SFX triggers.
type SoundSystem struct {
	context     *audio.Context
	musicPlayer *audio.Player
	mu          sync.Mutex
	lastSFX     map[string]time.Time
}

// NewSoundSystem initializes the sound system driver.
func NewSoundSystem(ctx *audio.Context) *SoundSystem {
	return &SoundSystem{
		context: ctx,
		lastSFX: make(map[string]time.Time),
	}
}

// Play plays a 4-byte aligned PCM buffer once or in an infinite loop on the music channel.
func (s *SoundSystem) Play(pcm []byte, loop bool) error {
	if s.context == nil {
		return fmt.Errorf("sound system: audio.Context is nil")
	}
	alignedLen := len(pcm) &^ 3
	if alignedLen == 0 {
		return fmt.Errorf("sound system: PCM buffer is empty or smaller than 4-byte stereo frame (%d bytes)", len(pcm))
	}
	pcm = pcm[:alignedLen]
	s.Stop()

	if loop {
		loopLength := int64(alignedLen) &^ 3
		loopStream := audio.NewInfiniteLoop(bytes.NewReader(pcm), loopLength)
		player, err := s.context.NewPlayer(loopStream)
		if err != nil {
			return err
		}
		s.musicPlayer = player
		player.Play()
	} else {
		player := s.context.NewPlayerFromBytes(pcm)
		s.musicPlayer = player
		player.Play()
	}
	return nil
}

// PlaySFX plays a one-shot sound effect concurrently without interrupting BGM,
// enforcing an optional per-cue cooldown to prevent audio channel choking.
func (s *SoundSystem) PlaySFX(cueName string, pcm []byte, cooldown time.Duration) error {
	if s.context == nil {
		return fmt.Errorf("sound system: audio.Context is nil")
	}
	alignedLen := len(pcm) &^ 3
	if alignedLen == 0 {
		return fmt.Errorf("sound system: SFX PCM buffer %q is empty or smaller than 4-byte stereo frame (%d bytes)", cueName, len(pcm))
	}

	if cooldown > 0 && cueName != "" {
		s.mu.Lock()
		now := time.Now()
		if last, ok := s.lastSFX[cueName]; ok && now.Sub(last) < cooldown {
			s.mu.Unlock()
			return nil
		}
		s.lastSFX[cueName] = now
		s.mu.Unlock()
	}

	player := s.context.NewPlayerFromBytes(pcm[:alignedLen])
	player.Play()
	return nil
}

// PlayDSL compiles a DSL script and plays it (one-shot or loop).
func (s *SoundSystem) PlayDSL(dslText string, loop bool) error {
	pcm, err := CompileDSL(dslText)
	if err != nil {
		return err
	}
	return s.Play(pcm, loop)
}

// SeekBytes seeks the active player to a 4-byte aligned byte offset in the 44.1kHz stereo PCM stream.
func (s *SoundSystem) SeekBytes(offsetBytes int64) error {
	if s.musicPlayer == nil {
		return fmt.Errorf("sound system: no active player to seek")
	}
	alignedOffset := offsetBytes &^ 3
	if alignedOffset < 0 {
		return fmt.Errorf("sound system: negative seek offset (%d)", alignedOffset)
	}
	targetDuration := time.Duration(alignedOffset) * time.Second / BytesPerSecond
	return s.musicPlayer.Seek(targetDuration)
}

// Stop stops any currently playing music player.
func (s *SoundSystem) Stop() {
	if s.musicPlayer != nil && s.musicPlayer.IsPlaying() {
		s.musicPlayer.Pause()
	}
}

// ============================================================================
// 5. WAV FILE EXPORTER
// ============================================================================

// ExportWAV writes a 4-byte aligned 16-bit 44100Hz stereo PCM buffer to a .wav file.
func ExportWAV(filename string, pcm []byte) (retErr error) {
	alignedLen := len(pcm) &^ 3
	if alignedLen == 0 {
		return fmt.Errorf("export WAV: PCM buffer is empty or smaller than 4-byte stereo frame (%d bytes)", len(pcm))
	}
	pcm = pcm[:alignedLen]

	f, err := os.Create(filename)
	if err != nil {
		return err
	}
	defer func() {
		if closeErr := f.Close(); closeErr != nil && retErr == nil {
			retErr = closeErr
		}
	}()

	const bitsPerSample = 16
	const byteRate = SampleRate * NumChannels * (bitsPerSample / 8)
	const blockAlign = NumChannels * (bitsPerSample / 8)

	dataSize := uint32(alignedLen)
	chunkSize := 36 + dataSize

	if _, err := f.WriteString("RIFF"); err != nil {
		return err
	}
	if err := binary.Write(f, binary.LittleEndian, chunkSize); err != nil {
		return err
	}
	if _, err := f.WriteString("WAVE"); err != nil {
		return err
	}

	if _, err := f.WriteString("fmt "); err != nil {
		return err
	}
	if err := binary.Write(f, binary.LittleEndian, uint32(16)); err != nil {
		return err
	}
	if err := binary.Write(f, binary.LittleEndian, uint16(1)); err != nil {
		return err
	}
	if err := binary.Write(f, binary.LittleEndian, uint16(NumChannels)); err != nil {
		return err
	}
	if err := binary.Write(f, binary.LittleEndian, uint32(SampleRate)); err != nil {
		return err
	}
	if err := binary.Write(f, binary.LittleEndian, uint32(byteRate)); err != nil {
		return err
	}
	if err := binary.Write(f, binary.LittleEndian, uint16(blockAlign)); err != nil {
		return err
	}
	if err := binary.Write(f, binary.LittleEndian, uint16(bitsPerSample)); err != nil {
		return err
	}

	if _, err := f.WriteString("data"); err != nil {
		return err
	}
	if err := binary.Write(f, binary.LittleEndian, dataSize); err != nil {
		return err
	}
	_, err = f.Write(pcm)
	return err
}
