# Miko AI — model bahasa kode buatan sendiri

AI khusus **coding** yang dibuat 100% dari nol: tokenizer sendiri, arsitektur transformer sendiri,
bobot acak yang dilatih dengan datasetmu sendiri. **Tidak memakai Qwen, GPT, Claude, Llama, atau model
pra-latih mana pun.** Dilatih dan dirilis lewat GitHub Actions, dijalankan di APK (di perangkat, tanpa server).

## Struktur
```
miko-ai/
├── data/
│   ├── raw/                 ← KODE milikmu / berlisensi bebas (.js .py .html .css ...)
│   ├── instruct/*.jsonl     ← tanya-jawab: {"user": "...", "assistant": "..."}
│   └── build_dataset.py     ← bersihkan, dedup, bagi train/val → data/processed/
├── tokenizer/
│   ├── bpe.py               ← BPE tingkat-byte buatan sendiri
│   └── train_tokenizer.py   ← → tokenizer/tokenizer.json
├── model/gpt.py             ← transformer kecil (PyTorch, bobot acak)
├── train/
│   ├── train.py             ← pelatihan dari nol → out/model.pt
│   ├── eval.py              ← perplexity + contoh jawaban
│   └── eval_benchmark.py    ← tes coding terpisah dan simpan jawaban
├── export/
│   ├── export_weights.py    ← model.pt → release/ (model.bin, model.json, tokenizer.json, parity.json)
│   ├── release_format.py, parity.py
├── release/                 ← model hasil latih yang dipakai APK (di-commit)
├── runtime/                 ← mesin inferensi JavaScript murni (browser/APK/Node)
│   ├── miko-ai-lm.js         ← tokenizer + transformer + generate
│   ├── analyzer.js          ← aturan analisis kode ZIP (API, CDN, aset, error)
│   ├── assistant.js         ← gabung model + analyzer
│   └── test_parity.mjs      ← bukti JS == Python
├── app/                     ← pembungkus APK (Capacitor) + UI chat di app/www
├── scripts/prepare_app.sh   ← salin runtime + model ke app/www
├── tests/                   ← referensi numpy & rilis uji (bobot acak)
└── .github/workflows/
    ├── train.yml            ← "server latih": Actions menjalankan seluruh pipeline
    └── release.yml          ← tag vX → uji paritas → bangun APK → GitHub Release
```

## Alur lengkap
```
data → build_dataset → train_tokenizer → train → eval → export → test_parity → APK → Release
```
Lokal:
```bash
pip install -r requirements.txt
python data/build_dataset.py
python tokenizer/train_tokenizer.py --vocab 1024
python train/train.py --steps 2000          # GPU otomatis dipakai bila ada
python train/eval.py
python export/export_weights.py
node runtime/test_parity.mjs release        # harus "Semua uji paritas lulus"
```
Di GitHub: tab **Actions → Latih model → Run workflow** (hasil di-commit ke `release/`).
Setiap push ke branch `main` memicu workflow rilis. Jika workflow selesai sukses, ia menerbitkan bundle web ke branch `remote` dan memperbarui release **[latest](https://github.com/v1-byte/Miko-Ai/releases/tag/latest)**. APK memeriksa SHA commit release terbaru, mencoba mengunduh APK yang sesuai saat aplikasi aktif, dan Android tetap meminta konfirmasi pengguna sebelum memasang APK. Keberhasilan build/release harus diverifikasi di tab Actions; push saja tidak menjamin APK latest terbit.
Untuk rilis versi resmi, gunakan `git tag v1.0.0 && git push --tags` → APK muncul di **Releases**.

## "Server AI di GitHub" — penjelasan jujur
GitHub tidak menjalankan server yang selalu hidup. Pembagian tugasnya:
- **GitHub Actions** = tempat melatih & merilis (otomatis, gratis untuk model kecil di CPU).
- **GitHub Releases** = tempat menyimpan APK dan berkas model.
- **Perangkat pengguna (APK)** = tempat AI berjalan (inferensi JS). Tidak butuh internet.

## Isi dataset (bagian paling menentukan)
Kualitas AI = kualitas data. Aturan:
1. `data/raw/`: kode yang **kamu tulis sendiri** atau berlisensi permisif (MIT/BSD/Apache) — simpan catatan sumber dan lisensinya di `data/SOURCES.md`. Jangan campur kode berlisensi tertutup.
2. `data/instruct/*.jsonl`: satu baris satu pasang, jawaban benar dan ringkas. Batch coding Indonesia ada di `id_core_batch_01.jsonl`; dataset contoh lain ada di `seed.jsonl`, `it_coding.jsonl`, dan `coding_practice.jsonl`. Ini yang mengajarkan format "tanya → jawab".
3. Bersihkan: tidak ada kunci rahasia, tidak ada kode rusak sebagai contoh jawaban.
4. Jalankan `python data/validate_instruct.py` sebelum training. Tambah data bertahap dan bandingkan hasil benchmark, bukan hanya `val_loss`.

Dataset eksternal, syarat lisensi, dan langkah impor lokal dijelaskan di [`data/EXTERNAL_DATASETS.md`](data/EXTERNAL_DATASETS.md). Importer tidak memasukkan data eksternal ke Git dan tidak mengunduh StarCoderData. Setelah impor dan tinjauan lisensi, gunakan direktori eksternal secara eksplisit, misalnya:
```bash
python data/build_dataset.py --extra-instruct data/external/instruct
```
Untuk data kode mentah lokal, gunakan `--extra-raw data/external/raw-starcoder`. Direktori eksternal diabaikan Git dan tidak dipakai secara default.

### Ukur kemampuan coding

`tests/coding_benchmark.jsonl` berisi kasus uji yang sengaja tidak dimasukkan ke training.
Setelah model dilatih, jalankan:

```bash
python train/eval_benchmark.py --ckpt out/model.pt
```

Jawaban tersimpan di `out/coding_benchmark_results.jsonl`. Tinjau tiap jawaban terhadap daftar
`checks`; runner tidak memberikan skor otomatis karena kecocokan kata tidak cukup untuk menilai
kebenaran kode. Jangan pindahkan pertanyaan benchmark ke folder `data/instruct`, agar pengukuran
tetap terpisah dari data latih.

### Urutan peningkatan yang disarankan

1. Jalankan tes alur dan benchmark pada baseline.
2. Periksa jawaban yang gagal, lalu tambah contoh latihan yang benar-benar menargetkan kelemahan itu.
3. Latih ulang dan bandingkan jawaban benchmark, bukan hanya `val_loss`.
4. Jika proses konsisten dan data berkualitas sudah cukup, eksperimenkan kapasitas model/GPU.

Dataset contoh yang baru ditambahkan adalah titik awal edukatif, bukan jaminan model sudah menjadi
programmer andal. Karena Miko-Ai dilatih dari bobot acak dengan model kecil, peningkatan dari contoh
ini diperkirakan terbatas; kode yang dihasilkan tetap perlu diuji dan ditinjau manusia.

## Skala & ekspektasi (jujur)
| Data | Model | Hasil wajar |
|---|---|---|
| ~20 KB (contoh bawaan) | 0.2 jt param | hanya menguji alur; jawabannya belum berguna |
| ~10–100 MB kode + ribuan tanya-jawab | 5–30 jt param | menyelesaikan pola kode umum, jawab pertanyaan yang mirip data |
| ratusan MB–GB | 50–200 jt param | cukup berguna, butuh GPU (Colab/Kaggle/sewa) |

Model dari nol dengan data terbatas **jauh lebih lemah** daripada model besar komersial; ia pandai di
bidang sempit yang datanya kamu berikan. Untuk skala lebih besar jalankan skrip yang sama di GPU:
`python train/train.py --layers 8 --embd 384 --heads 6 --block 512 --steps 20000`, commit `release/`.
Tiap +1 jt parameter ≈ +4 MB berkas model di APK.

Jika model kecil menghasilkan teks yang belum terbaca, runtime memakai fallback offline untuk pertanyaan
umum dan menampilkan error dengan jelas. Untuk jawaban model yang lebih baik, tambahkan dataset dan latih
ulang dengan lebih banyak langkah.

Dataset dari APK dapat disimpan lokal tanpa token GitHub melalui **Simpan antrean**; ini belum mengubah
model yang sedang berjalan. Untuk mengirim data dan memulai training, pilih **Simpan permanen ke GitHub & latih**.
File kode/proyek masuk ke `data/raw/`, sedangkan file `.jsonl` yang berisi satu objek
`{"user":"...","assistant":"..."}` per baris masuk ke `data/instruct/` dan divalidasi sebelum dikirim.
Untuk teks yang diketik, pilih jenis **Contoh tanya-jawab (JSONL)** dan masukkan satu objek JSON per baris.
Setelah workflow selesai, model hasil ekspor diperbarui di repository; APK yang sedang terbuka tidak belajar
seketika dan memerlukan build/update model untuk memakai bobot baru. Jangan unggah secret atau data pribadi.

## Router online opsional (default mati)

Miko-Ai tetap bekerja offline dengan model lokal dan knowledge retrieval. Klasifikasi topik `web`, `server`, `api`, `apk`, `security`, dan `coding` hanya memilih arahan/prompt; fitur ini **bukan** enam adapter yang telah dilatih. Template proxy Worker ada di [`server/`](server/), tetapi belum dideploy dan belum ada model provider yang dikonfigurasi.

Untuk mengaktifkan, ikuti [`server/README.md`](server/README.md), set model ID yang benar-benar tersedia, simpan `HF_TOKEN` hanya sebagai Cloudflare Worker Secret, deploy, lalu masukkan URL `/chat` di **Menu → Router online opsional**. Saat aktif, pertanyaan teks dikirim ke Worker/provider eksternal; analisis berkas tetap lokal. Jangan kirim rahasia atau data pribadi. Jika online gagal, aplikasi kembali ke knowledge/model lokal.

Tidak ada jaminan **3 KB per chat**: kode membatasi request sampai 8 KB, sementara respons dan biaya bergantung panjang output/provider. Per dokumentasi harga Hugging Face yang diperiksa 13 Oktober 2026, akun gratis tidak memperoleh kredit bulanan Inference Providers; periksa harga terkini sebelum mengaktifkan. Enam ID adapter dalam catatan lama belum diverifikasi dan tidak digunakan. Koreksi terperinci ada di [`docs/Miko-Full-Tutor.md`](docs/Miko-Full-Tutor.md).

Tes router dan Worker mock: `node runtime/test_online_router.mjs`. Tes ini tidak membuktikan Worker atau akun provider sudah dikonfigurasi.

## Yang sudah diuji / belum
- Diuji: tokenizer Python vs JS, inferensi JS vs referensi numpy (bobot acak), pembangun dataset.
- **Belum dijalankan**: `model/gpt.py`, `train/*.py`, `export_weights.py` (butuh PyTorch), workflow GitHub,
  dan build APK. Uji paritas di `train.yml` dan `release.yml` akan menangkap ketidakcocokan PyTorch ↔ JS.
- APK yang dihasilkan adalah **debug** (untuk instal langsung). Rilis Play Store perlu tanda tangan keystore.
