// Penganalisis kode game web: deteksi API, CDN, aset, dan masalah umum + saran perbaikan.
const RULES = [
  { id: "mixed-content", level: "error", re: /["'(]http:\/\/(?!localhost|127\.0\.0\.1)[^"')\s]+/g,
    msg: "Alamat http:// (non-HTTPS) — diblokir browser/WebView di halaman HTTPS.", fix: "Ganti ke https:// atau unduh aset ke dalam ZIP." },
  { id: "abs-path", level: "warn", re: /(?:src|href)=["']\/(?!\/)[^"']+["']/g,
    msg: "Path absolut diawali '/' — gagal saat dibuka dari file:// atau subfolder.", fix: "Ubah ke path relatif (./assets/...)." },
  { id: "fetch-local", level: "warn", re: /fetch\(\s*["'`](?!https?:)[^"'`]+["'`]/g,
    msg: "fetch() ke file lokal — gagal di file:// karena CORS.", fix: "Jalankan lewat server lokal/WebView dengan asset loader, atau inline datanya." },
  { id: "service-worker", level: "info", re: /serviceWorker\.register/g,
    msg: "Service worker terdeteksi — butuh HTTPS/localhost.", fix: "Pada APK gunakan https://appassets.androidplatform.net atau nonaktifkan SW untuk mode offline." },
  { id: "eval", level: "warn", re: /\beval\s*\(|new Function\s*\(/g,
    msg: "eval/new Function — berisiko dan bisa diblokir CSP.", fix: "Ganti dengan parsing/logika eksplisit." },
  { id: "secret", level: "error", re: /(?:api[_-]?key|secret|token|passwd|password)["']?\s*[:=]\s*["'][A-Za-z0-9_\-]{12,}["']/gi,
    msg: "Kemungkinan kunci/rahasia tertanam di kode.", fix: "Pindahkan ke server/variabel lingkungan, jangan di dalam ZIP/APK." },
];
const CDN = /https?:\/\/(?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|ajax\.googleapis\.com|fonts\.(?:googleapis|gstatic)\.com|code\.jquery\.com|stackpath\.bootstrapcdn\.com)[^"'`)\s]*/g;
const URLS = /https?:\/\/[^\s"'`)<>]+/g;
const API_CALL = /(fetch\(|XMLHttpRequest|axios\.|\$\.(?:get|post|ajax)|WebSocket\()/g;
const ASSET = /[\w\-./]+\.(?:png|jpe?g|gif|webp|svg|mp3|ogg|wav|mp4|webm|woff2?|ttf|json|atlas|glb|gltf)\b/gi;

const uniq = (a) => [...new Set(a)];
const lineOf = (text, idx) => text.slice(0, idx).split("\n").length;

export function analyzeFiles(files) {
  const out = { files: files.length, issues: [], cdn: [], urls: [], apiFiles: [], assets: [], missingAssets: [] };
  const known = new Set(files.map((f) => f.path.replace(/^\.?\//, "")));
  const codeLike = /\.(html?|js|mjs|css|json)$/i;
  for (const f of files) {
    const text = typeof f.content === "string" ? f.content : "";
    if (!codeLike.test(f.path) || !text) continue;
    for (const r of RULES) {
      r.re.lastIndex = 0;
      let m;
      while ((m = r.re.exec(text)) && out.issues.length < 300)
        out.issues.push({ rule: r.id, level: r.level, file: f.path, line: lineOf(text, m.index), msg: r.msg, fix: r.fix, snippet: m[0].slice(0, 80) });
    }
    out.cdn.push(...(text.match(CDN) || []));
    out.urls.push(...(text.match(URLS) || []));
    if (API_CALL.test(text)) out.apiFiles.push(f.path);
    API_CALL.lastIndex = 0;
    for (const a of text.match(ASSET) || []) out.assets.push(a);
  }
  out.cdn = uniq(out.cdn); out.urls = uniq(out.urls).slice(0, 100); out.apiFiles = uniq(out.apiFiles);
  out.assets = uniq(out.assets);
  const baseNames = new Set([...known].map((p) => p.split("/").pop()));
  out.missingAssets = out.assets.filter((a) => !/^https?:/.test(a) && !baseNames.has(a.split("/").pop())).slice(0, 50);
  return out;
}

export function formatReport(r) {
  const L = [`Hasil analisis (${r.files} file)`];
  const cnt = (lv) => r.issues.filter((i) => i.level === lv).length;
  L.push(`Masalah: ${cnt("error")} error, ${cnt("warn")} peringatan, ${cnt("info")} info`);
  for (const i of r.issues.slice(0, 15)) L.push(`- [${i.level}] ${i.file}:${i.line} ${i.msg} → ${i.fix}`);
  if (r.issues.length > 15) L.push(`…dan ${r.issues.length - 15} lainnya`);
  if (r.cdn.length) L.push(`\nCDN (${r.cdn.length}) — unduh ke ZIP agar bisa offline:\n` + r.cdn.slice(0, 10).map((c) => `- ${c}`).join("\n"));
  if (r.apiFiles.length) L.push(`\nFile yang memanggil API/jaringan: ${r.apiFiles.join(", ")}`);
  if (r.missingAssets.length) L.push(`\nAset dirujuk tapi tidak ada di ZIP:\n` + r.missingAssets.slice(0, 10).map((a) => `- ${a}`).join("\n"));
  return L.join("\n");
}
