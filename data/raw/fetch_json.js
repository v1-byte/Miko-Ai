// Ambil JSON dengan penanganan error
export async function ambilJson(url, opsi = {}) {
  const res = await fetch(url, opsi);
  if (!res.ok) throw new Error(`HTTP ${res.status} saat memuat ${url}`);
  return res.json();
}

export function tunda(ms) {
  return new Promise((selesai) => setTimeout(selesai, ms));
}

export async function coba(fn, kali = 3) {
  for (let i = 0; i < kali; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === kali - 1) throw e;
      await tunda(200 * (i + 1));
    }
  }
}
