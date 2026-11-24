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

package media

import (
	"context"
	"encoding/base64"
	"fmt"
	"strings"

	"google.golang.org/genai"
	"google.golang.org/genai/interactions/models/interactions"
	"google.golang.org/genai/interactions/models/operations"
)

const (
	defaultMusicModel   = "lyria-3.5"
	modelLyria35        = "lyria-3.5"
	modelLyria3Clip     = "lyria-3-clip-preview"
	modelLyria3Pro      = "lyria-3-pro-preview"
	maxMusicInputImages = 10
)

var musicModelMap = map[string]string{
	"lyria-3.5":            modelLyria35,
	"3.5":                  modelLyria35,
	"lyria-3-clip":         modelLyria3Clip,
	"lyria-3-clip-preview": modelLyria3Clip,
	"clip":                 modelLyria3Clip,
	"lyria-clip":           modelLyria3Clip,
	"lyria-3-pro":          modelLyria3Pro,
	"lyria-3-pro-preview":  modelLyria3Pro,
	"pro":                  modelLyria3Pro,
	"lyria-pro":            modelLyria3Pro,
}

var retiredMusicModels = map[string]bool{
	"lyria-002":          true,
	"lyria-realtime-exp": true,
}

// MusicOptions configures a Lyria music generation request.
type MusicOptions struct {
	Prompt        string
	Model         string
	Format        string
	APIMode       string
	InputImages   []string
	OutPath       string
	OutLyricsPath string
	Auth          AuthOptions
}

// MusicGenerateReport is the structured result returned by music_generate.
type MusicGenerateReport struct {
	OutPath       string `json:"outPath"`
	OutLyricsPath string `json:"outLyricsPath,omitempty"`
	Model         string `json:"model"`
	APIMode       string `json:"apiMode"`
	Format        string `json:"format"`
	MIMEType      string `json:"mimeType"`
	BytesWritten  int    `json:"bytesWritten"`
	Lyrics        string `json:"lyrics,omitempty"`
}

type validatedMusicConfig struct {
	prompt      string
	modelID     string
	audioFormat string
	apiMode     string
	inputMIMEs  []string
}

func resolveMusicModel(modelArg string) (string, error) {
	normalized := strings.TrimSpace(modelArg)
	if normalized == "" {
		normalized = defaultMusicModel
	}
	if retiredMusicModels[normalized] {
		return "", fmt.Errorf("legacy or retired model %q is not supported; use 'lyria-3.5', 'lyria-3-clip-preview', or 'lyria-3-pro-preview'", normalized)
	}
	canonical, ok := musicModelMap[normalized]
	if !ok {
		return "", fmt.Errorf("unsupported model %q (valid choices: lyria-3.5, lyria-3-clip-preview, lyria-3-pro-preview)", normalized)
	}
	return canonical, nil
}

func resolveAudioFormat(outPath, explicitFormat, modelID, apiMode string) (string, error) {
	lowerName := strings.ToLower(strings.TrimSpace(outPath))
	explicit := strings.TrimSpace(explicitFormat)

	var resolved string
	if explicit == "" {
		if strings.HasSuffix(lowerName, ".wav") {
			resolved = "wav"
		} else {
			resolved = "mp3"
		}
	} else {
		switch explicit {
		case "mp3", "wav":
			resolved = explicit
		default:
			return "", fmt.Errorf("unsupported format %q (valid choices: mp3, wav)", explicitFormat)
		}
		if explicit == "mp3" && strings.HasSuffix(lowerName, ".wav") {
			return "", fmt.Errorf("output filename %q ends with '.wav' but format 'mp3' was explicitly requested; omit format or use a '.mp3' filename", outPath)
		}
		if explicit == "wav" && strings.HasSuffix(lowerName, ".mp3") {
			return "", fmt.Errorf("output filename %q ends with '.mp3' but format 'wav' was explicitly requested; use a '.wav' filename or pass format 'mp3'", outPath)
		}
	}

	if resolved == "wav" && modelID != modelLyria35 {
		return "", fmt.Errorf("WAV output is only supported on 'lyria-3.5', not %q (%q outputs MP3 audio only)", modelID, modelID)
	}
	if resolved == "wav" && apiMode == "models" {
		return "", fmt.Errorf("WAV output via response_format requires apiMode 'interactions' (not 'models')")
	}
	return resolved, nil
}

func validateMusicOptions(opts MusicOptions) (validatedMusicConfig, error) {
	prompt := strings.TrimSpace(opts.Prompt)
	if prompt == "" {
		return validatedMusicConfig{}, fmt.Errorf("prompt is required")
	}
	if strings.TrimSpace(opts.OutPath) == "" {
		return validatedMusicConfig{}, fmt.Errorf("outPath is required")
	}

	modelID, err := resolveMusicModel(opts.Model)
	if err != nil {
		return validatedMusicConfig{}, err
	}

	apiMode, err := normalizeAPIMode(opts.APIMode)
	if err != nil {
		return validatedMusicConfig{}, err
	}

	inputMIMEs, err := validateInputImagePaths(opts.InputImages, maxMusicInputImages, "input images for Lyria 3")
	if err != nil {
		return validatedMusicConfig{}, err
	}

	audioFormat, err := resolveAudioFormat(opts.OutPath, opts.Format, modelID, apiMode)
	if err != nil {
		return validatedMusicConfig{}, err
	}

	return validatedMusicConfig{
		prompt:      prompt,
		modelID:     modelID,
		audioFormat: audioFormat,
		apiMode:     apiMode,
		inputMIMEs:  inputMIMEs,
	}, nil
}

// GenerateMusic validates arguments, authenticates against Google Gen AI, generates
// music via Lyria 3 models, writes audio (and optional lyrics) to disk, and returns a report.
func GenerateMusic(ctx context.Context, opts MusicOptions) (MusicGenerateReport, error) {
	cfg, err := validateMusicOptions(opts)
	if err != nil {
		return MusicGenerateReport{}, err
	}

	client, err := NewClient(ctx, opts.Auth)
	if err != nil {
		return MusicGenerateReport{}, err
	}

	images, err := loadInputImages(opts.InputImages, cfg.inputMIMEs)
	if err != nil {
		return MusicGenerateReport{}, err
	}

	var audioBytes []byte
	var mimeType string
	var lyrics string

	if cfg.apiMode == "interactions" {
		audioBytes, mimeType, lyrics, err = generateMusicInteractions(ctx, client, cfg, images)
	} else {
		audioBytes, mimeType, lyrics, err = generateMusicModels(ctx, client, cfg, images)
	}
	if err != nil {
		return MusicGenerateReport{}, err
	}
	if len(audioBytes) == 0 {
		return MusicGenerateReport{}, fmt.Errorf("no audio data returned from Lyria 3 model %s", cfg.modelID)
	}

	if mimeType == "" {
		if cfg.audioFormat == "wav" {
			mimeType = string(interactions.AudioResponseFormatMimeTypeAudioWav)
		} else {
			mimeType = string(interactions.AudioResponseFormatMimeTypeAudioMp3)
		}
	}

	if err := writeOutputFile(opts.OutPath, audioBytes); err != nil {
		return MusicGenerateReport{}, err
	}

	outLyricsPath := ""
	if lyrics != "" && strings.TrimSpace(opts.OutLyricsPath) != "" {
		if err := writeOutputFile(opts.OutLyricsPath, []byte(lyrics)); err != nil {
			return MusicGenerateReport{}, err
		}
		outLyricsPath = opts.OutLyricsPath
	}

	return MusicGenerateReport{
		OutPath:       opts.OutPath,
		OutLyricsPath: outLyricsPath,
		Model:         cfg.modelID,
		APIMode:       cfg.apiMode,
		Format:        cfg.audioFormat,
		MIMEType:      mimeType,
		BytesWritten:  len(audioBytes),
		Lyrics:        lyrics,
	}, nil
}

func generateMusicInteractions(ctx context.Context, client *genai.Client, cfg validatedMusicConfig, images []inputImageData) ([]byte, string, string, error) {
	input := buildInteractionsInput(cfg.prompt, images, true)

	var rfPtr *interactions.CreateModelInteractionResponseFormat
	if cfg.audioFormat == "wav" {
		mimeWav := interactions.AudioResponseFormatMimeTypeAudioWav
		rf := interactions.NewCreateModelInteractionResponseFormat(
			interactions.NewResponseFormat(interactions.AudioResponseFormat{
				MimeType: &mimeWav,
			}),
		)
		rfPtr = &rf
	}

	res, err := client.Interactions.Create(ctx, operations.CreateInteractionRequest{
		Body: operations.NewCreateInteractionRequestBody(interactions.CreateModelInteraction{
			Model:          interactions.Model(cfg.modelID),
			Input:          &input,
			ResponseFormat: rfPtr,
		}),
	})
	if err != nil {
		return nil, "", "", wrapAPIError("generating music", cfg.modelID, err)
	}
	if err := checkInteractionResponse(res.Interaction); err != nil {
		return nil, "", "", err
	}

	inter := res.Interaction
	audioBytes, mimeType, err := extractInteractionAudio(inter, cfg.modelID)
	if err != nil {
		return nil, "", "", err
	}
	lyrics := extractInteractionText(inter)
	return audioBytes, mimeType, lyrics, nil
}

func extractInteractionAudio(inter *interactions.Interaction, modelID string) ([]byte, string, error) {
	var encoded string
	var mimeType string

	if inter.OutputAudio != nil && inter.OutputAudio.Data != nil && strings.TrimSpace(*inter.OutputAudio.Data) != "" {
		encoded = *inter.OutputAudio.Data
		if inter.OutputAudio.MimeType != nil {
			mimeType = string(*inter.OutputAudio.MimeType)
		}
	} else {
		for _, step := range inter.Steps {
			if step.Type != interactions.StepTypeModelOutput || step.ModelOutputStep == nil {
				continue
			}
			for _, block := range step.ModelOutputStep.Content {
				if block.Type == interactions.ContentTypeAudio && block.AudioContent != nil && block.AudioContent.Data != nil && strings.TrimSpace(*block.AudioContent.Data) != "" {
					encoded = *block.AudioContent.Data
					if block.AudioContent.MimeType != nil {
						mimeType = string(*block.AudioContent.MimeType)
					}
					break
				}
			}
			if encoded != "" {
				break
			}
		}
	}

	if encoded == "" {
		return nil, "", fmt.Errorf("no audio data returned from Lyria 3 model %s", modelID)
	}
	decoded, err := base64.StdEncoding.DecodeString(strings.TrimSpace(encoded))
	if err != nil {
		return nil, "", fmt.Errorf("decode base64 audio from Interactions API response: %w", err)
	}
	return decoded, mimeType, nil
}

func generateMusicModels(ctx context.Context, client *genai.Client, cfg validatedMusicConfig, images []inputImageData) ([]byte, string, string, error) {
	contents := buildModelsContents(cfg.prompt, images, true)
	genCfg := &genai.GenerateContentConfig{
		ResponseModalities: []string{"AUDIO", "TEXT"},
	}

	resp, err := client.Models.GenerateContent(ctx, cfg.modelID, contents, genCfg)
	if err != nil {
		return nil, "", "", wrapAPIError("generating music", cfg.modelID, err)
	}

	var audioBytes []byte
	var mimeType string
	var lyricsParts []string

	if resp != nil && len(resp.Candidates) > 0 && resp.Candidates[0] != nil && resp.Candidates[0].Content != nil {
		for _, part := range resp.Candidates[0].Content.Parts {
			if part == nil || part.Thought {
				continue
			}
			if len(audioBytes) == 0 && part.InlineData != nil && len(part.InlineData.Data) > 0 {
				audioBytes = part.InlineData.Data
				mimeType = part.InlineData.MIMEType
			} else if part.Text != "" {
				lyricsParts = append(lyricsParts, part.Text)
			}
		}
	}

	if len(audioBytes) == 0 {
		return nil, "", "", fmt.Errorf("no audio data returned from Lyria 3 model %s", cfg.modelID)
	}
	return audioBytes, mimeType, strings.Join(lyricsParts, "\n"), nil
}
