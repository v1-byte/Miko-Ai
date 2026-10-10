// Asisten khusus CODING: gabungan aturan analisis (analyzer.js) + model bahasa buatan sendiri.
import { analyzeFiles, formatReport } from "./analyzer.js";

export const chatPrompt = (message) => `<|user|>\n${message}\n<|assistant|>\n`;

// message: pertanyaan; files: [{path, content}] opsional; mengalirkan potongan teks jawaban.
export async function* reply(lm, message, files, opts = {}) {
  if (Array.isArray(files) && files.length && /analis|periksa|cek|error|scan/i.test(message)) {
    yield formatReport(analyzeFiles(files));
    return;
  }
  yield* lm.generate(chatPrompt(message), { maxNew: 300, temperature: 0.4, topK: 20, ...opts });
}
