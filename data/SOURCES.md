# Sumber dan lisensi dataset

## Contoh instruksi yang ditulis khusus untuk Miko-Ai

| File | Asal | Lisensi/provenance |
|---|---|---|
| `instruct/id_core_batch_01.jsonl` | Ditulis khusus sebagai contoh pembelajaran bahasa Indonesia untuk repository Miko-Ai; kode contoh ringkas dibuat independen dan tidak disalin dari repo tertentu. | Kontribusi dataset proyek Miko-Ai; tidak memuat kode sumber pihak ketiga. Tinjau contoh sebelum distribusi. |
| `instruct/coding_practice.jsonl` | Contoh latihan coding awal yang dikurasi khusus untuk proyek. | Kontribusi dataset proyek Miko-Ai; tidak memuat kode sumber pihak ketiga. Tinjau contoh sebelum distribusi. |
| `instruct/seed.jsonl` | Seed instruksi yang disertakan dalam proyek. | Asal perlu dikonfirmasi pemilik repository sebelum mengklaim provenance lebih lanjut. |
| `instruct/it_coding.jsonl` | Dataset instruksi coding yang sudah ada di repository. | Asal dan lisensi perlu dikonfirmasi pemilik repository sebelum distribusi lebih lanjut. |

Jangan menganggap kode dari internet atau repository publik otomatis boleh digunakan. Untuk setiap batch eksternal, catat URL sumber, nama dataset/repository, versi atau commit, tanggal pengambilan, identifier lisensi SPDX, serta syarat atribusi dan pembatasan penggunaan. Simpan provenance yang dapat ditelusuri per sumber; jangan menggabungkan data dengan lisensi berbeda tanpa menilai kompatibilitasnya.

Dataset instruksi ini adalah data pelatihan, bukan jaminan bahwa contoh kodenya benar untuk semua versi runtime. Jalankan tes sintaks atau test yang sesuai, lakukan pemeriksaan keamanan, dan pisahkan benchmark dari data training.
# Sumber dataset

## instruct/id_coding_complete_01.jsonl

- Dibuat khusus untuk pelatihan Miko-Ai (edukatif).
- Isi: pasangan tanya-jawab coding (Python, JavaScript, HTML/CSS, SQL, konsep web, algoritma dasar).
- Banyak pertanyaan dalam Bahasa Indonesia.
- Jawaban ringkas + contoh kode yang benar.
- Tidak mengandung secret, kunci API, atau data pribadi.

## raw/

- `contoh_python.py`, `contoh_js.js`, `contoh_html.html`: contoh kode sederhana berlisensi permisif untuk pretraining file-level.
- Boleh diganti/ditambah dengan kode milik sendiri atau open source berlisensi MIT/BSD/Apache.
- Catat sumber di file ini jika menambahkan kode dari luar.

