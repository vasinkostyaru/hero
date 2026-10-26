"""Режет широкие слои фона пополам: на многих телефонах предел текстуры WebGL — 4096 px.
Запуск: python3 art/split_bg.py <корень проекта>
Из bg/city_far.png получаются bg/city_far_a.png и bg/city_far_b.png (исходник не трогаем).
"""
import sys, os
from PIL import Image

ROOT = sys.argv[1]
BG = os.path.join(ROOT, "public/assets/bg")

for name in ("city_far", "city_mid"):
    im = Image.open(os.path.join(BG, name + ".png"))
    w, h = im.size
    half = w // 2
    for suffix, box in (("a", (0, 0, half, h)), ("b", (half, 0, w, h))):
        part = im.crop(box)
        path = os.path.join(BG, f"{name}_{suffix}.png")
        part.save(path, optimize=True)
        print("->", os.path.relpath(path, ROOT), part.size)
