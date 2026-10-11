"""Jalankan benchmark coding terpisah dari data training; hasil perlu dinilai manusia."""
import argparse
import json
import sys
from pathlib import Path

import torch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from model.gpt import GPT, Config  # noqa: E402
from tokenizer.bpe import Tokenizer  # noqa: E402


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--ckpt", default=str(ROOT / "out/model.pt"))
    ap.add_argument("--tok", default=str(ROOT / "tokenizer/tokenizer.json"))
    ap.add_argument("--benchmark", default=str(ROOT / "tests/coding_benchmark.jsonl"))
    ap.add_argument("--output", default=str(ROOT / "out/coding_benchmark_results.jsonl"))
    ap.add_argument("--max_new", type=int, default=220)
    args = ap.parse_args()

    checkpoint = torch.load(args.ckpt, map_location="cpu")
    config = Config(**checkpoint["config"])
    model = GPT(config)
    model.load_state_dict(checkpoint["model"])
    model.eval()
    tokenizer = Tokenizer.load(args.tok)
    stop_ids = tuple(tokenizer.special_id[s] for s in ("<|end|>", "<|user|>"))

    rows = []
    for number, line in enumerate(Path(args.benchmark).read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        item = json.loads(line)
        question = item["user"].strip()
        prompt = f"<|user|>\n{question}\n<|assistant|>\n"
        prompt_ids = tokenizer.encode(prompt)
        if len(prompt_ids) >= config.block_size:
            raise ValueError(f"Pertanyaan benchmark {number} melebihi block_size model")
        with torch.no_grad():
            output = model.generate(
                torch.tensor([prompt_ids], dtype=torch.long),
                args.max_new,
                temperature=0.0,
                stop_ids=stop_ids,
            )[0].tolist()
        answer = tokenizer.decode(output[len(prompt_ids):]).split("<|end|>", 1)[0].strip()
        rows.append({"user": question, "checks": item.get("checks", []), "assistant": answer})

    destination = Path(args.output)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows), encoding="utf-8")
    print(f"Benchmark selesai: {len(rows)} kasus -> {destination}")
    print("Nilai jawaban secara manual terhadap field 'checks'; runner ini tidak mengarang skor kualitas otomatis.")


if __name__ == "__main__":
    main()
