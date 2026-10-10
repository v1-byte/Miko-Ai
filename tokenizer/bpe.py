"""Tokenizer BPE tingkat-byte buatan sendiri (tanpa library tokenizer apa pun).

Aturan HARUS identik dengan runtime/miko-ai-lm.js agar hasil Python == JS.
"""
import json
import re
from collections import Counter

SPECIALS = ["<|pad|>", "<|end|>", "<|user|>", "<|assistant|>", "<|code|>"]
PRE = re.compile(r" ?[A-Za-z0-9_]+| ?[^\sA-Za-z0-9_]+|\s+")
SPLIT = re.compile("(" + "|".join(re.escape(s) for s in SPECIALS) + ")")


def _merge(ids, pair, new_id):
    out, i, n = [], 0, len(ids)
    while i < n:
        if i < n - 1 and ids[i] == pair[0] and ids[i + 1] == pair[1]:
            out.append(new_id)
            i += 2
        else:
            out.append(ids[i])
            i += 1
    return out


class Tokenizer:
    def __init__(self, merges):
        self.merges = [tuple(m) for m in merges]
        self.ranks = {m: i for i, m in enumerate(self.merges)}
        self.nbase = 256 + len(self.merges)
        self.special_id = {s: self.nbase + i for i, s in enumerate(SPECIALS)}
        self.vocab_size = self.nbase + len(SPECIALS)
        self.bytes = [bytes([i]) for i in range(256)]
        for a, b in self.merges:
            self.bytes.append(self.bytes[a] + self.bytes[b])
        self._cache = {}

    # ---------- encode / decode ----------
    def _encode_chunk(self, chunk):
        hit = self._cache.get(chunk)
        if hit is not None:
            return hit
        ids = list(chunk.encode("utf-8"))
        while len(ids) > 1:
            best = None
            for i in range(len(ids) - 1):
                rk = self.ranks.get((ids[i], ids[i + 1]))
                if rk is not None and (best is None or rk < best):
                    best = rk
            if best is None:
                break
            ids = _merge(ids, self.merges[best], 256 + best)
        self._cache[chunk] = ids
        return ids

    def encode(self, text):
        out = []
        for part in SPLIT.split(text):
            if not part:
                continue
            if part in self.special_id:
                out.append(self.special_id[part])
            else:
                for c in PRE.findall(part):
                    out.extend(self._encode_chunk(c))
        return out

    def decode(self, ids):
        inv = {v: k for k, v in self.special_id.items()}
        out, buf = [], bytearray()
        for i in ids:
            if i in inv:
                out.append(buf.decode("utf-8", "replace"))
                buf = bytearray()
                out.append(inv[i])
            elif i < self.nbase:
                buf += self.bytes[i]
        out.append(buf.decode("utf-8", "replace"))
        return "".join(out)

    # ---------- simpan / muat ----------
    def save(self, path):
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"merges": [list(m) for m in self.merges], "specials": SPECIALS}, f)

    @classmethod
    def load(cls, path):
        with open(path, encoding="utf-8") as f:
            d = json.load(f)
        assert d["specials"] == SPECIALS, "daftar token khusus tidak cocok"
        return cls(d["merges"])


def train(texts, vocab_size=1024, min_freq=2, log=print):
    """Latih BPE dari daftar teks. vocab_size sudah termasuk 256 byte + token khusus."""
    freq = Counter()
    for t in texts:
        for part in SPLIT.split(t):
            if part and part not in SPECIALS:
                freq.update(PRE.findall(part))
    words = {w: list(w.encode("utf-8")) for w in freq}
    max_merges = vocab_size - 256 - len(SPECIALS)
    merges = []
    while len(merges) < max_merges:
        pairs = Counter()
        for w, ids in words.items():
            f = freq[w]
            for a, b in zip(ids, ids[1:]):
                pairs[(a, b)] += f
        if not pairs:
            break
        best = max(pairs, key=lambda p: (pairs[p], -p[0], -p[1]))
        if pairs[best] < min_freq:
            break
        new_id = 256 + len(merges)
        merges.append(best)
        for w in words:
            words[w] = _merge(words[w], best, new_id)
        if len(merges) % 100 == 0:
            log(f"  merge {len(merges)}/{max_merges}")
    return Tokenizer(merges)
