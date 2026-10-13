export const MAX_ONLINE_REQUEST_BYTES = 8 * 1024;

export function validateEndpoint(value) {
  let url;
  try {
    url = new URL(String(value ?? "").trim());
  } catch {
    throw new Error("URL router online tidak valid.");
  }
  const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !localHttp) {
    throw new Error("Endpoint router online harus memakai HTTPS (HTTP hanya di localhost untuk pengujian).");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("URL endpoint tidak boleh memuat kredensial, query, atau fragment.");
  }
  return url.href.replace(/\/$/, "");
}

function makeClientId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return [...bytes].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function getOrCreateClientId(storage) {
  try {
    const store = storage ?? globalThis.localStorage;
    const existing = store?.getItem("miko_online_client_id");
    if (existing && /^[a-zA-Z0-9-]{16,64}$/.test(existing)) return existing;
    const id = makeClientId();
    store?.setItem("miko_online_client_id", id);
    return id;
  } catch {
    return makeClientId();
  }
}

export async function requestOnline(endpoint, text, options = {}) {
  const url = validateEndpoint(endpoint);
  if (typeof text !== "string" || !text.trim()) throw new Error("Pertanyaan online kosong.");
  const body = JSON.stringify({ text });
  if (new TextEncoder().encode(body).byteLength > MAX_ONLINE_REQUEST_BYTES) {
    throw new Error("Pertanyaan terlalu panjang untuk router online (batas request 8 KB).");
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error("Fetch tidak tersedia di perangkat ini.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 25_000);
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Miko-Client-Id": options.clientId ?? getOrCreateClientId(options.storage),
      },
      body,
      signal: controller.signal,
    });
    if (!response.ok) {
      if (response.status === 429) throw new Error("Router online membatasi permintaan; coba lagi nanti.");
      if (response.status === 503) throw new Error("Model online belum siap atau belum dikonfigurasi.");
      throw new Error(`Router online gagal (HTTP ${response.status}).`);
    }
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("Respons router online bukan JSON yang valid.");
    }
    if (!data || typeof data.answer !== "string" || !data.answer.trim()) {
      throw new Error("Respons router online tidak berisi jawaban.");
    }
    return {
      answer: data.answer,
      topic: typeof data.topic === "string" ? data.topic : undefined,
      model: typeof data.model === "string" ? data.model : undefined,
    };
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Router online timeout.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
