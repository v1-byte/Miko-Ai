"""Contoh utilitas Python sederhana untuk dataset Miko-Ai."""

from typing import List, Optional


def balik(teks: str) -> str:
    return teks[::-1]


def is_prima(n: int) -> bool:
    if n <= 1:
        return False
    if n <= 3:
        return True
    if n % 2 == 0 or n % 3 == 0:
        return False
    i = 5
    while i * i <= n:
        if n % i == 0 or n % (i + 2) == 0:
            return False
        i += 6
    return True


def fibonacci(n: int) -> List[int]:
    if n <= 0:
        return []
    if n == 1:
        return [0]
    seq = [0, 1]
    while len(seq) < n:
        seq.append(seq[-1] + seq[-2])
    return seq


def unik_urut(data: list) -> list:
    dilihat = set()
    hasil = []
    for x in data:
        if x not in dilihat:
            dilihat.add(x)
            hasil.append(x)
    return hasil


def two_sum(nums: List[int], target: int) -> Optional[List[int]]:
    seen = {}
    for i, n in enumerate(nums):
        if target - n in seen:
            return [seen[target - n], i]
        seen[n] = i
    return None


if __name__ == "__main__":
    print(balik("miko"))
    print(is_prima(17))
    print(fibonacci(8))
    print(unik_urut([1, 2, 2, 3, 1]))
    print(two_sum([2, 7, 11, 15], 9))
