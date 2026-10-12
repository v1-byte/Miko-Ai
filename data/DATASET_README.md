# Dataset Lengkap untuk Miko-Ai

Paket dataset siap pakai untuk repo [v1-byte/Miko-Ai](https://github.com/v1-byte/Miko-Ai).

## Isi

```
miko_ai_dataset/
├── data/
│   ├── instruct/
│   │   └── id_coding_complete_01.jsonl   ← 212 pasangan tanya-jawab coding (ID + konsep)
│   ├── raw/
│   │   ├── contoh_python.py
│   │   ├── contoh_js.js
│   │   └── contoh_html.html
│   └── SOURCES.md
└── README.md
```

## Cara pakai

1. Clone repo Miko-Ai (atau fork kamu):
   ```bash
   git clone https://github.com/v1-byte/Miko-Ai.git
   cd Miko-Ai
   ```

2. Salin dataset ini ke dalam repo:
   ```bash
   # dari folder hasil ekstrak zip ini
   cp data/instruct/*.jsonl   path/ke/Miko-Ai/data/instruct/
   cp data/raw/*              path/ke/Miko-Ai/data/raw/
   # merge SOURCES.md jika perlu
   ```

3. Validasi:
   ```bash
   python data/validate_instruct.py
   ```

4. Bangun dataset + latih:
   ```bash
   python data/build_dataset.py
   python tokenizer/train_tokenizer.py --vocab 1024
   python train/train.py --steps 2000
   python train/eval.py
   python export/export_weights.py
   ```

   Atau lewat GitHub Actions: **Actions → Latih model → Run workflow**.

## Format instruct

Setiap baris = satu JSON:

```json
{"user": "pertanyaan", "assistant": "jawaban (boleh ada code block)"}
```

## Catatan

- Dataset ini **tambahan** di atas seed/id_core yang sudah ada di repo.
- Fokus: Python, JavaScript, HTML/CSS, SQL, konsep web, algoritma dasar, best practice — banyak dalam Bahasa Indonesia.
- Model dari-nol tetap terbatas; makin banyak data berkualitas + step training, makin baik hasilnya.
- Jangan masukkan secret / data pribadi ke `data/`.

## Lisensi data

Contoh kode di `raw/` dan Q&A di `instruct/` dibuat khusus untuk pelatihan edukatif Miko-Ai (bebas dipakai di project ini).
