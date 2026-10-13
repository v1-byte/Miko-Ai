// MIKO-AI ONLINE ROUTER — prefer Cloudflare Worker (token aman di server)
// Fallback opsional: HuggingFace langsung (HANYA untuk dev; jangan taruh token di APK production)

const ADAPTER_LIST = {
  api: "v1-byte/miko-api-lora",
  server: "v1-byte/miko-server-lora",
  web: "v1-byte/miko-web-lora",
  apk: "v1-byte/miko-apk-lora",
  security: "v1-byte/miko-security-lora",
  coding: "v1-byte/miko-coding-lora"
};

// === KONFIG ===
// Production: set WORKER_URL ke Cloudflare Worker kamu (lihat server/worker.mjs)
// Dev saja: isi HF_TOKEN — JANGAN commit token asli
const WORKER_URL = ""; // contoh: "https://miko-router.yourname.workers.dev"
const HF_TOKEN = "";   // kosongkan di production
const HF_BASE = "https://api-inference.huggingface.co/models/";

function detectTopic(text) {
  const t = (text || "").toLowerCase();
  if (t.match(/\bapi\b|endpoint|express|fastapi|rest|postman|jwt|bearer/)) return "api";
  if (t.match(/\bvps\b|nginx|docker|ubuntu|pm2|deploy|server|linux|ssl|domain/)) return "server";
  if (t.match(/\breact\b|tailwind|laravel|next\.js|\bweb\b|frontend|vite|html|css/)) return "web";
  if (t.match(/\bapk\b|capacitor|cordova|android studio|gradle|keystore|build apk/)) return "apk";
  if (t.match(/xss|sqli|sql injection|csrf|idor|rce|hack|security|owasp|brute force|rate limit/)) return "security";
  return "coding";
}

function clientId() {
  try {
    let id = localStorage.getItem("miko_online_client_id");
    if (id && /^[a-zA-Z0-9-]{16,64}$/.test(id)) return id;
    id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random().toString(16).slice(2);
    localStorage.setItem("miko_online_client_id", id);
    return id;
  } catch {
    return "anon-" + Date.now();
  }
}

/** chatMiko: utamakan Worker (aman). Fallback HF hanya jika WORKER_URL kosong + HF_TOKEN diisi. */
async function chatMiko(text, onProgress) {
  const topic = detectTopic(text);
  const modelId = ADAPTER_LIST[topic] || ADAPTER_LIST.coding;

  // 1) Jalur aman: Cloudflare Worker (token di server)
  if (WORKER_URL) {
    if (onProgress) onProgress(`[Router] Topik: ${topic} via Worker (kuota ~3KB)`);
    const res = await fetch(WORKER_URL.replace(/\/$/, ""), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Miko-Client-Id": clientId()
      },
      body: JSON.stringify({ text })
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Worker Error ${res.status}: ${err}`);
    }
    const data = await res.json();
    return {
      topic: data.topic || topic,
      modelId: data.model || modelId,
      answer: data.answer || JSON.stringify(data)
    };
  }

  // 2) Fallback dev: HF langsung (tidak aman untuk production APK)
  if (!HF_TOKEN) {
    throw new Error(
      "Online belum dikonfigurasi. Set WORKER_URL (disarankan) atau HF_TOKEN (dev saja). " +
      "Adapter HF juga harus sudah di-train & di-upload."
    );
  }
  if (onProgress) onProgress(`[Router] Topik: ${topic} -> ${modelId} (HF langsung, dev only)`);
  const res = await fetch(HF_BASE + modelId, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + HF_TOKEN,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      inputs: text,
      parameters: { max_new_tokens: 512, temperature: 0.7, top_p: 0.9, repetition_penalty: 1.1 }
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HF Error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return {
    topic,
    modelId,
    answer: data[0]?.generated_text || JSON.stringify(data)
  };
}

if (typeof window !== "undefined") window.chatMiko = chatMiko;
if (typeof module !== "undefined") module.exports = { chatMiko, detectTopic, ADAPTER_LIST };
