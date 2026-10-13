# Miko-Ai Full Tutor — Offline + Online Router Opsional

> Panduan ini menggantikan catatan lama yang mengklaim router, enam adapter, notebook, server, dan kuota 3 KB sudah siap. Implementasi sekarang menjaga model lokal sebagai default, menambahkan router online **opt-in**, dan menyediakan template Worker server-side. Model cloud belum dilatih, dipilih, atau dideploy.

## Ringkasan status sebenarnya

| Bagian | Status di repository |
|---|---|
| Model lokal Miko-Ai | Tetap digunakan offline; model dilatih dari bobot acak dan ukurannya kecil. |
| Router 6 topik | Sudah ditambahkan: web, server, API, APK, security, coding. Routing hanyalah klasifikasi prompt, bukan enam model yang sudah ada. |
| Pengaturan online di APK | Sudah tersedia, default **mati**. Pengguna memilih endpoint Worker dan mengaktifkannya sendiri. |
| Proxy Cloudflare | Kode template tersedia di `server/worker.mjs`; belum di-deploy ke akun Cloudflare. |
| HF model / LoRA adapter | Belum ada ID model yang diverifikasi, adapter terlatih, atau inference endpoint yang dikonfigurasi. `MIKO_MODEL_*` masih kosong. |
| Notebook Kaggle dan 100 contoh API | Tidak disertakan dalam repository. Jangan menganggap contoh di catatan lama sebagai file siap pakai atau data teruji. |
| Release APK | Workflow memerlukan signing secrets sebelum build release berfungsi; status konfigurasi secret dijelaskan di README. |

**Jadi, fitur online belum bisa menjawab sampai Worker, token provider, dan minimal satu model yang benar-benar tersedia dikonfigurasi.** Jika router online tidak berhasil, aplikasi mencoba model offline. Mode offline tetap tidak mengirim pertanyaan ke server.

## Apa yang berubah dari catatan lama

1. Catatan lama menaruh `HF_TOKEN` di JavaScript APK. Itu tidak aman: isi APK dapat diekstrak. Implementasi baru tidak pernah mengirim token dari perangkat; token dibaca Worker dari secret `HF_TOKEN`.
2. Endpoint lama `api-inference.huggingface.co/models/...` dan payload `{inputs: ...}` tidak dipakai di router ini. Worker menggunakan Chat Completions OpenAI-compatible di `https://router.huggingface.co/v1/chat/completions` dengan `model`, `messages`, dan `max_tokens`.
3. Klaim **3 KB per chat** bukan jaminan. Aplikasi membatasi request teks sampai 8 KB; ukuran balasan bervariasi menurut token dan panjang jawaban. Trafik dan biaya tidak bisa dipatok 3 KB.
4. Menurut dokumentasi harga Hugging Face yang diperiksa 13 Oktober 2026, akun gratis tidak mendapat kredit bulanan Inference Providers. Penggunaan routed dapat memerlukan pembelian kredit atau paket berbayar dan ditagih sesuai pemakaian. Periksa kembali halaman harga sebelum mengaktifkan.
5. Enam nama seperti `v1-byte/miko-api-lora` di catatan lama belum terbukti ada. Membuat `model_id` di kode tidak membuat model tersebut. Model harus sudah di-host dan kompatibel dengan provider. Adapter LoRA mentah juga tidak otomatis menjadi endpoint; perlu base model yang tepat dan cara serving yang mendukungnya.
6. Membagi berkas `adapter_model.safetensors` mentah menjadi byte-chunk 50 MB hanya membuat potongan backup, bukan paket model yang langsung dapat dimuat. Jangan melabeli potongan itu sebagai adapter siap inference; gunakan sharding format model yang didukung atau rekonstruksi berkas secara persis sebelum dipakai.
7. Server mock pada catatan lama mengizinkan CORS `*`, tidak mengautentikasi pengguna, dan mengembalikan jawaban placeholder. Itu bukan server AI produksi. Worker baru memakai allowlist origin, pembatasan input, rate-limit binding, pesan error generik, serta fail-closed bila binding atau konfigurasi model belum ada.
8. Contoh dataset lama menandatangani JWT dengan string rahasia tetap `'secret'`. Jangan masukkan pola itu ke data latihan. Gunakan secret dari environment, masa berlaku, algoritma/konfigurasi yang sesuai, dan pustaka teruji.

## Arsitektur yang sekarang

```text
APK Miko-Ai
  ├─ default: model lokal + analyzer lokal
  └─ bila pengguna mengaktifkan online:
       prompt teks → Cloudflare Worker → HF Inference Provider → jawaban
```

Aplikasi hanya menyimpan URL Worker dan pilihan on/off di local storage. `HF_TOKEN` hanya berada di Cloudflare Worker. Kode file/ZIP yang dipilih untuk fitur analisis tetap diproses secara lokal; router online tidak mengunggah berkas itu.

Router mengklasifikasikan topik di perangkat dan Worker mengklasifikasikannya kembali di server. Worker memilih `MIKO_MODEL_<TOPIK>` atau fallback `MIKO_MODEL_DEFAULT`. Keenam variabel tersebut harus berisi model ID yang valid dan dapat dipanggil; tidak ada ID dummy yang dipasang otomatis.

## Cara menyiapkan online router

Ikuti rincian terminal di [`server/README.md`](../server/README.md). Ringkasnya:

1. Buat/pilih model yang memang tersedia lewat Hugging Face Inference Providers atau endpoint Chat Completions yang kompatibel. Verifikasi akses model dan provider di Hugging Face terlebih dahulu.
2. Isi variabel model dan `ALLOWED_ORIGINS` di `server/wrangler.jsonc`. Gunakan origin yang benar-benar dipakai Capacitor; hapus localhost dari konfigurasi produksi bila tidak perlu.
3. Pilih `namespace_id` unik pada konfigurasi rate limit Cloudflare. Binding rate limit Cloudflare bersifat lokal per lokasi dan eventual-consistent; itu **bukan** batas biaya yang akurat dan bukan autentikasi kuat.
4. Dari folder `server`, simpan token lewat prompt Wrangler: `npx wrangler secret put HF_TOKEN`, kemudian deploy dengan `npx wrangler deploy`. Jangan menempel token di file app, README, commit, atau argumen shell.
5. Di APK buka **Menu → Router online opsional**, masukkan URL Worker berakhiran `/chat`, centang aktivasi, lalu simpan. Tanpa konfigurasi model, Worker mengembalikan 503 dan app jatuh kembali ke offline.
6. Uji satu model, biaya, error, CORS, dan fallback lebih dahulu. Baru setelah itu pertimbangkan menambah model topik lainnya.

Untuk keamanan, rate limit per-installasi yang disertakan hanya pengurang penyalahgunaan sederhana: ID bisa dipalsukan atau direset. Jangan jadikan ini perlindungan tagihan. Terapkan batas pengeluaran/monitoring di provider dan autentikasi server yang sesuai jika Worker dipublikasikan luas. Jangan kirim kata sandi, token, data pribadi, atau source code rahasia ke model online.

## Pengembangan dataset dan training

Dataset tetap menjadi dasar peningkatan **model lokal**. Alur repository yang ada adalah:

```text
data/instruct + data/raw → data/build_dataset.py → tokenizer → train → evaluasi/benchmark → export
```

Contoh instruksi dikirim satu objek JSON per baris: `{"user":"...","assistant":"..."}`. Jalankan `python3 data/validate_instruct.py` sebelum training. Simpan provenance/lisensi sumber di `data/SOURCES.md`; kode publik tidak otomatis bebas digunakan.

Benchmark di `tests/coding_benchmark.jsonl` harus tetap terpisah dari data training. Tambahkan contoh bertahap berdasarkan jawaban benchmark yang gagal; prioritaskan kebenaran dan pengujian kode, bukan mengejar angka 2.000 Q&A per bidang. Banyak contoh yang salah atau berulang bisa membuat model lebih buruk. Dataset juga tidak otomatis mengubah model saat pengguna memasukkannya lewat APK: data harus disimpan ke pipeline, model dilatih ulang, diekspor, lalu APK/release diperbarui.

Model lokal Miko-Ai kecil dan dibuat dari bobot acak, sehingga jumlah contoh saja tidak akan menjadikannya setara model besar. Model online, jika kelak diaktifkan, adalah layanan provider eksternal yang terpisah dari training lokal; menyimpan dataset di GitHub tidak otomatis melatih atau mengubah model Hugging Face.

## APK dan rilis

Pengaturan online baru ada di kode aplikasi. APK lama baru mendapat perubahan UI ini setelah bundle remote atau APK terbaru berhasil dimuat. Workflow `release.yml` pada main terbaru menerbitkan bundle web ke branch `remote`, membuat APK debug, dan memperbarui release `latest` bila seluruh langkah sukses. APK memeriksa SHA release dan memulai unduhan APK yang tepat; pemasangan tetap memerlukan persetujuan Android. Android hanya menerima pembaruan APK jika package ID dan sertifikat penandatangan kompatibel, jadi pastikan riwayat build/sertifikat konsisten dan verifikasi workflow serta aset release sebelum mengklaim APK terbarui. Bundle web remote dapat memperbarui aset web, tetapi bukan jaminan bahwa binary APK berhasil dipasang.

## Tes lokal

```bash
node runtime/test_online_router.mjs
node runtime/test_update_check.mjs
node runtime/test_parity.mjs release
python3 data/validate_instruct.py
```

Tes online memakai mock; tes itu memverifikasi routing, CORS, batas ukuran request, larangan token di client, rate-limit binding, dan fallback. Tes tersebut **tidak** membuktikan akun Cloudflare/Hugging Face sudah terhubung, model ada, biaya gratis, atau Worker telah dideploy.

## Rujukan resmi

- [Hugging Face Chat Completion](https://huggingface.co/docs/inference-providers/en/tasks/chat-completion) — endpoint API kompatibel OpenAI dan format request.
- [Hugging Face First API Call](https://huggingface.co/docs/inference-providers/en/guides/first-api-call) — token dan pemilihan provider.
- [Hugging Face Pricing and Billing](https://huggingface.co/docs/inference-providers/en/pricing) — kredit dan biaya pemakaian.
- [Hugging Face User Access Tokens](https://huggingface.co/docs/hub/en/security-tokens) — pengelolaan token.
- [Cloudflare Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/) — menyimpan rahasia sebagai Worker Secret.
- [Cloudflare Workers Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) — konfigurasi dan batas akurasi rate-limit binding.
