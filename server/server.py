# SERVER GRATIS - JALAN DI GITHUB CODESPACES / KAGGLE / HF SPACES
# Fungsi: Download shard 1GB dari GitHub Release (sekali), jadi API irit kuota

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import requests

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Simulasi load adapter (ganti dengan model asli kalau mau)
ADAPTERS = {
  "api": "v1-byte/miko-api-lora",
  "server": "v1-byte/miko-server-lora"
}

def detect_topic(q):
    q=q.lower()
    if "api" in q: return "api"
    if "vps" in q or "nginx" in q: return "server"
    return "api"

@app.get("/")
def home():
    return {"status": "Miko-Ai Router Online", "quota": "3KB per chat", "adapters": list(ADAPTERS.keys())}

@app.post("/chat")
def chat(payload: dict):
    text = payload.get("text","")
    topic = detect_topic(text)
    # Di sini nanti load model sesuai topic
    # answer = model.generate(text)
    answer = f"[MOCK] Topik terdeteksi: {topic} dari adapter {ADAPTERS.get(topic)}. Ganti dengan model.generate() asli."
    return {"topic": topic, "adapter": ADAPTERS.get(topic), "answer": answer, "quota_used": "3KB"}

# Jalankan: uvicorn server:app --host 0.0.0.0 --port 8000
