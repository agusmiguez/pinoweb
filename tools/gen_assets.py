#!/usr/bin/env python3
"""Generate the Tienda Pino logo (faithful SVG recreation) plus branded
placeholder product images. The placeholders use the EXACT filenames the real
photos should have, so the client can drop their photos in and everything works.
"""
import math, os

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.normpath(os.path.join(HERE, "..", "assets", "img"))
os.makedirs(IMG, exist_ok=True)

# Club palette (sampled from the logo)
NAVY   = "#1b2a6b"
GREEN  = "#2e9d4f"
RED    = "#e02438"
W      = 512

# ---------------------------------------------------------------------------
# 1) LOGO — pine/arrow silhouette filled with wavy navy+green stripes + red sun
# ---------------------------------------------------------------------------
def wave_band(y0, y1, amp=7.0, wl=150.0, phase=0.0, x0=-30, x1=W + 30, step=10):
    """Closed path: wavy top edge (y0) and wavy bottom edge (y1)."""
    top = []
    x = x0
    while x <= x1:
        top.append((x, y0 + amp * math.sin((x / wl) * 2 * math.pi + phase)))
        x += step
    bot = []
    x = x1
    while x >= x0:
        bot.append((x, y1 + amp * math.sin((x / wl) * 2 * math.pi + phase)))
        x -= step
    pts = top + bot
    d = "M {:.1f},{:.1f} ".format(*pts[0])
    d += " ".join("L {:.1f},{:.1f}".format(px, py) for px, py in pts[1:])
    d += " Z"
    return d

# Silhouette: rounded triangle (tree) + centered trunk. Used as a clip path.
SIL = (
    "M256 46 "                       # apex
    "Q272 46 282 62 "                # round apex
    "L452 332 "                      # right slope
    "Q462 350 442 354 "              # round bottom-right
    "L300 354 "
    "L300 452 "                      # trunk right
    "Q300 468 284 468 "
    "L228 468 "
    "Q212 468 212 452 "
    "L212 354 "                      # trunk left
    "L70 354 "
    "Q50 350 60 332 "                # round bottom-left
    "L230 62 "                       # left slope
    "Q240 46 256 46 Z"
)

stripes = []
band_h = 30
y = 30
i = 0
while y < 480:
    color = NAVY if i % 2 == 0 else GREEN
    stripes.append('<path d="{}" fill="{}"/>'.format(
        wave_band(y, y + band_h, amp=7, wl=160, phase=0.6), color))
    y += band_h
    i += 1

# Red sun: upper half-disk (dome up, flat bottom) sitting low-center
sun_cx, sun_cy, sun_r = 256, 300, 82
sun = ('<path d="M {0} {1} A {2} {2} 0 0 1 {3} {1} Z" fill="{4}"/>'
       .format(sun_cx - sun_r, sun_cy, sun_r, sun_cx + sun_r, RED))

logo = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {W}" role="img" aria-label="Tienda Pino — Náutico Escobar Country Club">
  <defs>
    <clipPath id="treeClip"><path d="{SIL}"/></clipPath>
  </defs>
  <g clip-path="url(#treeClip)">
    <rect x="0" y="0" width="{W}" height="{W}" fill="{GREEN}"/>
    {''.join(stripes)}
    {sun}
  </g>
</svg>'''
with open(os.path.join(IMG, "logo.svg"), "w", encoding="utf-8") as f:
    f.write(logo)

# A mono (single-colour) version of the silhouette for tiny / footer use
logo_mono = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {W}" role="img" aria-label="Tienda Pino">
  <path d="{SIL}" fill="currentColor"/>
</svg>'''
with open(os.path.join(IMG, "logo-mono.svg"), "w", encoding="utf-8") as f:
    f.write(logo_mono)

print("logo.svg + logo-mono.svg written")

# ---------------------------------------------------------------------------
# 2) PLACEHOLDER PHOTOS (Pillow) — real filenames, replace-in-place ready
# ---------------------------------------------------------------------------
try:
    from PIL import Image, ImageDraw, ImageFont
except Exception as e:
    print("Pillow missing, skipping placeholders:", e)
    raise SystemExit(0)

def hex2rgb(h): h = h.lstrip("#"); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def font(sz):
    for name in ("arialbd.ttf", "Arial.ttf", "DejaVuSans-Bold.ttf", "segoeuib.ttf"):
        try: return ImageFont.truetype(name, sz)
        except Exception: pass
    return ImageFont.load_default()

def draw_mark(d, cx, cy, s, navy, green, red):
    """Tiny pine mark: filled triangle + trunk + red dome."""
    d.polygon([(cx, cy - s), (cx + s*0.9, cy + s*0.7), (cx - s*0.9, cy + s*0.7)], fill=green)
    d.rectangle([cx - s*0.18, cy + s*0.5, cx + s*0.18, cy + s*1.0], fill=green)
    for k in range(-3, 4):
        yy = cy + k * (s*0.22)
        d.line([(cx - s*0.9, yy), (cx + s*0.9, yy)], fill=navy, width=max(2, int(s*0.07)))
    d.pieslice([cx - s*0.4, cy - s*0.4, cx + s*0.4, cy + s*0.4], 180, 360, fill=red)

def placeholder(fname, label, bg, accent, w=1000, h=1250):
    navy, green, red = hex2rgb(NAVY), hex2rgb(GREEN), hex2rgb(RED)
    bg_rgb, ac_rgb = hex2rgb(bg), hex2rgb(accent)
    img = Image.new("RGB", (w, h), bg_rgb)
    d = ImageDraw.Draw(img)
    # subtle vertical gradient
    for y in range(h):
        t = y / h
        c = tuple(int(bg_rgb[i] * (1 - 0.18 * t) + 0*t) for i in range(3))
        d.line([(0, y), (w, y)], fill=c)
    # accent side bars (echo of the kit)
    d.rectangle([0, 0, 14, h], fill=ac_rgb)
    d.rectangle([w - 14, 0, w, h], fill=ac_rgb)
    draw_mark(d, w // 2, int(h * 0.40), int(w * 0.14), navy, green, red)
    f1, f2 = font(int(w * 0.058)), font(int(w * 0.030))
    def center(text, fnt, y, fill):
        bb = d.textbbox((0, 0), text, font=fnt)
        d.text(((w - (bb[2]-bb[0])) / 2, y), text, font=fnt, fill=fill)
    center(label.upper(), f1, int(h * 0.60), (240, 244, 248))
    center("TIENDA  PINO", f2, int(h * 0.68), ac_rgb)
    center("foto provisoria — reemplazar", font(int(w*0.022)), int(h*0.92), (150,160,180))
    out = os.path.join(IMG, fname)
    img.save(out, "WEBP", quality=82, method=6)
    print("placeholder:", fname)

# Products (match the photos the client provided)
placeholder("jersey-home.webp", "Camiseta Titular", "#0c1633", GREEN)
placeholder("jersey-away.webp", "Camiseta Alternativa", "#11225a", "#f26a1b")
placeholder("cap-mono.webp",    "Gorra Grafito",        "#15151a", "#9aa3b2")
placeholder("cap-color.webp",   "Gorra Edición Color",  "#1a1a20", RED)
placeholder("kit-training.webp","Conjunto Entrenamiento","#0c1633", GREEN)
placeholder("bag.webp",         "Bolso de Club",        "#11225a", "#f26a1b")
placeholder("mate.webp",        "Mate N.E.C.C.",        "#15151a", GREEN)

# Wide hero / lifestyle placeholder
def hero(fname, w=1800, h=1100):
    navy, green, red = hex2rgb(NAVY), hex2rgb(GREEN), hex2rgb(RED)
    img = Image.new("RGB", (w, h), hex2rgb("#0a1530"))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / h
        c = (int(10 + 8*t), int(21 + 10*t), int(48 + 18*t))
        d.line([(0, y), (w, y)], fill=c)
    draw_mark(d, int(w*0.5), int(h*0.46), int(h*0.18), navy, green, red)
    img.save(os.path.join(IMG, fname), "WEBP", quality=80, method=6)
    print("placeholder:", fname)

hero("hero-lifestyle.webp")
print("DONE")
