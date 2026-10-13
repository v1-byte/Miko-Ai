import assert from "node:assert/strict";
import { detectTopic, TOPICS } from "./topic-router.mjs";
import { requestOnline, validateEndpoint, MAX_ONLINE_REQUEST_BYTES } from "./online-client.mjs";
import { reply, setKnowledge } from "./assistant.js";
import worker from "../server/worker.mjs";

const routes = [
  ["Buat halaman React dengan Tailwind", "web"],
  ["Deploy VPS Ubuntu pakai Nginx", "server"],
  ["Buat API REST dan endpoint Express", "api"],
  ["Cara build APK Capacitor dan Gradle", "apk"],
  ["Bagaimana mencegah XSS dan SQL injection?", "security"],
  ["Tulis fungsi Python untuk mengurutkan list", "coding"],
];
for (const [prompt, expected] of routes) assert.equal(detectTopic(prompt), expected, prompt);
assert.deepEqual([...TOPICS].sort(), ["api", "apk", "coding", "security", "server", "web"]);
assert.equal(detectTopic(""), "coding");

assert.equal(validateEndpoint("https://router.example.workers.dev/chat"), "https://router.example.workers.dev/chat");
assert.equal(validateEndpoint("http://localhost:8787/chat"), "http://localhost:8787/chat");
assert.throws(() => validateEndpoint("https://router.example/chat?token=secret"), /query/);
assert.throws(() => validateEndpoint("http://router.example/chat"), /HTTPS/);
assert.throws(() => validateEndpoint("https://user:pass@router.example/chat"), /kredensial/);

let sent;
const goodFetch = async (url, init) => {
  sent = { url, init };
  return new Response(JSON.stringify({ answer: "Jawaban online", topic: "api", model: "demo/model" }), { status: 200 });
};
const clientResult = await requestOnline("https://router.example/chat", "Buat API", {
  clientId: "12345678-1234-1234-1234-123456789abc",
  fetchImpl: goodFetch,
});
assert.equal(clientResult.answer, "Jawaban online");
assert.equal(sent.url, "https://router.example/chat");
const requestHeaders = new Headers(sent.init.headers);
assert.equal(requestHeaders.get("Authorization"), null, "client must never send a Hugging Face token");
assert.equal(requestHeaders.get("X-Miko-Client-Id"), "12345678-1234-1234-1234-123456789abc");
assert.deepEqual(JSON.parse(sent.init.body), { text: "Buat API" });
assert.equal(sent.init.credentials, "omit");
await assert.rejects(
  requestOnline("https://router.example/chat", "x".repeat(MAX_ONLINE_REQUEST_BYTES), { fetchImpl: goodFetch }),
  /8 KB/,
);
await assert.rejects(
  requestOnline("https://router.example/chat", "Buat API", {
    clientId: "12345678-1234-1234-1234-123456789abc",
    fetchImpl: async () => new Response("{}", { status: 429 }),
  }),
  /membatasi/,
);

const remoteChunks = [];
let routeInfo;
for await (const chunk of reply(null, "Buat API", undefined, {
  online: { enabled: true, endpoint: "https://router.example/chat", clientId: "12345678-1234-1234-1234-123456789abc" },
  fetchImpl: goodFetch,
  onRoute: (info) => { routeInfo = info; },
})) remoteChunks.push(chunk);
assert.deepEqual(remoteChunks, ["Jawaban online"]);
assert.equal(routeInfo.mode, "online");

async function* offlineModel() { yield "Jawaban offline"; }
const offlineChunks = [];
for await (const chunk of reply({ generate: offlineModel }, "pertanyaan coding", undefined, { online: { enabled: false } })) offlineChunks.push(chunk);
assert.deepEqual(offlineChunks, ["Jawaban offline"]);
setKnowledge([{ user: "contoh retrieval knowledge miko", assistant: "Jawaban dari knowledge lokal." }]);
const knowledgeChunks = [];
for await (const chunk of reply({ generate: offlineModel }, "contoh retrieval knowledge miko", undefined, { online: { enabled: false } })) knowledgeChunks.push(chunk);
assert.deepEqual(knowledgeChunks, ["Jawaban dari knowledge lokal."]);
setKnowledge([]);
const fallbackChunks = [];
for await (const chunk of reply({ generate: offlineModel }, "Buat API", undefined, {
  online: { enabled: true, endpoint: "https://router.example/chat", clientId: "12345678-1234-1234-1234-123456789abc" },
  fetchImpl: async () => { throw new Error("offline"); },
  onRoute: (info) => { routeInfo = info; },
})) fallbackChunks.push(chunk);
assert.deepEqual(fallbackChunks, ["Jawaban offline"]);
assert.equal(routeInfo.mode, "offline-fallback");

const originalFetch = globalThis.fetch;
let upstreamRequest;
globalThis.fetch = async (url, init) => {
  upstreamRequest = { url: String(url), init };
  return new Response(JSON.stringify({ choices: [{ message: { content: "Jawaban dari provider" } }] }), { status: 200 });
};
try {
  const env = {
    ALLOWED_ORIGINS: "capacitor://localhost",
    HF_TOKEN: "test-secret-never-returned",
    MIKO_MODEL_API: "demo/api-model:provider",
    MIKO_RATE_LIMITER: { limit: async ({ key }) => ({ success: key === "chat:12345678-1234-1234-1234-123456789abc" }) },
  };
  const makeRequest = (origin = "capacitor://localhost") => new Request("https://router.example/chat", {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      "X-Miko-Client-Id": "12345678-1234-1234-1234-123456789abc",
    },
    body: JSON.stringify({ text: "Buat API endpoint" }),
  });
  const response = await worker.fetch(makeRequest(), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "capacitor://localhost");
  const payload = await response.json();
  assert.equal(payload.answer, "Jawaban dari provider");
  assert.equal(payload.topic, "api");
  assert.equal(JSON.stringify(payload).includes("test-secret-never-returned"), false);
  assert.equal(upstreamRequest.url, "https://router.huggingface.co/v1/chat/completions");
  assert.equal(new Headers(upstreamRequest.init.headers).get("Authorization"), "Bearer test-secret-never-returned");

  const badOrigin = await worker.fetch(new Request("https://router.example/chat", {
    method: "POST", headers: { Origin: "https://attacker.example", "Content-Type": "application/json" }, body: JSON.stringify({ text: "x" }),
  }), env);
  assert.equal(badOrigin.status, 403);
  const preflight = await worker.fetch(new Request("https://router.example/chat", {
    method: "OPTIONS", headers: { Origin: "capacitor://localhost" },
  }), env);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Headers"), "Content-Type, X-Miko-Client-Id");
  const tooLarge = await worker.fetch(new Request("https://router.example/chat", {
    method: "POST", headers: { Origin: "capacitor://localhost", "Content-Type": "application/json" }, body: "x".repeat(MAX_ONLINE_REQUEST_BYTES + 100),
  }), env);
  assert.equal(tooLarge.status, 413);
  const deniedByLimiter = await worker.fetch(makeRequest(), { ...env, MIKO_RATE_LIMITER: { limit: async () => ({ success: false }) } });
  assert.equal(deniedByLimiter.status, 429);
  const noLimiter = await worker.fetch(makeRequest(), { ...env, MIKO_RATE_LIMITER: undefined });
  assert.equal(noLimiter.status, 503);
  const noModel = await worker.fetch(makeRequest(), { ...env, MIKO_MODEL_API: undefined });
  assert.equal(noModel.status, 503);
} finally {
  globalThis.fetch = originalFetch;
}

console.log("Semua tes router online/offline lulus.");
