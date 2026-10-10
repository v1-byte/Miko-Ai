"""Referensi numpy (tanpa torch) untuk model: dipakai menguji runtime JS dengan bobot acak.
Matematika harus sama dengan model/gpt.py.
"""
import numpy as np


def ln(x, w, b, eps=1e-5):
    m = x.mean(-1, keepdims=True)
    v = ((x - m) ** 2).mean(-1, keepdims=True)
    return (x - m) / np.sqrt(v + eps) * w + b


def gelu(x):
    return 0.5 * x * (1 + np.tanh(np.sqrt(2 / np.pi) * (x + 0.044715 * x ** 3)))


def forward(T, cfg, ids):
    """Logit untuk posisi terakhir. T: dict tensor (float32), ids: list token."""
    C, H = cfg["n_embd"], cfg["n_head"]
    n = len(ids)
    x = T["wte"][ids] + T["wpe"][:n]
    for i in range(cfg["n_layer"]):
        g = lambda k: T[f"h{i}.{k}"]
        h = ln(x, g("ln1.w"), g("ln1.b"))
        qkv = h @ g("qkv.w").T + g("qkv.b")
        q, k, v = np.split(qkv, 3, axis=-1)
        q, k, v = [t.reshape(n, H, C // H).transpose(1, 0, 2) for t in (q, k, v)]
        s = q @ k.transpose(0, 2, 1) / np.sqrt(C // H)
        s = np.where(np.tril(np.ones((n, n), bool)), s, -np.inf)
        s = np.exp(s - s.max(-1, keepdims=True))
        s /= s.sum(-1, keepdims=True)
        y = (s @ v).transpose(1, 0, 2).reshape(n, C)
        x = x + y @ g("proj.w").T + g("proj.b")
        h = ln(x, g("ln2.w"), g("ln2.b"))
        x = x + gelu(h @ g("fc.w").T + g("fc.b")) @ g("mproj.w").T + g("mproj.b")
    return (ln(x, T["ln_f.w"], T["ln_f.b"]) @ T["wte"].T)[-1]


def greedy(T, cfg, ids, n):
    ids = list(ids)
    out = []
    for _ in range(n):
        nxt = int(forward(T, cfg, ids[-cfg["block_size"]:]).argmax())
        ids.append(nxt)
        out.append(nxt)
    return out


def random_weights(cfg, seed=0):
    r = np.random.default_rng(seed)
    C, V, L = cfg["n_embd"], cfg["vocab_size"], cfg["n_layer"]
    N = lambda *s: (r.standard_normal(s) * 0.05).astype(np.float32)
    T = {"wte": N(V, C), "wpe": N(cfg["block_size"], C),
         "ln_f.w": 1 + N(C), "ln_f.b": N(C)}
    for i in range(L):
        T.update({f"h{i}.ln1.w": 1 + N(C), f"h{i}.ln1.b": N(C), f"h{i}.qkv.w": N(3 * C, C), f"h{i}.qkv.b": N(3 * C),
                  f"h{i}.proj.w": N(C, C), f"h{i}.proj.b": N(C), f"h{i}.ln2.w": 1 + N(C), f"h{i}.ln2.b": N(C),
                  f"h{i}.fc.w": N(4 * C, C), f"h{i}.fc.b": N(4 * C), f"h{i}.mproj.w": N(C, 4 * C), f"h{i}.mproj.b": N(C)})
    return T
