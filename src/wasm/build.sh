#!/usr/bin/env bash
# =============================================================================
# Content-Aware Fill — WASM Build Script
# =============================================================================
# Compiles caf_wrapper.cpp (CImg + PatchMatch) to caf.js + caf.wasm
# Output is placed in ../../public/wasm/ so Vite serves them as static assets.
#
# Usage:
#   cd src/wasm
#   ./build.sh
#
# Prerequisites:
#   - Emscripten SDK (https://emscripten.org/docs/getting_started/downloads.html)
#   - CImg.h and inpaint.h in the same directory (auto-downloaded if missing)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/../../public/wasm"
EMSDK_ENV="${EMSDK:-$HOME/emsdk}/emsdk_env.sh"

# Activate Emscripten environment if not already active
if ! command -v emcc &>/dev/null; then
    if [[ -f "$EMSDK_ENV" ]]; then
        echo "Activating Emscripten SDK..."
        # shellcheck disable=SC1090
        source "$EMSDK_ENV"
    else
        echo "ERROR: emcc not found and EMSDK env not available."
        echo "Install from: https://emscripten.org/docs/getting_started/downloads.html"
        exit 1
    fi
fi

echo "Using: $(emcc --version | head -1)"

# Download CImg headers if missing
if [[ ! -f "$SCRIPT_DIR/CImg.h" ]]; then
    echo "Downloading CImg.h..."
    curl -fsSL "https://github.com/GreycLab/CImg/raw/master/CImg.h" -o "$SCRIPT_DIR/CImg.h"
fi

if [[ ! -f "$SCRIPT_DIR/inpaint.h" ]]; then
    echo "Downloading inpaint.h..."
    curl -fsSL "https://github.com/GreycLab/CImg/raw/master/plugins/inpaint.h" -o "$SCRIPT_DIR/inpaint.h"
fi

mkdir -p "$OUTPUT_DIR"

echo "Compiling caf_wrapper.cpp → $OUTPUT_DIR/caf.js + caf.wasm ..."

emcc "$SCRIPT_DIR/caf_wrapper.cpp" \
    -o "$OUTPUT_DIR/caf.js" \
    -O3 \
    -std=c++17 \
    -I "$SCRIPT_DIR" \
    -Dcimg_display=0 \
    -Ucimg_use_png \
    -Ucimg_use_jpeg \
    -Ucimg_use_tiff \
    -U_OPENMP \
    -s WASM=1 \
    -s MODULARIZE=1 \
    -s EXPORT_NAME="CAFModule" \
    -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","HEAPU8","HEAP8"]' \
    -s EXPORTED_FUNCTIONS='["_malloc","_free"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=33554432 \
    -s MAXIMUM_MEMORY=536870912 \
    -s ENVIRONMENT=web,worker \
    -s SINGLE_FILE=0 \
    --bind

echo ""
echo "Build successful!"
ls -lh "$OUTPUT_DIR/caf.js" "$OUTPUT_DIR/caf.wasm"
echo ""
echo "Files are ready in public/wasm/ — Vite will serve them automatically."
