"""Bangun dataset latih dari data/raw (kode) dan data/instruct (tanya-jawab).

Keluaran: data/processed/train.txt dan val.txt
Format teks:
  <|code|>\n{kode}<|end|>\n
  <|user|>\n{pertanyaan}\n<|assistant|>\n{jawaban}<|end|>\n
"""
import argparse
import hashlib
import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CODE_EXT = {".js", ".mjs", ".ts", ".py", ".html", ".css", ".json", ".sh", ".md", ".java", ".kt", ".c", ".cpp", ".go", ".rs", ".php", ".sql"}
MAX_FILE = 200_000

ap = argparse.ArgumentParser()
ap.add_argument("--raw", default=str(ROOT / "data/raw"))
ap.add_argument("--instruct", default=str(ROOT / "data/instruct"))
ap.add_argument("--out", default=str(ROOT / "data/processed"))
ap.add_argument("--val_every", type=int, default=10, help="tiap dokumen ke-N masuk validasi")
ap.add_argument("--repeat_instruct", type=int, default=3, help="ulang tanya-jawab agar lebih berbobot")
a = ap.parse_args()


def clean(t):
    t = t.replace("﻿", "").replace("\r\n", "\n").replace("\r", "\n")
    t = "\n".join(line.rstrip() for line in t.split("\n"))
    for s in ("<|pad|>", "<|end|>", "<|user|>", "<|assistant|>", "<|code|>"):
        t = t.replace(s, "")  # cegah injeksi token khusus dari data
    return t.strip("\n") + "\n"


seen, docs = set(), []

# 1) kode mentah
for p in sorted(Path(a.raw).rglob("*")):
    if not p.is_file() or p.suffix.lower() not in CODE_EXT or p.stat().st_size > MAX_FILE:
        continue
    try:
        text = clean(p.read_text(encoding="utf-8"))
    except UnicodeDecodeError:
        continue
    h = hashlib.sha1(text.encode()).hexdigest()
    if len(text) < 20 or h in seen:
        continue
    seen.add(h)
    docs.append(f"<|code|>\n{text}<|end|>\n")

# 2) tanya-jawab
pairs = []
for p in sorted(Path(a.instruct).glob("*.jsonl")):
    for ln, line in enumerate(p.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            d = json.loads(line)
            q, r = clean(d["user"]).strip(), clean(d["assistant"]).strip()
        except (json.JSONDecodeError, KeyError):
            print(f"lewati {p.name}:{ln} (format salah)")
            continue
        h = hashlib.sha1((q + r).encode()).hexdigest()
        if h in seen:
            continue
        seen.add(h)
        pairs.append(f"<|user|>\n{q}\n<|assistant|>\n{r}<|end|>\n")

items = docs + pairs
random.Random(1337).shuffle(items)
train, val = [], []
for i, it in enumerate(items):
    (val if i % a.val_every == 0 else train).append(it)
if not val and train:  # data sangat kecil
    val.append(train[-1])
train = train + [x for x in train if x.startswith("<|user|>")] * (a.repeat_instruct - 1)

out = Path(a.out)
out.mkdir(parents=True, exist_ok=True)
(out / "train.txt").write_text("".join(train), encoding="utf-8")
(out / "val.txt").write_text("".join(val), encoding="utf-8")
print(f"kode: {len(docs)} dokumen | tanya-jawab: {len(pairs)} pasang")
print(f"train.txt: {sum(map(len, train)):,} karakter | val.txt: {sum(map(len, val)):,} karakter")
