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
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"google.golang.org/genai"
)

func clearAuthEnv(t *testing.T) {
	t.Helper()
	for _, key := range []string{
		"GEMINI_API_KEY",
		"GOOGLE_API_KEY",
		"GOOGLE_CLOUD_PROJECT",
		"GCP_PROJECT",
		"GOOGLE_CLOUD_LOCATION",
		"GOOGLE_CLOUD_REGION",
		"GOOGLE_GENAI_USE_ENTERPRISE",
		"GOOGLE_GENAI_USE_VERTEXAI",
		"GOOGLE_APPLICATION_CREDENTIALS",
		"GOOGLE_GEMINI_BASE_URL",
		"GOOGLE_VERTEX_BASE_URL",
	} {
		t.Setenv(key, "")
	}
}

func makeTestPNG(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	img.Set(0, 0, color.RGBA{R: 255, G: 0, B: 128, A: 255})
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatalf("encode test PNG: %v", err)
	}
	return buf.Bytes()
}

func TestImageModelResolutionAndValidation(t *testing.T) {
	validModels := map[string]string{
		"":                            modelNanoBanana21,
		"nano-banana-2.1":             modelNanoBanana21,
		"nano-banana-2-1":             modelNanoBanana21,
		"gemini-nano-banana-2.1":      modelNanoBanana21,
		"nano-banana-2":               modelNanoBanana2,
		"gemini-3.1-flash-image":      modelNanoBanana2,
		"nano-banana-2-lite":          modelNanoBanana2Lite,
		"nano-banana-lite":            modelNanoBanana2Lite,
		"gemini-3.1-flash-lite-image": modelNanoBanana2Lite,
		"nano-banana-pro":             modelNanoBananaPro,
		"gemini-3-pro-image":          modelNanoBananaPro,
	}
	for input, want := range validModels {
		got, err := resolveImageModel(input)
		if err != nil {
			t.Fatalf("resolveImageModel(%q) unexpected error: %v", input, err)
		}
		if got != want {
			t.Fatalf("resolveImageModel(%q) = %q, want %q", input, got, want)
		}
	}

	for _, imagen := range []string{"imagen-4.0-generate-001", "imagen-3.0-generate-002"} {
		_, err := resolveImageModel(imagen)
		if err == nil || !strings.Contains(err.Error(), "August 17, 2026") {
			t.Fatalf("expected Imagen shutdown error for %q, got %v", imagen, err)
		}
	}

	for _, retired := range []string{"nano-banana", "gemini-2.5-flash-image", "gemini-3-pro-image-preview"} {
		_, err := resolveImageModel(retired)
		if err == nil || !strings.Contains(err.Error(), "retired model") {
			t.Fatalf("expected retired model error for %q, got %v", retired, err)
		}
	}

	if _, err := resolveImageModel("unknown-banana"); err == nil {
		t.Fatal("expected error for unknown image model")
	}
}

func TestImageCapabilityGuards(t *testing.T) {
	// 512 / 512px normalized to 512px and allowed only on nano-banana-2.
	for _, res := range []string{"512", "512px"} {
		cfg, err := validateImageOptions(ImageOptions{
			Prompt:     "pixel art hero",
			OutPath:    "out.png",
			Model:      "nano-banana-2",
			Resolution: res,
		})
		if err != nil {
			t.Fatalf("expected nano-banana-2 to accept %q: %v", res, err)
		}
		if cfg.imageSize != "512px" {
			t.Fatalf("expected normalized imageSize 512px, got %q", cfg.imageSize)
		}

		for _, other := range []string{"nano-banana-2.1", "nano-banana-2-lite", "nano-banana-pro"} {
			if _, err := validateImageOptions(ImageOptions{
				Prompt:     "pixel art hero",
				OutPath:    "out.png",
				Model:      other,
				Resolution: res,
			}); err == nil || !strings.Contains(err.Error(), "nano-banana-2") {
				t.Fatalf("expected 512px rejection on %q, got %v", other, err)
			}
		}
	}

	// Lite rejects 2K, 4K, search, imageSearch.
	for _, res := range []string{"2K", "4K"} {
		if _, err := validateImageOptions(ImageOptions{
			Prompt:     "icon",
			OutPath:    "out.png",
			Model:      "nano-banana-2-lite",
			Resolution: res,
		}); err == nil {
			t.Fatalf("expected nano-banana-2-lite to reject %q", res)
		}
	}
	if _, err := validateImageOptions(ImageOptions{
		Prompt:  "icon",
		OutPath: "out.png",
		Model:   "nano-banana-2-lite",
		Search:  true,
	}); err == nil || !strings.Contains(err.Error(), "search grounding") {
		t.Fatalf("expected search rejection on nano-banana-2-lite, got %v", err)
	}
	if _, err := validateImageOptions(ImageOptions{
		Prompt:      "icon",
		OutPath:     "out.png",
		Model:       "nano-banana-2-lite",
		ImageSearch: true,
	}); err == nil || !strings.Contains(err.Error(), "search grounding") {
		t.Fatalf("expected imageSearch rejection on nano-banana-2-lite, got %v", err)
	}

	// Pro rejects extended aspect ratios and imageSearch, allows search.
	for _, ratio := range []string{"1:4", "4:1", "1:8", "8:1"} {
		if _, err := validateImageOptions(ImageOptions{
			Prompt:      "banner",
			OutPath:     "out.png",
			Model:       "nano-banana-pro",
			AspectRatio: ratio,
		}); err == nil {
			t.Fatalf("expected nano-banana-pro to reject aspectRatio %q", ratio)
		}
	}
	if _, err := validateImageOptions(ImageOptions{
		Prompt:      "banner",
		OutPath:     "out.png",
		Model:       "nano-banana-pro",
		ImageSearch: true,
	}); err == nil || !strings.Contains(err.Error(), "imageSearch") {
		t.Fatalf("expected imageSearch rejection on nano-banana-pro, got %v", err)
	}
	if _, err := validateImageOptions(ImageOptions{
		Prompt:  "banner",
		OutPath: "out.png",
		Model:   "nano-banana-pro",
		Search:  true,
	}); err != nil {
		t.Fatalf("expected nano-banana-pro to accept search=true: %v", err)
	}

	// ThinkingLevel medium only on nano-banana-2.1.
	if _, err := validateImageOptions(ImageOptions{
		Prompt:        "sprite sheet",
		OutPath:       "out.png",
		Model:         "nano-banana-2.1",
		ThinkingLevel: "medium",
	}); err != nil {
		t.Fatalf("expected nano-banana-2.1 to accept thinkingLevel medium: %v", err)
	}
	for _, m := range []string{"nano-banana-2", "nano-banana-2-lite", "nano-banana-pro"} {
		if _, err := validateImageOptions(ImageOptions{
			Prompt:        "sprite sheet",
			OutPath:       "out.png",
			Model:         m,
			ThinkingLevel: "medium",
		}); err == nil {
			t.Fatalf("expected %q to reject thinkingLevel medium", m)
		}
	}
	if _, err := validateImageOptions(ImageOptions{
		Prompt:        "sprite sheet",
		OutPath:       "out.png",
		ThinkingLevel: "ultra",
	}); err == nil {
		t.Fatal("expected invalid thinkingLevel to fail")
	}

	// Max 14 input images & extension check.
	imgs14 := make([]string, 14)
	for i := range imgs14 {
		imgs14[i] = "ref.HEIF"
	}
	if _, err := validateImageOptions(ImageOptions{
		Prompt:      "edit",
		OutPath:     "out.png",
		InputImages: imgs14,
	}); err != nil {
		t.Fatalf("expected 14 valid input images to pass: %v", err)
	}
	imgs15 := append(imgs14, "extra.png")
	if _, err := validateImageOptions(ImageOptions{
		Prompt:      "edit",
		OutPath:     "out.png",
		InputImages: imgs15,
	}); err == nil || !strings.Contains(err.Error(), "14") {
		t.Fatalf("expected max 14 images error, got %v", err)
	}
	if _, err := validateImageOptions(ImageOptions{
		Prompt:      "edit",
		OutPath:     "out.png",
		InputImages: []string{"anim.gif"},
	}); err == nil || !strings.Contains(err.Error(), "unsupported input image format") {
		t.Fatalf("expected unsupported image format error, got %v", err)
	}
}

func TestMusicModelResolutionAndFormatValidation(t *testing.T) {
	validModels := map[string]string{
		"":                     modelLyria35,
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
	for input, want := range validModels {
		got, err := resolveMusicModel(input)
		if err != nil {
			t.Fatalf("resolveMusicModel(%q) unexpected error: %v", input, err)
		}
		if got != want {
			t.Fatalf("resolveMusicModel(%q) = %q, want %q", input, got, want)
		}
	}

	for _, retired := range []string{"lyria-002", "lyria-realtime-exp"} {
		if _, err := resolveMusicModel(retired); err == nil || !strings.Contains(err.Error(), "retired model") {
			t.Fatalf("expected retired model error for %q, got %v", retired, err)
		}
	}

	// Format inference and constraints.
	if cfg, err := validateMusicOptions(MusicOptions{Prompt: "boss theme", OutPath: "boss.wav"}); err != nil || cfg.audioFormat != "wav" {
		t.Fatalf("expected inferred wav for lyria-3.5, got cfg=%+v err=%v", cfg, err)
	}
	if cfg, err := validateMusicOptions(MusicOptions{Prompt: "boss theme", OutPath: "boss.ogg"}); err != nil || cfg.audioFormat != "mp3" {
		t.Fatalf("expected inferred mp3 for .ogg, got cfg=%+v err=%v", cfg, err)
	}

	badCases := []struct {
		name string
		opts MusicOptions
		want string
	}{
		{"missing prompt", MusicOptions{OutPath: "a.mp3"}, "prompt is required"},
		{"missing outPath", MusicOptions{Prompt: "synthwave"}, "outPath is required"},
		{"wav filename with mp3 format", MusicOptions{Prompt: "a", OutPath: "a.wav", Format: "mp3"}, "ends with '.wav'"},
		{"mp3 filename with wav format", MusicOptions{Prompt: "a", OutPath: "a.mp3", Format: "wav"}, "ends with '.mp3'"},
		{"wav on clip", MusicOptions{Prompt: "a", OutPath: "a.wav", Model: "lyria-3-clip"}, "lyria-3.5"},
		{"wav on pro", MusicOptions{Prompt: "a", OutPath: "a.wav", Model: "lyria-3-pro"}, "lyria-3.5"},
		{"wav on models apiMode", MusicOptions{Prompt: "a", OutPath: "a.wav", APIMode: "models"}, "interactions"},
		{"invalid format", MusicOptions{Prompt: "a", OutPath: "a.flac", Format: "flac"}, "unsupported format"},
		{"invalid apiMode", MusicOptions{Prompt: "a", OutPath: "a.mp3", APIMode: "grpc"}, "unsupported apiMode"},
		{"11 input images", MusicOptions{Prompt: "a", OutPath: "a.mp3", InputImages: make([]string, 11)}, "10"},
		{"bad image ext", MusicOptions{Prompt: "a", OutPath: "a.mp3", InputImages: []string{"bad.gif"}}, "unsupported input image format"},
	}
	for _, tc := range badCases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := validateMusicOptions(tc.opts)
			if err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("validateMusicOptions(%+v) = %v, want substring %q", tc.opts, err, tc.want)
			}
		})
	}
}

func TestFailFastClientAuth(t *testing.T) {
	ctx := context.Background()
	clearAuthEnv(t)

	// 1. Neither API key nor Enterprise/Vertex configured.
	_, err := NewClient(ctx, AuthOptions{})
	if err == nil {
		t.Fatal("expected error when no credentials configured")
	}
	for _, want := range []string{"GEMINI_API_KEY", "GOOGLE_CLOUD_PROJECT", "global", "Fail fast"} {
		if !strings.Contains(err.Error(), want) {
			t.Fatalf("auth error missing %q: %v", want, err)
		}
	}
	if strings.Contains(err.Error(), "us-central1") {
		t.Fatalf("auth error must not recommend us-central1: %v", err)
	}

	// 2. Enterprise requested without ADC credentials file.
	t.Setenv("GOOGLE_APPLICATION_CREDENTIALS", filepath.Join(t.TempDir(), "missing_adc.json"))
	_, err = NewClient(ctx, AuthOptions{Enterprise: true, Project: "demo-proj"})
	if err == nil || !strings.Contains(err.Error(), "Application Default Credentials") {
		t.Fatalf("expected ADC error, got %v", err)
	}

	// 3. Enterprise requested via env with GEMINI_API_KEY also set, but missing project.
	adcPath := filepath.Join(t.TempDir(), "adc.json")
	if writeErr := os.WriteFile(adcPath, []byte(`{"client_id":"c","client_secret":"s","refresh_token":"r","type":"authorized_user"}`), 0o600); writeErr != nil {
		t.Fatal(writeErr)
	}
	t.Setenv("GOOGLE_APPLICATION_CREDENTIALS", adcPath)
	t.Setenv("GOOGLE_GENAI_USE_ENTERPRISE", "true")
	t.Setenv("GEMINI_API_KEY", "should-not-fallback")
	_, err = NewClient(ctx, AuthOptions{})
	if err == nil || !strings.Contains(err.Error(), "no GCP Project ID") {
		t.Fatalf("expected fail-fast missing GCP Project ID even when GEMINI_API_KEY is set, got %v", err)
	}

	// 4. Enterprise succeeds with project and defaults location to "global".
	t.Setenv("GOOGLE_CLOUD_PROJECT", "test-gcp-project")
	entClient, err := NewClient(ctx, AuthOptions{})
	if err != nil {
		t.Fatalf("expected enterprise client to initialize with ADC + project: %v", err)
	}
	if cfg := entClient.ClientConfig(); cfg.Project != "test-gcp-project" || cfg.Location != "global" || cfg.Backend != genai.BackendVertexAI {
		t.Fatalf("unexpected enterprise ClientConfig: %+v", cfg)
	}

	// 5. Gemini API key succeeds cleanly when enterprise flags/project are cleared.
	clearAuthEnv(t)
	t.Setenv("GEMINI_API_KEY", "test-api-key")
	apiClient, err := NewClient(ctx, AuthOptions{})
	if err != nil {
		t.Fatalf("expected Gemini API client to initialize: %v", err)
	}
	if cfg := apiClient.ClientConfig(); cfg.Backend != genai.BackendGeminiAPI || cfg.APIKey != "test-api-key" {
		t.Fatalf("unexpected Gemini API ClientConfig: %+v", cfg)
	}
}

func TestGenerateImageInteractionsAndModelsRoundTrip(t *testing.T) {
	ctx := context.Background()
	pngBytes := makeTestPNG(t, 16, 12)
	refPath := filepath.Join(t.TempDir(), "ref.png")
	if err := os.WriteFile(refPath, pngBytes, 0o644); err != nil {
		t.Fatal(err)
	}

	var lastPath string
	var lastReq map[string]any

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		lastPath = r.URL.Path
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &lastReq)

		w.Header().Set("Content-Type", "application/json")
		if strings.HasSuffix(r.URL.Path, "/interactions") {
			resp := map[string]any{
				"id":     "inter-123",
				"status": "completed",
				"steps": []any{
					map[string]any{
						"type": "model_output",
						"content": []any{
							map[string]any{
								"type": "text",
								"text": "Generated sprite sheet",
								"annotations": []any{
									map[string]any{
										"type":  "url_citation",
										"url":   "https://example.com/pixel-art",
										"title": "Pixel Art Guide",
									},
								},
							},
							map[string]any{
								"type":      "image",
								"data":      base64.StdEncoding.EncodeToString(pngBytes),
								"mime_type": "image/png",
							},
						},
					},
				},
			}
			_ = json.NewEncoder(w).Encode(resp)
			return
		}

		// Models API generateContent response with a skipped thought part.
		resp := map[string]any{
			"candidates": []any{
				map[string]any{
					"content": map[string]any{
						"role": "model",
						"parts": []any{
							map[string]any{
								"thought": true,
								"text":    "internal reasoning should be skipped",
							},
							map[string]any{
								"inlineData": map[string]any{
									"mimeType": "image/png",
									"data":     base64.StdEncoding.EncodeToString(pngBytes),
								},
							},
							map[string]any{
								"text": "Models output caption",
							},
						},
					},
					"groundingMetadata": map[string]any{
						"groundingChunks": []any{
							map[string]any{
								"web": map[string]any{
									"uri": "https://example.com/models-source",
								},
							},
						},
					},
				},
			},
		}
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer srv.Close()

	clearAuthEnv(t)
	t.Setenv("GEMINI_API_KEY", "test-key")
	t.Setenv("GOOGLE_GEMINI_BASE_URL", srv.URL)

	outInteractions := filepath.Join(t.TempDir(), "nested", "hero.png")
	rep1, err := GenerateImage(ctx, ImageOptions{
		Prompt:        "Hero sprite",
		Model:         "nano-banana-2",
		Resolution:    "512",
		AspectRatio:   "4:1",
		ThinkingLevel: "high",
		ImageSearch:   true,
		InputImages:   []string{refPath},
		OutPath:       outInteractions,
	})
	if err != nil {
		t.Fatalf("GenerateImage(interactions) failed: %v", err)
	}
	if !strings.HasSuffix(lastPath, "/interactions") {
		t.Fatalf("expected /interactions path, got %q", lastPath)
	}
	rf, _ := lastReq["response_format"].(map[string]any)
	if rf["image_size"] != "512px" || rf["aspect_ratio"] != "4:1" {
		t.Fatalf("unexpected interactions response_format: %+v", rf)
	}
	if rep1.Model != modelNanoBanana2 || rep1.APIMode != "interactions" || rep1.Width != 16 || rep1.Height != 12 {
		t.Fatalf("unexpected image report: %+v", rep1)
	}
	if rep1.Text != "Generated sprite sheet" || len(rep1.GroundingSources) != 1 || rep1.GroundingSources[0] != "https://example.com/pixel-art" {
		t.Fatalf("unexpected text/groundingSources: %+v", rep1)
	}
	if _, statErr := os.Stat(outInteractions); statErr != nil {
		t.Fatalf("expected image written at %q: %v", outInteractions, statErr)
	}

	outModels := filepath.Join(t.TempDir(), "models.png")
	rep2, err := GenerateImage(ctx, ImageOptions{
		Prompt:        "Hero portrait",
		Model:         "nano-banana-2.1",
		APIMode:       "models",
		ThinkingLevel: "medium",
		Search:        true,
		OutPath:       outModels,
	})
	if err != nil {
		t.Fatalf("GenerateImage(models) failed: %v", err)
	}
	if !strings.Contains(lastPath, "generateContent") {
		t.Fatalf("expected generateContent path, got %q", lastPath)
	}
	if rep2.Model != modelNanoBanana21 || rep2.APIMode != "models" || rep2.Width != 16 || rep2.Height != 12 {
		t.Fatalf("unexpected models image report: %+v", rep2)
	}
	if rep2.Text != "Models output caption" || len(rep2.GroundingSources) != 1 || rep2.GroundingSources[0] != "https://example.com/models-source" {
		t.Fatalf("unexpected models text/groundingSources: %+v", rep2)
	}
}

func TestGenerateMusicInteractionsAndModelsRoundTrip(t *testing.T) {
	ctx := context.Background()
	pngBytes := makeTestPNG(t, 4, 4)
	refPath := filepath.Join(t.TempDir(), "cover.png")
	if err := os.WriteFile(refPath, pngBytes, 0o644); err != nil {
		t.Fatal(err)
	}

	fakeWav := []byte("RIFF\x24\x00\x00\x00WAVEfmt ")
	fakeMP3 := []byte("ID3\x03\x00\x00\x00\x00\x00\x00")
	var lastReq map[string]any

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &lastReq)

		w.Header().Set("Content-Type", "application/json")
		if strings.HasSuffix(r.URL.Path, "/interactions") {
			resp := map[string]any{
				"id":     "inter-music-1",
				"status": "completed",
				"steps": []any{
					map[string]any{
						"type": "model_output",
						"content": []any{
							map[string]any{
								"type": "text",
								"text": "[Intro]\nSynthwave pulse",
							},
							map[string]any{
								"type":      "audio",
								"data":      base64.StdEncoding.EncodeToString(fakeWav),
								"mime_type": "audio/wav",
							},
						},
					},
				},
			}
			_ = json.NewEncoder(w).Encode(resp)
			return
		}

		resp := map[string]any{
			"candidates": []any{
				map[string]any{
					"content": map[string]any{
						"role": "model",
						"parts": []any{
							map[string]any{
								"inlineData": map[string]any{
									"mimeType": "audio/mp3",
									"data":     base64.StdEncoding.EncodeToString(fakeMP3),
								},
							},
							map[string]any{
								"text": "[Chorus]\nArcade fire",
							},
						},
					},
				},
			},
		}
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer srv.Close()

	clearAuthEnv(t)
	t.Setenv("GEMINI_API_KEY", "test-key")
	t.Setenv("GOOGLE_GEMINI_BASE_URL", srv.URL)

	tmpDir := t.TempDir()
	outWav := filepath.Join(tmpDir, "nested", "theme.wav")
	outLyrics := filepath.Join(tmpDir, "nested", "theme.txt")

	rep1, err := GenerateMusic(ctx, MusicOptions{
		Prompt:        "Synthwave boss theme",
		InputImages:   []string{refPath},
		OutPath:       outWav,
		OutLyricsPath: outLyrics,
	})
	if err != nil {
		t.Fatalf("GenerateMusic(interactions) failed: %v", err)
	}
	rf, _ := lastReq["response_format"].(map[string]any)
	if rf["type"] != "audio" || rf["mime_type"] != "audio/wav" {
		t.Fatalf("expected audio/wav response_format, got %+v", rf)
	}
	if rep1.Format != "wav" || rep1.MIMEType != "audio/wav" || rep1.BytesWritten != len(fakeWav) || rep1.OutLyricsPath != outLyrics {
		t.Fatalf("unexpected music report: %+v", rep1)
	}
	gotAudio, err := os.ReadFile(outWav)
	if err != nil || !bytes.Equal(gotAudio, fakeWav) {
		t.Fatalf("unexpected written audio: %v", err)
	}
	gotLyrics, err := os.ReadFile(outLyrics)
	if err != nil || string(gotLyrics) != "[Intro]\nSynthwave pulse" {
		t.Fatalf("unexpected written lyrics: %q (%v)", string(gotLyrics), err)
	}

	outMP3 := filepath.Join(tmpDir, "clip.mp3")
	rep2, err := GenerateMusic(ctx, MusicOptions{
		Prompt:  "Arcade loop",
		Model:   "lyria-3-clip",
		APIMode: "models",
		OutPath: outMP3,
	})
	if err != nil {
		t.Fatalf("GenerateMusic(models) failed: %v", err)
	}
	if rep2.Model != modelLyria3Clip || rep2.Format != "mp3" || rep2.MIMEType != "audio/mp3" || rep2.BytesWritten != len(fakeMP3) {
		t.Fatalf("unexpected models music report: %+v", rep2)
	}
}

func TestGenerateMediaWrapsAPIError(t *testing.T) {
	ctx := context.Background()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":{"code":"unauthorized","message":"invalid api key"}}`))
	}))
	defer srv.Close()

	clearAuthEnv(t)
	t.Setenv("GEMINI_API_KEY", "bad-key")
	t.Setenv("GOOGLE_GEMINI_BASE_URL", srv.URL)

	_, err := GenerateImage(ctx, ImageOptions{
		Prompt:  "test",
		OutPath: filepath.Join(t.TempDir(), "out.png"),
	})
	if err == nil || !strings.Contains(err.Error(), "GEMINI_API_KEY") {
		t.Fatalf("expected wrapped API error with auth guidance, got %v", err)
	}
}
