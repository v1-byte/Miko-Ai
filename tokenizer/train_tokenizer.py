"""Latih tokenizer dari data/processed/train.txt -> tokenizer/tokenizer.json"""
import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tokenizer.bpe import train  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--data", default=str(ROOT / "data/processed/train.txt"))
ap.add_argument("--vocab", type=int, default=1024)
ap.add_argument("--out", default=str(ROOT / "tokenizer/tokenizer.json"))
a = ap.parse_args()

text = Path(a.data).read_text(encoding="utf-8")
tok = train([text], vocab_size=a.vocab)
tok.save(a.out)
print(f"Tokenizer disimpan: {a.out} | vocab_size={tok.vocab_size} (merges={len(tok.merges)})")
