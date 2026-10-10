"""Buat rilis uji dengan bobot ACAK (tanpa torch) untuk memeriksa runtime JS == referensi Python.
Pakai: python tests/make_fixture.py [folder_keluaran]
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from export.parity import build_parity  # noqa: E402
from export.release_format import write_release  # noqa: E402
from tests.ref_numpy import forward, greedy, random_weights  # noqa: E402
from tokenizer.bpe import Tokenizer, train  # noqa: E402

out = sys.argv[1] if len(sys.argv) > 1 else str(ROOT / "out/fixture")
Path(out).mkdir(parents=True, exist_ok=True)

text = (ROOT / "data/processed/train.txt").read_text(encoding="utf-8")
tok = train([text], vocab_size=400, log=lambda *_: None)
tok.save(Path(out) / "_tok.json")
cfg = {"vocab_size": tok.vocab_size, "block_size": 64, "n_layer": 2, "n_head": 4, "n_embd": 32}
T = random_weights(cfg)
parity = build_parity(tok, cfg, lambda ids: forward(T, cfg, ids), lambda ids, n: greedy(T, cfg, ids, n))
n = write_release(out, cfg, T, Path(out) / "_tok.json", parity, "fixture")
print(f"fixture: {n:,} parameter, vocab {tok.vocab_size} -> {out}")
