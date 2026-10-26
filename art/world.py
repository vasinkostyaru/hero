"""Готовит фоны, текстуры и предметы мира 1 из art/raw в public/assets.
Запуск: python3 art/world.py <корень проекта>
"""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = sys.argv[1]
RAW = os.path.join(ROOT, "art/raw")
BG = os.path.join(ROOT, "public/assets/bg")
WORLD = os.path.join(ROOT, "public/assets/world")
os.makedirs(BG, exist_ok=True)
os.makedirs(os.path.join(WORLD, "props"), exist_ok=True)


def load(name):
    return np.array(Image.open(os.path.join(RAW, name)).convert("RGB")).astype(np.float32)


def save(arr, path):
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(path, optimize=True)
    print("->", os.path.relpath(path, ROOT), arr.shape[1], "x", arr.shape[0])


def white_to_alpha(rgb, seeds="top", thr=226, sat=26, band=3):
    """Убирает белый фон, связанный с краями (seeds), с мягким краем по алгоритму color-to-alpha."""
    mn, mx = rgb.min(2), rgb.max(2)
    white = (mn >= thr) & ((mx - mn) <= sat)
    lab, _ = ndi.label(white)
    if seeds == "top":
        ids = set(np.unique(lab[0])) - {0}
    else:
        ids = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(ids))
    # крупные замкнутые белые области (под верёвками с бельём и т.п.) — тоже фон
    sizes = ndi.sum(white, lab, range(1, lab.max() + 1))
    big = [i + 1 for i, v in enumerate(sizes) if v > 1500]
    bg |= np.isin(lab, big)
    alpha = np.where(bg, 0.0, 1.0)
    edge = ndi.binary_dilation(bg, iterations=band) & ~bg
    # color-to-alpha на кромке: насколько пиксель "не белый"
    a_edge = ((255 - rgb) / 255).max(2)
    a_edge = np.clip(a_edge * 1.6, 0, 1)
    alpha[edge] = a_edge[edge]
    out = rgb.copy()
    a3 = np.maximum(alpha, 1e-3)[..., None]
    out[edge] = ((rgb - 255 * (1 - a3)) / a3)[edge]
    return np.dstack([np.clip(out, 0, 255), alpha * 255])


def scale_h(arr, h):
    im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    w = round(im.width * h / im.height)
    return np.array(im.resize((w, h), Image.LANCZOS)).astype(np.float32)


def scale(arr, k):
    im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    return np.array(im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)).astype(np.float32)


def mirror_x(arr):
    return np.concatenate([arr, arr[:, ::-1]], axis=1)


def mirror_xy(arr):
    top = mirror_x(arr)
    return np.concatenate([top, top[::-1]], axis=0)


def flatten_light(rgb, sigma, axis=None, strength=0.85):
    """Убирает крупный перепад освещения (тёмный левый край -> оранжевый правый), чтобы текстура тайлилась."""
    lum = rgb.mean(2)
    if axis is None:
        low = ndi.gaussian_filter(lum, sigma)
    else:
        low = ndi.gaussian_filter1d(lum, sigma, axis=axis)
    k = (lum.mean() / np.maximum(low, 1)) ** strength
    # общий оттенок тоже выравниваем
    low_c = np.stack([ndi.gaussian_filter(rgb[..., c], sigma) for c in range(3)], 2) if axis is None else \
        np.stack([ndi.gaussian_filter1d(rgb[..., c], sigma, axis=axis) for c in range(3)], 2)
    mean_c = rgb.reshape(-1, 3).mean(0)
    tint = (mean_c / np.maximum(low_c, 1)) ** (strength * 0.6)
    return np.clip(rgb * k[..., None] ** 0.4 * tint, 0, 255)


# ---------- фоны ----------
H = 1080
sky = load("bg_sky.png")
save(scale_h(sky, H), os.path.join(BG, "sky.png"))  # 2527 px — шире, чем нужно при параллаксе 0.1, тайлить не надо

far = white_to_alpha(load("bg_far.png"))
# убрать солнце с дальнего слоя: на небе уже есть своё, при параллаксе было бы два солнца
rgb = far[..., :3]
yy, xx = np.indices(rgb.shape[:2])
sun = (rgb[..., 0] > 235) & (rgb[..., 1] > 200) & (rgb[..., 2] < 210) & (xx > 1100) & (xx < 1320) & (yy > 480) & (yy < 640)
sun = ndi.binary_dilation(ndi.binary_fill_holes(sun), iterations=2)
far[sun, 3] = 0
save(mirror_x(scale_h(far, H)), os.path.join(BG, "city_far.png"))

mid = white_to_alpha(load("bg_mid.png"))
save(mirror_x(scale_h(mid, H)), os.path.join(BG, "city_mid.png"))

# ---------- текстуры (бесшовные зеркалом 2x2, уменьшены вдвое) ----------
def seamless(t, f=0.18):
    """Бесшовность без зеркала: сдвиг на полразмера + плавное смешивание шва."""
    h, w = t.shape[:2]
    rolled = np.roll(np.roll(t, h // 2, 0), w // 2, 1)
    def ramp(n):
        x = np.minimum(np.arange(n), n - 1 - np.arange(n)) / (n * f)
        return np.clip(x, 0, 1)
    m = np.minimum.outer(ramp(h), ramp(w))[..., None]  # 0 у краёв -> берём rolled (он там непрерывен)
    return t * m + rolled * (1 - m)


t = flatten_light(load("tex_brick.png"), sigma=220)
save(mirror_xy(scale(t, 0.5)), os.path.join(WORLD, "tex_brick.png"))
t = flatten_light(load("tex_climb.png"), sigma=220)
save(seamless(scale(t, 0.5)), os.path.join(WORLD, "tex_climb.png"))

# ---------- край крыши ----------
r = white_to_alpha(load("roof_edge.png"), seeds="all")
ys = np.where(r[..., 3].max(1) > 200)[0]
r = r[ys.min():ys.max() + 1]
# обрезать края по 40 px (там бывают обрывки), выровнять свет по горизонтали
r = r[:, 40:-40]
r[..., :3] = flatten_light(r[..., :3], sigma=300, axis=1)
r = scale(r, 0.5)
save(mirror_x(r), os.path.join(WORLD, "roof_edge.png"))

# ---------- предметы ----------
NAMES = {  # порядок по координатам: сверху-слева
    "chimney": (50, 110), "water_tower": (430, 30), "antenna": (820, 80), "ac_unit": (1240, 200),
    "crate": (70, 575), "awning": (460, 585), "checkpoint_flag": (1105, 485), "lamp": (1565, 470),
}
p = white_to_alpha(load("props.png"), seeds="all")
solid = ndi.binary_closing(p[..., 3] > 40, iterations=3)
lab, n = ndi.label(solid)
objs = ndi.find_objects(lab)
for name, (px, py) in NAMES.items():
    best, bd = None, 1e9
    for i, sl in enumerate(objs, 1):
        if (lab[sl] == i).sum() < 3000:
            continue
        d = (sl[1].start - px) ** 2 + (sl[0].start - py) ** 2
        if d < bd:
            best, bd = (i, sl), d
    i, sl = best
    pad = 4
    y0, y1 = max(sl[0].start - pad, 0), sl[0].stop + pad
    x0, x1 = max(sl[1].start - pad, 0), sl[1].stop + pad
    crop = p[y0:y1, x0:x1].copy()
    m = ndi.binary_dilation(lab[y0:y1, x0:x1] == i, iterations=2)
    crop[..., 3] = np.where(m, crop[..., 3], 0)
    save(crop, os.path.join(WORLD, "props", name + ".png"))
