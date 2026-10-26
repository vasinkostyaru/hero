"""Иконки интерфейса в стиле игры (синий + жёлтый, мягкий объём, тёмный контур)."""
import sys, os, cairosvg
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
OL = "#2a1838"
DEFS = '''<defs>
<radialGradient id="blue" cx="0.4" cy="0.3" r="0.8"><stop offset="0" stop-color="#5aa0ff"/><stop offset="0.55" stop-color="#2a5fd6"/><stop offset="1" stop-color="#1a3a92"/></radialGradient>
<radialGradient id="gold" cx="0.4" cy="0.3" r="0.8"><stop offset="0" stop-color="#fff2a0"/><stop offset="0.5" stop-color="#ffc83a"/><stop offset="1" stop-color="#e08a10"/></radialGradient>
<radialGradient id="grey" cx="0.4" cy="0.3" r="0.8"><stop offset="0" stop-color="#9a8fb0"/><stop offset="1" stop-color="#4a4060"/></radialGradient>
<linearGradient id="shine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.65"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0.55" stop-color="#ffd860" stop-opacity="0.9"/><stop offset="1" stop-color="#ffb030" stop-opacity="0"/></radialGradient>
</defs>'''
def star(cx, cy, R, r):
    import math
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5; rr = R if i % 2 == 0 else r
        pts.append(f"{cx + rr * math.cos(a):.1f},{cy + rr * math.sin(a):.1f}")
    return " ".join(pts)
def web(cx, cy, R, col, op):
    import math
    s = ""
    for i in range(6):
        a = i * math.pi / 3
        s += f'<line x1="{cx}" y1="{cy}" x2="{cx + R * math.cos(a):.1f}" y2="{cy + R * math.sin(a):.1f}"/>'
    for k in (0.45, 0.8):
        pts = " ".join(f"{cx + R * k * math.cos(i * math.pi / 3):.1f},{cy + R * k * math.sin(i * math.pi / 3):.1f}" for i in range(6))
        s += f'<polygon points="{pts}" fill="none"/>'
    return f'<g stroke="{col}" stroke-opacity="{op}" stroke-width="2.5">{s}</g>'
def save(name, w, h, body):
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{DEFS}{body}</svg>'
    cairosvg.svg2png(bytestring=svg.encode(), write_to=os.path.join(OUT, name + ".png"))
# кнопка уровня: открыт / закрыт / текущий ореол
def badge(fill, inner):
    return (f'<circle cx="80" cy="84" r="66" fill="{OL}" opacity="0.35"/>'
            f'<circle cx="80" cy="78" r="66" fill="{OL}"/><circle cx="80" cy="78" r="60" fill="url(#{fill})"/>'
            f'{inner}<ellipse cx="80" cy="50" rx="40" ry="20" fill="url(#shine)"/>')
save("level_open", 160, 160, badge("blue", web(80, 78, 50, "#ffffff", 0.35) +
     f'<polygon points="{star(80, 80, 38, 16)}" fill="url(#gold)" stroke="{OL}" stroke-width="5" stroke-linejoin="round"/>'))
save("level_locked", 160, 160, badge("grey",
     f'<g stroke="{OL}" stroke-width="5" stroke-linejoin="round">'
     f'<path d="M62 74 v-12 a18 18 0 0 1 36 0 v12" fill="none" stroke="#d8d0e8" stroke-width="11"/>'
     f'<path d="M62 74 v-12 a18 18 0 0 1 36 0 v12" fill="none"/>'
     f'<rect x="52" y="72" width="56" height="42" rx="9" fill="url(#gold)"/><circle cx="80" cy="90" r="6" fill="{OL}" stroke="none"/></g>'))
save("level_glow", 240, 240, '<circle cx="120" cy="120" r="118" fill="url(#glow)"/>')
# звёзды
save("star_full", 80, 80, f'<polygon points="{star(40, 42, 34, 15)}" fill="url(#gold)" stroke="{OL}" stroke-width="5" stroke-linejoin="round"/>'
     f'<ellipse cx="34" cy="30" rx="10" ry="6" fill="#fff" opacity="0.6"/>')
save("star_empty", 80, 80, f'<polygon points="{star(40, 42, 34, 15)}" fill="#3a2e55" fill-opacity="0.75" stroke="{OL}" stroke-width="5" stroke-linejoin="round"/>')
# круглые кнопки
def button(icon):
    return (f'<circle cx="80" cy="86" r="70" fill="{OL}" opacity="0.35"/><circle cx="80" cy="80" r="70" fill="{OL}"/>'
            f'<circle cx="80" cy="80" r="63" fill="url(#blue)"/>{web(80, 80, 55, "#ffffff", 0.18)}{icon}'
            f'<ellipse cx="80" cy="46" rx="44" ry="20" fill="url(#shine)"/>')
save("btn_home", 160, 160, button(f'<path d="M80 40 L122 76 H110 V118 H92 V96 H68 V118 H50 V76 H38 Z" fill="url(#gold)" stroke="{OL}" stroke-width="6" stroke-linejoin="round"/>'))
save("btn_play", 160, 160, button(f'<path d="M64 46 L118 80 L64 114 Z" fill="url(#gold)" stroke="{OL}" stroke-width="6" stroke-linejoin="round"/>'))
save("btn_pause", 160, 160, button(f'<g fill="url(#gold)" stroke="{OL}" stroke-width="6"><rect x="54" y="48" width="18" height="64" rx="5"/><rect x="88" y="48" width="18" height="64" rx="5"/></g>'))
save("btn_restart", 160, 160, button(f'<path d="M108 66 A30 30 0 1 0 110 92" fill="none" stroke="{OL}" stroke-width="20" stroke-linecap="round"/>'
     f'<path d="M108 66 A30 30 0 1 0 110 92" fill="none" stroke="#ffc83a" stroke-width="10" stroke-linecap="round"/>'
     f'<path d="M96 52 L122 58 L112 82 Z" fill="url(#gold)" stroke="{OL}" stroke-width="5" stroke-linejoin="round"/>'))
print("ok")
