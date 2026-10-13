# Miko-Ai Online Router (opsional)

Worker ini adalah proxy server-side untuk mode online. APK tetap offline secara default. Saat pengguna mengaktifkan mode online, aplikasi hanya mengirim teks pertanyaan ke Worker. `HF_TOKEN` disimpan sebagai Cloudflare Worker Secret, tidak di dalam APK atau repository.

## Prasyarat sebelum deploy

1. Siapkan akun Cloudflare dan token Hugging Face yang memiliki izin **Inference Providers**. Jangan masukkan token ke `app/www`, file JavaScript, atau Git.
2. Pilih model yang benar-benar tersedia di Hugging Face Inference Providers atau endpoint yang kompatibel dengan API Chat Completions. ID model di catatan lama seperti `v1-byte/miko-api-lora` belum dibuktikan ada atau bisa dipanggil. Adapter LoRA mentah tidak otomatis menjadi endpoint; adapter harus dilayani dengan base model yang cocok.
3. Ubah `server/wrangler.jsonc`: isi model default atau variabel `MIKO_MODEL_WEB`, `MIKO_MODEL_SERVER`, `MIKO_MODEL_API`, `MIKO_MODEL_APK`, `MIKO_MODEL_SECURITY`, dan `MIKO_MODEL_CODING`. Isi `ALLOWED_ORIGINS` dengan origin aplikasi yang tepat. Hapus origin localhost dari konfigurasi produksi bila tidak diperlukan.
4. Ganti `ratelimits[0].namespace_id` dengan bilangan positif yang unik pada akun Cloudflare Anda. Pastikan versi Wrangler minimal 4.36.0.

## Deploy

Dari root repository:

```bash
cd server
npx wrangler secret put HF_TOKEN
npx wrangler deploy
```

Masukkan token pada prompt Wrangler; jangan menaruhnya pada argumen shell, log, APK, atau commit. Catat URL Worker hasil deploy, misalnya `https://miko-ai-online-router.<akun>.workers.dev`.

Di APK, buka **Menu → Router online opsional**, masukkan URL Worker dengan akhiran `/chat`, lalu centang aktivasi. Periksa `GET <URL-worker>/health` dari origin yang diizinkan untuk melihat bidang yang modelnya telah dikonfigurasi.

## Batasan dan biaya

Hugging Face Inference Providers memakai billing berbasis pemakaian; akun gratis tidak memperoleh kredit bulanan Inference Providers menurut dokumentasi saat panduan ini diperbarui. Cek biaya dan batas akun sebelum mengaktifkannya. Batas 8 KB di aplikasi adalah batas ukuran request, **bukan** janji bahwa seluruh lalu lintas chat hanya 3 KB. Ukuran respons berubah mengikuti jawaban dan jumlah token.

Binding rate limit Cloudflare bersifat lokal per lokasi dan eventual-consistent. ID instalasi aplikasi bukan autentikasi kuat dan dapat dipalsukan. Rate limit ini mengurangi penggunaan tidak sengaja, tetapi bukan batas biaya yang akurat atau perlindungan dari seluruh penyalahgunaan. Pantau billing, batasi penggunaan provider, dan tambahkan sistem autentikasi/rate limiting yang sesuai sebelum Worker dipublikasikan luas.

Aplikasi mengirim teks pertanyaan ke Worker dan provider model saat mode online aktif. Jangan kirim kata sandi, token, data pribadi, atau kode rahasia. Analisis file ZIP tetap dilakukan lokal dan tidak dikirim oleh router ini.
