import sys, os, json
from PIL import Image, ImageDraw
S, P = sys.argv[1], sys.argv[2]
order = [f"run_{i}" for i in range(1,7)] + ["idle","land","shoot","jump","apex","fall_1","fall_2","climb_1","climb_2","climb_3","climb_4","wall_slide"]
CW, CH, GROUND, WALL = 320, 320, 300, 225
cols = 6; rows = (len(order)+cols-1)//cols
atlas = Image.new("RGBA", (cols*CW, rows*CH)); fr = {}; ims = {}
for i, n in enumerate(order):
    im = Image.open(f"{S}/hb2x_g/{n}.png").resize((CW, CH), Image.LANCZOS); ims[n] = im
    x, y = (i % cols)*CW, (i//cols)*CH; atlas.alpha_composite(im, (x, y))
    fr[n] = {"frame": {"x": x, "y": y, "w": CW, "h": CH}, "sourceSize": {"w": CW, "h": CH},
             "spriteSourceSize": {"x": 0, "y": 0, "w": CW, "h": CH}, "rotated": False, "trimmed": False}
D = f"{P}/public/assets/hero2"; os.makedirs(D, exist_ok=True)
atlas.save(f"{D}/hero_atlas.png", optimize=True)
json.dump({"frames": fr, "meta": {"image": "hero_atlas.png", "size": {"w": atlas.width, "h": atlas.height}, "scale": "1"}}, open(f"{D}/hero_atlas.json", "w"), indent=1)
bg = Image.new("RGBA", atlas.size, (60,45,90,255)); bg.alpha_composite(atlas); d = ImageDraw.Draw(bg)
for r in range(rows): d.line([(0, r*CH+GROUND), (atlas.width, r*CH+GROUND)], fill=(255,90,90))
for c in range(cols): d.line([(c*CW+WALL, 0), (c*CW+WALL, atlas.height)], fill=(90,255,120)); d.line([(c*CW, 0), (c*CW, atlas.height)], fill=(255,255,255))
for i, n in enumerate(order): d.text(((i%cols)*CW+4, (i//cols)*CH+4), n, fill=(255,255,0))
bg.convert("RGB").save(f"{S}/atlas_preview.png")
W = f"{S}/full/avgust-hero/public/assets/"
climbtex = Image.open(W+"world/tex_climb.png").convert("RGBA").resize((313,313))
sky = Image.open(W+"bg/sky.png").convert("RGBA")
g = []
for k in range(32):
    sc = sky.crop((800, 200, 1440, 560)).copy()
    wall = Image.new("RGBA", (140, 360+313))
    for y in range(0, wall.height, 313): wall.paste(climbtex.crop((0,0,140,313)), (0, y))
    off = (k*5) % 313
    sc.alpha_composite(wall.crop((0, 313-off, 140, 313-off+360)), (380, 0))
    sc.alpha_composite(ims[f"climb_{k//4%4+1}"], (380-WALL, 20))
    g.append(sc.convert("RGB"))
g[0].save(f"{S}/climb_test.gif", save_all=True, append_images=g[1:], duration=90, loop=0)
edge = Image.open(W+"world/roof_edge.png").convert("RGBA").resize((1046,74))
seq = ["idle","land","jump","jump","jump","apex","apex","apex","fall_1","fall_2","fall_2","land","idle","idle","idle"]
ys  = [0,0,-70,-130,-170,-190,-195,-188,-150,-95,-35,0,0,0,0]
g = []
for n, dy in zip(seq, ys):
    sc = sky.crop((800, 150, 1440, 510)).copy(); sc.alpha_composite(edge.crop((0,0,640,74)), (0, 300))
    sc.alpha_composite(ims[n], (160, 310-GROUND+dy)); g.append(sc.convert("RGB"))
g[0].save(f"{S}/jump_test.gif", save_all=True, append_images=g[1:], duration=100, loop=0)
g = []
for k in range(18):
    sc = sky.crop((800+k*14, 150, 1440+k*14, 510)).copy()
    for x in range(-(k*40 % 523), 640, 523): sc.alpha_composite(edge.crop((0,0,523,74)), (x, 300))
    sc.alpha_composite(ims[f"run_{k%6+1}"], (160, 310-GROUND)); g.append(sc.convert("RGB"))
g[0].save(f"{S}/run_test2.gif", save_all=True, append_images=g[1:], duration=85, loop=0)
