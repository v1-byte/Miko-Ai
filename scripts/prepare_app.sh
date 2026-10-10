#!/usr/bin/env bash
# Salin runtime + model hasil latih ke app/www agar siap dibungkus jadi APK.
set -euo pipefail
cd "$(dirname "$0")/.."
test -f release/model.bin || { echo "release/model.bin belum ada — latih dulu (lihat README)"; exit 1; }
mkdir -p app/www/ai app/www/model
cp runtime/miko-ai-lm.js runtime/assistant.js runtime/analyzer.js app/www/ai/
cp release/model.json release/model.bin release/tokenizer.json app/www/model/
echo "app/www siap: $(du -sh app/www | cut -f1)"
