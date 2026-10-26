"""Дрон-2 по частям: корпус и пропеллер из art/raw/drone2_parts.png (нарезка — art/sheet.py
в art/drone2_cut: body, prop, full). По образцу «целый дрон» (full) находит, где и в каком
масштабе пропеллер сидит на корпусе: корпус привязан по глазу, пропеллер — по размаху лопастей
и втулке. Пишет drone2_body.png, drone2_propeller.png (в масштабе корпуса) и drone2_layout.json.
Запуск: python3 art/drone2.py <проект>
"""
import sys, os, json
import numpy as np
from PIL import Image

root = sys.argv[1]
cut = os.path.join(root, 'art/drone2_cut')
out = os.path.join(root, 'public/assets/chars/enemies')
load = lambda k: Image.open(os.path.join(cut, k + '.png')).convert('RGBA')
body, prop, full = load('body'), load('prop'), load('full')


def eye(img):
    a = np.array(img).astype(int)
    m = (a[..., 3] > 200) & (a[..., 2] > 200) & (a[..., 1] > 170) & (a[..., 0] < 150)
    ys, xs = np.where(m)
    return xs.mean(), ys.mean(), m.sum()


def blades(img, rows):
    """Размах лопастей (самый широкий ряд в верхней части) и его высота."""
    al = np.array(img)[..., 3]
    best = (0, 0, 0, 0)
    for y in range(rows):
        xs = np.where(al[y] > 100)[0]
        if len(xs) and xs.max() - xs.min() > best[0]:
            best = (xs.max() - xs.min(), xs.min(), xs.max(), y)
    return best


# корпус → образец: сдвиг по глазу (масштаб тот же — сверено по площади глаза)
bx, by, barea = eye(body)
fx, fy, farea = eye(full)
print('eye area body/full', barea, farea)
body_in_full = (fx - bx, fy - by)

# пропеллер → образец: масштаб по размаху лопастей, сдвиг по их центру и высоте
pw, px0, px1, py = blades(prop, prop.height // 2)
fw, fx0, fx1, fyb = blades(full, 80)
k = fw / pw
prop_s = prop.resize((round(prop.width * k), round(prop.height * k)), Image.LANCZOS)
prop_in_full = ((fx0 + fx1) / 2 - (px0 + px1) / 2 * k, fyb - py * k)

# центр пропеллера относительно центра корпуса — в пикселях корпуса
pcx = prop_in_full[0] - body_in_full[0] + prop_s.width / 2
pcy = prop_in_full[1] - body_in_full[1] + prop_s.height / 2
layout = {
    'body': {'w': body.width, 'h': body.height},
    'propeller': {'w': prop_s.width, 'h': prop_s.height},
    'prop_center_from_body_center': {'x': round(pcx - body.width / 2, 1), 'y': round(pcy - body.height / 2, 1)},
    'note': 'Пропеллер уже в масштабе корпуса. Ось вращения — центр пропеллера по X.',
}
body.save(os.path.join(out, 'drone2_body.png'), optimize=True)
prop_s.save(os.path.join(out, 'drone2_propeller.png'), optimize=True)
with open(os.path.join(out, 'drone2_layout.json'), 'w') as f:
    json.dump(layout, f, indent=1, ensure_ascii=False)
print(json.dumps(layout, ensure_ascii=False))

# превью: собранный дрон рядом с образцом
w = max(full.width, body.width) + 40
prev = Image.new('RGBA', (w * 2, full.height + 80), (70, 40, 90, 255))
ox, oy = 20, 60
prev.alpha_composite(body, (ox, oy))
cx, cy = ox + body.width / 2 + layout['prop_center_from_body_center']['x'], oy + body.height / 2 + layout['prop_center_from_body_center']['y']
prev.alpha_composite(prop_s, (round(cx - prop_s.width / 2), round(cy - prop_s.height / 2)))
prev.alpha_composite(full, (w + 20, round(oy - body_in_full[1])))
prev.save(os.path.join(root, 'art/drone2_preview.png'))
