// Asisten khusus CODING: gabungan aturan analisis (analyzer.js) + model bahasa buatan sendiri.
import { analyzeFiles, formatReport } from "./analyzer.js";

export const chatPrompt = (message) => `<|user|>\n${message}\n<|assistant|>\n`;

const fallback = (message) => {
  const q = message.trim().toLowerCase();
  if (/^(halo|hai|hi|hello|pagi|siang|sore|malam)\b/.test(q))
    return "Halo! Saya Miko AI. Saya bisa membantu menjelaskan dan menulis kode.";
  if (/fungsi|function|javascript|js/.test(q))
    return "Contoh fungsi JavaScript:\n\nfunction tambah(a, b) {\n  return a + b;\n}\n\nPanggil dengan tambah(2, 3).";
  if (/api\b|endpoint|http|rest/.test(q))
    return "API adalah antarmuka untuk berkomunikasi antarprogram. Alur umumnya: client mengirim HTTP request ke endpoint, server memprosesnya, lalu mengembalikan response JSON dengan status seperti 200 atau 404.";
  if (/html|css|tampilan|web/.test(q))
    return "Untuk halaman web, gunakan HTML untuk struktur, CSS untuk tampilan, dan JavaScript untuk interaksi. Mulai dari struktur sederhana lalu tambahkan fitur satu per satu.";
  if (/python|def |pip|django|flask/.test(q))
    return "Contoh fungsi Python:\n\ndef tambah(a, b):\n    return a + b\n\nJalankan dengan print(tambah(2, 3)).";
  if (/error|bug|debug|gagal|tidak bisa/.test(q))
    return "Untuk menganalisis error, kirim pesan error lengkap, potongan kode terkait, dan langkah untuk memunculkannya. Periksa baris pertama pada stack trace terlebih dahulu.";
  return "Saya belum memahami pertanyaan itu dengan baik. Coba tanyakan dengan menyertakan bahasa pemrograman atau potongan kode yang ingin dianalisis.";
};

const usable = (s) => {
  if (!s || s.trim().length < 2 || s.includes("�")) return false;
  const printable = [...s].filter((c) => c === "\n" || c === "\t" || (c >= " " && c <= "~") || c.charCodeAt(0) > 0x7f).length;
  return printable / s.length > 0.85;
};

// message: pertanyaan; files: [{path, content}] opsional; mengalirkan potongan teks jawaban.
export async function* reply(lm, message, files, opts = {}) {
  if (Array.isArray(files) && files.length && /analis|periksa|cek|error|scan/i.test(message)) {
    yield formatReport(analyzeFiles(files));
    return;
  }
  let answer = "";
  for await (const part of lm.generate(chatPrompt(message), { maxNew: 300, temperature: 0.4, topK: 20, ...opts })) answer += part;
  yield usable(answer) ? answer : fallback(message);
}
