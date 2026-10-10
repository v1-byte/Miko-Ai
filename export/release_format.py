"""Penulis format rilis (hanya numpy). Dipakai export_weights.py dan tests/make_fixture.py.

Berkas rilis:
  model.json      -> config + daftar tensor (nama, bentuk, offset dalam satuan float32)
  model.bin       -> semua tensor float32 little-endian berurutan
  tokenizer.json  -> salinan tokenizer
  parity.json     -> data uji agar runtime JS dibuktikan sama dengan Python
"""
import json
import shutil
from pathlib import Path

import numpy as np


def tensor_order(n_layer):
    names = ["wte", "wpe"]
    for i in range(n_layer):
        for t in ["ln1.w", "ln1.b", "qkv.w", "qkv.b", "proj.w", "proj.b",
                  "ln2.w", "ln2.b", "fc.w", "fc.b", "mproj.w", "mproj.b"]:
            names.append(f"h{i}.{t}")
    names += ["ln_f.w", "ln_f.b"]
    return names


def write_release(out_dir, cfg, tensors, tokenizer_path, parity, version="dev"):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    meta, offset, chunks = [], 0, []
    for name in tensor_order(cfg["n_layer"]):
        arr = np.ascontiguousarray(tensors[name], dtype="<f4")
        meta.append({"name": name, "shape": list(arr.shape), "offset": offset, "length": int(arr.size)})
        chunks.append(arr.reshape(-1))
        offset += int(arr.size)
    (out / "model.bin").write_bytes(np.concatenate(chunks).astype("<f4").tobytes())
    (out / "model.json").write_text(json.dumps(
        {"version": version, "config": cfg, "params": offset, "tensors": meta}), encoding="utf-8")
    shutil.copyfile(tokenizer_path, out / "tokenizer.json")
    (out / "parity.json").write_text(json.dumps(parity), encoding="utf-8")
    return offset
