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
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"net/http"
	"strings"

	"google.golang.org/genai"
	"google.golang.org/genai/interactions/models/interactions"
	"google.golang.org/genai/interactions/models/operations"
)

const (
	defaultImageModelAlias = "nano-banana-2.1"
	modelNanoBanana21      = "gemini-nano-banana-2.1"
	modelNanoBanana2       = "gemini-3.1-flash-image"
	modelNanoBanana2Lite   = "gemini-3.1-flash-lite-image"
	modelNanoBananaPro     = "gemini-3-pro-image"
	maxImageInputImages    = 14
)

var imageModelMap = map[string]string{
	"nano-banana-2.1":             modelNanoBanana21,
	"nano-banana-2-1":             modelNanoBanana21,
	"nano-banana-2":               modelNanoBanana2,
	"nano-banana-2-lite":          modelNanoBanana2Lite,
	"nano-banana-lite":            modelNanoBanana2Lite,
	"nano-banana-pro":             modelNanoBananaPro,
	"gemini-nano-banana-2.1":      modelNanoBanana21,
	"gemini-3.1-flash-image":      modelNanoBanana2,
	"gemini-3.1-flash-lite-image": modelNanoBanana2Lite,
	"gemini-3-pro-image":          modelNanoBananaPro,
}

var validAspectRatios = map[string]bool{
	"1:1": true, "1:4": true, "1:8": true, "2:3": true, "3:2": true,
	"3:4": true, "4:1": true, "4:3": true, "4:5": true, "5:4": true,
	"8:1": true, "9:16": true, "16:9": true, "21:9": true,
}

var extendedAspectRatios = map[string]bool{
	"1:4": true, "4:1": true, "1:8": true, "8:1": true,
}

// ImageOptions configures a Nano Banana image generation or editing request.
type ImageOptions struct {
	Prompt        string
	Model         string
	AspectRatio   string
	Resolution    string
	APIMode       string
	InputImages   []string
	ThinkingLevel string
	Search        bool
	ImageSearch   bool
	OutPath       string
	Auth          AuthOptions
}

// ImageGenerateReport is the structured result returned by image_generate.
type ImageGenerateReport struct {
	OutPath          string   `json:"outPath"`
	Model            string   `json:"model"`
	APIMode          string   `json:"apiMode"`
	MIMEType         string   `json:"mimeType"`
	BytesWritten     int      `json:"bytesWritten"`
	Width            int      `json:"width"`
	Height           int      `json:"height"`
	Text             string   `json:"text,omitempty"`
	GroundingSources []string `json:"groundingSources"`
}

type validatedImageConfig struct {
	prompt        string
	modelID       string
	aspectRatio   string
	imageSize     string
	apiMode       string
	thinkingLevel string
	inputMIMEs    []string
}

func resolveImageModel(modelArg string) (string, error) {
	normalized := strings.TrimSpace(modelArg)
	if normalized == "" {
		normalized = defaultImageModelAlias
	}
	if strings.HasPrefix(normalized, "imagen-") {
		return "", fmt.Errorf("retired Imagen model %q shut down on August 17, 2026; migrate to 'nano-banana-2.1' (gemini-nano-banana-2.1) or 'nano-banana-pro' (gemini-3-pro-image)", normalized)
	}
	if normalized == "nano-banana" || normalized == "gemini-2.5-flash-image" || strings.HasSuffix(normalized, "-preview") {
		return "", fmt.Errorf("legacy or retired model %q is not supported; migrate to 'nano-banana-2.1' (gemini-nano-banana-2.1) or 'nano-banana-2-lite' (gemini-3.1-flash-lite-image)", normalized)
	}
	canonical, ok := imageModelMap[normalized]
	if !ok {
		return "", fmt.Errorf("unsupported model %q (valid choices: nano-banana-2.1, nano-banana-2, nano-banana-2-lite, nano-banana-pro)", normalized)
	}
	return canonical, nil
}

func validateImageOptions(opts ImageOptions) (validatedImageConfig, error) {
	prompt := strings.TrimSpace(opts.Prompt)
	if prompt == "" {
		return validatedImageConfig{}, fmt.Errorf("prompt is required")
	}
	if strings.TrimSpace(opts.OutPath) == "" {
		return validatedImageConfig{}, fmt.Errorf("outPath is required")
	}

	modelID, err := resolveImageModel(opts.Model)
	if err != nil {
		return validatedImageConfig{}, err
	}

	apiMode, err := normalizeAPIMode(opts.APIMode)
	if err != nil {
		return validatedImageConfig{}, err
	}

	aspectRatio := strings.TrimSpace(opts.AspectRatio)
	if aspectRatio == "" {
		aspectRatio = "1:1"
	}
	if !validAspectRatios[aspectRatio] {
		return validatedImageConfig{}, fmt.Errorf("unsupported aspectRatio %q (supported: 1:1, 1:4, 1:8, 2:3, 3:2, 3:4, 4:1, 4:3, 4:5, 5:4, 8:1, 9:16, 16:9, 21:9)", aspectRatio)
	}
	if extendedAspectRatios[aspectRatio] && modelID == modelNanoBananaPro {
		return validatedImageConfig{}, fmt.Errorf("aspectRatio %q is only supported by 'nano-banana-2.1', 'nano-banana-2', and 'nano-banana-2-lite'", aspectRatio)
	}

	rawRes := strings.TrimSpace(opts.Resolution)
	if rawRes == "" {
		rawRes = "1K"
	}
	imageSize := rawRes
	if rawRes == "512" {
		imageSize = "512px"
	}
	switch imageSize {
	case "512px", "1K", "2K", "4K":
	default:
		return validatedImageConfig{}, fmt.Errorf("unsupported resolution %q (supported: 512px, 1K, 2K, 4K)", rawRes)
	}
	if (imageSize == "2K" || imageSize == "4K") && modelID == modelNanoBanana2Lite {
		return validatedImageConfig{}, fmt.Errorf("resolution %q is not supported by %s (2K and 4K output requires 'nano-banana-2.1', 'nano-banana-2', or 'nano-banana-pro')", rawRes, opts.Model)
	}
	if imageSize == "512px" && modelID != modelNanoBanana2 {
		return validatedImageConfig{}, fmt.Errorf("resolution %q is only supported by 'nano-banana-2' (gemini-3.1-flash-image), not %q (%s); use '1K', '2K', or '4K'", rawRes, opts.Model, modelID)
	}

	thinking := strings.TrimSpace(opts.ThinkingLevel)
	if thinking != "" {
		switch thinking {
		case "minimal", "medium", "high":
		default:
			return validatedImageConfig{}, fmt.Errorf("unsupported thinkingLevel %q (valid choices: minimal, medium, high)", thinking)
		}
		if thinking == "medium" && modelID != modelNanoBanana21 {
			return validatedImageConfig{}, fmt.Errorf("thinkingLevel 'medium' is only supported by 'nano-banana-2.1' (gemini-nano-banana-2.1), not %q", modelID)
		}
	}

	if (opts.Search || opts.ImageSearch) && modelID == modelNanoBanana2Lite {
		return validatedImageConfig{}, fmt.Errorf("search grounding is not supported by %s; use 'nano-banana-2.1', 'nano-banana-2', or 'nano-banana-pro' for Google Search grounding", modelID)
	}
	if opts.ImageSearch && modelID != modelNanoBanana21 && modelID != modelNanoBanana2 {
		return validatedImageConfig{}, fmt.Errorf("imageSearch (Google Image Search grounding) is only supported by 'nano-banana-2.1' and 'nano-banana-2'")
	}

	inputMIMEs, err := validateInputImagePaths(opts.InputImages, maxImageInputImages, "input/reference images")
	if err != nil {
		return validatedImageConfig{}, err
	}

	return validatedImageConfig{
		prompt:        prompt,
		modelID:       modelID,
		aspectRatio:   aspectRatio,
		imageSize:     imageSize,
		apiMode:       apiMode,
		thinkingLevel: thinking,
		inputMIMEs:    inputMIMEs,
	}, nil
}

// GenerateImage validates arguments, authenticates against Google Gen AI, generates
// or edits an image via Nano Banana models, writes it to outPath, and returns a metadata report.
func GenerateImage(ctx context.Context, opts ImageOptions) (ImageGenerateReport, error) {
	cfg, err := validateImageOptions(opts)
	if err != nil {
		return ImageGenerateReport{}, err
	}

	client, err := NewClient(ctx, opts.Auth)
	if err != nil {
		return ImageGenerateReport{}, err
	}

	images, err := loadInputImages(opts.InputImages, cfg.inputMIMEs)
	if err != nil {
		return ImageGenerateReport{}, err
	}

	var imgBytes []byte
	var mimeType string
	var text string
	var sources []string

	if cfg.apiMode == "interactions" {
		imgBytes, mimeType, text, sources, err = generateImageInteractions(ctx, client, cfg, opts, images)
	} else {
		imgBytes, mimeType, text, sources, err = generateImageModels(ctx, client, cfg, opts, images)
	}
	if err != nil {
		return ImageGenerateReport{}, err
	}
	if sources == nil {
		sources = make([]string, 0)
	}
	if len(imgBytes) == 0 {
		return ImageGenerateReport{}, fmt.Errorf("no image returned from %s (%s API)", cfg.modelID, cfg.apiMode)
	}

	var width, height int
	if imgCfg, format, decErr := image.DecodeConfig(bytes.NewReader(imgBytes)); decErr == nil {
		width = imgCfg.Width
		height = imgCfg.Height
		if mimeType == "" && format != "" {
			mimeType = "image/" + format
		}
	}
	if mimeType == "" {
		mimeType = http.DetectContentType(imgBytes)
	}

	if err := writeOutputFile(opts.OutPath, imgBytes); err != nil {
		return ImageGenerateReport{}, err
	}

	return ImageGenerateReport{
		OutPath:          opts.OutPath,
		Model:            cfg.modelID,
		APIMode:          cfg.apiMode,
		MIMEType:         mimeType,
		BytesWritten:     len(imgBytes),
		Width:            width,
		Height:           height,
		Text:             text,
		GroundingSources: sources,
	}, nil
}

func generateImageInteractions(ctx context.Context, client *genai.Client, cfg validatedImageConfig, opts ImageOptions, images []inputImageData) ([]byte, string, string, []string, error) {
	input := buildInteractionsInput(cfg.prompt, images, false)
	aspectRatio := interactions.ImageResponseFormatAspectRatio(cfg.aspectRatio)
	imageSize := interactions.ImageResponseFormatImageSize(cfg.imageSize)
	rf := interactions.NewCreateModelInteractionResponseFormat(
		interactions.NewResponseFormat(interactions.ImageResponseFormat{
			AspectRatio: &aspectRatio,
			ImageSize:   &imageSize,
		}),
	)

	var tools []interactions.Tool
	if opts.ImageSearch {
		tools = append(tools, interactions.NewTool(interactions.GoogleSearch{
			SearchTypes: []interactions.GoogleSearchSearchType{
				interactions.GoogleSearchSearchTypeWebSearch,
				interactions.GoogleSearchSearchTypeImageSearch,
			},
		}))
	} else if opts.Search {
		tools = append(tools, interactions.NewTool(interactions.GoogleSearch{}))
	}

	var genCfg *interactions.GenerationConfig
	if cfg.thinkingLevel != "" {
		tl := interactions.ThinkingLevel(cfg.thinkingLevel)
		genCfg = &interactions.GenerationConfig{
			ThinkingLevel: &tl,
		}
	}

	res, err := client.Interactions.Create(ctx, operations.CreateInteractionRequest{
		Body: operations.NewCreateInteractionRequestBody(interactions.CreateModelInteraction{
			Model:            interactions.Model(cfg.modelID),
			Input:            &input,
			ResponseFormat:   &rf,
			Tools:            tools,
			GenerationConfig: genCfg,
		}),
	})
	if err != nil {
		return nil, "", "", nil, wrapAPIError("generating image", cfg.modelID, err)
	}
	if err := checkInteractionResponse(res.Interaction); err != nil {
		return nil, "", "", nil, err
	}

	inter := res.Interaction
	imgBytes, mimeType, err := extractInteractionImage(inter)
	if err != nil {
		return nil, "", "", nil, err
	}

	text := extractInteractionText(inter)
	sources := extractInteractionGroundingSources(inter)
	return imgBytes, mimeType, text, sources, nil
}

func extractInteractionImage(inter *interactions.Interaction) ([]byte, string, error) {
	var encoded string
	var mimeType string

	if inter.OutputImage != nil && inter.OutputImage.Data != nil && strings.TrimSpace(*inter.OutputImage.Data) != "" {
		encoded = *inter.OutputImage.Data
		if inter.OutputImage.MimeType != nil {
			mimeType = string(*inter.OutputImage.MimeType)
		}
	} else {
		for _, step := range inter.Steps {
			if step.Type != interactions.StepTypeModelOutput || step.ModelOutputStep == nil {
				continue
			}
			for _, block := range step.ModelOutputStep.Content {
				if block.Type == interactions.ContentTypeImage && block.ImageContent != nil && block.ImageContent.Data != nil && strings.TrimSpace(*block.ImageContent.Data) != "" {
					encoded = *block.ImageContent.Data
					if block.ImageContent.MimeType != nil {
						mimeType = string(*block.ImageContent.MimeType)
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
		return nil, "", fmt.Errorf("no image returned from Interactions API response")
	}
	decoded, err := base64.StdEncoding.DecodeString(strings.TrimSpace(encoded))
	if err != nil {
		return nil, "", fmt.Errorf("decode base64 image from Interactions API response: %w", err)
	}
	return decoded, mimeType, nil
}

func extractInteractionGroundingSources(inter *interactions.Interaction) []string {
	sources := make([]string, 0)
	seen := make(map[string]bool)
	addSource := func(src string) {
		trimmed := strings.TrimSpace(src)
		if trimmed != "" && !seen[trimmed] {
			seen[trimmed] = true
			sources = append(sources, trimmed)
		}
	}

	for _, step := range inter.Steps {
		if step.Type != interactions.StepTypeModelOutput || step.ModelOutputStep == nil {
			continue
		}
		for _, block := range step.ModelOutputStep.Content {
			if block.Type != interactions.ContentTypeText || block.TextContent == nil {
				continue
			}
			for _, ann := range block.TextContent.Annotations {
				switch ann.Type {
				case interactions.AnnotationTypeURLCitation:
					if ann.URLCitation != nil && ann.URLCitation.URL != nil {
						addSource(*ann.URLCitation.URL)
					}
				case interactions.AnnotationTypeFileCitation:
					if ann.FileCitation != nil && ann.FileCitation.DocumentURI != nil {
						addSource(*ann.FileCitation.DocumentURI)
					}
				case interactions.AnnotationTypePlaceCitation:
					if ann.PlaceCitation != nil && ann.PlaceCitation.URL != nil {
						addSource(*ann.PlaceCitation.URL)
					}
				}
			}
		}
	}
	return sources
}

func mapGenAIThinkingLevel(level string) genai.ThinkingLevel {
	switch level {
	case "minimal":
		return genai.ThinkingLevelMinimal
	case "medium":
		return genai.ThinkingLevelMedium
	case "high":
		return genai.ThinkingLevelHigh
	default:
		return genai.ThinkingLevelUnspecified
	}
}

func generateImageModels(ctx context.Context, client *genai.Client, cfg validatedImageConfig, opts ImageOptions, images []inputImageData) ([]byte, string, string, []string, error) {
	contents := buildModelsContents(cfg.prompt, images, false)
	genCfg := &genai.GenerateContentConfig{
		ResponseModalities: []string{"TEXT", "IMAGE"},
		ImageConfig: &genai.ImageConfig{
			AspectRatio: cfg.aspectRatio,
			ImageSize:   cfg.imageSize,
		},
	}
	if cfg.thinkingLevel != "" {
		genCfg.ThinkingConfig = &genai.ThinkingConfig{
			ThinkingLevel: mapGenAIThinkingLevel(cfg.thinkingLevel),
		}
	}
	if opts.ImageSearch {
		genCfg.Tools = []*genai.Tool{{
			GoogleSearch: &genai.GoogleSearch{
				SearchTypes: &genai.SearchTypes{
					WebSearch:   &genai.WebSearch{},
					ImageSearch: &genai.ImageSearch{},
				},
			},
		}}
	} else if opts.Search {
		genCfg.Tools = []*genai.Tool{{
			GoogleSearch: &genai.GoogleSearch{},
		}}
	}

	resp, err := client.Models.GenerateContent(ctx, cfg.modelID, contents, genCfg)
	if err != nil {
		return nil, "", "", nil, wrapAPIError("generating image", cfg.modelID, err)
	}

	var imgBytes []byte
	var mimeType string
	var textParts []string
	sources := make([]string, 0)

	if resp != nil && len(resp.Candidates) > 0 && resp.Candidates[0] != nil {
		cand := resp.Candidates[0]
		if cand.Content != nil {
			for _, part := range cand.Content.Parts {
				if part == nil || part.Thought {
					continue
				}
				if len(imgBytes) == 0 && part.InlineData != nil && len(part.InlineData.Data) > 0 {
					imgBytes = part.InlineData.Data
					mimeType = part.InlineData.MIMEType
				} else if part.Text != "" {
					textParts = append(textParts, part.Text)
				}
			}
		}
		sources = extractModelsGroundingSources(cand.GroundingMetadata)
	}

	if len(imgBytes) == 0 {
		return nil, "", "", nil, fmt.Errorf("no image data found in generate_content response candidates")
	}
	return imgBytes, mimeType, strings.Join(textParts, "\n"), sources, nil
}

func extractModelsGroundingSources(gm *genai.GroundingMetadata) []string {
	sources := make([]string, 0)
	if gm == nil {
		return sources
	}
	seen := make(map[string]bool)
	addSource := func(src string) {
		trimmed := strings.TrimSpace(src)
		if trimmed != "" && !seen[trimmed] {
			seen[trimmed] = true
			sources = append(sources, trimmed)
		}
	}

	for _, chunk := range gm.GroundingChunks {
		if chunk == nil {
			continue
		}
		if chunk.Web != nil {
			addSource(chunk.Web.URI)
		}
		if chunk.Image != nil {
			if chunk.Image.SourceURI != "" {
				addSource(chunk.Image.SourceURI)
			} else {
				addSource(chunk.Image.ImageURI)
			}
		}
		if chunk.Maps != nil {
			addSource(chunk.Maps.URI)
		}
		if chunk.RetrievedContext != nil {
			addSource(chunk.RetrievedContext.URI)
		}
	}
	return sources
}
