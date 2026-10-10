"""Ekspor model.pt -> release/ (model.bin, model.json, tokenizer.json, parity.json)."""
import argparse
import sys
from pathlib import Path

import numpy as np
import torch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from export.release_format import write_release  # noqa: E402
from model.gpt import GPT, Config  # noqa: E402
from tokenizer.bpe import Tokenizer  # noqa: E402
from export.parity import build_parity  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--ckpt", default=str(ROOT / "out/model.pt"))
ap.add_argument("--tok", default=str(ROOT / "tokenizer/tokenizer.json"))
ap.add_argument("--out", default=str(ROOT / "release"))
ap.add_argument("--version", default="dev")
a = ap.parse_args()

ck = torch.load(a.ckpt, map_location="cpu")
cfg = Config(**ck["config"])
model = GPT(cfg)
model.load_state_dict(ck["model"])
model.eval()
tok = Tokenizer.load(a.tok)
assert tok.vocab_size == cfg.vocab_size, "vocab tokenizer != vocab model"

sd = {k: v.detach().cpu().numpy().astype(np.float32) for k, v in model.state_dict().items()}
T = {"wte": sd["wte.weight"], "wpe": sd["wpe.weight"], "ln_f.w": sd["ln_f.weight"], "ln_f.b": sd["ln_f.bias"]}
for i in range(cfg.n_layer):
    p = f"blocks.{i}."
    for ours, theirs in [("ln1.w", "ln1.weight"), ("ln1.b", "ln1.bias"), ("qkv.w", "qkv.weight"), ("qkv.b", "qkv.bias"),
                         ("proj.w", "proj.weight"), ("proj.b", "proj.bias"), ("ln2.w", "ln2.weight"), ("ln2.b", "ln2.bias"),
                         ("fc.w", "fc.weight"), ("fc.b", "fc.bias"), ("mproj.w", "mproj.weight"), ("mproj.b", "mproj.bias")]:
        T[f"h{i}.{ours}"] = sd[p + theirs]


@torch.no_grad()
def torch_logits(ids):
    return model(torch.tensor([ids]))[0][0, -1].numpy()


def torch_greedy(ids, n):
    out = model.generate(torch.tensor([ids]), n, temperature=0.0)
    return out[0, len(ids):].tolist()


parity = build_parity(tok, cfg.to_dict(), torch_logits, torch_greedy)
n = write_release(a.out, cfg.to_dict(), T, a.tok, parity, a.version)
print(f"Rilis ditulis ke {a.out} | {n:,} parameter | ~{n*4/1e6:.1f} MB")
