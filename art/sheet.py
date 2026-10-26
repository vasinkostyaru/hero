"""Режет лист персонажей по сетке областей: в каждой области берётся самый крупный объект.
Фон убирается строгим порогом (только почти чистый белый), чтобы не съесть белую паутину и перья.
Запуск: python3 art/sheet.py <проект> <лист.png> <папка-вывода> name:x0,y0,x1,y1 ...
"""
import sys, os, numpy as np
from PIL import Image
from scipy import ndimage as ndi
root, sheet, outdir = sys.argv[1:4]
out = os.path.join(root, outdir); os.makedirs(out, exist_ok=True)
src = np.array(Image.open(os.path.join(root, sheet)).convert("RGB")).astype(np.float32)
mn, mx = src.min(2), src.max(2)
white = (mn >= 244) & ((mx - mn) <= 10)
lab, _ = ndi.label(white)
ids = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(ids))
alpha = np.where(bg, 0.0, 1.0)
edge = ndi.binary_dilation(bg, iterations=2) & ~bg
alpha[edge] = np.clip(((255 - src) / 255).max(2) * 4, 0, 1)[edge]
rgba = np.dstack([src, alpha * 255])
solid = ndi.binary_closing(rgba[..., 3] > 30, iterations=4)
for spec in sys.argv[4:]:
    name, box = spec.split(":")
    x0, y0, x1, y1 = map(int, box.split(","))
    reg = np.zeros_like(solid); reg[y0:y1, x0:x1] = solid[y0:y1, x0:x1]
    l, n = ndi.label(reg)
    sizes = ndi.sum(reg, l, range(1, n + 1))
    m = ndi.binary_dilation(l == int(np.argmax(sizes)) + 1, iterations=2)
    a = rgba.copy(); a[..., 3] *= m
    ys, xs = np.where(a[..., 3] > 8)
    a = a[ys.min() - 2:ys.max() + 3, xs.min() - 2:xs.max() + 3]
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(os.path.join(out, name + ".png"), optimize=True)
    print(name, a.shape[1], "x", a.shape[0])
