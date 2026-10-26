"""Атлас птицы из кадров, нарезанных art/sheet.py (чайка — art/raw/seagull_sheet.png,
Ворон — art/raw/crow_fly_sheet.png). Кадры выравниваются по приметной точке головы
(чайка — основание клюва, Ворон — стекло очков): голова на месте, машут только крылья.
Кадры из CENTERED (пике) — по центру силуэта. Все кадры в холсте одного размера,
центр холста — центр тела. Уменьшение до игрового размера здесь (Lanczos), в игре setScale(1).
Запуск: python3 art/bird_atlas.py <проект> seagull|crow
"""
import sys, os, json
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

root, bird = sys.argv[1:3]


def largest(mask):
    lab, n = ndi.label(mask)
    sizes = ndi.sum(mask, lab, range(1, n + 1))
    return np.where(lab == int(np.argmax(sizes)) + 1)


def beak_base(a):
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    ys, xs = largest((al > 200) & (r > 215) & (g > 140) & (g < 215) & (b < 110))
    return xs.min(), ys.min()


def goggle_lens(a):
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    ys, xs = largest((al > 200) & (b > 150) & (b > r + 60) & (b > g + 20))
    return xs.mean(), ys.mean()


def clear_holes(img):
    """Белый фон, запертый внутри силуэта (между крылом и носком, между лапами), — в прозрачность.
    Только чистый белый крупными пятнами: блики на носке мельче и не такие белые."""
    a = np.array(img).astype(np.float32)
    mn, mx = a[..., :3].min(2), a[..., :3].max(2)
    white = (mn >= 240) & ((mx - mn) <= 12) & (a[..., 3] > 0)
    lab, n = ndi.label(white)
    sizes = ndi.sum(white, lab, range(1, n + 1))
    holes = np.isin(lab, [i + 1 for i, sz in enumerate(sizes) if sz >= 60])
    a[..., 3][holes] = 0
    # светлая кайма вокруг дыры — полупрозрачная по светлоте, как при вырезании фона
    edge = ndi.binary_dilation(holes, iterations=2) & ~holes
    a[..., 3][edge] *= np.clip(((255 - a[..., :3]) / 255).max(2) * 4, 0, 1)[edge]
    return Image.fromarray(a.astype(np.uint8))


# scale — до игрового размера; body — центр тела относительно опорной точки (пиксели листа)
BIRDS = {
    'seagull': dict(cut='art/seagull_cut', out='public/assets/chars/enemies', scale=0.4, anchor=beak_base,
                    body=(-140, 75), frames=['fly_1', 'fly_2', 'fly_3', 'fly_4', 'glide', 'dive'], centered=['dive']),
    # Ворон: стекло очков на листе ~30 px против 40 на crow_fly.png (в игре × 0.45) → 0.45 × 40/31
    'crow': dict(cut='art/crow_cut', out='public/assets/chars/crow', scale=0.58, anchor=goggle_lens,
                 body=(-110, 85), frames=['fly_1', 'fly_2', 'fly_3', 'fly_4', 'land', 'takeoff'], centered=[],
                 holes=True),
}
cfg = BIRDS[bird]
cut = os.path.join(root, cfg['cut'])
out = os.path.join(root, cfg['out'])
SCALE = cfg['scale']

frames = {}
for name in cfg['frames']:
    img = Image.open(os.path.join(cut, name + '.png')).convert('RGBA')
    if cfg.get('holes'):
        img = clear_holes(img)
    if name in cfg['centered']:
        cx, cy = img.width / 2, img.height / 2
    else:
        ax, ay = cfg['anchor'](np.array(img).astype(int))
        cx, cy = ax + cfg['body'][0], ay + cfg['body'][1]
    frames[name] = (img, cx, cy)

# общий холст: центр — центр тела, по краям хватает места любому кадру
half_w = max(max(cx, img.width - cx) for img, cx, cy in frames.values()) + 4
half_h = max(max(cy, img.height - cy) for img, cx, cy in frames.values()) + 4
W, H = int(half_w * 2), int(half_h * 2)
fw, fh = round(W * SCALE), round(H * SCALE)

names = cfg['frames']
sheet = Image.new('RGBA', (fw * len(names), fh))
atlas = {'frames': {}, 'meta': {'image': f'{bird}_atlas.png', 'size': {'w': sheet.width, 'h': fh}, 'scale': '1'}}
for i, name in enumerate(names):
    img, cx, cy = frames[name]
    canvas = Image.new('RGBA', (W, H))
    canvas.alpha_composite(img, (int(round(half_w - cx)), int(round(half_h - cy))))
    small = canvas.resize((fw, fh), Image.LANCZOS)
    sheet.alpha_composite(small, (i * fw, 0))
    atlas['frames'][name] = {
        'frame': {'x': i * fw, 'y': 0, 'w': fw, 'h': fh},
        'rotated': False, 'trimmed': False,
        'spriteSourceSize': {'x': 0, 'y': 0, 'w': fw, 'h': fh},
        'sourceSize': {'w': fw, 'h': fh},
    }
sheet.save(os.path.join(out, f'{bird}_atlas.png'), optimize=True)
with open(os.path.join(out, f'{bird}_atlas.json'), 'w') as f:
    json.dump(atlas, f, indent=1)
print('frame', fw, 'x', fh, 'sheet', sheet.size)

# превью: цикл взмахов на закатном фоне
bg = (70, 40, 90, 255)
seq = ['fly_1', 'fly_2', 'fly_3', 'fly_4'] * 3 + [n for n in names if not n.startswith('fly_') for _ in range(5)]
gif = []
for name in seq:
    i = names.index(name)
    fr = Image.new('RGBA', (fw, fh), bg)
    fr.alpha_composite(sheet.crop((i * fw, 0, (i + 1) * fw, fh)))
    gif.append(fr.convert('RGB').resize((fw * 2, fh * 2)))
gif[0].save(os.path.join(root, f'art/{bird}_test.gif'), save_all=True, append_images=gif[1:], duration=90, loop=0)
