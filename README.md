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
│   └── eval.py              ← perplexity + contoh jawaban
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
Setiap push ke branch `main` otomatis menjalankan test paritas, membangun APK, dan memperbarui
release **[latest](https://github.com/v1-byte/Miko-Ai/releases/tag/latest)**. Jadi perubahan kode atau fitur
yang sudah dipush ke GitHub akan tersedia otomatis di release latest.
APK juga memeriksa release latest saat dibuka dan menampilkan tombol unduh ketika ada build baru.
Android tetap meminta konfirmasi pengguna saat memasang APK; pembaruan diam-diam tidak diizinkan Android
untuk APK di luar Play Store.
Untuk rilis versi resmi, gunakan `git tag v1.0.0 && git push --tags` → APK muncul di **Releases**.

## "Server AI di GitHub" — penjelasan jujur
GitHub tidak menjalankan server yang selalu hidup. Pembagian tugasnya:
- **GitHub Actions** = tempat melatih & merilis (otomatis, gratis untuk model kecil di CPU).
- **GitHub Releases** = tempat menyimpan APK dan berkas model.
- **Perangkat pengguna (APK)** = tempat AI berjalan (inferensi JS). Tidak butuh internet.

## Isi dataset (bagian paling menentukan)
Kualitas AI = kualitas data. Aturan:
1. `data/raw/`: kode yang **kamu tulis sendiri** atau berlisensi permisif (MIT/BSD/Apache) — simpan catatan sumber dan lisensinya di `data/SOURCES.md`. Jangan campur kode berlisensi tertutup.
2. `data/instruct/*.jsonl`: satu baris satu pasang, jawaban benar dan ringkas. Mulai dari contoh di `seed.jsonl`. Ini yang mengajarkan format "tanya → jawab".
3. Bersihkan: tidak ada kunci rahasia, tidak ada kode rusak sebagai contoh jawaban.
4. Tambah bertahap, latih ulang, bandingkan `val_loss` di `eval.py`.

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

Dataset dari APK dapat disimpan lokal tanpa token GitHub melalui **Simpan lokal**. Konektor GitHub hanya
diperlukan saat pengguna memilih **Sinkronkan GitHub & latih** untuk mengirim antrean dataset ke repository
dan menjalankan training cloud. Dengan demikian input dataset tidak bergantung pada konektor.

## Yang sudah diuji / belum
- Diuji: tokenizer Python vs JS, inferensi JS vs referensi numpy (bobot acak), pembangun dataset.
- **Belum dijalankan**: `model/gpt.py`, `train/*.py`, `export_weights.py` (butuh PyTorch), workflow GitHub,
  dan build APK. Uji paritas di `train.yml` dan `release.yml` akan menangkap ketidakcocokan PyTorch ↔ JS.
- APK yang dihasilkan adalah **debug** (untuk instal langsung). Rilis Play Store perlu tanda tangan keystore.
