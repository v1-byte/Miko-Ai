// Runtime AI Miko AI: tokenizer + transformer (inferensi) murni JavaScript.
// Jalan di browser / WebView APK / Node. Tanpa library, tanpa server.
// Aturan tokenizer HARUS identik dengan tokenizer/bpe.py.

export const SPECIALS = ["<|pad|>", "<|end|>", "<|user|>", "<|assistant|>", "<|code|>"];
const PRE = / ?[A-Za-z0-9_]+| ?[^\sA-Za-z0-9_]+|\s+/g;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const SPLIT = new RegExp("(" + SPECIALS.map(esc).join("|") + ")");

function mergeIds(ids, a, b, newId) {
  const out = [];
  for (let i = 0; i < ids.length; ) {
    if (i < ids.length - 1 && ids[i] === a && ids[i + 1] === b) { out.push(newId); i += 2; }
    else { out.push(ids[i]); i += 1; }
  }
  return out;
}

export class Tokenizer {
  constructor(data) {
    this.merges = data.merges;
    this.ranks = new Map(this.merges.map(([a, b], i) => [a * 100000 + b, i]));
    this.nbase = 256 + this.merges.length;
    this.specialId = Object.fromEntries(SPECIALS.map((s, i) => [s, this.nbase + i]));
    this.vocabSize = this.nbase + SPECIALS.length;
    this.bytes = [];
    for (let i = 0; i < 256; i++) this.bytes.push([i]);
    for (const [a, b] of this.merges) this.bytes.push(this.bytes[a].concat(this.bytes[b]));
    this.cache = new Map();
    this.enc = new TextEncoder();
    this.dec = new TextDecoder("utf-8");
  }
  _chunk(chunk) {
    let hit = this.cache.get(chunk);
    if (hit) return hit;
    let ids = Array.from(this.enc.encode(chunk));
    while (ids.length > 1) {
      let best = -1;
      for (let i = 0; i < ids.length - 1; i++) {
        const r = this.ranks.get(ids[i] * 100000 + ids[i + 1]);
        if (r !== undefined && (best < 0 || r < best)) best = r;
      }
      if (best < 0) break;
      const [a, b] = this.merges[best];
      ids = mergeIds(ids, a, b, 256 + best);
    }
    this.cache.set(chunk, ids);
    return ids;
  }
  encode(text) {
    const out = [];
    for (const part of text.split(SPLIT)) {
      if (!part) continue;
      if (part in this.specialId) out.push(this.specialId[part]);
      else for (const c of part.match(PRE) || []) for (const id of this._chunk(c)) out.push(id);
    }
    return out;
  }
  decode(ids) {
    const inv = {};
    for (const [s, id] of Object.entries(this.specialId)) inv[id] = s;
    let out = "", buf = [];
    const flush = () => { if (buf.length) { out += this.dec.decode(new Uint8Array(buf)); buf = []; } };
    for (const id of ids) {
      if (inv[id] !== undefined) { flush(); out += inv[id]; }
      else if (id < this.nbase) for (const b of this.bytes[id]) buf.push(b);
    }
    flush();
    return out;
  }
}

// ---------- operasi matematika ----------
function layerNorm(x, w, b) {
  const n = x.length; let mean = 0;
  for (let i = 0; i < n; i++) mean += x[i];
  mean /= n;
  let v = 0;
  for (let i = 0; i < n; i++) { const d = x[i] - mean; v += d * d; }
  const inv = 1 / Math.sqrt(v / n + 1e-5);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) y[i] = (x[i] - mean) * inv * w[i] + b[i];
  return y;
}
function linear(x, W, b, out, inn) {
  const y = new Float32Array(out);
  for (let o = 0; o < out; o++) {
    let s = b[o]; const row = o * inn;
    for (let i = 0; i < inn; i++) s += W[row + i] * x[i];
    y[o] = s;
  }
  return y;
}
const K = Math.sqrt(2 / Math.PI);
const gelu = (x) => 0.5 * x * (1 + Math.tanh(K * (x + 0.044715 * x * x * x)));

export class MikoAILM {
  constructor(manifest, buffer, tokenizerData) {
    if (buffer instanceof Uint8Array) buffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    this.cfg = manifest.config;
    this.version = manifest.version;
    this.tok = new Tokenizer(tokenizerData);
    if (this.tok.vocabSize !== this.cfg.vocab_size) throw new Error("vocab tokenizer != model");
    const w = {};
    for (const t of manifest.tensors) w[t.name] = new Float32Array(buffer, t.offset * 4, t.length);
    this.wte = w.wte; this.wpe = w.wpe; this.lnfW = w["ln_f.w"]; this.lnfB = w["ln_f.b"];
    this.L = [];
    for (let i = 0; i < this.cfg.n_layer; i++) {
      const g = (n) => w[`h${i}.${n}`];
      this.L.push({ ln1w: g("ln1.w"), ln1b: g("ln1.b"), qkvw: g("qkv.w"), qkvb: g("qkv.b"), projw: g("proj.w"), projb: g("proj.b"),
        ln2w: g("ln2.w"), ln2b: g("ln2.b"), fcw: g("fc.w"), fcb: g("fc.b"), mpw: g("mproj.w"), mpb: g("mproj.b") });
    }
  }
  newState() {
    const { n_layer, block_size, n_embd } = this.cfg;
    return { pos: 0,
      k: Array.from({ length: n_layer }, () => new Float32Array(block_size * n_embd)),
      v: Array.from({ length: n_layer }, () => new Float32Array(block_size * n_embd)) };
  }
  // Satu langkah (satu token) dengan KV-cache; mengembalikan logits token berikutnya.
  step(token, st) {
    const { n_embd: C, n_head: H, n_layer, block_size: T, vocab_size: V } = this.cfg;
    const hd = C / H, pos = st.pos;
    if (pos >= T) throw new Error("konteks penuh");
    let x = new Float32Array(C);
    for (let i = 0; i < C; i++) x[i] = this.wte[token * C + i] + this.wpe[pos * C + i];
    const scale = 1 / Math.sqrt(hd);
    for (let l = 0; l < n_layer; l++) {
      const p = this.L[l];
      const qkv = linear(layerNorm(x, p.ln1w, p.ln1b), p.qkvw, p.qkvb, 3 * C, C);
      st.k[l].set(qkv.subarray(C, 2 * C), pos * C);
      st.v[l].set(qkv.subarray(2 * C, 3 * C), pos * C);
      const att = new Float32Array(C), sc = new Float32Array(pos + 1);
      for (let h = 0; h < H; h++) {
        const qo = h * hd; let mx = -Infinity;
        for (let t = 0; t <= pos; t++) {
          let s = 0; const ko = t * C + qo;
          for (let d = 0; d < hd; d++) s += qkv[qo + d] * st.k[l][ko + d];
          s *= scale; sc[t] = s; if (s > mx) mx = s;
        }
        let sum = 0;
        for (let t = 0; t <= pos; t++) { sc[t] = Math.exp(sc[t] - mx); sum += sc[t]; }
        for (let t = 0; t <= pos; t++) {
          const wgt = sc[t] / sum, vo = t * C + qo;
          for (let d = 0; d < hd; d++) att[qo + d] += wgt * st.v[l][vo + d];
        }
      }
      const y = linear(att, p.projw, p.projb, C, C);
      for (let i = 0; i < C; i++) x[i] += y[i];
      const f = linear(layerNorm(x, p.ln2w, p.ln2b), p.fcw, p.fcb, 4 * C, C);
      for (let i = 0; i < f.length; i++) f[i] = gelu(f[i]);
      const m = linear(f, p.mpw, p.mpb, C, 4 * C);
      for (let i = 0; i < C; i++) x[i] += m[i];
    }
    st.pos++;
    const xf = layerNorm(x, this.lnfW, this.lnfB);
    const logits = new Float32Array(V);
    for (let v = 0; v < V; v++) { let s = 0; const o = v * C; for (let i = 0; i < C; i++) s += this.wte[o + i] * xf[i]; logits[v] = s; }
    return logits;
  }
  _sample(logits, temperature, topK) {
    const V = logits.length;
    if (!(temperature > 0)) { let b = 0; for (let i = 1; i < V; i++) if (logits[i] > logits[b]) b = i; return b; }
    let idx = Array.from({ length: V }, (_, i) => i);
    if (topK && topK < V) { idx.sort((a, b) => logits[b] - logits[a]); idx = idx.slice(0, topK); }
    let mx = -Infinity; for (const i of idx) if (logits[i] > mx) mx = logits[i];
    const pr = idx.map((i) => Math.exp((logits[i] - mx) / temperature));
    let r = Math.random() * pr.reduce((a, b) => a + b, 0);
    for (let j = 0; j < idx.length; j++) { r -= pr[j]; if (r <= 0) return idx[j]; }
    return idx[idx.length - 1];
  }
  // Generator sinkron id token. opts: maxNew, temperature, topK, stopIds
  *genIds(promptIds, opts = {}) {
    const { maxNew = 200, temperature = 0.7, topK = 40 } = opts;
    const stopIds = opts.stopIds ?? [this.tok.specialId["<|end|>"], this.tok.specialId["<|user|>"]];
    const T = this.cfg.block_size;
    let ids = promptIds.slice(-(T - 1));
    if (!ids.length) ids = [this.tok.specialId["<|pad|>"]];
    const st = this.newState();
    let logits;
    for (const id of ids) logits = this.step(id, st);
    const limit = Math.min(maxNew, T - ids.length);
    for (let n = 0; n < limit; n++) {
      const nxt = this._sample(logits, temperature, topK);
      if (stopIds.includes(nxt)) return;
      yield nxt;
      if (n + 1 < limit) logits = this.step(nxt, st);
    }
  }
  // Generator async teks (aman untuk UI): yield potongan teks baru.
  async *generate(prompt, opts = {}) {
    const gen = [], g = this.genIds(this.tok.encode(prompt), opts);
    let emitted = "", n = 0;
    for (const id of g) {
      gen.push(id);
      const text = this.tok.decode(gen);
      if (!text.endsWith("�")) { const d = text.slice(emitted.length); emitted = text; if (d) yield d; }
      if (++n % 4 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    const rest = this.tok.decode(gen).slice(emitted.length);
    if (rest) yield rest;
  }
  async complete(prompt, opts) { let s = ""; for await (const d of this.generate(prompt, opts)) s += d; return s; }
}

// Muat dari URL (browser/WebView) — baseUrl berisi model.json, model.bin, tokenizer.json
export async function loadModel(baseUrl = "./model/") {
  const get = (f) => fetch(baseUrl + f);
  const [m, b, t] = await Promise.all([get("model.json"), get("model.bin"), get("tokenizer.json")]);
  if (!m.ok || !b.ok || !t.ok) throw new Error("berkas model tidak ditemukan di " + baseUrl);
  return new MikoAILM(await m.json(), await b.arrayBuffer(), await t.json());
}
