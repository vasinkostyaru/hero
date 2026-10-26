"""Атлас птицы из кадров, нарезанных art/sheet.py (чайка — art/raw/seagull_sheet.png,
голубь — art/raw/pigeon_sheet.png). Кадры выравниваются по приметной точке: у чайки —
основание клюва (голова на месте, машут только крылья), у голубя — лапы и линия земли.
Кадры из CENTERED (пике) — по центру силуэта. Все кадры в холсте одного размера,
центр холста — центр тела. Уменьшение до игрового размера здесь (Lanczos), в игре setScale(1).
Запуск: python3 art/bird_atlas.py <проект> seagull|pigeon
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


def feet(a):
    """Голубь ходит: опора — линия лап (низ силуэта), по X — центр масс силуэта."""
    ys, xs = np.where(a[..., 3] > 128)
    return xs.mean(), ys.max()


# scale — до игрового размера; body — центр тела относительно опорной точки (пиксели листа)
BIRDS = {
    'seagull': dict(cut='art/seagull_cut', out='public/assets/chars/enemies', scale=0.4, anchor=beak_base,
                    body=(-140, 75), frames=['fly_1', 'fly_2', 'fly_3', 'fly_4', 'glide', 'dive'], centered=['dive']),
    # голубь: глаз на листе ~9.5% крупнее, чем на pigeon.png (в игре × 0.3) → 0.3 / 1.095;
    # центр холста — 170 px листа над лапами
    'pigeon': dict(cut='art/pigeon_cut', out='public/assets/chars/enemies', scale=0.274, anchor=feet,
                   body=(0, -170), frames=['walk_1', 'walk_2', 'walk_3', 'walk_4', 'peck', 'angry'], centered=[],
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
print('frame', fw, 'x', fh, 'sheet', sheet.size, 'anchor below center', round(-cfg['body'][1] * SCALE, 1))

# превью: цикл взмахов на закатном фоне
bg = (70, 40, 90, 255)
loop = [n for n in names if n.startswith(('fly_', 'walk_'))]
seq = loop * 3 + [n for n in names if n not in loop for _ in range(5)]
gif = []
for name in seq:
    i = names.index(name)
    fr = Image.new('RGBA', (fw, fh), bg)
    fr.alpha_composite(sheet.crop((i * fw, 0, (i + 1) * fw, fh)))
    gif.append(fr.convert('RGB').resize((fw * 2, fh * 2)))
gif[0].save(os.path.join(root, f'art/{bird}_test.gif'), save_all=True, append_images=gif[1:], duration=90, loop=0)
