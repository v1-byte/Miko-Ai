# Miko AI — Offline model + Online Router (anti boros kuota)

AI coding yang bisa jalan **offline** di APK (model kecil dari nol) dan opsional **online** lewat router topik → adapter LoRA di HuggingFace, dengan token aman di Cloudflare Worker.

## Status jujur (baca ini dulu)

| Bagian | Status |
|--------|--------|
| Model lokal offline di APK | ✅ Ada & di-build otomatis |
| Router topik 6 bidang | ✅ Ada (`runtime/topic-router.mjs`, `js/router.js`) |
| Online client (opt-in) | ✅ Ada (`runtime/online-client.mjs`) |
| Cloudflare Worker template | ✅ Ada (`server/worker.mjs`) — perlu di-deploy + secret |
| Auto-update APK | ✅ Cek release `latest` |
| 6 adapter LoRA di HuggingFace | ❌ Belum dilatih — **pending** |
| Dataset 2000 Q&A/bidang | ❌ Baru template ~30–50 contoh/bidang |
| Notebook training Kaggle | ✅ `notebooks/train_and_upload.ipynb` |

**Kesimpulan:** Offline sudah jalan. Online 6-adapter **belum** sampai adapter di-train & Worker diisi model ID.

## Alur online yang disarankan (aman, ~3KB/chat)

```
HP (APK)  --teks 1KB-->  Cloudflare Worker  --HF_TOKEN-->  HuggingFace model
          <--jawab 2KB--                      <--generate--
```

Token **tidak** disimpan di APK. Lihat `server/worker.mjs` dan `docs/Miko-Full-Tutor.md`.

## File penting

```
js/router.js              deteksi topik
js/api.js                 chatMiko() — utamakan WORKER_URL
adapters/config.json      daftar target adapter + status
server/worker.mjs         proxy aman + rate limit
server/server.py          mock FastAPI (Codespaces)
notebooks/train_and_upload.ipynb   train 1 LoRA + upload HF
dataset_template/{api,server,web,apk,security,coding}/
runtime/                  inferensi lokal + online client
app/                      Capacitor APK shell
```

## Setup online lengkap

Lihat **[docs/SETUP-ONLINE-FULL.md](docs/SETUP-ONLINE-FULL.md)** (HF token → Worker → APK).

Default Worker memakai model publik Qwen2.5-Coder agar **online bisa diuji dulu** sebelum LoRA custom.

## Cara lanjut biar online benar-benar jalan

1. **Isi dataset** per bidang (cicil; kualitas > kuantitas). Format JSONL:
   `{"user":"...","assistant":"..."}`
2. **Train di Kaggle** (GPU): buka `notebooks/train_and_upload.ipynb`, set `DOMAIN` + `HF_TOKEN`, Run.
   Ulangi untuk `api`, `server`, `web`, `apk`, `security`, `coding`.
3. **Deploy Worker** (`server/worker.mjs`):
   - `npx wrangler secret put HF_TOKEN`
   - Set env: `MIKO_MODEL_API`, `MIKO_MODEL_SERVER`, … atau `MIKO_MODEL_DEFAULT`
   - `ALLOWED_ORIGINS` = origin APK/web kamu
4. Di APK: aktifkan online + isi URL Worker.
5. Push ke `main` → Actions bangun APK + update release `latest` (auto-update).

## Model lokal (default)

```bash
pip install -r requirements.txt
python data/build_dataset.py
python tokenizer/train_tokenizer.py --vocab 1024
python train/train.py --steps 2000
python export/export_weights.py
node runtime/test_parity.mjs release
```

Atau di GitHub: **Actions → Latih model**.

## APK & auto-update

- Setiap push `main` memicu workflow **Rilis APK**.
- APK masuk release tag `latest`.
- APK yang terpasang bisa cek update (user tetap konfirmasi install).

## Keamanan

- Jangan commit `HF_TOKEN` / GitHub PAT.
- Jangan taruh secret di `js/api.js` yang ikut di-bundle APK.
- Pakai Worker sebagai proxy.

## Lisensi data

Hanya kode milikmu atau berlisensi permisif di `data/raw/`. Catat sumber di `data/SOURCES.md`.
