# Setup Online Router Miko-Ai — Full (HP + gratis)

Tujuan: APK offline tetap jalan; mode online opt-in menjawab lewat HuggingFace **tanpa** token di HP.

## Status setelah scaffolding di repo

- Model lokal offline: siap
- Router topik + Worker template: siap
- Default model Worker: `Qwen/Qwen2.5-Coder-7B-Instruct` (publik) — **bisa dipakai dulu** sebelum LoRA custom
- LoRA `v1-byte/miko-*-lora`: opsional, train nanti di Kaggle

## A. HuggingFace token (5 menit)

1. Daftar/login https://huggingface.co  
2. Settings → Access Tokens → Create (type **Write** jika mau upload model; **Read** cukup untuk inference saja)  
3. Copy `hf_...` — jangan commit ke git

## B. Deploy Cloudflare Worker (10–15 menit)

Di komputer atau Codespaces:

```bash
cd server
npm install -g wrangler
npx wrangler login
npx wrangler secret put HF_TOKEN
# tempel token hf_...
npx wrangler deploy
```

Catat URL hasil deploy, contoh: `https://miko-ai-online-router.<akun>.workers.dev`

Worker mengharapkan path yang dipanggil client. Di APK, isi endpoint **dengan** `/chat` jika UI meminta (lihat placeholder di pengaturan online).

Cek `wrangler.jsonc`:

- `ALLOWED_ORIGINS` harus berisi origin APK (`capacitor://localhost`) dan origin uji browser
- `MIKO_MODEL_*` default sudah diisi model publik Qwen Coder

Opsional ganti ke LoRA custom setelah training:

```
MIKO_MODEL_API=v1-byte/miko-api-lora
...
```

## C. Aktifkan di APK

1. Install APK dari https://github.com/v1-byte/Miko-Ai/releases/tag/latest  
2. Menu ⋯ → **Router online opsional**  
3. Centang aktifkan, tempel URL Worker  
4. Simpan — **jangan** isi HF token di APK

Uji: `bikin API login Express anti brute force` → status "Mode online · api"

## D. Train LoRA custom (opsional, per bidang)

1. Kaggle → New Notebook → GPU  
2. Upload / copy `notebooks/train_and_upload.ipynb`  
3. Set `DOMAIN=api`, `HF_TOKEN`, path dataset  
4. Run All → upload ke `v1-byte/miko-api-lora`  
5. Ulangi domain lain  
6. Update env Worker ke repo LoRA kamu

Dataset mulai dari `dataset_template/<domain>/`. Target ideal 500–2000 Q&A **berkualitas** per bidang.

## E. Auto-update APK

Push ke `main` → Actions **Rilis APK** → asset di release `latest`.  
APK terpasang bisa cek update (user tetap konfirmasi install).

## Troubleshooting

| Gejala | Cek |
|--------|-----|
| origin_not_allowed | Tambah origin di `ALLOWED_ORIGINS` Worker |
| model_or_hf_token_not_configured | `wrangler secret put HF_TOKEN` + model env tidak kosong |
| rate_limited | 10 req/menit per client id — tunggu |
| Online gagal; offline | Worker down / jaringan — offline tetap jalan |
| HF 402/429 | Kuota HF; ganti model lebih kecil atau tunggu |

## Keamanan

- Token hanya di Cloudflare secret  
- Rate limit Worker aktif  
- Jangan kirim password/secret ke chat online  
