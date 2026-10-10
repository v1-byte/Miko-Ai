"""Bangun data uji paritas Python <-> JS (tokenizer + logits + generate greedy)."""

PROMPT = "<|user|>\nApa itu CDN?\n<|assistant|>\n"
TOK_TESTS = [
    "function add(a, b) {\n  return a + b;\n}\n",
    "<|user|>\nhalo  dunia\n<|assistant|>\n",
    "if x >= 10:  # komentar\n\tprint('é ü 日本')\n",
    "<|code|>\n<div class=\"a\">x</div><|end|>\n",
    "   ",
]


def build_parity(tok, cfg, logits_fn, greedy_fn, n_greedy=24):
    ids = tok.encode(PROMPT)
    ids = ids[-(cfg["block_size"] - n_greedy - 1):]
    last = logits_fn(ids)
    return {
        "prompt": PROMPT,
        "prompt_ids": ids,
        "logits_head": [float(x) for x in last[:16]],
        "logits_argmax": int(last.argmax()),
        "greedy_ids": [int(x) for x in greedy_fn(ids, n_greedy)],
        "tok_tests": [{"text": t, "ids": tok.encode(t)} for t in TOK_TESTS],
    }
