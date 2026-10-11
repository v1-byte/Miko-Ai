"""Validasi format, duplikasi, dan indikasi secret pada dataset instruksi JSONL."""
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SECRET_PATTERNS = {
    "GitHub token": re.compile(r"\b(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b"),
    "private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "AWS access key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "OpenAI-style API key": re.compile(r"\bsk-[A-Za-z0-9_-]{24,}\b"),
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dir", default=str(ROOT / "data/instruct"))
    args = parser.parse_args()
    folder = Path(args.dir)
    files = sorted(folder.glob("*.jsonl"))
    if not files:
        print(f"ERROR: tidak ada file JSONL di {folder}", file=sys.stderr)
        return 1

    errors, warnings = [], []
    seen_pairs, seen_questions = {}, {}
    total = 0
    for path in files:
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except UnicodeDecodeError as exc:
            errors.append(f"{path.name}: bukan UTF-8 valid ({exc})")
            continue
        for line_number, line in enumerate(lines, 1):
            if not line.strip():
                continue
            total += 1
            label = f"{path.name}:{line_number}"
            try:
                item = json.loads(line)
            except json.JSONDecodeError as exc:
                errors.append(f"{label}: JSON tidak valid ({exc.msg})")
                continue
            if not isinstance(item, dict):
                errors.append(f"{label}: setiap baris harus berupa objek JSON")
                continue
            question, answer = item.get("user"), item.get("assistant")
            if not isinstance(question, str) or not question.strip():
                errors.append(f"{label}: field user wajib berupa teks tidak kosong")
                continue
            if not isinstance(answer, str) or not answer.strip():
                errors.append(f"{label}: field assistant wajib berupa teks tidak kosong")
                continue
            normalized_question = " ".join(question.split()).casefold()
            pair_key = (normalized_question, " ".join(answer.split()).casefold())
            duplicate_pair = pair_key in seen_pairs
            if duplicate_pair:
                warnings.append(f"{label}: pasangan identik dengan {seen_pairs[pair_key]}")
            else:
                seen_pairs[pair_key] = label
            if normalized_question in seen_questions and not duplicate_pair:
                warnings.append(f"{label}: pertanyaan berulang dengan jawaban berbeda ({seen_questions[normalized_question]})")
            else:
                seen_questions.setdefault(normalized_question, label)
            content = question + "\n" + answer
            for name, pattern in SECRET_PATTERNS.items():
                if pattern.search(content):
                    errors.append(f"{label}: pola yang menyerupai {name}; hapus atau ganti dengan placeholder")
                    break

    for warning in warnings:
        print(f"WARNING: {warning}")
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    print(f"File: {len(files)} | baris: {total} | pasangan unik: {len(seen_pairs)} | warning: {len(warnings)} | error: {len(errors)}")
    if errors:
        return 1
    print("Validasi struktur selesai. Ini tidak membuktikan kebenaran kode atau kualitas jawaban; tetap tinjau dan uji contoh.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
