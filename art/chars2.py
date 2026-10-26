"""Атласы персонажей миров 2–3 из кадров, нарезанных art/sheet.py (art/<имя>_cut/):
злодеи — Робо-Шмель и Енот-Бандит, шалуны — робот-пылесос и белка.
Кадры одного движения выравниваются друг по другу (взаимная корреляция силуэтов), чтобы
персонаж не дёргался; у каждого кадра — точка опоры (pivot в атласе): у злодея и шалуна —
у лап. Уменьшение до игрового размера здесь (Lanczos), в игре setScale(1).
В <имя>_meta.json — где в полёте висит вещь (hold) и где голова у поверженного (head),
в игровых пикселях от точки опоры. Отдельные картинки: кокон, жёлудь.
Ворон (мир 1) собирается в тот же формат из готовых картинок art/crow2 (CROW2.md): кадры полёта
выровнены по клюву (beak.json) — опора считается от клюва, как было в игре.
Запуск: python3 art/chars2.py <проект>
"""
import sys, os, json
import numpy as np
from PIL import Image

root = sys.argv[1]

# frames: кадр -> 'feet' (опора — низ силуэта) или имя кадра, по которому выравнивать.
# hold/head — точки в пикселях кадра-образца (art/<имя>_cut), см. сетку в превью.
CHARS = {
    'bumblebee': dict(scale=0.5, frames={'fly_2': 'feet', 'fly_1': 'fly_2', 'fly_3': 'fly_2', 'fly_4': 'fly_2', 'laugh': 'feet', 'dizzy': 'feet'},
                      hold=('fly_2', 400, 262), head=('dizzy', 250, 40)),
    'raccoon': dict(scale=0.58, frames={'fly_2': 'feet', 'fly_1': 'fly_2', 'fly_3': 'fly_2', 'jump': 'feet', 'laugh': 'feet', 'dizzy': 'feet'},
                    hold=('fly_2', 275, 373), head=('dizzy', 130, 95)),
    'vacuum': dict(scale=0.4, frames={'drive_1': 'feet', 'drive_2': 'drive_1', 'drive_3': 'drive_1', 'rev': 'feet', 'dash': 'feet'},
                   single={'cocoon': 0.33}),
    'squirrel': dict(scale=0.36, frames={'idle_1': 'feet', 'idle_2': 'idle_1', 'reach': 'idle_1', 'windup': 'idle_1', 'throw': 'idle_1', 'laugh': 'idle_1'},
                     single={'cocoon': 0.36, 'acorn': 0.24}),
}


def load(name, frame):
    if name == 'crow':
        return Image.open(os.path.join(root, f'art/crow2/crow_{frame}.png')).convert('RGBA')
    return Image.open(os.path.join(root, f'art/{name}_cut/{frame}.png')).convert('RGBA')


# Ворон: в игре клюв был на (70, −125 ± 5) от лап (взмах вниз — корпус выше), полёт × 0.45,
# хохот × 0.46, лёжа × 0.42 — опору кадров полёта считаем от клюва обратно в пиксели картинки
_beak = json.load(open(os.path.join(root, 'art/crow2/beak.json')))
CROW_FLY = 0.45
CHARS = {'crow': dict(
    scale={'fly_1': CROW_FLY, 'fly_2': CROW_FLY, 'laugh': 0.46, 'dizzy': 0.42},
    frames={f'fly_{i}': (_beak[f'crow_fly_{i}']['beakX'] - 70 / CROW_FLY, _beak[f'crow_fly_{i}']['beakY'] + (125 - bob) / CROW_FLY)
            for i, bob in ((1, 5), (2, -5))} | {'laugh': 'bottom', 'dizzy': 'bottom'},
    meta={'hold': {'x': 70, 'y': -125}, 'head': {'x': 66, 'y': -100}}), **CHARS}


def feet(img):
    """Низ силуэта; по x — середина нижних 8% силуэта."""
    a = np.array(img)[..., 3] > 128
    ys, xs = np.where(a)
    y1 = ys.max()
    band = ys > y1 - (ys.max() - ys.min()) * 0.08
    return float(xs[band].mean()), float(y1)


def shift_to(img, ref):
    """Сдвиг (dx, dy), при котором силуэт img лучше всего ложится на ref (FFT-корреляция)."""
    a = (np.array(img)[..., 3] > 128).astype(np.float32)
    b = (np.array(ref)[..., 3] > 128).astype(np.float32)
    H = a.shape[0] + b.shape[0]
    W = a.shape[1] + b.shape[1]
    c = np.fft.irfft2(np.fft.rfft2(b, (H, W)) * np.conj(np.fft.rfft2(a, (H, W))), (H, W))
    dy, dx = np.unravel_index(int(np.argmax(c)), c.shape)
    if dy > H // 2: dy -= H
    if dx > W // 2: dx -= W
    return dx, dy


for name, cfg in CHARS.items():
    out = os.path.join(root, f'public/assets/chars/{name}')
    os.makedirs(out, exist_ok=True)
    ks = cfg['scale'] if isinstance(cfg['scale'], dict) else {f: cfg['scale'] for f in cfg['frames']}
    k = next(iter(ks.values()))
    imgs = {f: load(name, f) for f in cfg['frames']}
    pivots = {}
    for f, rule in cfg['frames'].items():
        if isinstance(rule, tuple):
            pivots[f] = rule
        elif rule == 'bottom':
            pivots[f] = (imgs[f].width / 2, imgs[f].height)
        elif rule == 'feet':
            pivots[f] = feet(imgs[f])
        else:
            # img, сдвинутый на (dx, dy), совпадает с образцом: опора образца в координатах img — минус сдвиг
            dx, dy = shift_to(imgs[f], imgs[rule])
            px, py = pivots[rule]
            pivots[f] = (px - dx, py - dy)

    # атлас в один ряд, кадры уже в игровом размере
    small = {f: im.resize((round(im.width * ks[f]), round(im.height * ks[f])), Image.LANCZOS) for f, im in imgs.items()}
    W = sum(s.width + 2 for s in small.values())
    H = max(s.height for s in small.values())
    sheet = Image.new('RGBA', (W, H))
    atlas = {'frames': {}, 'meta': {'image': f'{name}_atlas.png', 'size': {'w': W, 'h': H}, 'scale': '1'}}
    x = 0
    for f, s in small.items():
        sheet.alpha_composite(s, (x, 0))
        px, py = pivots[f]
        atlas['frames'][f] = {
            'frame': {'x': x, 'y': 0, 'w': s.width, 'h': s.height},
            'rotated': False, 'trimmed': False,
            'spriteSourceSize': {'x': 0, 'y': 0, 'w': s.width, 'h': s.height},
            'sourceSize': {'w': s.width, 'h': s.height},
            'pivot': {'x': round(px / imgs[f].width, 4), 'y': round(py / imgs[f].height, 4)},
        }
        x += s.width + 2
    sheet.save(os.path.join(out, f'{name}_atlas.png'), optimize=True)
    with open(os.path.join(out, f'{name}_atlas.json'), 'w') as fh:
        json.dump(atlas, fh, indent=1)

    meta = dict(cfg.get('meta', {}))
    for key in ('hold', 'head'):
        if key in cfg:
            f, hx, hy = cfg[key]
            px, py = pivots[f]
            meta[key] = {'x': round((hx - px) * k, 1), 'y': round((hy - py) * k, 1)}
    if meta:
        with open(os.path.join(out, f'{name}_meta.json'), 'w') as fh:
            json.dump(meta, fh, indent=1)
    for f, sk in cfg.get('single', {}).items():
        im = load(name, f)
        im.resize((round(im.width * sk), round(im.height * sk)), Image.LANCZOS).save(os.path.join(out, f'{name}_{f}.png'), optimize=True)
    print(name, 'atlas', sheet.size, meta)

    # превью: все кадры опорой в одну точку (красный крест) — видно, не дёргается ли
    bg = (60, 40, 90, 255)
    cw = max(s.width for s in small.values()) * 2
    ch = max(s.height for s in small.values()) * 2
    prev = Image.new('RGBA', (cw * len(small), ch), bg)
    for i, (f, s) in enumerate(small.items()):
        px, py = pivots[f]
        ox, oy = i * cw + cw // 2, int(ch * 0.8)
        prev.alpha_composite(s, (int(ox - px * ks[f]), int(oy - py * ks[f])))
        for d in range(-6, 7):
            prev.putpixel((ox + d, oy), (255, 60, 60, 255))
            prev.putpixel((ox, oy + d), (255, 60, 60, 255))
        if 'hold' in meta and f.startswith('fly'):
            hx, hy = int(ox + meta['hold']['x']), int(oy + meta['hold']['y'])
            for d in range(-5, 6):
                prev.putpixel((hx + d, hy), (60, 255, 60, 255))
                prev.putpixel((hx, hy + d), (60, 255, 60, 255))
    prev.convert('RGB').save(os.path.join(root, f'art/{name}_preview.png'))
