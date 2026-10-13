# MIKO-AI FULL PROJECT - ONLINE ROUTER ANTI BOROS KUOTA

## APA INI?
Project jadi untuk Miko-Ai jago 6 bidang: Web, Server, API, APK, Security, Coding.
System: Topik 1 -> manggil Adapter 1 otomatis, kuota cuma 3KB per chat (bukan 1GB).

## FILE YANG SUDAH JADI (TINGGAL UPLOAD VIA HP)
- `js/router.js` -> deteksi topik (5KB)
- `js/api.js` -> fetch irit kuota ke HuggingFace (ganti HF_TOKEN)
- `adapters/config.json` -> daftar 6 adapter
- `server/server.py` -> server gratis kalau mau pakai GitHub Codespaces
- `notebooks/train_and_upload.ipynb` -> training + pecah 1GB + upload HF (jalan di Kaggle via HP)
- `dataset_template/api_100_sample.jsonl` -> contoh 100 Q&A berkualitas

## CARA PASANG VIA HP (10 MENIT JADI)
1. Buka github.com/v1-byte/Miko-Ai -> Upload file dari folder ini: `js/router.js` dan `js/api.js` (replace yang lama)
2. Ganti `HF_TOKEN` di `js/api.js` dengan token asli dari huggingface.co/settings/tokens
3. Commit.
4. Buka Kaggle -> New Notebook -> Upload `notebooks/train_and_upload.ipynb` -> Run
5. Tunggu 2 jam -> adapter jadi -> otomatis jadi API online
6. Test di APK: `chatMiko("bikin API login aman")` -> harusnya balik jawaban, kuota 3KB.

## SOLUSI ANTI BOROS KUOTA
- GitHub simpan backup pecah 20x50MB (repo miko-api-lora-1gb)
- HuggingFace simpan yang online (server yang download 1GB, bukan HP)
- HP user cuma kirim teks 1KB, terima 2KB.

## YANG KURANG? INI SUDAH FULL
- [x] Router deteksi topik
- [x] API irit kuota
- [x] Cara pecah 1GB jadi 50MB
- [x] Notebook training
- [x] Server gratis
- [x] Dataset template 100 Q&A
- [ ] Kamu tinggal isi dataset jadi 2000 Q&A per bidang (cicil via HP)

## TOKEN
- HF_TOKEN: https://huggingface.co/settings/tokens -> New Token -> Read -> Copy `hf_...`
- Taruh di `js/api.js` baris 4
- Kalau mau aman, pakai Cloudflare Worker (lihat file `docs/Miko-Full-Tutor.md` Bab 8)

## KALAU MAU JADI 100%
1. Isi dataset 2000 Q&A per bidang
2. Training 6 adapter di Kaggle (1 per hari)
3. Upload 6 ke HuggingFace
4. APK kamu sudah jago 6 bidang, kuota irit.

---

## Struktur Project

```
Miko-Ai/
├── js/
│   ├── router.js          ← deteksi topik (web/server/api/apk/security/coding)
│   └── api.js             ← chatMiko() irit kuota 3KB ke HuggingFace
├── adapters/
│   └── config.json        ← daftar 6 adapter LoRA
├── server/
│   ├── server.py          ← FastAPI mock server (Codespaces/Kaggle)
│   ├── worker.mjs         ← Cloudflare Worker template (aman token)
│   └── wrangler.jsonc
├── runtime/               ← mesin inferensi lokal + online client
├── model/                 ← transformer kecil dari nol (opsional offline)
├── train/                 ← training lokal
├── data/                  ← dataset
├── app/                   ← APK Capacitor
└── docs/Miko-Full-Tutor.md ← panduan lengkap 12 bab
```

## Model Lokal (default) vs Online Router

- **Offline (default)**: Model kecil dilatih dari bobot acak, jalan di APK tanpa internet.
- **Online Router (opt-in)**: Deteksi topik → panggil adapter LoRA di HuggingFace. Kuota hanya ~3KB per chat.

Lihat `docs/Miko-Full-Tutor.md` untuk status sebenarnya dan cara setup Cloudflare Worker agar token aman.

## Alur Online Anti Boros

```
User ketik di APK → js/router.js deteksi topik
                 → js/api.js kirim 1KB ke HF Inference
                 → HF server yang load adapter (bukan HP)
                 → Balik jawaban 2KB
```

## Catatan Penting

- Ganti `HF_TOKEN` di `js/api.js` sebelum dipakai.
- Adapter `v1-byte/miko-*-lora` harus di-train & upload dulu di HuggingFace.
- Jangan commit token asli ke repo.
- Untuk keamanan token, gunakan Cloudflare Worker (`server/worker.mjs`).
