// MIKO-AI ONLINE ROUTER - VERSI IRIT KUOTA 3KB
// GANTI HF_TOKEN DENGAN TOKEN ASLI KAMU DARI huggingface.co/settings/tokens

const HF_TOKEN = "hf_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"; // <-- GANTI INI
const HF_BASE = "https://api-inference.huggingface.co/models/";
const ADAPTER_LIST = {
  api: "v1-byte/miko-api-lora",
  server: "v1-byte/miko-server-lora",
  web: "v1-byte/miko-web-lora",
  apk: "v1-byte/miko-apk-lora",
  security: "v1-byte/miko-security-lora",
  coding: "v1-byte/miko-coding-lora"
};

function detectTopic(text){
  const t = (text||"").toLowerCase();
  if(t.match(/\bapi\b|endpoint|express|fastapi|rest/)) return "api";
  if(t.match(/vps|nginx|docker|ubuntu|pm2|deploy|server/)) return "server";
  if(t.match(/react|tailwind|laravel|web|frontend/)) return "web";
  if(t.match(/apk|capacitor|android/)) return "apk";
  if(t.match(/xss|sqli|hack|security|aman/)) return "security";
  return "coding";
}

async function chatMiko(text, onProgress){
  const topic = detectTopic(text);
  const modelId = ADAPTER_LIST[topic];
  if(onProgress) onProgress(`[Router] Topik: ${topic} -> ${modelId} (kuota 3KB)`);
  
  const res = await fetch(HF_BASE + modelId, {
    method: "POST",
    headers: { "Authorization": "Bearer " + HF_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ inputs: text, parameters: { max_new_tokens: 512, temperature: 0.7, top_p: 0.9, repetition_penalty: 1.1 } })
  });
  
  if(!res.ok){
    const err = await res.text();
    throw new Error(`HF Error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return { topic, modelId, answer: data[0]?.generated_text || JSON.stringify(data) };
}

// Contoh pakai di APK Capacitor / Web:
// chatMiko("bikin API login anti brute force").then(r=>console.log(r.answer));

if(typeof window !== 'undefined') window.chatMiko = chatMiko;
