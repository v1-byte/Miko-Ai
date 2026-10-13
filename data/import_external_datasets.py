#!/usr/bin/env python3
"""Import dataset eksternal hanya atas perintah eksplisit; seluruh output lokal diabaikan Git."""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXTERNAL = ROOT / "data" / "external"
MAX_DOWNLOAD_BYTES = 1_000_000_000
SOURCES = {
    "coma": {
        "url": "https://media.githubusercontent.com/media/Denilah/CoMA/main/data/CoMIT.json",
        "license": "Repository states Apache-2.0; underlying datasets have separate provenance/terms",
        "license_url": "https://github.com/Denilah/CoMA/blob/main/LICENSE",
        "dataset_url": "https://github.com/Denilah/CoMA",
    },
    "codealpaca": {
        "url": "https://raw.githubusercontent.com/sahil280114/codealpaca/master/data/code_alpaca_20k.json",
        "license": "CC BY-NC 4.0 (noncommercial; attribution required)",
        "license_url": "https://github.com/sahil280114/codealpaca/blob/master/DATA_LICENSE",
        "dataset_url": "https://github.com/sahil280114/codealpaca",
    },
}
ALLOWED_STACK_LICENSES = {
    "MIT", "APACHE-2.0", "BSD-2-CLAUSE", "BSD-3-CLAUSE", "ISC"
}
LANG_EXT = {
    "python": ".py", "py": ".py", "javascript": ".js", "js": ".js",
    "typescript": ".ts", "ts": ".ts", "html": ".html", "css": ".css",
    "java": ".java", "c": ".c", "c++": ".cpp", "cpp": ".cpp",
    "go": ".go", "rust": ".rs", "rs": ".rs", "php": ".php", "sql": ".sql",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def fetch(source: str, refresh: bool) -> Path:
    info = SOURCES[source]
    cache_dir = EXTERNAL / "cache" / source
    cache_dir.mkdir(parents=True, exist_ok=True)
    filename = "CoMIT.json" if source == "coma" else "code_alpaca_20k.json"
    target = cache_dir / filename
    if target.exists() and not refresh:
        print(f"Memakai cache lokal: {target}")
        return target

    request = urllib.request.Request(
        info["url"], headers={"User-Agent": "Miko-Ai-dataset-importer/1.0"}
    )
    temporary = target.with_suffix(target.suffix + ".part")
    try:
        with urllib.request.urlopen(request, timeout=60) as response, temporary.open("wb") as out:
            length = response.headers.get("Content-Length")
            if length and int(length) > MAX_DOWNLOAD_BYTES:
                raise ValueError(f"Berkas terlalu besar ({length} byte); batas importer 1 GB.")
            total = 0
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_DOWNLOAD_BYTES:
                    raise ValueError("Berkas melewati batas importer 1 GB.")
                out.write(chunk)
        temporary.replace(target)
        print(f"Unduhan selesai: {total:,} byte -> {target}")
        return target
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


def get_records(payload):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("data", "train", "examples", "records"):
            if isinstance(payload.get(key), list):
                return payload[key]
    raise ValueError("Struktur JSON tidak dikenali; harapkan daftar objek atau kunci data/train/examples/records.")


def first_text(record: dict, keys: tuple[str, ...]) -> str:
    for key in keys:
        value = record.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def normalize_instruction(record: dict) -> tuple[str, str]:
    if not isinstance(record, dict):
        return "", ""
    question = first_text(record, ("instruction", "task", "prompt", "user", "question"))
    context = first_text(record, ("input", "context"))
    answer = first_text(record, ("output", "assistant", "response", "answer", "completion"))
    if context:
        question = f"{question}\n\nKonteks/input:\n{context}" if question else context
    return question, answer


def import_instructions(args) -> int:
    source = args.source
    if source == "codealpaca" and not args.acknowledge_noncommercial:
        raise ValueError("Code Alpaca berlisensi CC BY-NC 4.0. Ulangi dengan --acknowledge-noncommercial setelah meninjau lisensinya.")
    if source == "coma" and not args.acknowledge_provenance_review:
        raise ValueError("CoMA memuat sumber upstream beragam. Ulangi dengan --acknowledge-provenance-review setelah meninjau provenance dan syarat sumber.")

    source_path = fetch(source, args.refresh)
    payload = json.loads(source_path.read_text(encoding="utf-8"))
    records = get_records(payload)
    output_dir = Path(args.destination).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{source}.jsonl"
    manifest_path = output_dir / f"{source}.provenance.json"
    seen, count, skipped = set(), 0, 0
    with output_path.open("w", encoding="utf-8", newline="\n") as out:
        for record in records:
            question, answer = normalize_instruction(record)
            if not question or not answer:
                skipped += 1
                continue
            signature = hashlib.sha256((question + "\0" + answer).encode("utf-8")).hexdigest()
            if signature in seen:
                skipped += 1
                continue
            seen.add(signature)
            out.write(json.dumps({"user": question, "assistant": answer}, ensure_ascii=False) + "\n")
            count += 1

    info = SOURCES[source]
    manifest = {
        "source": source,
        "dataset_url": info["dataset_url"],
        "source_data_url": info["url"],
        "license_note": info["license"],
        "license_url": info["license_url"],
        "source_sha256": sha256(source_path),
        "imported_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "normalized_records": count,
        "skipped_invalid_or_duplicate": skipped,
        "output": output_path.name,
        "notice": "Local import only. Keep this provenance with the data and honor all source terms; output is not added to Git.",
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Ternormalisasi {count:,} pasangan; dilewati {skipped:,} (format kosong/tidak didukung atau duplikat).")
    print(f"JSONL lokal: {output_path}")
    print(f"Provenance: {manifest_path}")
    print("Jangan commit berkas ini; data/external/ diabaikan Git.")
    return 0


def convert_stack(args) -> int:
    if not args.acknowledge_stack_terms:
        raise ValueError("Tinjau dan setujui ketentuan dataset The Stack/StarCoderData terlebih dahulu dengan --acknowledge-stack-terms.")
    source_path = Path(args.input).expanduser().resolve()
    if not source_path.is_file():
        raise FileNotFoundError(source_path)
    output_dir = Path(args.destination).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = output_dir / "stack.provenance.jsonl"
    counts = {"written": 0, "skipped_license": 0, "skipped_record": 0, "skipped_duplicate": 0}
    seen = set()
    with source_path.open("r", encoding="utf-8") as inp, manifest_path.open("w", encoding="utf-8") as manifest:
        for line_no, line in enumerate(inp, 1):
            if not line.strip():
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                counts["skipped_record"] += 1
                continue
            license_id = str(record.get("license") or record.get("license_id") or record.get("spdx_id") or "").strip().upper()
            if license_id not in ALLOWED_STACK_LICENSES:
                counts["skipped_license"] += 1
                continue
            code = first_text(record, ("content", "code", "text"))
            if len(code) < 20:
                counts["skipped_record"] += 1
                continue
            lang = str(record.get("language") or record.get("lang") or "").strip().lower()
            ext = LANG_EXT.get(lang, ".txt")
            digest = hashlib.sha256(code.encode("utf-8")).hexdigest()
            if digest in seen:
                counts["skipped_duplicate"] += 1
                continue
            seen.add(digest)
            filename = f"stack_{digest[:20]}{ext}"
            (output_dir / filename).write_text(code + "\n", encoding="utf-8")
            manifest.write(json.dumps({
                "file": filename,
                "sha256": digest,
                "license": license_id,
                "repo_name": record.get("repo_name"),
                "path": record.get("path"),
                "source_line": line_no,
            }, ensure_ascii=False) + "\n")
            counts["written"] += 1
    summary = output_dir / "stack.import-summary.json"
    summary.write_text(json.dumps({
        "input": str(source_path),
        "accepted_spdx_allowlist": sorted(ALLOWED_STACK_LICENSES),
        "counts": counts,
        "generated_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "note": "Local conversion only; continue honoring The Stack terms, source licenses, attribution, and removal updates.",
    }, indent=2) + "\n", encoding="utf-8")
    print("Hasil konversi lokal:", json.dumps(counts, ensure_ascii=False))
    print(f"Manifest: {manifest_path}")
    print(f"Ringkasan: {summary}")
    print("Data tidak diunduh otomatis dan tidak ditambahkan ke Git.")
    return 0


def build_parser():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("list", help="tampilkan sumber dan batasan")

    imp = commands.add_parser("import-instructions", help="unduh dan normalkan CoMA atau Code Alpaca ke data/external/")
    imp.add_argument("--source", choices=sorted(SOURCES), required=True)
    imp.add_argument("--destination", default=str(EXTERNAL / "instruct"))
    imp.add_argument("--refresh", action="store_true", help="unduh ulang berkas sumber yang di-cache")
    imp.add_argument("--acknowledge-noncommercial", action="store_true", help="konfirmasi telah meninjau CC BY-NC 4.0 Code Alpaca")
    imp.add_argument("--acknowledge-provenance-review", action="store_true", help="konfirmasi telah meninjau provenance/licensing upstream CoMA")

    stack = commands.add_parser("convert-stack-jsonl", help="konversi JSONL lokal The Stack; tidak mengunduh dataset")
    stack.add_argument("--input", required=True, help="JSONL lokal yang diperoleh setelah menerima syarat akses")
    stack.add_argument("--destination", default=str(EXTERNAL / "raw-starcoder"))
    stack.add_argument("--acknowledge-stack-terms", action="store_true", help="konfirmasi syarat dataset telah dibaca dan diterima")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        if args.command == "list":
            for name, info in SOURCES.items():
                print(f"{name}: {info['dataset_url']} — {info['license']}")
            print("starcoderdata: gated/manual only; review data/EXTERNAL_DATASETS.md")
            print("indonesian-index: catalog only; review individual dataset licenses")
            return 0
        if args.command == "import-instructions":
            return import_instructions(args)
        if args.command == "convert-stack-jsonl":
            return convert_stack(args)
    except (OSError, ValueError, urllib.error.URLError, json.JSONDecodeError) as exc:
        print(f"Gagal: {exc}", file=sys.stderr)
        return 2
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
