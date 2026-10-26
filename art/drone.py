"""Режет лист дрона: дрон (корпус + пропеллер отдельно), дрон в коконе, пустой кокон.
Паутина белая, поэтому фон убирается со строгим порогом (только почти чистый белый)."""
import sys, os, numpy as np
from PIL import Image
from scipy import ndimage as ndi
ROOT = sys.argv[1]
src = np.array(Image.open(os.path.join(ROOT, "art/raw/drone.png")).convert("RGB")).astype(np.float32)
OUT = os.path.join(ROOT, "public/assets/world/drone"); os.makedirs(OUT, exist_ok=True)
mn, mx = src.min(2), src.max(2)
white = (mn >= 246) & ((mx - mn) <= 9)
lab, _ = ndi.label(white)
ids = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(ids))
alpha = np.where(bg, 0.0, 1.0)
edge = ndi.binary_dilation(bg, iterations=2) & ~bg
alpha[edge] = np.clip(((255 - src) / 255).max(2) * 4, 0, 1)[edge]
rgba = np.dstack([src, alpha * 255])
solid = ndi.binary_closing(rgba[..., 3] > 30, iterations=4)
lab, n = ndi.label(solid)
objs = sorted([(sl[1].start, i + 1, sl) for i, sl in enumerate(ndi.find_objects(lab)) if (lab == i + 1).sum() > 5000])
names = ["drone", "drone_cocoon", "cocoon_empty"]
def save(a, name):
    ys, xs = np.where(a[..., 3] > 8)
    a = a[max(ys.min() - 3, 0):ys.max() + 4, max(xs.min() - 3, 0):xs.max() + 4]
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(os.path.join(OUT, name + ".png"), optimize=True)
    print(name, a.shape[1], "x", a.shape[0])
for (x0, i, sl), name in zip(objs, names):
    c = rgba[sl].copy(); c[..., 3] *= ndi.binary_dilation(lab[sl] == i, iterations=2)
    save(c, name)
    if name == "drone":
        # пропеллер отдельно — чтобы крутить в коде (scaleX = cos(t))
        rgb = c[..., :3]; h = c.shape[0]
        # срез по самому узкому месту вала между лопастями и корпусом
        rows = (c[..., 3] > 100).sum(1)
        top = int(c.shape[0] * 0.35)
        cut = int(np.argmin(rows[20:top])) + 20
        upper = np.zeros(c.shape[:2], bool); upper[:cut] = c[:cut, :, 3] > 30
        ul, un = ndi.label(upper)
        sizes = ndi.sum(upper, ul, range(1, un + 1))
        prop_mask = ndi.binary_dilation(ul == int(np.argmax(sizes)) + 1, iterations=2) & (np.indices(upper.shape)[0] < cut)
        prop = c.copy(); prop[..., 3] *= prop_mask
        body = c.copy(); body[..., 3] *= ~prop_mask
        save(prop, "drone_propeller"); save(body, "drone_body")
        print("cut row", cut, "of", h)
