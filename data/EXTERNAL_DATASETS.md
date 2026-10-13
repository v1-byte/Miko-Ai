# Katalog dataset eksternal untuk Miko-Ai

Katalog ini mencatat sumber yang dapat dipertimbangkan, bukan salinan atau endorsement atas isi dataset. Lisensi kode sumber dapat berbeda dari lisensi repository atau dataset pembungkusnya. Tinjau syarat sumber asal sebelum memakai, melatih, atau membagikan hasilnya.

## Sumber coding

### 1. CoMA / CoMIT

- Repository: <https://github.com/Denilah/CoMA>
- Berkas data: `data/CoMIT.json` (sekitar 73,5 MB pada saat pemeriksaan 2026-10-13).
- Isi: sekitar 80 ribu instruksi multi-tugas; mencakup generasi, pencarian, perbaikan, penyelesaian, dan penjelasan kode. Bahasa instruksi terutama Inggris dan Mandarin.
- Lisensi: repository menyatakan Apache-2.0, tetapi dokumentasinya menyebut data bersumber dari beberapa dataset eksternal. Lisensi dan provenance upstream dapat berbeda. Importer meminta konfirmasi bahwa provenance dan syarat masing-masing sumber sudah ditinjau.
- Import lokal (tidak masuk Git): `python data/import_external_datasets.py import-instructions --source coma --acknowledge-provenance-review`

### 2. Code Alpaca

- Repository: <https://github.com/sahil280114/codealpaca>
- Berkas data: `data/code_alpaca_20k.json` (sekitar 8,1 MB pada saat pemeriksaan 2026-10-13).
- Isi: 20 ribu contoh instruksi coding; instruksi dan jawaban dihasilkan untuk eksperimen Code Alpaca.
- Lisensi data: CC BY-NC 4.0 menurut `DATA_LICENSE`; mengharuskan atribusi dan membatasi penggunaan nonkomersial. Ini berbeda dari lisensi kode repository.
- Import lokal (tidak masuk Git): `python data/import_external_datasets.py import-instructions --source codealpaca --acknowledge-noncommercial`

### 3. StarCoderData / The Stack

- Dataset card: <https://huggingface.co/datasets/bigcode/starcoderdata>
- Repository pembangun: <https://github.com/bigcode-project/the-stack-v2>
- Isi: korpus kode sangat besar untuk banyak bahasa pemrograman; bukan dataset tanya-jawab siap pakai.
- Akses: perlu membaca dan menerima ketentuan di halaman dataset; halaman menyatakan informasi kontak pengguna dibagikan kepada pemelihara. Kode tetap tunduk pada lisensi asal, permintaan penghapusan harus diikuti, dan salinan dataset tidak boleh dibagikan ulang tanpa ketentuan yang diminta.
- Tidak ada pengunduhan otomatis. Jika Anda telah memperoleh berkas JSONL secara sah dan menerima ketentuannya, konversi lokal hanya menyimpan baris dengan lisensi SPDX yang diizinkan (MIT, Apache-2.0, BSD-2-Clause/3-Clause, ISC):
  `python data/import_external_datasets.py convert-stack-jsonl --input /path/ke/file.jsonl --acknowledge-stack-terms`
- Berkas keluaran berada di `data/external/`, diabaikan Git, dan tidak ikut training sampai direktori itu diberikan secara eksplisit ke `build_dataset.py`.

## Katalog Bahasa Indonesia

### 4. Awesome Indonesian LLM Dataset

- Repository: <https://github.com/irfanfadhullah/awesome-indonesian-llm-dataset>
- Ini adalah katalog tautan untuk dataset Bahasa Indonesia lintas tugas dan modalitas, bukan satu berkas dataset coding yang dapat langsung diimpor. Setiap sumber memiliki lisensi, akses, dan formatnya sendiri.
- Gunakan katalog untuk memilih dataset sesuai tugas Miko-Ai, lalu periksa lisensi dan provenance dataset individual sebelum menambahkannya.

Sumber tambahan katalog NLP Bahasa Indonesia: <https://github.com/louisowen6/NLP_bahasa_resources> (katalog sumber daya; pembaruan terakhir yang tercantum di sana adalah 2022).

## Prinsip penyimpanan dan training

- Isi eksternal tidak pernah ditaruh dalam commit: cache, hasil normalisasi, manifest, dan hasil konversi disimpan dalam `data/external/`, yang diabaikan Git.
- Importer hanya berjalan setelah perintah eksplisit. Ia tidak menjalankan training, tidak mengubah `data/instruct/` yang terlacak, dan tidak mengunduh StarCoderData.
- `data/build_dataset.py` hanya memakai data eksternal bila direktori tambahan diberikan melalui `--extra-instruct` atau `--extra-raw`.
- Simpan atribusi dan provenance bersama hasil impor lokal. Jangan gunakan data berlisensi nonkomersial untuk penggunaan komersial; jangan klaim bahwa lisensi repository sumber otomatis melisensikan semua konten dataset.
