let hitung = 0;
const tombol = document.getElementById('tombol');
const hasil = document.getElementById('hasil');

tombol.addEventListener('click', () => {
  hitung += 1;
  hasil.textContent = String(hitung);
});
