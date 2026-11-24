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

package sprite

import (
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	_ "image/jpeg"
	_ "image/png"
	"os"
	"path/filepath"
	"strings"
)

// SynthReport is the structured QA and metadata report for .sprite, .aseprite, and PNG sprite sheets.
type SynthReport struct {
	Passed             bool          `json:"passed"`
	Error              string        `json:"error,omitempty"`
	Title              string        `json:"title"`
	Type               string        `json:"type"`
	Width              int           `json:"width"`
	Height             int           `json:"height"`
	SheetWidth         int           `json:"sheetWidth"`
	SheetHeight        int           `json:"sheetHeight"`
	SheetCols          int           `json:"sheetCols"`
	SheetRows          int           `json:"sheetRows"`
	Palette            string        `json:"palette"`
	TotalFrames        int           `json:"totalFrames"`
	FillRatioPct       float64       `json:"fillRatioPct"`
	OpaquePixelPct     float64       `json:"opaquePixelPct"`
	CenterOfMassX      float64       `json:"centerOfMassX"`
	CenterOfMassY      float64       `json:"centerOfMassY"`
	LuminanceSteps     int           `json:"luminanceSteps"`
	PremultipliedClean bool          `json:"premultipliedClean"`
	Tags               []CompiledTag `json:"tags"`
	Parts              []PartSummary `json:"parts"`
	PaletteColors      []string      `json:"paletteColors"`
	Issues             []string      `json:"issues"`
	PNGPath            string        `json:"pngPath,omitempty"`
	AsepritePath       string        `json:"asepritePath,omitempty"`
	GifPaths           []string      `json:"gifPaths,omitempty"`
}

// InspectOptions configures sprite sheet or container inspection.
type InspectOptions struct {
	FilePath    string
	FrameWidth  int
	FrameHeight int
	Cols        int
	Rows        int
	JsonPath    string
	OutPngPath  string
}

// CompileOptions configures .sprite DSL compilation and optional exports.
type CompileOptions struct {
	DSL             string
	FilePath        string
	BaseDir         string
	OutPngPath      string
	OutJsonPath     string
	OutAsepritePath string
	OutPreviewPath  string
	OutGifDir       string
	GifPrefix       string
	Scale           int
}

// NormalizeOptionsInput configures AI sprite grid chroma-key normalization and alignment.
type NormalizeOptionsInput struct {
	FilePaths       []string
	FrameWidth      int
	FrameHeight     int
	Cols            int
	Rows            int
	Tolerance       int
	HasTolerance    bool
	Center          bool
	Ground          bool
	Pad             int
	HasPad          bool
	DurationMs      int
	Tags            []string
	OutPngPath      string
	OutJsonPath     string
	OutSpritePath   string
	OutAsepritePath string
	OutPreviewPath  string
	OutGifDir       string
	GifPrefix       string
	Scale           int
}

// PaletteRamp represents a 4-step material shading ramp extracted from an image.
type PaletteRamp struct {
	Name  string   `json:"name"`
	Steps []string `json:"steps"`
}

// PaletteReport returns extracted 4-step material ramps and formatted .sprite DSL directives.
type PaletteReport struct {
	FilePath string        `json:"filePath"`
	Ramps    []PaletteRamp `json:"ramps"`
	DSL      string        `json:"dsl"`
}

func nonNilTags(in []CompiledTag) []CompiledTag {
	if in == nil {
		return []CompiledTag{}
	}
	return in
}

func nonNilParts(in []PartSummary) []PartSummary {
	if in == nil {
		return []PartSummary{}
	}
	return in
}

func nonNilStrings(in []string) []string {
	if in == nil {
		return []string{}
	}
	return in
}

func formatPaletteHexes(cols []color.RGBA, maxCount int) []string {
	if maxCount <= 0 {
		maxCount = 24
	}
	var picked []color.RGBA
	out := make([]string, 0, maxCount)
	seen := make(map[string]bool)
	for _, minDist := range []int{36, 18, 0} {
		for _, c := range cols {
			if c.A < 200 {
				continue
			}
			hex := fmt.Sprintf("#%02X%02X%02X", c.R, c.G, c.B)
			if seen[hex] {
				continue
			}
			if minDist > 0 {
				tooClose := false
				for _, p := range picked {
					if colorDistManhattan(c, p) < minDist {
						tooClose = true
						break
					}
				}
				if tooClose {
					continue
				}
			}
			seen[hex] = true
			picked = append(picked, c)
			out = append(out, hex)
			if len(out) >= maxCount {
				return out
			}
		}
	}
	return out
}

func buildSynthReport(cs *CompiledSprite, valRep SpriteValidationReport, pngPath, asePath string, gifPaths []string) SynthReport {
	b := cs.SheetRGBA.Bounds()
	return SynthReport{
		Passed:             valRep.Passed,
		Title:              cs.Title,
		Type:               cs.Type,
		Width:              cs.FrameW,
		Height:             cs.FrameH,
		SheetWidth:         b.Dx(),
		SheetHeight:        b.Dy(),
		SheetCols:          cs.SheetCols,
		SheetRows:          cs.SheetRows,
		Palette:            cs.Palette,
		TotalFrames:        len(cs.Frames),
		FillRatioPct:       valRep.FillRatioPct,
		OpaquePixelPct:     valRep.OpaquePixelPct,
		CenterOfMassX:      valRep.CenterOfMassX,
		CenterOfMassY:      valRep.CenterOfMassY,
		LuminanceSteps:     valRep.LuminanceSteps,
		PremultipliedClean: valRep.PremultipliedClean,
		Tags:               nonNilTags(cs.Tags),
		Parts:              nonNilParts(cs.Parts),
		PaletteColors:      nonNilStrings(formatPaletteHexes(cs.PaletteColors, 32)),
		Issues:             nonNilStrings(valRep.Issues),
		PNGPath:            pngPath,
		AsepritePath:       asePath,
		GifPaths:           gifPaths,
	}
}

func resolveEffectiveScale(requested, fw, fh int) int {
	if requested > 0 {
		return requested
	}
	if fw >= 128 || fh >= 128 {
		return 1
	}
	if fw >= 64 || fh >= 64 {
		return 2
	}
	return 4
}

func loadImageFile(path string) (image.Image, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer func() { _ = f.Close() }()
	img, _, err := image.Decode(f)
	return img, err
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// Inspect inspects a .sprite container, binary .aseprite/.ase file, or .png sprite sheet.
func Inspect(opts InspectOptions) (SynthReport, error) {
	imgPath := strings.TrimSpace(opts.FilePath)
	if imgPath == "" {
		return SynthReport{}, fmt.Errorf("missing sprite container or sheet path")
	}
	lowerPath := strings.ToLower(imgPath)

	// Container branch 1: .aseprite / .ase binary file
	if strings.HasSuffix(lowerPath, ".aseprite") || strings.HasSuffix(lowerPath, ".ase") {
		cs, err := ImportAseprite(imgPath)
		if err != nil {
			return SynthReport{}, err
		}
		if opts.OutPngPath != "" {
			if err := ExportPNGSheet(opts.OutPngPath, "", cs); err != nil {
				return SynthReport{}, err
			}
		}
		valRep := ValidateSprite(cs)
		return buildSynthReport(cs, valRep, opts.OutPngPath, imgPath, nil), nil
	}

	// Container branch 2: .sprite container or procedural DSL file
	if strings.HasSuffix(lowerPath, ".sprite") {
		spec, err := LoadSpriteFile(imgPath)
		if err != nil {
			return SynthReport{}, err
		}
		if opts.FrameWidth > 0 && opts.FrameHeight > 0 {
			spec.Width = opts.FrameWidth
			spec.Height = opts.FrameHeight
		}
		if opts.Cols > 0 && opts.Rows > 0 {
			spec.GridCols = opts.Cols
			spec.GridRows = opts.Rows
		}
		cs, err := CompileSprite(spec)
		if err != nil {
			return SynthReport{}, err
		}
		pngPath := ""
		if opts.OutPngPath != "" {
			if err := ExportPNGSheet(opts.OutPngPath, "", cs); err != nil {
				return SynthReport{}, err
			}
			pngPath = opts.OutPngPath
		} else if spec.SheetPath != "" {
			if filepath.IsAbs(spec.SheetPath) {
				pngPath = spec.SheetPath
			} else {
				pngPath = filepath.Join(spec.BaseDir, spec.SheetPath)
			}
		}
		valRep := ValidateSprite(cs)
		return buildSynthReport(cs, valRep, pngPath, "", nil), nil
	}

	// Raw PNG/image sprite sheet branch
	img, err := loadImageFile(imgPath)
	if err != nil {
		return SynthReport{}, fmt.Errorf("read image %q: %w", imgPath, err)
	}
	rgba := toPremultipliedRGBA(img)
	b := rgba.Bounds()
	w, h := b.Dx(), b.Dy()

	stem := strings.TrimSuffix(filepath.Base(imgPath), filepath.Ext(imgPath))
	manifestPath := opts.JsonPath
	if manifestPath == "" {
		cand := strings.TrimSuffix(imgPath, filepath.Ext(imgPath)) + ".json"
		if fileExists(cand) {
			manifestPath = cand
		}
	}

	fw, fh := opts.FrameWidth, opts.FrameHeight
	cols, rows := opts.Cols, opts.Rows
	var tags []CompiledTag

	if manifestPath != "" && fileExists(manifestPath) {
		if jb, readErr := os.ReadFile(manifestPath); readErr == nil {
			var man AsepriteSheetJSON
			if json.Unmarshal(jb, &man) == nil {
				if fw <= 0 && man.Meta.FrameWidth > 0 {
					fw = man.Meta.FrameWidth
				}
				if fh <= 0 && man.Meta.FrameHeight > 0 {
					fh = man.Meta.FrameHeight
				}
				if cols <= 0 && man.Meta.Cols > 0 {
					cols = man.Meta.Cols
				}
				if rows <= 0 && man.Meta.Rows > 0 {
					rows = man.Meta.Rows
				}
				if len(man.Meta.FrameTags) > 0 {
					tags = man.Meta.FrameTags
				}
			}
		}
	}

	if fw <= 0 || fh <= 0 {
		if cols > 0 && rows > 0 {
			fw = w / cols
			fh = h / rows
		} else if w == h && w%4 == 0 {
			cols, rows = 4, 4
			fw, fh = w/4, h/4
		} else if h > 0 && w >= h && w%h == 0 {
			cols = w / h
			rows = 1
			fw, fh = h, h
		} else if w%4 == 0 && h%4 == 0 {
			cols, rows = 4, 4
			fw, fh = w/4, h/4
		} else {
			cols, rows = 1, 1
			fw, fh = w, h
		}
	}
	if cols <= 0 && fw > 0 {
		cols = maxInt(1, w/fw)
	}
	if rows <= 0 && fh > 0 {
		rows = maxInt(1, h/fh)
	}

	var frames []*image.RGBA
	var durations []int
	for r := range rows {
		for c := range cols {
			cell := image.NewRGBA(image.Rect(0, 0, fw, fh))
			hasOpaque := false
			for y := 0; y < fh && r*fh+y < h; y++ {
				for x := 0; x < fw && c*fw+x < w; x++ {
					px := rgba.RGBAAt(c*fw+x, r*fh+y)
					if px.A > 0 {
						hasOpaque = true
					}
					cell.SetRGBA(x, y, px)
				}
			}
			if hasOpaque || len(tags) > 0 {
				frames = append(frames, cell)
				durations = append(durations, 100)
			}
		}
	}
	if len(frames) == 0 {
		frames = append(frames, rgba)
		durations = append(durations, 100)
	}
	if len(tags) == 0 {
		tags = []CompiledTag{
			{
				Name:       "all",
				FromFrame:  0,
				ToFrame:    len(frames) - 1,
				Frames:     len(frames),
				DurationMs: 100,
				Loop:       "forward",
			},
		}
	}

	cs := &CompiledSprite{
		Title:          stem,
		Type:           "sprite",
		FrameW:         fw,
		FrameH:         fh,
		Palette:        "custom",
		Frames:         frames,
		FrameDurations: durations,
		Tags:           tags,
		PaletteColors:  collectUniqueColors(rgba),
		SheetRGBA:      rgba,
		SheetCols:      cols,
		SheetRows:      rows,
	}
	valRep := ValidateSprite(cs)
	return buildSynthReport(cs, valRep, imgPath, "", nil), nil
}

// Compile compiles a .sprite DSL string or file and writes optional PNG, JSON, Aseprite, preview, and GIF outputs.
func Compile(opts CompileOptions) (SynthReport, error) {
	var spec *SpriteSpec
	var err error

	if strings.TrimSpace(opts.DSL) != "" {
		spec, err = ParseSpriteDSL(opts.DSL)
		if err != nil {
			return SynthReport{}, err
		}
		if strings.TrimSpace(opts.BaseDir) != "" {
			spec.BaseDir = opts.BaseDir
		} else if strings.TrimSpace(opts.FilePath) != "" {
			spec.BaseDir = filepath.Dir(opts.FilePath)
		}
	} else if strings.TrimSpace(opts.FilePath) != "" {
		spec, err = LoadSpriteFile(opts.FilePath)
		if err != nil {
			return SynthReport{}, err
		}
	} else {
		return SynthReport{}, fmt.Errorf("missing .sprite DSL text or filePath")
	}

	cs, err := CompileSprite(spec)
	if err != nil {
		return SynthReport{}, err
	}

	if opts.OutPngPath != "" || opts.OutJsonPath != "" {
		if err := ExportPNGSheet(opts.OutPngPath, opts.OutJsonPath, cs); err != nil {
			return SynthReport{}, err
		}
	}
	if opts.OutAsepritePath != "" {
		if err := ExportAseprite(opts.OutAsepritePath, cs); err != nil {
			return SynthReport{}, err
		}
	}
	effScale := resolveEffectiveScale(opts.Scale, cs.FrameW, cs.FrameH)
	if opts.OutPreviewPath != "" {
		if err := ExportPreviewPNG(opts.OutPreviewPath, effScale, cs); err != nil {
			return SynthReport{}, err
		}
	}
	var gifPaths []string
	if opts.OutGifDir != "" {
		prefix := opts.GifPrefix
		if prefix == "" {
			if opts.FilePath != "" {
				prefix = strings.TrimSuffix(filepath.Base(opts.FilePath), filepath.Ext(opts.FilePath))
			} else if cs.Title != "" {
				prefix = strings.ToLower(strings.ReplaceAll(cs.Title, " ", "_"))
			} else {
				prefix = "sprite"
			}
		}
		gifPaths, err = ExportTagGIFs(opts.OutGifDir, prefix, effScale, cs)
		if err != nil {
			return SynthReport{}, err
		}
	}

	valRep := ValidateSprite(cs)
	return buildSynthReport(cs, valRep, opts.OutPngPath, opts.OutAsepritePath, gifPaths), nil
}

// Normalize strips chroma-key backgrounds, aligns frames, and exports normalized sprite assets.
func Normalize(opts NormalizeOptionsInput) (SynthReport, error) {
	if len(opts.FilePaths) == 0 {
		return SynthReport{}, fmt.Errorf("missing input raw sprite sheet image path(s)")
	}

	srcImgs := make([]image.Image, 0, len(opts.FilePaths))
	for _, p := range opts.FilePaths {
		img, err := loadImageFile(p)
		if err != nil {
			return SynthReport{}, fmt.Errorf("read image %q: %w", p, err)
		}
		srcImgs = append(srcImgs, img)
	}

	durMs := opts.DurationMs
	if durMs <= 0 {
		durMs = 100
	}
	var parsedTags []CompiledTag
	for _, ts := range opts.Tags {
		ct, err := ParseNormalizeTagFlag(ts, durMs)
		if err != nil {
			return SynthReport{}, fmt.Errorf("parse tag %q: %w", ts, err)
		}
		parsedTags = append(parsedTags, ct)
	}

	fw, fh := opts.FrameWidth, opts.FrameHeight
	if opts.Cols <= 0 && opts.Rows <= 0 {
		if fw <= 0 {
			fw = 32
		}
		if fh <= 0 {
			fh = 32
		}
	}

	tol := 18
	if opts.HasTolerance {
		tol = max(0, min(opts.Tolerance, 255))
	}
	pad := 2
	if opts.HasPad {
		pad = max(0, opts.Pad)
	}

	stem := strings.TrimSuffix(filepath.Base(opts.FilePaths[0]), filepath.Ext(opts.FilePaths[0]))
	cs, err := NormalizeMultiSpriteSheets(srcImgs, NormalizeOptions{
		Title:           stem,
		FrameWidth:      fw,
		FrameHeight:     fh,
		GridCols:        opts.Cols,
		GridRows:        opts.Rows,
		ColorTolerance:  uint8(tol),
		AutoCenterX:     opts.Center,
		GroundBottom:    opts.Ground,
		BottomPadding:   pad,
		DefaultDuration: durMs,
		Tags:            parsedTags,
	})
	if err != nil {
		return SynthReport{}, err
	}

	effScale := resolveEffectiveScale(opts.Scale, cs.FrameW, cs.FrameH)
	if opts.OutPngPath != "" || opts.OutJsonPath != "" {
		if err := ExportPNGSheet(opts.OutPngPath, opts.OutJsonPath, cs); err != nil {
			return SynthReport{}, err
		}
	}

	spriteOutPath := opts.OutSpritePath
	if spriteOutPath == "" && opts.OutPngPath != "" && !strings.HasPrefix(filepath.Clean(opts.OutPngPath), filepath.Clean(os.TempDir())) {
		ext := filepath.Ext(opts.OutPngPath)
		spriteOutPath = strings.TrimSuffix(opts.OutPngPath, ext) + ".sprite"
	}
	if spriteOutPath != "" && opts.OutPngPath != "" {
		if err := ExportSpriteContainer(spriteOutPath, filepath.Base(opts.OutPngPath), cs); err != nil {
			return SynthReport{}, err
		}
	}
	if opts.OutAsepritePath != "" {
		if err := ExportAseprite(opts.OutAsepritePath, cs); err != nil {
			return SynthReport{}, err
		}
	}
	if opts.OutPreviewPath != "" {
		if err := ExportPreviewPNG(opts.OutPreviewPath, effScale, cs); err != nil {
			return SynthReport{}, err
		}
	}
	var gifPaths []string
	if opts.OutGifDir != "" {
		prefix := opts.GifPrefix
		if prefix == "" {
			prefix = stem
		}
		gifPaths, err = ExportTagGIFs(opts.OutGifDir, prefix, effScale, cs)
		if err != nil {
			return SynthReport{}, err
		}
	}

	valRep := ValidateSprite(cs)
	return buildSynthReport(cs, valRep, opts.OutPngPath, opts.OutAsepritePath, gifPaths), nil
}

// ExtractPalette extracts up to maxRamps 4-step material shading ramps from a reference image.
func ExtractPalette(filePath string, maxRamps int) (PaletteReport, error) {
	if strings.TrimSpace(filePath) == "" {
		return PaletteReport{}, fmt.Errorf("missing reference image path")
	}
	if maxRamps <= 0 {
		maxRamps = 4
	}
	img, err := loadImageFile(filePath)
	if err != nil {
		return PaletteReport{}, fmt.Errorf("read image %q: %w", filePath, err)
	}
	ramps, err := ExtractPaletteRamps(img, maxRamps)
	if err != nil {
		return PaletteReport{}, err
	}

	outRamps := make([]PaletteRamp, 0, len(ramps))
	var dslLines []string
	dslLines = append(dslLines, fmt.Sprintf("// Extracted %d material ramps from %s", len(ramps), filepath.Base(filePath)))
	for _, r := range ramps {
		outRamps = append(outRamps, PaletteRamp{
			Name:  r.Name,
			Steps: []string{r.Steps[0], r.Steps[1], r.Steps[2], r.Steps[3]},
		})
		dslLines = append(dslLines, fmt.Sprintf("ramp %-10s %s %s %s %s", r.Name, r.Steps[0], r.Steps[1], r.Steps[2], r.Steps[3]))
	}

	return PaletteReport{
		FilePath: filePath,
		Ramps:    outRamps,
		DSL:      strings.Join(dslLines, "\n"),
	}, nil
}
