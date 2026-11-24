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
	"context"
	"strings"

	"github.com/danicat/agy-game-studio/mcp/media"
	"github.com/danicat/agy-game-studio/mcp/music"
	"github.com/danicat/agy-game-studio/mcp/sfx"
	"github.com/danicat/agy-game-studio/mcp/sprite"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// SoundPresetsInput accepts no required arguments.
type SoundPresetsInput struct{}

// SoundPresetsOutput bundles both SFX and music preset catalogs.
type SoundPresetsOutput struct {
	SFXPresets   []sfx.PresetInfo     `json:"sfxPresets"`
	MusicPresets music.PresetsCatalog `json:"musicPresets"`
}

// MusicSynthesizeInput defines arguments for the music_synthesize tool.
type MusicSynthesizeInput struct {
	DSL          string   `json:"dsl,omitempty" jsonschema:"Inline .music DSL text"`
	FilePath     string   `json:"filePath,omitempty" jsonschema:"Path to a .music file on disk used when dsl is omitted"`
	Apple        bool     `json:"apple,omitempty" jsonschema:"Render using macOS Apple CoreAudio real instruments"`
	SoloTracks   []string `json:"soloTracks,omitempty" jsonschema:"Optional list of track names to solo in the mixed output"`
	MuteTracks   []string `json:"muteTracks,omitempty" jsonschema:"Optional list of track names to mute in the mixed output"`
	OutWavPath   string   `json:"outWavPath,omitempty" jsonschema:"Optional output path to write the synthesized 16-bit 44.1 kHz stereo WAV file"`
	OutStemsPath string   `json:"outStemsPath,omitempty" jsonschema:"Optional output path to write the packed binary per-track stems file"`
}

// MusicValidateInput defines arguments for the music_validate tool.
type MusicValidateInput struct {
	DSL            string  `json:"dsl,omitempty" jsonschema:"Inline .music DSL text"`
	FilePath       string  `json:"filePath,omitempty" jsonschema:"Path to a .music file on disk used when dsl is omitted"`
	MinChannels    int     `json:"minChannels,omitempty" jsonschema:"Minimum required channels for production BGM (default 8)"`
	MinDurationSec float64 `json:"minDurationSec,omitempty" jsonschema:"Minimum required duration in seconds for production BGM (default 30)"`
}

// SFXSynthesizeInput defines arguments for the sfx_synthesize tool.
type SFXSynthesizeInput struct {
	DSL        string `json:"dsl,omitempty" jsonschema:"Inline .sfx DSL text"`
	FilePath   string `json:"filePath,omitempty" jsonschema:"Path to a .sfx file on disk used when dsl is omitted"`
	OutWavPath string `json:"outWavPath,omitempty" jsonschema:"Optional output path to write the synthesized 16-bit 44.1 kHz stereo WAV file"`
}

// SpriteInspectInput defines arguments for the sprite_inspect tool.
type SpriteInspectInput struct {
	FilePath    string `json:"filePath" jsonschema:"Path to a .sprite, .aseprite, .ase, or .png sprite file"`
	FrameWidth  int    `json:"frameWidth,omitempty" jsonschema:"Optional explicit frame width in pixels"`
	FrameHeight int    `json:"frameHeight,omitempty" jsonschema:"Optional explicit frame height in pixels"`
	Cols        int    `json:"cols,omitempty" jsonschema:"Optional explicit grid column count"`
	Rows        int    `json:"rows,omitempty" jsonschema:"Optional explicit grid row count"`
	JsonPath    string `json:"jsonPath,omitempty" jsonschema:"Optional companion Aseprite JSON manifest path"`
	OutPngPath  string `json:"outPngPath,omitempty" jsonschema:"Optional output path to export the rendered PNG sprite sheet"`
}

// SpriteCompileInput defines arguments for the sprite_compile tool.
type SpriteCompileInput struct {
	DSL             string `json:"dsl,omitempty" jsonschema:"Inline .sprite DSL text"`
	FilePath        string `json:"filePath,omitempty" jsonschema:"Path to a .sprite file on disk or reference file providing base directory when dsl is inline"`
	BaseDir         string `json:"baseDir,omitempty" jsonschema:"Optional base directory for resolving relative sheet paths when dsl is inline"`
	OutPngPath      string `json:"outPngPath,omitempty" jsonschema:"Optional output path to write the packed PNG sprite sheet"`
	OutJsonPath     string `json:"outJsonPath,omitempty" jsonschema:"Optional output path to write an Aseprite-compatible JSON manifest"`
	OutAsepritePath string `json:"outAsepritePath,omitempty" jsonschema:"Optional output path to write a binary .aseprite file"`
	OutPreviewPath  string `json:"outPreviewPath,omitempty" jsonschema:"Optional output path to write a magnified nearest-neighbor preview PNG"`
	OutGifDir       string `json:"outGifDir,omitempty" jsonschema:"Optional output directory for per-tag animated GIF motion previews"`
	GifPrefix       string `json:"gifPrefix,omitempty" jsonschema:"Optional filename prefix for exported GIF previews"`
	Scale           int    `json:"scale,omitempty" jsonschema:"Magnification scale for preview and GIF exports (1 to 16)"`
}

// SpriteNormalizeInput defines arguments for the sprite_normalize tool.
type SpriteNormalizeInput struct {
	FilePath        string   `json:"filePath,omitempty" jsonschema:"Single input sprite sheet PNG path"`
	FilePaths       []string `json:"filePaths,omitempty" jsonschema:"One or more input sprite sheet PNG paths to stitch and normalize"`
	FrameWidth      int      `json:"frameWidth,omitempty" jsonschema:"Target frame width in pixels"`
	FrameHeight     int      `json:"frameHeight,omitempty" jsonschema:"Target frame height in pixels"`
	Cols            int      `json:"cols,omitempty" jsonschema:"Grid columns in each input image"`
	Rows            int      `json:"rows,omitempty" jsonschema:"Grid rows in each input image"`
	Tolerance       *int     `json:"tolerance,omitempty" jsonschema:"Background color key Manhattan tolerance (0 to 255, default 18)"`
	Center          *bool    `json:"center,omitempty" jsonschema:"Auto-center each frame horizontally (default true)"`
	Ground          *bool    `json:"ground,omitempty" jsonschema:"Ground each frame bottom edge to frameHeight minus pad (default false)"`
	Pad             *int     `json:"pad,omitempty" jsonschema:"Bottom padding in pixels when ground is true (default 2)"`
	DurationMs      int      `json:"durationMs,omitempty" jsonschema:"Default frame duration in milliseconds (default 100)"`
	Tags            []string `json:"tags,omitempty" jsonschema:"Animation tag specs formatted as name:from:to[:duration_ms[:loop]]"`
	OutPngPath      string   `json:"outPngPath,omitempty" jsonschema:"Optional output path for the normalized PNG sprite sheet"`
	OutJsonPath     string   `json:"outJsonPath,omitempty" jsonschema:"Optional output path for the Aseprite JSON manifest"`
	OutSpritePath   string   `json:"outSpritePath,omitempty" jsonschema:"Optional output path for the generated .sprite container file"`
	OutAsepritePath string   `json:"outAsepritePath,omitempty" jsonschema:"Optional output path for the binary .aseprite file"`
	OutPreviewPath  string   `json:"outPreviewPath,omitempty" jsonschema:"Optional output path for a magnified preview PNG"`
	OutGifDir       string   `json:"outGifDir,omitempty" jsonschema:"Optional output directory for per-tag animated GIF motion previews"`
	GifPrefix       string   `json:"gifPrefix,omitempty" jsonschema:"Optional filename prefix for exported GIF previews"`
	Scale           int      `json:"scale,omitempty" jsonschema:"Magnification scale for preview and GIF exports"`
}

// SpriteExtractPaletteInput defines arguments for the sprite_extract_palette tool.
type SpriteExtractPaletteInput struct {
	FilePath string `json:"filePath" jsonschema:"Path to a reference PNG or JPEG character sheet image"`
	NumRamps int    `json:"numRamps,omitempty" jsonschema:"Maximum number of 4-step material ramps to extract (1 to 12, default 4)"`
}

// ImageGenerateInput defines arguments for the image_generate tool.
type ImageGenerateInput struct {
	Prompt        string   `json:"prompt" jsonschema:"Text prompt describing the image to generate or edit"`
	Model         string   `json:"model,omitempty" jsonschema:"Image model ID or alias such as nano-banana-2.1 (default), nano-banana-2, nano-banana-2-lite, or nano-banana-pro"`
	AspectRatio   string   `json:"aspectRatio,omitempty" jsonschema:"Output aspect ratio (1:1 default, 1:4, 1:8, 2:3, 3:2, 3:4, 4:1, 4:3, 4:5, 5:4, 8:1, 9:16, 16:9, or 21:9)"`
	Resolution    string   `json:"resolution,omitempty" jsonschema:"Output image resolution (512px on nano-banana-2 only, 1K default, 2K, or 4K)"`
	APIMode       string   `json:"apiMode,omitempty" jsonschema:"API transport mode (interactions by default, or models)"`
	InputImages   []string `json:"inputImages,omitempty" jsonschema:"Optional list of up to 14 local reference image paths (.png, .jpg, .jpeg, .webp, .heic, or .heif)"`
	ThinkingLevel string   `json:"thinkingLevel,omitempty" jsonschema:"Optional thinking depth (minimal, medium on nano-banana-2.1 only, or high)"`
	Search        bool     `json:"search,omitempty" jsonschema:"Enable Google Web Search grounding (unsupported on nano-banana-2-lite)"`
	ImageSearch   bool     `json:"imageSearch,omitempty" jsonschema:"Enable Google Web and Image Search grounding (nano-banana-2.1 and nano-banana-2 only)"`
	OutPath       string   `json:"outPath" jsonschema:"Output file path where the generated image will be written"`
	Enterprise    bool     `json:"enterprise,omitempty" jsonschema:"Force Vertex AI or Gemini Enterprise Application Default Credentials"`
	Project       string   `json:"project,omitempty" jsonschema:"Optional Google Cloud project ID for Vertex AI or Gemini Enterprise"`
	Location      string   `json:"location,omitempty" jsonschema:"Optional Google Cloud location for Vertex AI or Gemini Enterprise (defaults to global)"`
}

// MusicGenerateInput defines arguments for the music_generate tool.
type MusicGenerateInput struct {
	Prompt        string   `json:"prompt" jsonschema:"Text prompt describing the music style, instruments, tempo, key, structure, and optional lyrics"`
	Model         string   `json:"model,omitempty" jsonschema:"Music model ID or alias such as lyria-3.5 (default), lyria-3-clip-preview, or lyria-3-pro-preview"`
	Format        string   `json:"format,omitempty" jsonschema:"Audio container format (mp3 or wav; inferred from outPath extension when omitted; wav requires lyria-3.5 and interactions mode)"`
	APIMode       string   `json:"apiMode,omitempty" jsonschema:"API transport mode (interactions by default, or models)"`
	InputImages   []string `json:"inputImages,omitempty" jsonschema:"Optional list of up to 10 local reference image paths for visual mood inspiration"`
	OutPath       string   `json:"outPath" jsonschema:"Output audio file path where the generated music will be written"`
	OutLyricsPath string   `json:"outLyricsPath,omitempty" jsonschema:"Optional file path to save generated lyrics and song structure text"`
	Enterprise    bool     `json:"enterprise,omitempty" jsonschema:"Force Vertex AI or Gemini Enterprise Application Default Credentials"`
	Project       string   `json:"project,omitempty" jsonschema:"Optional Google Cloud project ID for Vertex AI or Gemini Enterprise"`
	Location      string   `json:"location,omitempty" jsonschema:"Optional Google Cloud location for Vertex AI or Gemini Enterprise (defaults to global)"`
}

// NewServer constructs the Game Studio MCP server and registers all audio, sprite, and generative media tools.
func NewServer() *mcp.Server {
	server := mcp.NewServer(&mcp.Implementation{
		Name:    "agy-game-studio",
		Version: "0.4.0",
	}, nil)

	mcp.AddTool(server, &mcp.Tool{
		Name:        "sound_presets",
		Description: "List built-in SFX archetype presets, music wave types, YM2612 FM patches, and classical tempo markings",
	}, handleSoundPresets)

	mcp.AddTool(server, &mcp.Tool{
		Name:        "music_synthesize",
		Description: "Synthesize and analyze a .music DSL score to 16-bit 44.1 kHz stereo WAV and optional per-track binary stems",
	}, handleMusicSynthesize)

	mcp.AddTool(server, &mcp.Tool{
		Name:        "music_validate",
		Description: "Validate a .music DSL score against production BGM music theory, consonance, drift, channel count, and duration rules",
	}, handleMusicValidate)

	mcp.AddTool(server, &mcp.Tool{
		Name:        "sfx_synthesize",
		Description: "Synthesize and validate a .sfx DSL sound effect cue to 16-bit 44.1 kHz stereo WAV",
	}, handleSFXSynthesize)

	mcp.AddTool(server, &mcp.Tool{
		Name:        "sprite_inspect",
		Description: "Inspect a .sprite container, binary .aseprite/.ase file, or .png sprite sheet and optionally export a rendered PNG",
	}, handleSpriteInspect)

	mcp.AddTool(server, &mcp.Tool{
		Name:        "sprite_compile",
		Description: "Compile a .sprite DSL specification and optionally export packed PNG sheets, Aseprite binaries, JSON manifests, previews, and GIFs",
	}, handleSpriteCompile)

	mcp.AddTool(server, &mcp.Tool{
		Name:        "sprite_normalize",
		Description: "Strip chroma-key backgrounds, center and ground frames, and export normalized PNG, JSON, .sprite, .aseprite, and GIF sprite sheets",
	}, handleSpriteNormalize)

	mcp.AddTool(server, &mcp.Tool{
		Name:        "sprite_extract_palette",
		Description: "Extract 4-step material shading ramps from a reference character sheet image as .sprite DSL ramp directives",
	}, handleSpriteExtractPalette)

	mcp.AddTool(server, &mcp.Tool{
		Name:        "image_generate",
		Description: "Generate or edit game images, character sheets, and chroma-key sprite grids using Google Nano Banana models",
	}, handleImageGenerate)

	mcp.AddTool(server, &mcp.Tool{
		Name:        "music_generate",
		Description: "Generate 44.1 kHz stereo songs, instrumental loops, and soundtracks using Google Lyria 3 models",
	}, handleMusicGenerate)

	return server
}

func handleSoundPresets(_ context.Context, _ *mcp.CallToolRequest, _ SoundPresetsInput) (*mcp.CallToolResult, SoundPresetsOutput, error) {
	sfxCatalog := sfx.BuildPresetsCatalog()
	if sfxCatalog == nil {
		sfxCatalog = []sfx.PresetInfo{}
	}
	return nil, SoundPresetsOutput{
		SFXPresets:   sfxCatalog,
		MusicPresets: music.BuildPresetsCatalog(),
	}, nil
}

func handleMusicSynthesize(_ context.Context, _ *mcp.CallToolRequest, in MusicSynthesizeInput) (*mcp.CallToolResult, music.SynthReport, error) {
	rep := music.Synthesize(music.SynthesizeOptions{
		DSL:          in.DSL,
		FilePath:     in.FilePath,
		Apple:        in.Apple,
		SoloTracks:   in.SoloTracks,
		MuteTracks:   in.MuteTracks,
		OutWavPath:   in.OutWavPath,
		OutStemsPath: in.OutStemsPath,
	})
	return nil, rep, nil
}

func handleMusicValidate(_ context.Context, _ *mcp.CallToolRequest, in MusicValidateInput) (*mcp.CallToolResult, music.ValidateReport, error) {
	rep := music.Validate(in.DSL, in.FilePath, in.MinChannels, in.MinDurationSec)
	return nil, rep, nil
}

func handleSFXSynthesize(_ context.Context, _ *mcp.CallToolRequest, in SFXSynthesizeInput) (*mcp.CallToolResult, sfx.SynthReport, error) {
	rep := sfx.Synthesize(sfx.SynthesizeOptions{
		DSL:        in.DSL,
		FilePath:   in.FilePath,
		OutWavPath: in.OutWavPath,
	})
	return nil, rep, nil
}

func handleSpriteInspect(_ context.Context, _ *mcp.CallToolRequest, in SpriteInspectInput) (*mcp.CallToolResult, sprite.SynthReport, error) {
	rep, err := sprite.Inspect(sprite.InspectOptions{
		FilePath:    in.FilePath,
		FrameWidth:  in.FrameWidth,
		FrameHeight: in.FrameHeight,
		Cols:        in.Cols,
		Rows:        in.Rows,
		JsonPath:    in.JsonPath,
		OutPngPath:  in.OutPngPath,
	})
	if err != nil {
		return nil, sprite.SynthReport{}, err
	}
	return nil, rep, nil
}

func handleSpriteCompile(_ context.Context, _ *mcp.CallToolRequest, in SpriteCompileInput) (*mcp.CallToolResult, sprite.SynthReport, error) {
	rep, err := sprite.Compile(sprite.CompileOptions{
		DSL:             in.DSL,
		FilePath:        in.FilePath,
		BaseDir:         in.BaseDir,
		OutPngPath:      in.OutPngPath,
		OutJsonPath:     in.OutJsonPath,
		OutAsepritePath: in.OutAsepritePath,
		OutPreviewPath:  in.OutPreviewPath,
		OutGifDir:       in.OutGifDir,
		GifPrefix:       in.GifPrefix,
		Scale:           in.Scale,
	})
	if err != nil {
		return nil, sprite.SynthReport{}, err
	}
	return nil, rep, nil
}

func handleSpriteNormalize(_ context.Context, _ *mcp.CallToolRequest, in SpriteNormalizeInput) (*mcp.CallToolResult, sprite.SynthReport, error) {
	filePaths := make([]string, 0, len(in.FilePaths)+1)
	for _, p := range in.FilePaths {
		if trimmed := strings.TrimSpace(p); trimmed != "" {
			filePaths = append(filePaths, trimmed)
		}
	}
	if len(filePaths) == 0 && strings.TrimSpace(in.FilePath) != "" {
		filePaths = append(filePaths, strings.TrimSpace(in.FilePath))
	}

	center := true
	if in.Center != nil {
		center = *in.Center
	}
	ground := false
	if in.Ground != nil {
		ground = *in.Ground
	}
	var tol int
	var hasTol bool
	if in.Tolerance != nil {
		tol = *in.Tolerance
		hasTol = true
	}
	var pad int
	var hasPad bool
	if in.Pad != nil {
		pad = *in.Pad
		hasPad = true
	}

	rep, err := sprite.Normalize(sprite.NormalizeOptionsInput{
		FilePaths:       filePaths,
		FrameWidth:      in.FrameWidth,
		FrameHeight:     in.FrameHeight,
		Cols:            in.Cols,
		Rows:            in.Rows,
		Tolerance:       tol,
		HasTolerance:    hasTol,
		Center:          center,
		Ground:          ground,
		Pad:             pad,
		HasPad:          hasPad,
		DurationMs:      in.DurationMs,
		Tags:            in.Tags,
		OutPngPath:      in.OutPngPath,
		OutJsonPath:     in.OutJsonPath,
		OutSpritePath:   in.OutSpritePath,
		OutAsepritePath: in.OutAsepritePath,
		OutPreviewPath:  in.OutPreviewPath,
		OutGifDir:       in.OutGifDir,
		GifPrefix:       in.GifPrefix,
		Scale:           in.Scale,
	})
	if err != nil {
		return nil, sprite.SynthReport{}, err
	}
	return nil, rep, nil
}

func handleSpriteExtractPalette(_ context.Context, _ *mcp.CallToolRequest, in SpriteExtractPaletteInput) (*mcp.CallToolResult, sprite.PaletteReport, error) {
	rep, err := sprite.ExtractPalette(in.FilePath, in.NumRamps)
	if err != nil {
		return nil, sprite.PaletteReport{}, err
	}
	return nil, rep, nil
}

func handleImageGenerate(ctx context.Context, _ *mcp.CallToolRequest, in ImageGenerateInput) (*mcp.CallToolResult, media.ImageGenerateReport, error) {
	rep, err := media.GenerateImage(ctx, media.ImageOptions{
		Prompt:        in.Prompt,
		Model:         in.Model,
		AspectRatio:   in.AspectRatio,
		Resolution:    in.Resolution,
		APIMode:       in.APIMode,
		InputImages:   in.InputImages,
		ThinkingLevel: in.ThinkingLevel,
		Search:        in.Search,
		ImageSearch:   in.ImageSearch,
		OutPath:       in.OutPath,
		Auth: media.AuthOptions{
			Enterprise: in.Enterprise,
			Project:    in.Project,
			Location:   in.Location,
		},
	})
	if err != nil {
		return nil, media.ImageGenerateReport{GroundingSources: make([]string, 0)}, err
	}
	return nil, rep, nil
}

func handleMusicGenerate(ctx context.Context, _ *mcp.CallToolRequest, in MusicGenerateInput) (*mcp.CallToolResult, media.MusicGenerateReport, error) {
	rep, err := media.GenerateMusic(ctx, media.MusicOptions{
		Prompt:        in.Prompt,
		Model:         in.Model,
		Format:        in.Format,
		APIMode:       in.APIMode,
		InputImages:   in.InputImages,
		OutPath:       in.OutPath,
		OutLyricsPath: in.OutLyricsPath,
		Auth: media.AuthOptions{
			Enterprise: in.Enterprise,
			Project:    in.Project,
			Location:   in.Location,
		},
	})
	if err != nil {
		return nil, media.MusicGenerateReport{}, err
	}
	return nil, rep, nil
}
