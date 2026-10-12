#!/usr/bin/env bash
# Salin runtime + model hasil latih ke app/www agar siap dibungkus jadi APK.
set -euo pipefail
cd "$(dirname "$0")/.."
test -f release/model.bin || { echo "release/model.bin belum ada — latih dulu (lihat README)"; exit 1; }
mkdir -p app/www/ai app/www/model app/www/assets
cp runtime/miko-ai-lm.js runtime/assistant.js runtime/analyzer.js app/www/ai/
cp app/node_modules/@capacitor/core/dist/capacitor.js app/www/ai/capacitor.js
cp assets/miko-ai-logo.png app/www/assets/miko-ai-logo.png
cp release/model.json release/model.bin release/tokenizer.json app/www/model/
python3 - <<'PY'
import json
from pathlib import Path
rows = []
for path in sorted(Path("data/instruct").glob("*.jsonl")):
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(row.get("user"), str) and isinstance(row.get("assistant"), str):
            rows.append({"user": row["user"], "assistant": row["assistant"]})
Path("app/www/ai/knowledge.json").write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
print(f"knowledge base: {len(rows)} pasangan")
PY
commit="${GITHUB_SHA:-$(git rev-parse HEAD 2>/dev/null || echo dev)}"
version="${GITHUB_REF_NAME:-dev}"
python3 - "$commit" "$version" <<'PY'
import json, sys
from pathlib import Path
Path("app/www/build.json").write_text(json.dumps({
    "commit": sys.argv[1],
    "version": sys.argv[2],
    "updateUrl": "https://github.com/v1-byte/Miko-Ai/releases/download/latest/Miko-AI-main.apk"
}, ensure_ascii=False) + "\n", encoding="utf-8")
PY
echo "app/www siap: $(du -sh app/www | cut -f1)"
