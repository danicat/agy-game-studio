#!/usr/bin/env bash
# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# ==============================================================================
# Antigravity 2D Game Studio (agy-game-studio): Environment Doctor Script
# Validates required toolchain, WASM runtime assets, and optional tooling.
# ==============================================================================

set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<EOF
Usage: $(basename "$0")

Validates local environment prerequisites for Antigravity 2D Game Studio:
  - go (Go 1.26+ compiler for WASM builds and the bundled MCP engine server)
  - wasm_exec.js (Go WebAssembly runtime support in GOROOT)
  - node (Node.js runtime for studio sidecar and MCP launcher)
  - godoctor (Optional/Recommended: Go verification, linting, and mutation testing)
  - kungfu (Optional/Recommended: On-demand agent skills gateway)
  - gemini auth (Optional: Gemini API or Vertex AI / Gemini Enterprise credentials for image_generate and music_generate)
EOF
  exit 0
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

ERRORS=0
WARNINGS=0
REMEDIATIONS=()
NOTES=()

is_truthy() {
  local val
  val="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')"
  [[ "$val" == "true" || "$val" == "1" || "$val" == "yes" ]]
}

record_row() {
  local component="$1"
  local status="$2"
  local details="$3"
  local fix="${4:-}"

  local color="$GREEN"
  if [[ "$status" == "FAIL" ]]; then
    color="$RED"
    ERRORS=$((ERRORS + 1))
    REMEDIATIONS+=("${BOLD}${component}${NC}: ${fix}")
  elif [[ "$status" == "WARN" ]]; then
    color="$YELLOW"
    WARNINGS=$((WARNINGS + 1))
    [[ -n "$fix" ]] && NOTES+=("${BOLD}${component}${NC}: ${fix}")
  fi

  printf "│ %-22s │ ${color}%-6s${NC} │ %-44s │\n" "$component" "$status" "${details:0:44}"
}

echo -e "${BLUE}${BOLD}==================================================================================${NC}"
echo -e "${BLUE}${BOLD}        Antigravity 2D Game Studio (agy-game-studio): Environment Doctor        ${NC}"
echo -e "${BLUE}${BOLD}==================================================================================${NC}"
echo ""
printf "┌────────────────────────┬────────┬──────────────────────────────────────────────┐\n"
printf "│ %-22s │ %-6s │ %-44s │\n" "Component" "Status" "Details"
printf "├────────────────────────┼────────┼──────────────────────────────────────────────┤\n"

# 1. Check Go (1.26+)
if command -v go >/dev/null 2>&1; then
  GO_RAW="$(go version | awk '{print $3}')"
  GO_VER="${GO_RAW#go}"
  GO_MAJOR="$(echo "$GO_VER" | cut -d. -f1)"
  GO_MINOR="$(echo "$GO_VER" | cut -d. -f2)"
  if [[ "$GO_MAJOR" -gt 1 ]] || { [[ "$GO_MAJOR" -eq 1 ]] && [[ "$GO_MINOR" -ge 26 ]]; }; then
    record_row "go" "PASS" "Go ${GO_VER} installed"
  else
    record_row "go" "FAIL" "Go ${GO_VER} found (1.26+ required)" \
      "Upgrade Go to 1.26+: 'brew upgrade go' or download from https://go.dev/dl/"
  fi
else
  record_row "go" "FAIL" "go binary not found in PATH" \
    "Install Go 1.26+: 'brew install go' or download from https://go.dev/dl/"
fi

# 2. Check Go WebAssembly Support (wasm_exec.js)
if command -v go >/dev/null 2>&1; then
  GOROOT_PATH="$(go env GOROOT)"
  if [[ -f "${GOROOT_PATH}/lib/wasm/wasm_exec.js" ]]; then
    record_row "wasm_exec.js" "PASS" "Found in GOROOT/lib/wasm/wasm_exec.js"
  elif [[ -f "${GOROOT_PATH}/misc/wasm/wasm_exec.js" ]]; then
    record_row "wasm_exec.js" "PASS" "Found in GOROOT/misc/wasm/wasm_exec.js"
  else
    record_row "wasm_exec.js" "FAIL" "Missing wasm_exec.js in ${GOROOT_PATH}" \
      "Reinstall Go 1.26+ standard library from https://go.dev/dl/"
  fi
else
  record_row "wasm_exec.js" "FAIL" "Cannot check (go not installed)" \
    "Install Go 1.26+ first"
fi

# 3. Check Node.js (for Studio Sidecars and MCP Launcher)
if command -v node >/dev/null 2>&1; then
  NODE_VER="$(node --version 2>&1 | head -n1)"
  record_row "node" "PASS" "Node.js ${NODE_VER}"
else
  record_row "node" "FAIL" "node binary not found in PATH" \
    "Install Node.js 20+: 'brew install node' or https://nodejs.org/"
fi

# 4. Check godoctor (Recommended / Optional)
if command -v godoctor >/dev/null 2>&1; then
  GD_PATH="$(command -v godoctor)"
  record_row "godoctor (optional)" "PASS" "Found (${GD_PATH:0:36})"
else
  record_row "godoctor (optional)" "WARN" "Not installed (recommended)" \
    "Optional: 'go install github.com/danicat/godoctor/cmd/godoctor@latest'"
fi

# 5. Check kungfu (Recommended / Optional)
if command -v kungfu >/dev/null 2>&1; then
  KF_PATH="$(command -v kungfu)"
  record_row "kungfu (optional)" "PASS" "Found (${KF_PATH:0:36})"
else
  record_row "kungfu (optional)" "WARN" "Not installed (recommended)" \
    "Optional: 'go install github.com/danicat/kungfu@latest'"
fi

# 6. Check Gemini / Vertex AI Auth (Optional, for image_generate and music_generate)
GEMINI_KEY="${GEMINI_API_KEY:-${GOOGLE_API_KEY:-}}"
USE_ENTERPRISE="${GOOGLE_GENAI_USE_ENTERPRISE:-}"
USE_VERTEXAI="${GOOGLE_GENAI_USE_VERTEXAI:-}"
GCP_PROJECT="${GOOGLE_CLOUD_PROJECT:-}"

if is_truthy "$USE_ENTERPRISE" || is_truthy "$USE_VERTEXAI"; then
  if [[ -n "$GCP_PROJECT" ]]; then
    record_row "gemini auth (optional)" "PASS" "Vertex/Enterprise (${GCP_PROJECT})"
  else
    record_row "gemini auth (optional)" "WARN" "Missing GOOGLE_CLOUD_PROJECT" \
      "Optional (for Nano Banana & Lyria): export GOOGLE_CLOUD_PROJECT=\"your-gcp-project-id\" and run 'gcloud auth application-default login'"
  fi
elif [[ -n "$GEMINI_KEY" ]]; then
  if [[ -n "${GEMINI_API_KEY:-}" ]]; then
    record_row "gemini auth (optional)" "PASS" "Gemini API key set (GEMINI_API_KEY)"
  else
    record_row "gemini auth (optional)" "PASS" "Gemini API key set (GOOGLE_API_KEY)"
  fi
else
  record_row "gemini auth (optional)" "WARN" "Not set (optional for Lyria/Banana)" \
    "Optional (for Nano Banana & Lyria): export GEMINI_API_KEY=\"...\" (or GOOGLE_API_KEY), OR set GOOGLE_GENAI_USE_ENTERPRISE=true (or GOOGLE_GENAI_USE_VERTEXAI=true) + GOOGLE_CLOUD_PROJECT and run 'gcloud auth application-default login'"
fi
printf "└────────────────────────┴────────┴──────────────────────────────────────────────┘\n"

if [[ "$WARNINGS" -gt 0 ]]; then
  echo ""
  echo -e "${YELLOW}${BOLD}Optional Recommendations:${NC}"
  for note in "${NOTES[@]}"; do
    echo -e "  • ${note}"
  done
fi

if [[ "$ERRORS" -gt 0 ]]; then
  echo ""
  echo -e "${RED}${BOLD}❌ ENVIRONMENT CHECK FAILED: ${ERRORS} required check(s) did not pass.${NC}"
  echo -e "${YELLOW}${BOLD}Actionable Remediation Steps:${NC}"
  for fix in "${REMEDIATIONS[@]}"; do
    echo -e "  • ${fix}"
  done
  exit 1
fi

echo ""
echo -e "${GREEN}${BOLD}✅ ENVIRONMENT CHECK PASSED: All required tools are ready.${NC}"
exit 0
