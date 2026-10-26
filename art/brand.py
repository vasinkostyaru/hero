"""Фирменные картинки «Августа-героя» из готовых рисунков (без текста — игра для малыша):
- экран загрузки public/assets/ui/splash.jpg (1920×1080): закатное небо, город, Август в прыжке
  в лучах, вокруг — три злодея с украденными вещами;
- он же — заставка Android (res/drawable*/splash.png, по размерам каждого файла, «cover»);
- иконка приложения: фон — закат с лучами, передний план — Август (голова и плечи),
  она же — иконки веб-версии (public/icons, экран «Домой» на айфоне);
  адаптивная (ic_launcher_background/foreground) и обычные квадратная и круглая.
Герой — art/brand_cut (art/sheet.py из art/raw/hero_actions_sheet.png).
Запуск: python3 art/brand.py <проект>
"""
import sys, os, glob, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

root = sys.argv[1]
P = lambda *a: os.path.join(root, *a)
RES = P('android/app/src/main/res')


def rays(size, center, n, color, alpha, spread=0.5):
    """Лучи-веер из точки: мягкие клинья на прозрачном фоне."""
    w, h = size
    layer = Image.new('RGBA', size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    R = math.hypot(w, h)
    for i in range(n):
        a = i * 2 * math.pi / n
        da = math.pi / n * spread
        pts = [center, (center[0] + R * math.cos(a - da), center[1] + R * math.sin(a - da)),
               (center[0] + R * math.cos(a + da), center[1] + R * math.sin(a + da))]
        d.polygon(pts, fill=color + (alpha,))
    return layer.filter(ImageFilter.GaussianBlur(size[0] // 120))


def glow(size, center, radius, color, alpha):
    w, h = size
    yy, xx = np.mgrid[0:h, 0:w]
    k = np.clip(1 - np.hypot(xx - center[0], yy - center[1]) / radius, 0, 1) ** 2
    a = np.zeros((h, w, 4), np.uint8)
    a[..., :3] = color
    a[..., 3] = (k * alpha).astype(np.uint8)
    return Image.fromarray(a)


def put(base, img, cx, cy, height, flip=False, shadow=True):
    """Картинку высотой height — центром в (cx, cy); снизу мягкая тёмная обводка-тень."""
    k = height / img.height
    im = img.resize((round(img.width * k), round(img.height * k)), Image.LANCZOS)
    if flip:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    x, y = round(cx - im.width / 2), round(cy - im.height / 2)
    if shadow:
        a = im.split()[3].filter(ImageFilter.GaussianBlur(10))
        sh = Image.new('RGBA', im.size, (30, 10, 40, 0))
        sh.putalpha(a.point(lambda v: v * 0.55))
        base.alpha_composite(sh, (x + 6, y + 10))
    base.alpha_composite(im, (x, y))


def load(path):
    return Image.open(P(path)).convert('RGBA')


# ---------- экран загрузки ----------
W, H = 1920, 1080
sky = load('public/assets/bg/sky.png')
splash = sky.crop(((sky.width - W) // 2, 0, (sky.width - W) // 2 + W, H))
hero_c = (960, 500)
splash.alpha_composite(rays((W, H), hero_c, 18, (255, 220, 140), 38))
splash.alpha_composite(glow((W, H), hero_c, 520, (255, 214, 140), 150))
mid = load('public/assets/bg/city_mid_a.png')
splash.alpha_composite(mid.crop((300, 0, 300 + W, H)), (0, 60))
# низ темнее — там кольцо загрузки
splash.alpha_composite(Image.fromarray(np.dstack([np.full((H, W, 3), (24, 8, 40), np.uint8),
                                                  (np.clip((np.arange(H)[:, None] - 760) / 320, 0, 1) * 200).astype(np.uint8).repeat(W, 1)])))

# злодеи вокруг, у каждого — украденная особая вещь
for path, item, cx, cy, h, flip in [
    ('art/crow2/crow_fly_1.png', 'sock', 330, 300, 300, False),
    ('art/bumblebee_cut/fly_2.png', 'dragon', 1600, 250, 270, True),
    ('art/raccoon_cut/fly_2.png', 'cake', 1620, 640, 330, True),
]:
    put(splash, load(path), cx, cy, h, flip)
    put(splash, load(f'public/assets/items/{item}.png'), cx + (-1 if flip else 1) * h * 0.18, cy + h * 0.45, 90, shadow=False)
put(splash, load('art/brand_cut/jump.png'), hero_c[0], hero_c[1], 620)
os.makedirs(P('public/assets/ui'), exist_ok=True)
splash.convert('RGB').save(P('public/assets/ui/splash.jpg'), quality=88)
print('splash', splash.size)

# заставка Android: по размеру каждого файла, «cover» с центром на герое
for f in glob.glob(os.path.join(RES, 'drawable*/splash.png')):
    w, h = Image.open(f).size
    k = max(w / W, h / H)
    big = splash.resize((round(W * k), round(H * k)), Image.LANCZOS)
    x = min(max(0, round(hero_c[0] * k - w / 2)), big.width - w)
    y = min(max(0, round(hero_c[1] * k - h / 2)), big.height - h)
    big.crop((x, y, x + w, y + h)).convert('RGB').save(f, optimize=True)

# ---------- иконка ----------
S = 432  # адаптивная иконка xxxhdpi: 108dp × 4; видно — центральные 72dp (288 px)
yy = np.linspace(0, 1, S)[:, None].repeat(S, 1)
top, midc, bot = np.array([92, 58, 168]), np.array([255, 120, 90]), np.array([255, 196, 96])
col = np.where(yy[..., None] < 0.55, top + (midc - top) * (yy[..., None] / 0.55), midc + (bot - midc) * ((yy[..., None] - 0.55) / 0.45))
bg = Image.fromarray(np.dstack([col, np.full((S, S), 255)]).astype(np.uint8), 'RGBA')
bg.alpha_composite(rays((S, S), (S // 2, S // 2 + 20), 14, (255, 236, 170), 70))
bg.alpha_composite(glow((S, S), (S // 2, S // 2 + 10), 200, (255, 230, 160), 170))

# Август: голова и плечи, в центральной безопасной зоне
stand = load('art/brand_cut/stand.png')
bust = stand.crop((0, 0, stand.width, round(stand.height * 0.52)))
fg = Image.new('RGBA', (S, S), (0, 0, 0, 0))
k = 300 / bust.height
b = bust.resize((round(bust.width * k), round(bust.height * k)), Image.LANCZOS)
# по низу плечи растворяются — без резкого среза
a = np.array(b.split()[3]).astype(np.float32)
a *= np.clip((b.height - np.arange(b.height)) / 60, 0, 1)[:, None]
b.putalpha(Image.fromarray(a.astype(np.uint8)))
fg.alpha_composite(b, (S // 2 - b.width // 2 - 58, S // 2 - 150))

DENS = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
full = bg.copy()
full.alpha_composite(fg)
inner = full.crop((S // 6, S // 6, S - S // 6, S - S // 6))  # что видно у адаптивной
for d, m in DENS.items():
    out = os.path.join(RES, f'mipmap-{d}')
    n = round(108 * m)
    bg.resize((n, n), Image.LANCZOS).save(os.path.join(out, 'ic_launcher_background.png'), optimize=True)
    fg.resize((n, n), Image.LANCZOS).save(os.path.join(out, 'ic_launcher_foreground.png'), optimize=True)
    s = round(48 * m)
    ic = inner.resize((s, s), Image.LANCZOS)
    for name, mask in (('ic_launcher', 'rounded'), ('ic_launcher_round', 'circle')):
        mk = Image.new('L', (s * 4, s * 4), 0)
        dm = ImageDraw.Draw(mk)
        if mask == 'circle':
            dm.ellipse((0, 0, s * 4 - 1, s * 4 - 1), fill=255)
        else:
            dm.rounded_rectangle((0, 0, s * 4 - 1, s * 4 - 1), radius=s * 4 * 0.2, fill=255)
        o = ic.copy()
        o.putalpha(mk.resize((s, s), Image.LANCZOS))
        o.save(os.path.join(out, f'{name}.png'), optimize=True)
full.convert('RGB').save(P('art/icon_preview.png'))
print('icon ok')

# ---------- иконки веб-версии (экран «Домой» на айфоне, манифест) ----------
os.makedirs(P('public/icons'), exist_ok=True)
for n in (180, 192, 512):
    full.resize((n, n), Image.LANCZOS).convert('RGB').save(P(f'public/icons/icon-{n}.png'), optimize=True)
print('web icons ok')
