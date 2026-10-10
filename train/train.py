"""Latih model dari nol (bobot acak) pada data/processed."""
import argparse
import math
import sys
import time
from pathlib import Path

import torch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from model.gpt import GPT, Config  # noqa: E402
from tokenizer.bpe import Tokenizer  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--data", default=str(ROOT / "data/processed"))
ap.add_argument("--tok", default=str(ROOT / "tokenizer/tokenizer.json"))
ap.add_argument("--out", default=str(ROOT / "out"))
ap.add_argument("--steps", type=int, default=2000)
ap.add_argument("--batch", type=int, default=32)
ap.add_argument("--block", type=int, default=256)
ap.add_argument("--layers", type=int, default=4)
ap.add_argument("--heads", type=int, default=4)
ap.add_argument("--embd", type=int, default=128)
ap.add_argument("--lr", type=float, default=1e-3)
ap.add_argument("--warmup", type=int, default=100)
ap.add_argument("--eval_every", type=int, default=200)
ap.add_argument("--seed", type=int, default=1337)
a = ap.parse_args()

torch.manual_seed(a.seed)
device = "cuda" if torch.cuda.is_available() else "cpu"
tok = Tokenizer.load(a.tok)
read = lambda n: torch.tensor(tok.encode((Path(a.data) / n).read_text(encoding="utf-8")), dtype=torch.long)
train_ids, val_ids = read("train.txt"), read("val.txt")
print(f"device={device} | token latih={len(train_ids):,} | token val={len(val_ids):,} | vocab={tok.vocab_size}")
if len(train_ids) < a.block + 2:
    sys.exit(f"Data terlalu sedikit ({len(train_ids)} token) untuk block={a.block}. Tambah data atau kecilkan --block.")

cfg = Config(vocab_size=tok.vocab_size, block_size=a.block, n_layer=a.layers, n_head=a.heads, n_embd=a.embd)
model = GPT(cfg).to(device)
print(f"parameter: {model.num_params():,}")
opt = torch.optim.AdamW(model.parameters(), lr=a.lr, betas=(0.9, 0.95), weight_decay=0.1)


def batch(ids):
    ix = torch.randint(len(ids) - a.block - 1, (a.batch,))
    x = torch.stack([ids[i:i + a.block] for i in ix])
    y = torch.stack([ids[i + 1:i + a.block + 1] for i in ix])
    return x.to(device), y.to(device)


def lr_at(s):
    if s < a.warmup:
        return a.lr * (s + 1) / a.warmup
    p = (s - a.warmup) / max(1, a.steps - a.warmup)
    return a.lr * (0.1 + 0.9 * 0.5 * (1 + math.cos(math.pi * p)))


@torch.no_grad()
def val_loss(n=20):
    model.eval()
    ids = val_ids if len(val_ids) > a.block + 2 else train_ids
    ls = [model(*batch(ids))[1].item() for _ in range(n)]
    model.train()
    return sum(ls) / len(ls)


Path(a.out).mkdir(parents=True, exist_ok=True)
best, t0 = float("inf"), time.time()
for step in range(a.steps + 1):
    for g in opt.param_groups:
        g["lr"] = lr_at(step)
    if step % a.eval_every == 0 or step == a.steps:
        vl = val_loss()
        print(f"step {step:6d} | val_loss {vl:.4f} | ppl {math.exp(vl):.1f} | {time.time()-t0:.0f}s")
        if vl < best:
            best = vl
            torch.save({"model": model.state_dict(), "config": cfg.to_dict(), "val_loss": vl}, Path(a.out) / "model.pt")
    if step == a.steps:
        break
    x, y = batch(train_ids)
    _, loss = model(x, y)
    opt.zero_grad(set_to_none=True)
    loss.backward()
    torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
    opt.step()
    if step % 50 == 0:
        print(f"step {step:6d} | loss {loss.item():.4f}")
print(f"Selesai. val_loss terbaik {best:.4f} -> {Path(a.out) / 'model.pt'}")
