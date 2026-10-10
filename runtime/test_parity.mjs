// Uji paritas: runtime JS harus menghasilkan token & logits yang sama dengan Python.
// Pakai: node runtime/test_parity.mjs [folder_rilis]   (default: release/)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ZiperrLM, Tokenizer } from "./ziperr-lm.js";

const dir = process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), "../release");
const rd = (f) => fs.readFileSync(path.join(dir, f));
const manifest = JSON.parse(rd("model.json")), tokData = JSON.parse(rd("tokenizer.json")), parity = JSON.parse(rd("parity.json"));
const lm = new ZiperrLM(manifest, rd("model.bin"), tokData);
let fail = 0;
const check = (ok, msg) => { console.log((ok ? "OK   " : "GAGAL") + " " + msg); if (!ok) fail++; };

// 1) tokenizer
const tok = new Tokenizer(tokData);
for (const t of parity.tok_tests)
  check(JSON.stringify(tok.encode(t.text)) === JSON.stringify(t.ids), `tokenizer encode ${JSON.stringify(t.text.slice(0, 24))}`);
for (const t of parity.tok_tests) check(tok.decode(tok.encode(t.text)) === t.text, `tokenizer round-trip ${JSON.stringify(t.text.slice(0, 24))}`);
check(JSON.stringify(tok.encode(parity.prompt).slice(-parity.prompt_ids.length)) === JSON.stringify(parity.prompt_ids), "prompt_ids");

// 2) logits
const st = lm.newState(); let logits;
for (const id of parity.prompt_ids) logits = lm.step(id, st);
let maxErr = 0;
parity.logits_head.forEach((v, i) => { maxErr = Math.max(maxErr, Math.abs(v - logits[i])); });
check(maxErr < 2e-3, `logits (galat maks ${maxErr.toExponential(2)})`);
let am = 0; for (let i = 1; i < logits.length; i++) if (logits[i] > logits[am]) am = i;
check(am === parity.logits_argmax, "argmax logits");

// 3) generate greedy
const g = [...lm.genIds(parity.prompt_ids, { maxNew: parity.greedy_ids.length, temperature: 0, stopIds: [] })];
check(JSON.stringify(g) === JSON.stringify(parity.greedy_ids), "generate greedy sama dengan Python");

console.log(fail ? `\n${fail} uji GAGAL` : "\nSemua uji paritas lulus");
process.exit(fail ? 1 : 0);
