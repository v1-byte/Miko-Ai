// Asisten khusus CODING: gabungan aturan analisis (analyzer.js) + model bahasa buatan sendiri.
import { analyzeFiles, formatReport } from "./analyzer.js";
import { detectTopic } from "./topic-router.mjs";
import { requestOnline } from "./online-client.mjs";

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
  if (/git|github|commit|branch|push|pull request/.test(q))
    return "Git menyimpan riwayat perubahan kode. Alur aman: git switch -c nama-fitur, git add ., git commit -m \"pesan\", lalu git push -u origin nama-fitur. Setelah itu buat pull request untuk review.";
  if (/sql|database|mysql|postgres|query|tabel/.test(q))
    return "Gunakan parameterized query untuk mencegah SQL injection. Pastikan kolom penting memiliki index, gunakan transaction untuk operasi terkait, dan sertakan WHERE saat UPDATE atau DELETE.";
  if (/linux|terminal|shell|docker|container/.test(q))
    return "Mulai diagnosis dari pwd, ls, grep, find, dan tail. Untuk Docker, periksa docker ps, docker logs, environment variable, volume, serta port yang dipetakan.";
  if (/keamanan|security|password|token|secret|xss|csrf/.test(q))
    return "Jangan simpan password atau token di kode. Gunakan HTTPS, hashing password Argon2id atau bcrypt, validasi input, parameterized query, least privilege, dan secret manager.";
  if (/algoritma|kompleksitas|struktur data|array|stack|queue/.test(q))
    return "Pilih algoritma berdasarkan ukuran input dan operasi yang dominan. Ukur kompleksitas waktu dan memori; satu loop biasanya O(n), sedangkan loop bersarang sering O(n²).";
  if (/error|bug|debug|gagal|tidak bisa/.test(q))
    return "Untuk menganalisis error, kirim pesan error lengkap, potongan kode terkait, dan langkah untuk memunculkannya. Periksa baris pertama pada stack trace terlebih dahulu.";
  return "Saya belum memahami pertanyaan itu dengan baik. Coba tanyakan dengan menyertakan bahasa pemrograman atau potongan kode yang ingin dianalisis.";
};

let knowledge = [];
export const setKnowledge = (rows) => { knowledge = Array.isArray(rows) ? rows.filter((r) => r && r.user && r.assistant) : []; };
const words = (s) => new Set((s.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length > 2));
const retrieve = (message) => {
  const query = words(message);
  if (!query.size || !knowledge.length) return "";
  let best = null, bestScore = 0;
  for (const row of knowledge) {
    const target = words(row.user);
    let overlap = 0;
    for (const w of query) if (target.has(w)) overlap++;
    const phrase = row.user.toLowerCase().includes(message.trim().toLowerCase()) ? 0.5 : 0;
    const score = overlap / Math.max(query.size, target.size) + phrase;
    if (overlap && score > bestScore) { bestScore = score; best = row.assistant.trim(); }
  }
  return bestScore >= (query.size <= 3 ? 0.55 : 0.42) ? best : "";
};

const normalize = (s) => String(s || "")
  .replace(/<\|(?:assistant|user|code|pad)\|>/g, "")
  .split("<|end|>")[0]
  .trim();

const usable = (s) => {
  const t = normalize(s);
  if (t.length < 2 || t.includes("�") || /<\|[^>]+\|>/.test(t)) return false;
  const printable = [...t].filter((c) => c === "\n" || c === "\t" || (c >= " " && c <= "~") || c.charCodeAt(0) > 0x7f).length;
  if (printable / t.length <= 0.85) return false;
  const words = t.match(/[A-Za-z]{3,}/g) || [];
  const repeatedNoise = words.filter((w) => /(?:UN|NULL|NUN|JON|ONT){2,}/i.test(w)).length;
  const repetitiveWord = words.some((w) => /([A-Z]{2,4})\1/i.test(w) || /(.)\1{3,}/i.test(w));
  if (repeatedNoise >= 2 || repetitiveWord) return false;
  if (words.length >= 10 && new Set(words.map((w) => w.toLowerCase())).size / words.length < 0.28) return false;
  return true;
};

// `online` bersifat opt-in. Hanya prompt teks dikirim; analisis berkas dan knowledge tetap lokal.
export async function* reply(lm, message, files, opts = {}) {
  if (Array.isArray(files) && files.length && /analis|periksa|cek|error|scan/i.test(message)) {
    yield formatReport(analyzeFiles(files));
    return;
  }

  const { online, onRoute, fetchImpl, ...generationOptions } = opts;
  const topic = detectTopic(message);
  if (online?.enabled && online?.endpoint) {
    onRoute?.({ mode: "online-start", topic });
    try {
      const result = await requestOnline(online.endpoint, message, {
        clientId: online.clientId,
        fetchImpl,
      });
      onRoute?.({ mode: "online", topic: result.topic ?? topic, model: result.model });
      yield result.answer;
      return;
    } catch (error) {
      onRoute?.({ mode: "offline-fallback", topic, error: error?.message ?? "Permintaan online gagal." });
    }
  }

  if (/^(halo|hai|hi|hello|pagi|siang|sore|malam)\b/i.test(message.trim())) {
    yield fallback(message);
    return;
  }
  const known = retrieve(message);
  if (known) {
    yield known;
    return;
  }
  if (!lm?.generate) throw new Error("Model offline belum siap dan router online tidak berhasil.");
  let answer = "";
  for await (const part of lm.generate(chatPrompt(message), { maxNew: 220, temperature: 0.1, topK: 10, ...generationOptions })) answer += part;
  const clean = normalize(answer);
  yield usable(clean) ? clean : fallback(message);
}
