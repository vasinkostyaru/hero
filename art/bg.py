"""Рисует 3 слоя закатного фона (SVG -> PNG), бесшовные по горизонтали."""
import random, sys, os
import cairosvg

W, H = 2400, 1080
out = sys.argv[1]
os.makedirs(out, exist_ok=True)


def save(name, body, defs=""):
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><defs>{defs}</defs>{body}</svg>'
    open(os.path.join(out, name + ".svg"), "w").write(svg)
    cairosvg.svg2png(bytestring=svg.encode(), write_to=os.path.join(out, name + ".png"))


def cloud(cx, cy, s, fill, op):
    parts = []
    for dx, dy, r in [(-1.6, 0.25, 0.55), (-0.8, -0.1, 0.8), (0, -0.35, 1), (0.9, -0.05, 0.75), (1.7, 0.25, 0.5)]:
        parts.append(f'<ellipse cx="{cx+dx*s*60:.0f}" cy="{cy+dy*s*40:.0f}" rx="{r*s*70:.0f}" ry="{r*s*42:.0f}"/>')
    parts.append(f'<rect x="{cx-2.1*s*60:.0f}" y="{cy:.0f}" width="{4.2*s*60:.0f}" height="{s*28:.0f}" rx="{s*14:.0f}"/>')
    g = "".join(parts)
    # тень снизу и подсветка сверху
    return (f'<g opacity="{op}"><g fill="#c0607a" transform="translate(0,{s*10:.0f})">{g}</g>'
            f'<g fill="{fill}">{g}</g><g fill="#ffd6a0" opacity="0.55" transform="translate(0,{-s*8:.0f}) scale(1)">'
            f'<ellipse cx="{cx:.0f}" cy="{cy-s*22:.0f}" rx="{s*55:.0f}" ry="{s*18:.0f}"/></g></g>')


# ---------- 1. небо ----------
random.seed(7)
defs = '''
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#4b3f9e"/><stop offset="0.35" stop-color="#8a5bb0"/>
  <stop offset="0.62" stop-color="#e2798a"/><stop offset="0.82" stop-color="#f6a35c"/>
  <stop offset="1" stop-color="#ffcf7a"/></linearGradient>
<radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
  <stop offset="0" stop-color="#fff3c4"/><stop offset="0.55" stop-color="#ffd27a"/>
  <stop offset="1" stop-color="#ffb35c" stop-opacity="0"/></radialGradient>
<radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
  <stop offset="0" stop-color="#ffd890" stop-opacity="0.7"/><stop offset="1" stop-color="#ff9a6a" stop-opacity="0"/></radialGradient>
'''
body = f'<rect width="{W}" height="{H}" fill="url(#sky)"/>'
for i in range(70):
    x, y = random.uniform(0, W), random.uniform(0, H * 0.35)
    body += f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{random.uniform(1,2.4):.1f}" fill="#fff" opacity="{random.uniform(.25,.7):.2f}"/>'
body += f'<ellipse cx="1200" cy="860" rx="700" ry="380" fill="url(#glow)"/>'
body += f'<circle cx="1200" cy="860" r="230" fill="url(#sun)"/><circle cx="1200" cy="860" r="105" fill="#fff0c0"/>'
for cx, cy, s, op in [(300, 260, 1.6, .9), (900, 170, 1.1, .8), (1650, 300, 1.9, .9), (2150, 190, 1.2, .8),
                      (600, 520, 1.3, .7), (1450, 560, 1.0, .65), (2000, 480, 1.4, .7), (2400 + 300 - 2400, 260, 0, 0)]:
    if s:
        body += cloud(cx, cy, s, "#f2a1a6", op)
        if cx < 400: body += cloud(cx + W, cy, s, "#f2a1a6", op)
        if cx > W - 400: body += cloud(cx - W, cy, s, "#f2a1a6", op)
save("sky", body, defs)


# ---------- здания ----------
def skyline(seed, base_y, hmin, hmax, wmin, wmax, col, win_col, win_op, roof_items):
    random.seed(seed)
    x, s = 0, ""
    blds = []
    while x < W:
        w = random.randint(wmin, wmax)
        h = random.randint(hmin, hmax)
        blds.append((x, w, h))
        x += w + random.randint(-10, 6)
    for (x, w, h) in blds:
        for off in (0, W) if x + w > W else (0,):
            X = x - off
            top = base_y - h
            s += f'<rect x="{X}" y="{top}" width="{w}" height="{H-top}" fill="{col}"/>'
            s += f'<rect x="{X}" y="{top}" width="{w}" height="6" fill="#ffffff" opacity="0.08"/>'
            if random.random() < roof_items and w > 60:
                k = random.random()
                if k < 0.35:  # водонапорная башня
                    tx = X + random.randint(10, max(11, w - 50))
                    s += (f'<g fill="{col}"><rect x="{tx}" y="{top-70}" width="40" height="45" rx="4"/>'
                          f'<polygon points="{tx-4},{top-70} {tx+20},{top-92} {tx+44},{top-70}"/>'
                          f'<rect x="{tx+4}" y="{top-26}" width="4" height="26"/><rect x="{tx+32}" y="{top-26}" width="4" height="26"/></g>')
                elif k < 0.7:  # антенна
                    ax = X + random.randint(8, w - 8)
                    s += f'<rect x="{ax}" y="{top-80}" width="3" height="80" fill="{col}"/><rect x="{ax-14}" y="{top-62}" width="31" height="3" fill="{col}"/><rect x="{ax-9}" y="{top-48}" width="21" height="3" fill="{col}"/>'
                else:  # трубы
                    for j in range(random.randint(1, 3)):
                        cx = X + 10 + j * 26
                        s += f'<rect x="{cx}" y="{top-30}" width="18" height="30" fill="{col}"/><rect x="{cx-3}" y="{top-34}" width="24" height="6" fill="{col}"/>'
            # окна
            for wy in range(top + 22, H - 10, 34):
                for wx in range(X + 12, X + w - 18, 26):
                    if random.random() < win_op:
                        s += f'<rect x="{wx}" y="{wy}" width="12" height="16" rx="2" fill="{win_col}" opacity="{random.uniform(.55,1):.2f}"/>'
    return s


far = skyline(11, 920, 140, 380, 70, 150, "#7a66b0", "#ffd98a", 0.22, 0.35)
# дымка снизу
far_defs = '<linearGradient id="haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3a27a" stop-opacity="0"/><stop offset="1" stop-color="#f3a27a" stop-opacity="0.55"/></linearGradient>'
far += f'<rect x="0" y="650" width="{W}" height="{H-650}" fill="url(#haze)"/>'
save("city_far", far, far_defs)

mid = skyline(23, 1070, 90, 250, 140, 260, "#4a3870", "#ffbf5e", 0.3, 0.8)
mid_defs = '<linearGradient id="rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c2148" stop-opacity="0"/><stop offset="1" stop-color="#2c2148" stop-opacity="0.6"/></linearGradient>'
mid += f'<rect x="0" y="760" width="{W}" height="{H-760}" fill="url(#rim)"/>'
save("city_mid", mid, mid_defs)
