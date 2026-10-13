# Server Miko-Ai (Worker + mock)

## Cloudflare Worker (produksi)

File utama: `worker.mjs` + `wrangler.jsonc`.

```bash
npx wrangler secret put HF_TOKEN
npx wrangler deploy
```

Env model default memakai `Qwen/Qwen2.5-Coder-7B-Instruct` agar online langsung bisa diuji sebelum LoRA custom ada.

Ganti ke adapter sendiri setelah upload HF:

- `MIKO_MODEL_API`
- `MIKO_MODEL_SERVER`
- `MIKO_MODEL_WEB`
- `MIKO_MODEL_APK`
- `MIKO_MODEL_SECURITY`
- `MIKO_MODEL_CODING`
- `MIKO_MODEL_DEFAULT` (fallback)

`ALLOWED_ORIGINS` — daftar origin dipisah koma. Wajib ada `capacitor://localhost` untuk APK Capacitor.

## FastAPI mock (dev)

```bash
pip install fastapi uvicorn
uvicorn server:app --app-dir . --host 0.0.0.0 --port 8000
# atau dari folder server: uvicorn server:app --reload
```

Hanya simulasi topik; bukan inferensi model.

## Keamanan

Jangan commit HF_TOKEN. Pantau billing HuggingFace. Rate limit Worker bukan jaminan anti-abuse penuh.
