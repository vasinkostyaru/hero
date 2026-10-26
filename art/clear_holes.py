"""Белый фон, запертый внутри силуэта (между ногами бочки, трубами, флагштоком и флагом),
в прозрачность. Нарезка убирает только фон, связанный с краем картинки, — эти пятна остаются.
Только чистый белый пятнами от 40 px; светлая кайма вокруг — полупрозрачная по светлоте.
Запуск: python3 art/clear_holes.py <png> [<png> ...]   (файлы перезаписываются)
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi


def clear_holes(img, min_size=40):
    a = np.array(img.convert('RGBA')).astype(np.float32)
    mn, mx = a[..., :3].min(2), a[..., :3].max(2)
    white = (mn >= 235) & ((mx - mn) <= 14) & (a[..., 3] > 0)
    lab, n = ndi.label(white)
    sizes = ndi.sum(white, lab, range(1, n + 1))
    holes = np.isin(lab, [i + 1 for i, sz in enumerate(sizes) if sz >= min_size])
    a[..., 3][holes] = 0
    edge = ndi.binary_dilation(holes, iterations=2) & ~holes
    a[..., 3][edge] *= np.clip(((255 - a[..., :3]) / 255).max(2) * 4, 0, 1)[edge]
    return Image.fromarray(a.astype(np.uint8)), int(holes.sum())


if __name__ == '__main__':
    for path in sys.argv[1:]:
        img, n = clear_holes(Image.open(path))
        img.save(path, optimize=True)
        print(path, 'cleared px', n)
