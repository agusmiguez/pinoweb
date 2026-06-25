#!/usr/bin/env python3
"""Genera íconos PNG (PWA / home-screen) dibujando el logo del pino con Pillow.
Fondo blanco, pino con franjas navy+verde y sol rojo, zona segura centrada."""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.normpath(os.path.join(HERE, "..", "assets", "img"))
NAVY = (27, 42, 107); GREEN = (46, 157, 79); RED = (224, 36, 56); WHITE = (255, 255, 255)

def make_icon(size, out, bg=WHITE):
    W = size
    img = Image.new("RGBA", (W, W), bg + (255,))
    # máscara con la silueta del pino (triángulo + tronco), centrada ~68%
    mask = Image.new("L", (W, W), 0)
    md = ImageDraw.Draw(mask)
    cx = W / 2
    apex = (cx, W * 0.18)
    bl = (W * 0.18, W * 0.64); br = (W * 0.82, W * 0.64)
    md.polygon([apex, br, bl], fill=255)
    md.rounded_rectangle([cx - W * 0.075, W * 0.60, cx + W * 0.075, W * 0.82],
                         radius=int(W * 0.03), fill=255)
    # capa de franjas (verde base + barras navy)
    stripes = Image.new("RGBA", (W, W), GREEN + (255,))
    sd = ImageDraw.Draw(stripes)
    bh = max(3, int(W * 0.042))
    y = int(W * 0.16)
    while y < W * 0.85:
        sd.rectangle([0, y, W, y + bh], fill=NAVY + (255,))
        y += bh * 2
    # sol rojo (semicírculo, domo arriba) centrado en el cuerpo
    sun_r = W * 0.155
    scy = W * 0.45
    sd.pieslice([cx - sun_r, scy - sun_r, cx + sun_r, scy + sun_r], 180, 360, fill=RED + (255,))
    # franjas sólo dentro del pino
    img.paste(stripes, (0, 0), mask)
    img.convert("RGB").save(out, "PNG")
    print("icon:", os.path.basename(out), size)

make_icon(512, os.path.join(IMG, "icon-512.png"))
make_icon(192, os.path.join(IMG, "icon-192.png"))
make_icon(180, os.path.join(IMG, "apple-touch-icon.png"))
print("DONE")
