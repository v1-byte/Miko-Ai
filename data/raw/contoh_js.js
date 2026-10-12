/** Contoh utilitas JavaScript sederhana untuk dataset Miko-Ai. */

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function throttle(fn, limit) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last >= limit) {
      last = now;
      return fn.apply(this, args);
    }
  };
}

function formatRupiah(angka) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(angka);
}

function isPalindrome(teks) {
  const bersih = teks.toLowerCase().replace(/[^a-z0-9]/g, "");
  return bersih === [...bersih].reverse().join("");
}

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key];
    (acc[k] = acc[k] || []).push(item);
    return acc;
  }, {});
}

function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

// Contoh pemakaian (Node / browser console)
if (typeof module !== "undefined") {
  module.exports = { debounce, throttle, formatRupiah, isPalindrome, groupBy, clamp };
}
