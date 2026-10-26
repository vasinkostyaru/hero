"""Убирает белый фон и режет лист на детали по связным областям."""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi


def remove_white_bg(img, thr=232, sat_max=18):
    a = np.array(img.convert("RGB")).astype(np.int16)
    mn = a.min(axis=2)
    mx = a.max(axis=2)
    whiteish = (mn >= thr) & ((mx - mn) <= sat_max)
    # фон = белые пиксели, связанные с краем картинки
    lab, n = ndi.label(whiteish)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    # мягкий край: пиксели рядом с фоном получают альфу по "белизне"
    edge = ndi.binary_dilation(bg, iterations=2) & ~bg
    alpha = np.where(bg, 0, 255).astype(np.float32)
    w = np.clip((mn - 200) / (255 - 200), 0, 1)
    alpha[edge] = np.clip((1 - w[edge]) * 255 * 1.4, 0, 255)
    rgba = np.dstack([a.astype(np.uint8), alpha.astype(np.uint8)])
    # убрать белую кайму: подтемнить полупрозрачные края до цвета соседей
    return rgba


def components(rgba, min_area=1500, pad=6):
    solid = rgba[..., 3] > 40
    solid = ndi.binary_closing(solid, iterations=2)
    lab, n = ndi.label(solid)
    out = []
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        area = (lab[sl] == i).sum()
        if area < min_area:
            continue
        y0, y1 = max(sl[0].start - pad, 0), min(sl[0].stop + pad, rgba.shape[0])
        x0, x1 = max(sl[1].start - pad, 0), min(sl[1].stop + pad, rgba.shape[1])
        crop = rgba[y0:y1, x0:x1].copy()
        m = ndi.binary_dilation(lab[y0:y1, x0:x1] == i, iterations=2)
        crop[..., 3] = np.where(m, crop[..., 3], 0)
        out.append(((x0, y0, x1, y1), crop, area))
    return out


if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    os.makedirs(dst, exist_ok=True)
    rgba = remove_white_bg(Image.open(src))
    Image.fromarray(rgba).save(os.path.join(dst, "_full.png"))
    for k, (box, crop, area) in enumerate(components(rgba)):
        name = f"part_{k:02d}_{box[0]}_{box[1]}.png"
        Image.fromarray(crop).save(os.path.join(dst, name))
        print(name, box, area)
