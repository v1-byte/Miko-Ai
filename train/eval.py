"""Evaluasi: val loss/perplexity + contoh jawaban."""
import argparse
import math
import sys
from pathlib import Path

import torch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from model.gpt import GPT, Config  # noqa: E402
from tokenizer.bpe import Tokenizer  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--ckpt", default=str(ROOT / "out/model.pt"))
ap.add_argument("--tok", default=str(ROOT / "tokenizer/tokenizer.json"))
ap.add_argument("--val", default=str(ROOT / "data/processed/val.txt"))
ap.add_argument("--prompt", action="append", default=None)
a = ap.parse_args()

ck = torch.load(a.ckpt, map_location="cpu")
cfg = Config(**ck["config"])
model = GPT(cfg)
model.load_state_dict(ck["model"])
model.eval()
tok = Tokenizer.load(a.tok)

ids = torch.tensor(tok.encode(Path(a.val).read_text(encoding="utf-8")))
B = cfg.block_size
tot, n = 0.0, 0
with torch.no_grad():
    for i in range(0, len(ids) - B - 1, B):
        x, y = ids[i:i + B][None], ids[i + 1:i + B + 1][None]
        tot += model(x, y)[1].item()
        n += 1
if n:
    print(f"val_loss {tot/n:.4f} | perplexity {math.exp(tot/n):.1f}")

stop = (tok.special_id["<|end|>"], tok.special_id["<|user|>"])
for p in a.prompt or ["<|user|>\nBagaimana cara fetch data di JavaScript?\n<|assistant|>\n"]:
    out = model.generate(torch.tensor([tok.encode(p)]), 120, temperature=0.0, stop_ids=stop)
    print("-" * 40)
    print(tok.decode(out[0].tolist()))
