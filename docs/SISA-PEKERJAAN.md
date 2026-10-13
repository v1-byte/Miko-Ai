# Catatan sisa pekerjaan — Miko-Ai

**Update:** 2026-10-13  
**Repo:** https://github.com/v1-byte/Miko-Ai

Dokumen ini memisahkan apa yang **sudah selesai di repo** dan apa yang **masih harus dikerjakan di akun/perangkat kamu**.

---

## 1. Yang sudah selesai (di GitHub)

| Item | Keterangan |
|------|------------|
| Model lokal offline | Ada di `release/`, jalan di APK tanpa internet |
| Build APK otomatis | Workflow `release.yml` tiap push `main` |
| Auto-update APK | Cek release tag `latest` |
| Router topik 6 bidang | `runtime/topic-router.mjs`, `js/router.js` |
| Online client (opt-in) | `runtime/online-client.mjs` — default **mati** |
| Cloudflare Worker template | `server/worker.mjs` + `wrangler.jsonc` |
| Default model online | `Qwen/Qwen2.5-Coder-7B-Instruct` (publik, sementara) |
| Dataset template 6 domain | `dataset_template/{api,server,web,apk,security,coding}/` |
| Sample di `data/instruct/` | Domain samples + extra generated |
| Notebook train LoRA | `notebooks/train_and_upload.ipynb` |
| `prepare_app.sh` | Menyertakan `js/` + `adapters/` ke APK |
| Panduan setup online | `docs/SETUP-ONLINE-FULL.md` |
| README status jujur | Tidak mengklaim LoRA custom sudah live |

---

## 2. Sisa pekerjaan (wajib agar online hidup)

Kerjakan **berurutan**. Tanpa langkah ini, mode online di APK belum bisa menjawab.

### ✅ Checklist A — Online dasar (~15–30 menit)

- [ ] **A1.** Buat akun / login [HuggingFace](https://huggingface.co)
- [ ] **A2.** Buat Access Token (Read cukup untuk inference; Write jika nanti upload LoRA)  
      → https://huggingface.co/settings/tokens  
      → simpan `hf_...` di tempat aman (**jangan** commit ke git / jangan kirim di chat publik)
- [ ] **A3.** Install Wrangler & login Cloudflare:
  ```bash
  git clone https://github.com/v1-byte/Miko-Ai.git
  cd Miko-Ai/server
  npm install -g wrangler
  npx wrangler login
  ```
- [ ] **A4.** Set secret token:
  ```bash
  npx wrangler secret put HF_TOKEN
  ```
- [ ] **A5.** Deploy Worker:
  ```bash
  npx wrangler deploy
  ```
  Catat URL, contoh: `https://miko-ai-online-router.<akun>.workers.dev`
- [ ] **A6.** Pastikan `ALLOWED_ORIGINS` di `wrangler.jsonc` berisi:
  - `capacitor://localhost` (APK)
  - origin browser jika uji di web
  Lalu deploy ulang jika diubah.
- [ ] **A7.** Install APK dari  
      https://github.com/v1-byte/Miko-Ai/releases/tag/latest
- [ ] **A8.** Di APK: Menu ⋯ → **Router online opsional**
  - Tempel: `https://URL-WORKER-KAMU/chat`
  - Centang aktifkan → Simpan
  - **Jangan** isi HF token di APK
- [ ] **A9.** Uji chat, contoh: `bikin API login Express anti brute force`  
      Status harus menunjukkan mode online + topik (mis. `api`)

**Selesai A** = online sudah jalan memakai model publik Qwen (bukan LoRA custom).

---

### ✅ Checklist B — LoRA custom 6 bidang (opsional, bertahap)

Hanya jika ingin adapter sendiri `v1-byte/miko-*-lora` (bukan Qwen publik).

Untuk **setiap** domain: `api` → `server` → `web` → `apk` → `security` → `coding`

- [ ] **B1.** Perbanyak dataset di `dataset_template/<domain>/`  
      Format per baris: `{"user":"...","assistant":"..."}`  
      Target realistis: 500–2000 Q&A **benar & tested** (bukan spam)
- [ ] **B2.** Buka [Kaggle](https://kaggle.com) → New Notebook → GPU (T4)
- [ ] **B3.** Pakai `notebooks/train_and_upload.ipynb`
  - Set `DOMAIN` (mis. `api`)
  - Set `HF_TOKEN` (Write)
  - Pastikan file JSONL terbaca
- [ ] **B4.** Run training → upload ke `v1-byte/miko-<domain>-lora`
- [ ] **B5.** Di Cloudflare, ganti env model:
  - `MIKO_MODEL_API=v1-byte/miko-api-lora`
  - (dst. per domain)
  - atau biarkan `MIKO_MODEL_DEFAULT` sebagai fallback
- [ ] **B6.** `npx wrangler deploy` lagi
- [ ] **B7.** Update `adapters/config.json` status → `online` (opsional, dokumentasi)

Ulangi B1–B5 sampai 6 domain selesai (boleh 1 domain/hari).

---

### ✅ Checklist C — Kualitas & produksi (disarankan)

- [ ] **C1.** Isi dataset serius (kualitas > jumlah)
- [ ] **C2.** Monitor billing / kuota HuggingFace
- [ ] **C3.** Perketat `ALLOWED_ORIGINS` (jangan `*` di production)
- [ ] **C4.** Jangan commit secret (HF token, GitHub PAT, keystore)
- [ ] **C5.** Keystore release Android jika mau sebar APK non-debug / Play Store
- [ ] **C6.** Uji offline: matikan online → pastikan model lokal masih menjawab
- [ ] **C7.** Uji auto-update: pasang APK lama → cek update ke `latest`

---

## 3. Yang tidak perlu dikerjakan lagi (sudah di repo)

- Menulis ulang router topik dari nol  
- Membuat template Worker dari nol  
- Membuat notebook training dari nol  
- Setup workflow build APK  
- Menulis klaim palsu “6 adapter sudah live” tanpa training  

---

## 4. Prioritas singkat

| Prioritas | Apa | Hasil |
|-----------|-----|--------|
| **P0** | Checklist A (HF + Worker + APK) | Online hidup |
| **P1** | Dataset + 1 LoRA (`api`) | Spesialisasi pertama |
| **P2** | 5 LoRA sisanya | 6 bidang custom |
| **P3** | Hardening (origin, billing, keystore) | Lebih aman / rilis |

---

## 5. Link cepat

- Setup online: [SETUP-ONLINE-FULL.md](./SETUP-ONLINE-FULL.md)  
- Worker: `server/worker.mjs`, `server/wrangler.jsonc`  
- Notebook: `notebooks/train_and_upload.ipynb`  
- Release APK: https://github.com/v1-byte/Miko-Ai/releases/tag/latest  
- Actions: https://github.com/v1-byte/Miko-Ai/actions  

---

## 6. Catatan jujur

- Offline **sudah** bisa dipakai tanpa langkah di atas.  
- Online **belum** hidup sampai Checklist **A** selesai di akun kamu.  
- LoRA `v1-byte/miko-*-lora` **belum dilatih**; sementara Worker memakai model publik Qwen.  
- Training 6 adapter butuh waktu GPU + dataset berkualitas — tidak instan.
