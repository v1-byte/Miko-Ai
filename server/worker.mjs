import { detectTopic, TOPICS } from "../runtime/topic-router.mjs";

const HF_CHAT_URL = "https://router.huggingface.co/v1/chat/completions";
const MAX_BODY_BYTES = 8 * 1024;
const MAX_TOKENS = 384;

const SPECIALTY_PROMPTS = {
  web: "Fokus pada pengembangan web. Jawab dalam bahasa Indonesia, berikan contoh yang relevan, dan tandai asumsi versi/library.",
  server: "Fokus pada server dan deployment. Jawab dalam bahasa Indonesia, utamakan langkah yang dapat diuji dan praktik operasi yang aman.",
  api: "Fokus pada desain dan implementasi API. Jawab dalam bahasa Indonesia, sertakan validasi input, autentikasi yang sesuai, dan contoh yang aman.",
  apk: "Fokus pada Android dan APK. Jawab dalam bahasa Indonesia, bedakan kode aplikasi, izin sistem, signing, dan proses distribusi.",
  security: "Fokus pada keamanan defensif. Jelaskan mitigasi dan pengujian yang diizinkan; jangan mengarang hasil uji yang belum dilakukan.",
  coding: "Fokus pada pemrograman umum. Jawab dalam bahasa Indonesia dan jelaskan cara menguji kode.",
};

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = String(env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return origin && allowed.includes(origin) ? origin : null;
}

async function readBodyLimited(request) {
  const reader = request.body?.getReader();
  if (!reader) return { raw: "" };
  const decoder = new TextDecoder();
  let raw = "";
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return { tooLarge: true };
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    return { raw };
  } catch {
    try { await reader.cancel(); } catch {}
    return { invalid: true };
  }
}

function jsonResponse(body, status, origin = null) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, X-Miko-Client-Id");
    headers.set("Access-Control-Max-Age", "600");
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export default {
  async fetch(request, env) {
    const origin = allowedOrigin(request, env);
    if (!origin) return jsonResponse({ error: "origin_not_allowed" }, 403);

    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Vary": "Origin",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Miko-Client-Id",
          "Access-Control-Max-Age": "600",
        },
      });
    }
    if (url.pathname === "/health" && request.method === "GET") {
      const configured = TOPICS.filter((topic) => env[`MIKO_MODEL_${topic.toUpperCase()}`] || env.MIKO_MODEL_DEFAULT);
      return jsonResponse({ status: "ok", configuredTopics: configured }, 200, origin);
    }
    if (url.pathname !== "/chat") return jsonResponse({ error: "not_found" }, 404, origin);
    if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405, origin);
    if (!request.headers.get("Content-Type")?.toLowerCase().includes("application/json")) {
      return jsonResponse({ error: "content_type_must_be_json" }, 415, origin);
    }

    const declaredLength = Number(request.headers.get("Content-Length") ?? 0);
    if (declaredLength > MAX_BODY_BYTES) return jsonResponse({ error: "request_too_large" }, 413, origin);

    const bodyResult = await readBodyLimited(request);
    if (bodyResult.tooLarge) return jsonResponse({ error: "request_too_large" }, 413, origin);
    if (bodyResult.invalid) return jsonResponse({ error: "invalid_request_body" }, 400, origin);
    let payload;
    try {
      payload = JSON.parse(bodyResult.raw);
    } catch {
      return jsonResponse({ error: "invalid_json" }, 400, origin);
    }
    if (typeof payload?.text !== "string" || !payload.text.trim()) {
      return jsonResponse({ error: "text_required" }, 400, origin);
    }

    const clientId = request.headers.get("X-Miko-Client-Id") ?? "";
    if (!/^[a-zA-Z0-9-]{16,64}$/.test(clientId)) {
      return jsonResponse({ error: "client_id_required" }, 400, origin);
    }
    if (!env.MIKO_RATE_LIMITER?.limit) {
      return jsonResponse({ error: "rate_limiter_not_configured" }, 503, origin);
    }
    try {
      const { success } = await env.MIKO_RATE_LIMITER.limit({ key: `chat:${clientId}` });
      if (!success) return jsonResponse({ error: "rate_limited" }, 429, origin);
    } catch {
      return jsonResponse({ error: "rate_limiter_unavailable" }, 503, origin);
    }

    const topic = detectTopic(payload.text);
    const model = env[`MIKO_MODEL_${topic.toUpperCase()}`] || env.MIKO_MODEL_DEFAULT;
    if (!model || !env.HF_TOKEN) return jsonResponse({ error: "model_or_hf_token_not_configured" }, 503, origin);

    let upstream;
    try {
      upstream = await fetch(HF_CHAT_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.HF_TOKEN}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SPECIALTY_PROMPTS[topic] },
            { role: "user", content: payload.text },
          ],
          max_tokens: MAX_TOKENS,
          temperature: 0.25,
          stream: false,
        }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      return jsonResponse({ error: "inference_provider_unavailable" }, 502, origin);
    }
    if (!upstream.ok) return jsonResponse({ error: "inference_provider_failed" }, 502, origin);

    let result;
    try {
      result = await upstream.json();
    } catch {
      return jsonResponse({ error: "invalid_inference_response" }, 502, origin);
    }
    const answer = result?.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) {
      return jsonResponse({ error: "empty_inference_response" }, 502, origin);
    }
    return jsonResponse({ answer, topic, model }, 200, origin);
  },
};
