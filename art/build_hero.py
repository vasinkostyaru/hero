"""Собирает все кадры героя в один атлас 1x (без масштабирования в игре):
выравнивание по голове (волосы), ноги на линии земли, у лазанья — руки/носки на линии стены."""
import sys, os, json, numpy as np
from PIL import Image
from scipy import ndimage as ndi
OLD, NEW, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(OUT, exist_ok=True)
K2 = 0.65 * 2            # итог 2x: idle ~432 px, потом /2 -> ~216 px
CW, CH, GROUND, WALL_X = 640, 640, 600, 450   # холст 2x
def trim(a):
    ys, xs = np.where(a[..., 3] > 10); return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
def load_old(n):  # уже в 0.75 от листа
    a = trim(np.array(Image.open(f"{OLD}/{n}.png").convert("RGBA")))
    return rs(a, 0.65 * 2)
def load_new(n):
    a = trim(np.array(Image.open(f"{NEW}/{n}.png").convert("RGBA")))
    return rs(a, 0.75 * 0.65 * 2)
def rs(a, k):
    im = Image.fromarray(a); return np.array(im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS))
def hair(a):
    r, g, b, al = [a[..., i].astype(int) for i in range(4)]
    m = (r > 100) & (r < 230) & (g > 40) & (g < 130) & (b < 80) & (r > g + 35) & (al > 200)
    m = ndi.binary_opening(m, iterations=1)
    lab, n = ndi.label(m); s = ndi.sum(m, lab, range(1, n + 1)); m = lab == (np.argmax(s) + 1)
    ys, xs = np.where(m); return xs.mean(), ys.mean()
def hair_area(a):
    r, g, b, al = [a[..., i].astype(int) for i in range(4)]
    m = (r > 100) & (r < 230) & (g > 40) & (g < 130) & (b < 80) & (r > g + 35) & (al > 200)
    m = ndi.binary_opening(m, iterations=1); lab, n = ndi.label(m)
    return ndi.sum(m, lab, range(1, n + 1)).max()
frames = []
G = "ground"; A = "air"; W = "wall"
for n in [f"run_{i}" for i in range(1, 7)] + ["idle", "land", "shoot"]: frames.append((n, load_old(n), G))
frames.append(("jump", load_old("jump"), A))
for n in ["apex", "fall_1", "fall_2"]: frames.append((n, load_new(n), A))
for n in ["climb_1", "climb_2", "climb_3", "climb_4", "wall_slide"]: frames.append((n, load_new(n), W))
# выровнять масштаб листов по площади волос (голова одинакового размера во всех кадрах)
old_ref = np.median([hair_area(a) for n, a, k in frames if n.startswith("run") or n == "idle"])
new_ref = np.median([hair_area(a) for n, a, k in frames if n in ("apex", "climb_1", "climb_2", "climb_3", "climb_4", "wall_slide", "fall_1", "fall_2")])
kfix = (old_ref / new_ref) ** 0.5
print("new sheet scale fix", round(kfix, 3))
frames = [(n, rs(a, kfix) if n in ("apex", "fall_1", "fall_2", "climb_1", "climb_2", "climb_3", "climb_4", "wall_slide") else a, k) for n, a, k in frames]
out = []
for name, a, kind in frames:
    hx, hy = hair(a)
    if kind == G:
        x = CW / 2 - hx; y = GROUND - a.shape[0]
    elif kind == A:
        x = CW / 2 - hx; y = CH * 0.22 - hy
    else:
        right = np.where((a[..., 3] > 120).any(0))[0].max()
        x = WALL_X - right; y = CH * 0.30 - hy
    c = Image.new("RGBA", (CW, CH)); c.alpha_composite(Image.fromarray(a), (int(round(x)), int(round(y))))
    out.append((name, c))
for name, c in out: c.save(f"{OUT}/{name}.png")
print(" ".join(n for n, _ in out))
