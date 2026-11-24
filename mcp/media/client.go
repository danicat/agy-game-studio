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

// Package media implements Google Gen AI image and music generation tools for
// Nano Banana and Lyria models using both Interactions and Models APIs.
package media

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"cloud.google.com/go/auth/credentials"
	"google.golang.org/genai"
	"google.golang.org/genai/interactions/models/apierrors"
	"google.golang.org/genai/interactions/models/interactions"
)

const authRemediationMessage = `Authentication guidance:
  Option 1: Vertex AI / Gemini Enterprise (Application Default Credentials):
    gcloud auth application-default login
    export GOOGLE_CLOUD_PROJECT="your-gcp-project-id"
    export GOOGLE_CLOUD_LOCATION="global"
    export GOOGLE_GENAI_USE_ENTERPRISE="true"
  Option 2: Gemini Developer API (API Key):
    export GEMINI_API_KEY="your-api-key"
CRITICAL FOR AGENTS: Fail fast. Do NOT attempt unauthorized workarounds, fallback media generators, or procedural placeholder files. Stop immediately, report this exact authentication error to the user, and ask them to configure credentials.`

var supportedImageMIMETypes = map[string]string{
	".png":  "image/png",
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".heic": "image/heic",
	".heif": "image/heif",
}

// AuthOptions configures Vertex AI / Gemini Enterprise or Gemini Developer API authentication.
type AuthOptions struct {
	Enterprise bool
	Project    string
	Location   string
}

type inputImageData struct {
	mimeType string
	data     []byte
}

func isTruthyEnv(val string) bool {
	switch strings.ToLower(strings.TrimSpace(val)) {
	case "true", "1", "yes":
		return true
	default:
		return false
	}
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if trimmed := strings.TrimSpace(v); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

// NewClient initializes a Google Gen AI client using either Vertex AI / Gemini
// Enterprise Application Default Credentials (genai.BackendEnterprise) or a
// Gemini Developer API key (genai.BackendGeminiAPI), failing fast if missing.
func NewClient(ctx context.Context, opts AuthOptions) (*genai.Client, error) {
	apiKey := firstNonEmpty(os.Getenv("GEMINI_API_KEY"), os.Getenv("GOOGLE_API_KEY"))
	envEnterprise := isTruthyEnv(os.Getenv("GOOGLE_GENAI_USE_ENTERPRISE"))
	envVertex := isTruthyEnv(os.Getenv("GOOGLE_GENAI_USE_VERTEXAI"))
	envProject := firstNonEmpty(os.Getenv("GOOGLE_CLOUD_PROJECT"), os.Getenv("GCP_PROJECT"))

	project := firstNonEmpty(opts.Project, envProject)
	location := firstNonEmpty(opts.Location, os.Getenv("GOOGLE_CLOUD_LOCATION"), "global")

	useEnterprise := opts.Enterprise ||
		strings.TrimSpace(opts.Project) != "" ||
		strings.TrimSpace(opts.Location) != "" ||
		envEnterprise ||
		envVertex ||
		(apiKey == "" && envProject != "")

	if useEnterprise {
		creds, err := credentials.DetectDefault(&credentials.DetectOptions{
			Scopes: []string{"https://www.googleapis.com/auth/cloud-platform"},
		})
		if err != nil {
			return nil, fmt.Errorf("failed to load Google Cloud Application Default Credentials for Vertex AI / Gemini Enterprise: %w\n\n%s", err, authRemediationMessage)
		}
		if project == "" {
			if adcProject, projErr := creds.ProjectID(ctx); projErr == nil && strings.TrimSpace(adcProject) != "" {
				project = strings.TrimSpace(adcProject)
			} else if quotaProject, quotaErr := creds.QuotaProjectID(ctx); quotaErr == nil && strings.TrimSpace(quotaProject) != "" {
				project = strings.TrimSpace(quotaProject)
			}
		}
		if project == "" {
			return nil, fmt.Errorf("no GCP Project ID found for Vertex AI / Gemini Enterprise (pass project or set GOOGLE_CLOUD_PROJECT)\n\n%s", authRemediationMessage)
		}

		return genai.NewClient(ctx, &genai.ClientConfig{
			Backend:     genai.BackendEnterprise,
			Project:     project,
			Location:    location,
			Credentials: creds,
		})
	}

	if apiKey == "" {
		return nil, fmt.Errorf("GEMINI_API_KEY environment variable is not set and Vertex AI / Gemini Enterprise credentials (GOOGLE_CLOUD_PROJECT / ADC) are not configured\n\n%s", authRemediationMessage)
	}

	return genai.NewClient(ctx, &genai.ClientConfig{
		Backend: genai.BackendGeminiAPI,
		APIKey:  apiKey,
	})
}

func normalizeAPIMode(mode string) (string, error) {
	trimmed := strings.TrimSpace(mode)
	if trimmed == "" {
		return "interactions", nil
	}
	switch trimmed {
	case "interactions", "models":
		return trimmed, nil
	default:
		return "", fmt.Errorf("unsupported apiMode %q (valid choices: interactions, models)", mode)
	}
}

func detectImageMIMEType(imgPath string) (string, error) {
	trimmed := strings.TrimSpace(imgPath)
	if trimmed == "" {
		return "", fmt.Errorf("input image path cannot be empty")
	}
	ext := strings.ToLower(filepath.Ext(trimmed))
	if mime, ok := supportedImageMIMETypes[ext]; ok {
		return mime, nil
	}
	if ext == "" {
		ext = "(none)"
	}
	return "", fmt.Errorf("unsupported input image format %q for %q (supported: .heic, .heif, .jpeg, .jpg, .png, .webp)", ext, imgPath)
}

func validateInputImagePaths(paths []string, maxCount int, maxLabel string) ([]string, error) {
	if len(paths) > maxCount {
		return nil, fmt.Errorf("maximum of %d %s allowed (got %d)", maxCount, maxLabel, len(paths))
	}
	mimes := make([]string, 0, len(paths))
	for _, p := range paths {
		mime, err := detectImageMIMEType(p)
		if err != nil {
			return nil, err
		}
		mimes = append(mimes, mime)
	}
	return mimes, nil
}

func loadInputImages(paths []string, mimes []string) ([]inputImageData, error) {
	if len(paths) == 0 {
		return nil, nil
	}
	out := make([]inputImageData, 0, len(paths))
	for i, p := range paths {
		raw, err := os.ReadFile(p)
		if err != nil {
			return nil, fmt.Errorf("read input image %q: %w", p, err)
		}
		out = append(out, inputImageData{
			mimeType: mimes[i],
			data:     raw,
		})
	}
	return out, nil
}

func buildInteractionsInput(prompt string, images []inputImageData, promptFirst bool) interactions.InteractionsInput {
	if len(images) == 0 {
		return interactions.NewInteractionsInput(prompt)
	}
	contents := make([]interactions.Content, 0, len(images)+1)
	if promptFirst {
		contents = append(contents, interactions.NewContent(interactions.TextContent{Text: prompt}))
	}
	for _, img := range images {
		b64 := base64.StdEncoding.EncodeToString(img.data)
		mime := interactions.ImageContentMimeType(img.mimeType)
		contents = append(contents, interactions.NewContent(interactions.ImageContent{
			Data:     &b64,
			MimeType: &mime,
		}))
	}
	if !promptFirst {
		contents = append(contents, interactions.NewContent(interactions.TextContent{Text: prompt}))
	}
	return interactions.NewInteractionsInput(contents)
}

func buildModelsContents(prompt string, images []inputImageData, promptFirst bool) []*genai.Content {
	parts := make([]*genai.Part, 0, len(images)+1)
	if promptFirst {
		parts = append(parts, genai.NewPartFromText(prompt))
	}
	for _, img := range images {
		parts = append(parts, genai.NewPartFromBytes(img.data, img.mimeType))
	}
	if !promptFirst {
		parts = append(parts, genai.NewPartFromText(prompt))
	}
	return []*genai.Content{genai.NewContentFromParts(parts, genai.RoleUser)}
}

func writeOutputFile(outPath string, data []byte) error {
	absPath, err := filepath.Abs(outPath)
	if err != nil {
		return fmt.Errorf("resolve output path %q: %w", outPath, err)
	}
	if dir := filepath.Dir(absPath); dir != "" {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return fmt.Errorf("create output directory %q: %w", dir, err)
		}
	}
	if err := os.WriteFile(outPath, data, 0o644); err != nil {
		return fmt.Errorf("write output file %q: %w", outPath, err)
	}
	return nil
}

func wrapAPIError(op, modelID string, err error) error {
	if err == nil {
		return nil
	}
	var gErr genai.APIError
	var gErrPtr *genai.APIError
	var intClientErr *apierrors.CreateInteractionClientError
	var intServerErr *apierrors.CreateInteractionServerError
	var intAPIErr *apierrors.APIError
	if errors.As(err, &gErr) ||
		errors.As(err, &gErrPtr) ||
		errors.As(err, &intClientErr) ||
		errors.As(err, &intServerErr) ||
		errors.As(err, &intAPIErr) {
		return fmt.Errorf("API error %s with %s: %w\n\n%s", op, modelID, err, authRemediationMessage)
	}
	return fmt.Errorf("error %s with %s: %w", op, modelID, err)
}

func checkInteractionResponse(inter *interactions.Interaction) error {
	if inter == nil {
		return fmt.Errorf("empty interaction response returned by API")
	}
	if len(inter.Errors) > 0 {
		msgs := make([]string, 0, len(inter.Errors))
		for _, e := range inter.Errors {
			code := ""
			if e.Code != nil {
				code = *e.Code
			}
			msg := ""
			if e.Message != nil {
				msg = *e.Message
			}
			if code != "" && msg != "" {
				msgs = append(msgs, fmt.Sprintf("%s: %s", code, msg))
			} else if msg != "" {
				msgs = append(msgs, msg)
			} else if code != "" {
				msgs = append(msgs, code)
			}
		}
		if len(msgs) > 0 {
			return fmt.Errorf("interaction failed (%s): %s", inter.Status, strings.Join(msgs, "; "))
		}
	}
	if inter.Status == interactions.InteractionStatusFailed {
		return fmt.Errorf("interaction failed with status %q", inter.Status)
	}
	return nil
}

func extractInteractionText(inter *interactions.Interaction) string {
	if inter == nil {
		return ""
	}
	if inter.OutputText != nil && strings.TrimSpace(*inter.OutputText) != "" {
		return *inter.OutputText
	}
	var parts []string
	for _, step := range inter.Steps {
		if step.Type != interactions.StepTypeModelOutput || step.ModelOutputStep == nil {
			continue
		}
		for _, block := range step.ModelOutputStep.Content {
			if block.Type == interactions.ContentTypeText && block.TextContent != nil && block.TextContent.Text != "" {
				parts = append(parts, block.TextContent.Text)
			}
		}
	}
	return strings.Join(parts, "\n")
}
