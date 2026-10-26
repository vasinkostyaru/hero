"""Выравнивает кадры героя: все кадры в холсте одного размера, голова по одной вертикали,
наземные кадры — ноги на одной линии земли. Собирает атлас + JSON для Phaser.
Запуск: python3 art/hero_frames.py <проект>"""
import sys, os, json, numpy as np
from PIL import Image
ROOT = sys.argv[1]
SRC = {"run": os.path.join(ROOT, "art/cut_run"), "act": os.path.join(ROOT, "art/cut_act")}
OUT = os.path.join(ROOT, "public/assets/hero2"); os.makedirs(OUT, exist_ok=True)
frames = [("run_%d" % i, "run", True) for i in range(1, 7)] + [
    ("idle", "act", True), ("jump", "act", False), ("fall", "act", False),
    ("land", "act", True), ("climb", "act", False), ("shoot", "act", True)]
CW, CH, GROUND = 640, 560, 540       # холст кадра и линия земли
SCALE = 0.75                          # итог ~2x от экранного роста героя (~216 px)
def head_x(a):
    al = a[..., 3] > 100
    ys = np.where(al.any(1))[0]; top = ys.min(); h = ys.max() - top
    band = al[top:top + int(h * 0.35)]
    return np.where(band)[1].mean()
out = {}
imgs = []
for name, src, grounded in frames:
    im = Image.open(os.path.join(SRC[src], name + ".png")).convert("RGBA")
    im = im.resize((round(im.width * SCALE), round(im.height * SCALE)), Image.LANCZOS)
    a = np.array(im)
    hx = head_x(a)
    canvas = Image.new("RGBA", (CW, CH))
    x = round(CW * 0.5 - hx)
    if grounded:
        bottom = np.where((a[..., 3] > 100).any(1))[0].max()
        y = GROUND - bottom
    else:
        y = round(CH * 0.5 - a.shape[0] * 0.5)
    canvas.alpha_composite(im, (max(x, 0), max(y, 0)))
    imgs.append((name, canvas))
# атлас: сетка 4 колонки
cols = 4; rows = (len(imgs) + cols - 1) // cols
atlas = Image.new("RGBA", (cols * CW, rows * CH))
for i, (name, c) in enumerate(imgs):
    fx, fy = (i % cols) * CW, (i // cols) * CH
    atlas.alpha_composite(c, (fx, fy))
    out[name] = {"frame": {"x": fx, "y": fy, "w": CW, "h": CH}, "sourceSize": {"w": CW, "h": CH},
                 "spriteSourceSize": {"x": 0, "y": 0, "w": CW, "h": CH}, "rotated": False, "trimmed": False}
    c.save(os.path.join(OUT, name + ".png"), optimize=True)
atlas.save(os.path.join(OUT, "hero_atlas.png"), optimize=True)
json.dump({"frames": out, "meta": {"image": "hero_atlas.png", "size": {"w": atlas.width, "h": atlas.height},
          "scale": "1", "note": "Все кадры 640x560. Точка опоры (origin) — (0.5, 540/560): центр головы по X, линия земли по Y. Прыжок/падение/лазанье центрированы по вертикали."}},
          open(os.path.join(OUT, "hero_atlas.json"), "w"), ensure_ascii=False, indent=1)
print("atlas", atlas.size)
