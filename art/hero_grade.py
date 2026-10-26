"""Вписывает кадры героя в закатную сцену: убирает светлую кайму, добавляет мягкий тёмный контур,
тёплый свет сверху-спереди и фиолетовую тень снизу (как у фона и предметов).
Запуск: python3 hero_grade.py <папка с кадрами> <папка вывода>"""
import sys, os, glob, numpy as np
from PIL import Image
from scipy import ndimage as ndi
src, dst = sys.argv[1], sys.argv[2]; os.makedirs(dst, exist_ok=True)
for f in sorted(glob.glob(os.path.join(src, "*.png"))):
    if "atlas" in f: continue
    a = np.array(Image.open(f).convert("RGBA")).astype(np.float32)
    rgb, al = a[..., :3], a[..., 3] / 255
    solid = al > 0.9
    # 1) кайма: цвет полупрозрачных краёв берём от ближайшего непрозрачного пикселя
    idx = ndi.distance_transform_edt(~solid, return_distances=False, return_indices=True)
    rgb = np.where(solid[..., None], rgb, rgb[idx[0], idx[1]])
    # и подъедаем альфу на ~1px, чтобы ушёл белый ореол
    al = np.clip(ndi.grey_erosion(al, size=(2, 2)) * 1.05, 0, 1)
    body = al > 0.5
    ys, xs = np.where(body)
    if len(ys) == 0: continue
    y0, y1 = ys.min(), ys.max()
    yy = np.indices(al.shape)[0]
    t = np.clip((yy - y0) / max(y1 - y0, 1), 0, 1)[..., None]  # 0 сверху, 1 снизу
    # 2) освещение сцены: тёплый сверху, сиреневая тень снизу, общая лёгкая приглушка
    warm = np.array([1.04, 0.95, 0.86]); cool = np.array([0.80, 0.74, 0.92])
    light = warm * (1 - t) + cool * t
    lum = rgb.mean(2, keepdims=True)
    rgb = lum + (rgb - lum) * 0.88          # чуть меньше насыщенности, как у фона
    rgb = rgb * light
    # 3) тёплый ободок по верхнему краю силуэта (свет заката)
    inner = ndi.binary_erosion(body, iterations=3)
    rim = (body & ~inner).astype(np.float32)
    up = np.zeros_like(rim); up[:-4] = body[4:] & ~body[:-4] if False else 0
    shifted = np.zeros_like(body); shifted[4:] = body[:-4]   # силуэт, сдвинутый вниз
    top_edge = body & ~shifted
    rim_top = ndi.gaussian_filter(top_edge.astype(np.float32), 1.2)[..., None] * (1 - t) * 0.6
    rgb = rgb + (np.array([255, 170, 90]) - rgb) * np.clip(rim_top, 0, 0.55)
    # 4) мягкий тёмный контур снаружи (у фона и предметов он есть, у героя — нет)
    ring = ndi.binary_dilation(body, iterations=2) & ~body
    out_a = np.maximum(al, ndi.gaussian_filter(ring.astype(np.float32), 0.8) * 0.75)
    outline_col = np.array([42, 24, 58], np.float32)
    rgb = np.where((ring & (al < 0.5))[..., None], outline_col, rgb)
    res = np.dstack([np.clip(rgb, 0, 255), out_a * 255]).astype(np.uint8)
    Image.fromarray(res).save(os.path.join(dst, os.path.basename(f)), optimize=True)
    print(os.path.basename(f))
