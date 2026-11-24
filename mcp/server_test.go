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
	"context"
	"encoding/base64"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func connectInMemoryMCP(t *testing.T) *mcp.ClientSession {
	t.Helper()
	ctx := context.Background()
	server := NewServer()
	client := mcp.NewClient(&mcp.Implementation{Name: "test-client", Version: "0.1.0"}, nil)

	serverTransport, clientTransport := mcp.NewInMemoryTransports()
	if _, err := server.Connect(ctx, serverTransport, nil); err != nil {
		t.Fatalf("server.Connect failed: %v", err)
	}
	session, err := client.Connect(ctx, clientTransport, nil)
	if err != nil {
		t.Fatalf("client.Connect failed: %v", err)
	}
	t.Cleanup(func() {
		_ = session.Close()
	})
	return session
}

func decodeStructured[T any](t *testing.T, res *mcp.CallToolResult) T {
	t.Helper()
	if res.IsError {
		t.Fatalf("tool returned IsError=true: %+v", res.Content)
	}
	raw, err := json.Marshal(res.StructuredContent)
	if err != nil {
		t.Fatalf("marshal structuredContent: %v", err)
	}
	var out T
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatalf("unmarshal structuredContent: %v (raw=%s)", err, string(raw))
	}
	return out
}

func callToolErrorText(t *testing.T, res *mcp.CallToolResult) string {
	t.Helper()
	if !res.IsError {
		t.Fatalf("expected IsError=true, got IsError=false (structured=%+v)", res.StructuredContent)
	}
	var parts []string
	for _, c := range res.Content {
		if tc, ok := c.(*mcp.TextContent); ok {
			parts = append(parts, tc.Text)
		}
	}
	return strings.Join(parts, "\n")
}

func makeMinimalPNG(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	img.Set(0, 0, color.RGBA{R: 0, G: 255, B: 0, A: 255})
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatalf("png.Encode failed: %v", err)
	}
	return buf.Bytes()
}

func TestMCPServerDiscoveryAndTools(t *testing.T) {
	ctx := context.Background()
	session := connectInMemoryMCP(t)

	if initRes := session.InitializeResult(); initRes == nil || initRes.ServerInfo == nil || initRes.ServerInfo.Version != "0.4.0" {
		t.Fatalf("expected server version 0.4.0, got %+v", initRes)
	}

	// 1. Verify all 10 tools and schemas are registered
	toolsRes, err := session.ListTools(ctx, nil)
	if err != nil {
		t.Fatalf("ListTools failed: %v", err)
	}
	byName := make(map[string]*mcp.Tool, len(toolsRes.Tools))
	for _, tool := range toolsRes.Tools {
		byName[tool.Name] = tool
	}
	wantTools := []string{
		"sound_presets",
		"music_synthesize",
		"music_validate",
		"sfx_synthesize",
		"sprite_inspect",
		"sprite_compile",
		"sprite_normalize",
		"sprite_extract_palette",
		"image_generate",
		"music_generate",
	}
	if len(byName) != len(wantTools) {
		t.Fatalf("expected %d registered tools, got %d (%+v)", len(wantTools), len(byName), byName)
	}
	for _, name := range wantTools {
		tool, ok := byName[name]
		if !ok {
			t.Fatalf("missing expected MCP tool %q in %+v", name, byName)
		}
		if tool.InputSchema == nil {
			t.Fatalf("tool %q missing InputSchema", name)
		}
	}

	for _, mediaTool := range []string{"image_generate", "music_generate"} {
		tool := byName[mediaTool]
		schemaMap, ok := tool.InputSchema.(map[string]any)
		if !ok {
			t.Fatalf("%s InputSchema is not a map: %T", mediaTool, tool.InputSchema)
		}
		reqRaw, _ := schemaMap["required"].([]any)
		var reqFields []string
		for _, r := range reqRaw {
			if s, ok := r.(string); ok {
				reqFields = append(reqFields, s)
			}
		}
		if !slices.Contains(reqFields, "prompt") || !slices.Contains(reqFields, "outPath") || len(reqFields) != 2 {
			t.Fatalf("%s unexpected required fields: %v", mediaTool, reqFields)
		}
		if tool.OutputSchema == nil {
			t.Fatalf("%s missing OutputSchema", mediaTool)
		}
	}

	// 2. sound_presets
	presetsRes, err := session.CallTool(ctx, &mcp.CallToolParams{
		Name:      "sound_presets",
		Arguments: map[string]any{},
	})
	if err != nil {
		t.Fatalf("sound_presets CallTool failed: %v", err)
	}
	presets := decodeStructured[SoundPresetsOutput](t, presetsRes)
	if len(presets.SFXPresets) != 18 {
		t.Fatalf("expected 18 SFX presets, got %d", len(presets.SFXPresets))
	}
	if len(presets.MusicPresets.WaveTypes) == 0 || len(presets.MusicPresets.YM2612Presets) == 0 {
		t.Fatalf("expected non-empty music presets catalog")
	}

	tmpDir := t.TempDir()

	// 3. sfx_synthesize (valid + invalid syntax)
	sfxWav := filepath.Join(tmpDir, "laser.wav")
	sfxRes, err := session.CallTool(ctx, &mcp.CallToolParams{
		Name: "sfx_synthesize",
		Arguments: map[string]any{
			"filePath":   filepath.Join("..", "tests", "fixtures", "sfx", "laser_arcade.sfx"),
			"outWavPath": sfxWav,
		},
	})
	if err != nil {
		t.Fatalf("sfx_synthesize CallTool failed: %v", err)
	}
	if _, statErr := os.Stat(sfxWav); statErr != nil {
		t.Fatalf("expected WAV output at %q: %v", sfxWav, statErr)
	}
	sfxReport := decodeStructured[map[string]any](t, sfxRes)
	if sfxReport["passed"] != true {
		t.Fatalf("expected laser_arcade.sfx to pass, got %+v", sfxReport)
	}

	badSfxRes, err := session.CallTool(ctx, &mcp.CallToolParams{
		Name: "sfx_synthesize",
		Arguments: map[string]any{
			"dsl": "title \"Broken\"\ntype sfx\ninst b wave=nope vol=0.5\ntrack main b: A4:100ms\n",
		},
	})
	if err != nil {
		t.Fatalf("bad sfx_synthesize CallTool failed: %v", err)
	}
	badSfx := decodeStructured[map[string]any](t, badSfxRes)
	if badSfx["passed"] != false {
		t.Fatalf("expected broken sfx DSL to return passed=false, got %+v", badSfx)
	}

	// 4. music_synthesize & music_validate
	musicWav := filepath.Join(tmpDir, "song.wav")
	musicStems := filepath.Join(tmpDir, "song.stems")
	musicDSL := `
title "MCP Test Song"
type song
bpm 120
time 4/4
inst lead wave=ym2612_brass vol=0.16 pan=-0.20
inst bass wave=ym2612_bass  vol=0.20 pan=0.00
track ch1 lead: C5:4 E5:4 G5:4 C6:4
track ch2 bass: C2:4 C2:4 G1:4 G1:4
`
	musicRes, err := session.CallTool(ctx, &mcp.CallToolParams{
		Name: "music_synthesize",
		Arguments: map[string]any{
			"dsl":          musicDSL,
			"soloTracks":   []string{"ch1"},
			"outWavPath":   musicWav,
			"outStemsPath": musicStems,
		},
	})
	if err != nil {
		t.Fatalf("music_synthesize CallTool failed: %v", err)
	}
	if _, statErr := os.Stat(musicWav); statErr != nil {
		t.Fatalf("expected music WAV output: %v", statErr)
	}
	if _, statErr := os.Stat(musicStems); statErr != nil {
		t.Fatalf("expected music stems output: %v", statErr)
	}
	musicReport := decodeStructured[map[string]any](t, musicRes)
	if musicReport["passed"] != true {
		t.Fatalf("expected music_synthesize to pass, got %+v", musicReport)
	}

	valRes, err := session.CallTool(ctx, &mcp.CallToolParams{
		Name: "music_validate",
		Arguments: map[string]any{
			"filePath": filepath.Join("..", "tests", "fixtures", "music", "battle_theme.music"),
		},
	})
	if err != nil {
		t.Fatalf("music_validate CallTool failed: %v", err)
	}
	valReport := decodeStructured[map[string]any](t, valRes)
	if valReport["passed"] != true {
		t.Fatalf("expected battle_theme.music validation to pass, got %+v", valReport)
	}

	// 5. sprite_inspect (.sprite and .aseprite)
	inspPng := filepath.Join(tmpDir, "inspect.png")
	inspRes, err := session.CallTool(ctx, &mcp.CallToolParams{
		Name: "sprite_inspect",
		Arguments: map[string]any{
			"filePath":   filepath.Join("..", "tests", "fixtures", "sprite", "black_cat_anime.aseprite"),
			"outPngPath": inspPng,
		},
	})
	if err != nil {
		t.Fatalf("sprite_inspect CallTool failed: %v", err)
	}
	if _, statErr := os.Stat(inspPng); statErr != nil {
		t.Fatalf("expected inspected PNG output: %v", statErr)
	}
	inspReport := decodeStructured[map[string]any](t, inspRes)
	if inspReport["passed"] != true {
		t.Fatalf("expected sprite_inspect to pass, got %+v", inspReport)
	}

	// 6. sprite_compile
	compPng := filepath.Join(tmpDir, "compiled.png")
	compRes, err := session.CallTool(ctx, &mcp.CallToolParams{
		Name: "sprite_compile",
		Arguments: map[string]any{
			"filePath":   filepath.Join("..", "tests", "fixtures", "sprite", "black_cat_anime.sprite"),
			"outPngPath": compPng,
		},
	})
	if err != nil {
		t.Fatalf("sprite_compile CallTool failed: %v", err)
	}
	if _, statErr := os.Stat(compPng); statErr != nil {
		t.Fatalf("expected compiled PNG output: %v", statErr)
	}
	compReport := decodeStructured[map[string]any](t, compRes)
	if compReport["passed"] != true {
		t.Fatalf("expected sprite_compile to pass, got %+v", compReport)
	}

	// 7. sprite_normalize
	normPng := filepath.Join(tmpDir, "normalized.png")
	normRes, err := session.CallTool(ctx, &mcp.CallToolParams{
		Name: "sprite_normalize",
		Arguments: map[string]any{
			"filePath":   filepath.Join("..", "tests", "fixtures", "sprite", "black_cat_anime.png"),
			"cols":       4,
			"rows":       8,
			"outPngPath": normPng,
		},
	})
	if err != nil {
		t.Fatalf("sprite_normalize CallTool failed: %v", err)
	}
	if _, statErr := os.Stat(normPng); statErr != nil {
		t.Fatalf("expected normalized PNG output: %v", statErr)
	}
	normReport := decodeStructured[map[string]any](t, normRes)
	if normReport["totalFrames"] != float64(32) {
		t.Fatalf("expected 32 frames from black_cat_anime.png, got %v", normReport["totalFrames"])
	}

	// 8. sprite_extract_palette
	palRes, err := session.CallTool(ctx, &mcp.CallToolParams{
		Name: "sprite_extract_palette",
		Arguments: map[string]any{
			"filePath": filepath.Join("..", "tests", "fixtures", "sprite", "black_cat_anime.png"),
			"numRamps": 4,
		},
	})
	if err != nil {
		t.Fatalf("sprite_extract_palette CallTool failed: %v", err)
	}
	palReport := decodeStructured[map[string]any](t, palRes)
	if palReport["dsl"] == "" {
		t.Fatalf("expected non-empty ramp DSL from sprite_extract_palette")
	}

	// 9 & 10. image_generate & music_generate fail-fast validation and auth errors
	for _, key := range []string{
		"GEMINI_API_KEY",
		"GOOGLE_API_KEY",
		"GOOGLE_CLOUD_PROJECT",
		"GCP_PROJECT",
		"GOOGLE_CLOUD_LOCATION",
		"GOOGLE_GENAI_USE_ENTERPRISE",
		"GOOGLE_GENAI_USE_VERTEXAI",
		"GOOGLE_APPLICATION_CREDENTIALS",
		"GOOGLE_GEMINI_BASE_URL",
	} {
		t.Setenv(key, "")
	}

	badImgRes, err := session.CallTool(ctx, &mcp.CallToolParams{
		Name: "image_generate",
		Arguments: map[string]any{
			"prompt":  "pixel knight",
			"model":   "imagen-4.0-generate-001",
			"outPath": filepath.Join(tmpDir, "knight.png"),
		},
	})
	if err != nil {
		t.Fatalf("image_generate CallTool failed: %v", err)
	}
	if errTxt := callToolErrorText(t, badImgRes); !strings.Contains(errTxt, "August 17, 2026") {
		t.Fatalf("expected Imagen shutdown message, got %q", errTxt)
	}

	badImgRes2, err := session.CallTool(ctx, &mcp.CallToolParams{
		Name: "image_generate",
		Arguments: map[string]any{
			"prompt":     "pixel knight",
			"model":      "nano-banana-2.1",
			"resolution": "512px",
			"outPath":    filepath.Join(tmpDir, "knight.png"),
		},
	})
	if err != nil {
		t.Fatalf("image_generate CallTool failed: %v", err)
	}
	if errTxt := callToolErrorText(t, badImgRes2); !strings.Contains(errTxt, "nano-banana-2") {
		t.Fatalf("expected 512px guard message, got %q", errTxt)
	}

	noAuthImgRes, err := session.CallTool(ctx, &mcp.CallToolParams{
		Name: "image_generate",
		Arguments: map[string]any{
			"prompt":  "pixel knight",
			"outPath": filepath.Join(tmpDir, "knight.png"),
		},
	})
	if err != nil {
		t.Fatalf("image_generate CallTool failed: %v", err)
	}
	if errTxt := callToolErrorText(t, noAuthImgRes); !strings.Contains(errTxt, "GEMINI_API_KEY") || !strings.Contains(errTxt, "global") {
		t.Fatalf("expected fail-fast auth error, got %q", errTxt)
	}

	badMusRes, err := session.CallTool(ctx, &mcp.CallToolParams{
		Name: "music_generate",
		Arguments: map[string]any{
			"prompt":  "synthwave boss theme",
			"model":   "lyria-002",
			"outPath": filepath.Join(tmpDir, "boss.mp3"),
		},
	})
	if err != nil {
		t.Fatalf("music_generate CallTool failed: %v", err)
	}
	if errTxt := callToolErrorText(t, badMusRes); !strings.Contains(errTxt, "retired model") {
		t.Fatalf("expected retired Lyria model error, got %q", errTxt)
	}

	badMusRes2, err := session.CallTool(ctx, &mcp.CallToolParams{
		Name: "music_generate",
		Arguments: map[string]any{
			"prompt":  "arcade loop",
			"model":   "lyria-3-clip",
			"outPath": filepath.Join(tmpDir, "loop.wav"),
		},
	})
	if err != nil {
		t.Fatalf("music_generate CallTool failed: %v", err)
	}
	if errTxt := callToolErrorText(t, badMusRes2); !strings.Contains(errTxt, "lyria-3.5") {
		t.Fatalf("expected wav model guard error, got %q", errTxt)
	}

	noAuthMusRes, err := session.CallTool(ctx, &mcp.CallToolParams{
		Name: "music_generate",
		Arguments: map[string]any{
			"prompt":  "arcade loop",
			"outPath": filepath.Join(tmpDir, "loop.mp3"),
		},
	})
	if err != nil {
		t.Fatalf("music_generate CallTool failed: %v", err)
	}
	if errTxt := callToolErrorText(t, noAuthMusRes); !strings.Contains(errTxt, "GEMINI_API_KEY") || !strings.Contains(errTxt, "GOOGLE_CLOUD_PROJECT") {
		t.Fatalf("expected fail-fast auth error, got %q", errTxt)
	}

	// End-to-end MCP tool call roundtrip for image_generate and music_generate
	pngData := makeMinimalPNG(t, 8, 6)
	mp3Data := []byte("ID3-mock-mp3")
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var reqBody map[string]any
		_ = json.NewDecoder(r.Body).Decode(&reqBody)
		modelName, _ := reqBody["model"].(string)

		w.Header().Set("Content-Type", "application/json")
		if strings.HasPrefix(modelName, "lyria") {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id":     "mcp-mus-1",
				"status": "completed",
				"steps": []any{
					map[string]any{
						"type": "model_output",
						"content": []any{
							map[string]any{"type": "audio", "data": base64.StdEncoding.EncodeToString(mp3Data), "mime_type": "audio/mp3"},
						},
					},
				},
			})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"id":     "mcp-img-1",
			"status": "completed",
			"steps": []any{
				map[string]any{
					"type": "model_output",
					"content": []any{
						map[string]any{"type": "image", "data": base64.StdEncoding.EncodeToString(pngData), "mime_type": "image/png"},
					},
				},
			},
		})
	}))
	defer srv.Close()

	t.Setenv("GEMINI_API_KEY", "test-mcp-key")
	t.Setenv("GOOGLE_GEMINI_BASE_URL", srv.URL)

	imgOut := filepath.Join(tmpDir, "gen_sprite.png")
	imgCallRes, err := session.CallTool(ctx, &mcp.CallToolParams{
		Name: "image_generate",
		Arguments: map[string]any{
			"prompt":  "16-bit slime sprite",
			"outPath": imgOut,
		},
	})
	if err != nil {
		t.Fatalf("image_generate CallTool failed: %v", err)
	}
	imgReport := decodeStructured[map[string]any](t, imgCallRes)
	if imgReport["width"] != float64(8) || imgReport["height"] != float64(6) {
		t.Fatalf("unexpected image dimensions in report: %+v", imgReport)
	}
	sourcesSlice, ok := imgReport["groundingSources"].([]any)
	if !ok || len(sourcesSlice) != 0 {
		t.Fatalf("expected non-nil empty groundingSources array, got %#v", imgReport["groundingSources"])
	}

	musOut := filepath.Join(tmpDir, "gen_theme.mp3")
	musCallRes, err := session.CallTool(ctx, &mcp.CallToolParams{
		Name: "music_generate",
		Arguments: map[string]any{
			"prompt":  "16-bit dungeon loop",
			"outPath": musOut,
		},
	})
	if err != nil {
		t.Fatalf("music_generate CallTool failed: %v", err)
	}
	musReport := decodeStructured[map[string]any](t, musCallRes)
	if musReport["format"] != "mp3" || musReport["bytesWritten"] != float64(len(mp3Data)) {
		t.Fatalf("unexpected music report: %+v", musReport)
	}
}
