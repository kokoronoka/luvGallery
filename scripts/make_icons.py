from PIL import Image, ImageDraw
import math
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "icons")
os.makedirs(OUT, exist_ok=True)

PRIMARY = (190, 24, 93)     # #BE185D
SECONDARY = (236, 72, 153)  # #EC4899
BG = (253, 242, 248)        # #FDF2F8


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def heart_path(cx, cy, size):
    pts = []
    steps = 200
    for i in range(steps + 1):
        t = (i / steps) * 2 * math.pi
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((cx + x * size, cy - y * size))
    return pts


def make_icon(px, maskable=False, out_name=None):
    scale = 4
    img = Image.new("RGBA", (px * scale, px * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx, cy = (px * scale) / 2, (px * scale) / 2

    if maskable:
        draw.rectangle([0, 0, px * scale, px * scale], fill=BG)
        heart_scale = (px * scale) / 46
    else:
        r = px * scale / 2
        draw.ellipse([0, 0, px * scale, px * scale], fill=BG)
        heart_scale = (px * scale) / 40

    for i in range(px * scale):
        pass

    grad = Image.new("RGBA", (1, px * scale), (0, 0, 0, 0))
    for y in range(px * scale):
        t = y / (px * scale)
        grad.putpixel((0, y), lerp(PRIMARY, SECONDARY, t) + (255,))
    grad = grad.resize((px * scale, px * scale))

    mask = Image.new("L", (px * scale, px * scale), 0)
    mdraw = ImageDraw.Draw(mask)
    pts = heart_path(cx, cy, heart_scale)
    mdraw.polygon(pts, fill=255)

    img.paste(grad, (0, 0), mask)

    img = img.resize((px, px), Image.LANCZOS)
    name = out_name or f"icon-{px}.png"
    img.save(os.path.join(OUT, name))
    print("wrote", name)


make_icon(192)
make_icon(512)
make_icon(512, maskable=True, out_name="icon-maskable-512.png")
make_icon(180, out_name="apple-touch-icon.png")
make_icon(32, out_name="favicon-32.png")
make_icon(16, out_name="favicon-16.png")
print("done")
