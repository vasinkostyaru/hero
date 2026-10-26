"""Атлас платформ мира 1 из кадров, нарезанных art/sheet.py (art/platform_cut) с листов
art/raw/platforms_long.png и art/raw/platforms_special.png.

Длинные платформы (доски, леса, балка) режутся на левый край, несколько модулей середины
и правый край. Резы — по стыкам, которые сами прячут шов: у досок по центру верёвок,
у лесов по центру стоек, у балки посередине между заклёпками. В игре середина набирается
модулями вперемешку — платформа любой длины без видимого повтора.
Особые платформы (люлька, балкон, бельё, тележка с крюком) — целиком.

Всё уменьшается до игрового размера здесь (Lanczos), в игре setScale(1).
Пишет public/assets/world/platforms.png + .json (Phaser JSON Hash) и platforms_meta.json
(высота, линия, где стоит герой, ширины кусков). Превью — art/platforms_preview.png.
Запуск: python3 art/platforms.py <проект>
"""
import sys, os, json
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from clear_holes import clear_holes

root = sys.argv[1]
cut = os.path.join(root, 'art/platform_cut')
out = os.path.join(root, 'public/assets/world')
SCALE = 0.42

# x резов (пиксели нарезки) и y, где стоит герой (верх настила)
LONG = {
    'wood': dict(cuts=[225, 345, 445, 548, 632, 750, 855, 960, 1055, 1165, 1275], stand=18),
    'scaffold': dict(cuts=[392, 750, 1108], stand=34),
    'beam': dict(cuts=[190, 440, 730, 1010, 1270], stand=12),
}
SPECIAL = {
    # stand — пол; rope — верх тросов (в игре тросы тянутся кодом дальше вверх)
    'cradle': dict(stand=398),
    # кирпичная колонна справа отрезана
    'balcony': dict(stand=182, crop=(0, 0, 495, None)),
    # stand — верх белья: на него прыгают, как на батут
    'clothesline': dict(stand=70),
    # hook — точка крюка, за которую потом можно цепляться
    'trolley': dict(stand=None),
}


def load(name):
    img, _ = clear_holes(Image.open(os.path.join(cut, name + '.png')))
    return img.copy()


def small(img):
    return img.resize((round(img.width * SCALE), round(img.height * SCALE)), Image.LANCZOS)


pieces = {}
meta = {'scale': SCALE, 'long': {}, 'special': {}}
for name, cfg in LONG.items():
    img = small(load(name))
    xs = [0] + [round(c * SCALE) for c in cfg['cuts']] + [img.width]
    parts = [img.crop((xs[i], 0, xs[i + 1], img.height)) for i in range(len(xs) - 1)]
    keys = [f'{name}_l'] + [f'{name}_m{i}' for i in range(1, len(parts) - 1)] + [f'{name}_r']
    for k, p in zip(keys, parts):
        pieces[k] = p
    meta['long'][name] = {
        'h': img.height,
        'stand': round(cfg['stand'] * SCALE),
        'left': parts[0].width,
        'right': parts[-1].width,
        'mids': [p.width for p in parts[1:-1]],
    }

for name, cfg in SPECIAL.items():
    img = load(name)
    if cfg.get('crop'):
        x0, y0, x1, y1 = cfg['crop']
        img = img.crop((x0, y0, x1 or img.width, y1 or img.height))
    if name == 'trolley':
        # кусок балки, с которым нарисована тележка, оставляем только за колёсами:
        # тележка едет по нашей балке
        px = img.load()
        for y in range(74):
            for x in range(img.width):
                if x < 150 or x > 370:
                    px[x, y] = (0, 0, 0, 0)
        img = img.crop(img.getbbox())
    img = small(img)
    pieces[name] = img
    meta['special'][name] = {'w': img.width, 'h': img.height, 'stand': None if cfg['stand'] is None else round(cfg['stand'] * SCALE)}

# упаковка полками, ширина атласа ≤ 2048 (лимит текстур телефона — 4096)
MAXW, PAD = 2048, 2
order = sorted(pieces, key=lambda k: -pieces[k].height)
x = y = shelf = 0
pos = {}
for k in order:
    p = pieces[k]
    if x + p.width > MAXW:
        x, y, shelf = 0, y + shelf + PAD, 0
    pos[k] = (x, y)
    x += p.width + PAD
    shelf = max(shelf, p.height)
atlas = Image.new('RGBA', (MAXW, y + shelf))
frames = {}
for k, (px_, py_) in pos.items():
    p = pieces[k]
    atlas.alpha_composite(p, (px_, py_))
    frames[k] = {'frame': {'x': px_, 'y': py_, 'w': p.width, 'h': p.height}, 'rotated': False, 'trimmed': False,
                 'spriteSourceSize': {'x': 0, 'y': 0, 'w': p.width, 'h': p.height}, 'sourceSize': {'w': p.width, 'h': p.height}}
atlas = atlas.crop((0, 0, max(px_ + pieces[k].width for k, (px_, _) in pos.items()), atlas.height))
atlas.save(os.path.join(out, 'platforms.png'), optimize=True)
with open(os.path.join(out, 'platforms.json'), 'w') as f:
    json.dump({'frames': frames, 'meta': {'image': 'platforms.png', 'size': {'w': atlas.width, 'h': atlas.height}, 'scale': '1'}}, f, indent=1)
with open(os.path.join(out, 'platforms_meta.json'), 'w') as f:
    json.dump(meta, f, indent=1)
print('atlas', atlas.size)
print(json.dumps(meta))

# превью: каждая длинная платформа собрана из модулей вперемешку на 900 px + особые, на тёмном фоне
prev = Image.new('RGBA', (1000, 700), (70, 40, 90, 255))
yy = 10
for name, m in meta['long'].items():
    xx = 10
    prev.alpha_composite(pieces[f'{name}_l'], (xx, yy)); xx += m['left']
    i = 0
    while xx < 800:
        k = f'{name}_m{1 + (i * 7) % len(m["mids"])}'
        prev.alpha_composite(pieces[k], (xx, yy)); xx += pieces[k].width; i += 1
    prev.alpha_composite(pieces[f'{name}_r'], (xx, yy))
    yy += m['h'] + 20
xx = 10
for name in SPECIAL:
    prev.alpha_composite(pieces[name], (xx, yy)); xx += pieces[name].width + 20
prev.save(os.path.join(root, 'art/platforms_preview.png'))
