"""One-shot : genere les icones PWA (planete + anneau, palette Space Tech du site)."""
import math
from PIL import Image, ImageDraw

BG = (11, 11, 16, 255)       # --color-bg
PLANET = (59, 130, 246, 255)  # --color-accent
PLANET_SHADOW = (30, 58, 95, 255)  # --color-accent-bg
RING = (148, 163, 184, 255)  # --color-muted


def draw_icon(size: int, padding_ratio: float) -> Image.Image:
    img = Image.new("RGBA", (size, size), BG)
    draw = ImageDraw.Draw(img)
    pad = size * padding_ratio
    cx, cy = size / 2, size / 2
    r = (size - 2 * pad) / 2 * 0.62

    # Anneau (ellipse fine, inclinee) derriere puis devant la planete
    ring_rx, ring_ry = r * 1.9, r * 0.55
    ring_bbox = [cx - ring_rx, cy - ring_ry, cx + ring_rx, cy + ring_ry]
    ring_width = max(2, int(size * 0.018))
    draw.ellipse(ring_bbox, outline=RING, width=ring_width)

    # Planete (cercle plein + demi-ombre pour un effet 3D simple)
    bbox = [cx - r, cy - r, cx + r, cy + r]
    draw.ellipse(bbox, fill=PLANET)
    draw.pieslice(bbox, -90, 90, fill=PLANET_SHADOW)

    return img


targets = [
    ("icon-192.png", 192, 0.08),
    ("icon-512.png", 512, 0.08),
    ("icon-maskable-192.png", 192, 0.18),
    ("icon-maskable-512.png", 512, 0.18),
    ("apple-touch-icon.png", 180, 0.1),
]

out_dir = "C:/_Perso/UNIVERSE3D/frontend/public/icons"
for name, size, pad in targets:
    icon = draw_icon(size, pad)
    icon.convert("RGB").save(f"{out_dir}/{name}") if not name.startswith("icon-maskable") else icon.save(f"{out_dir}/{name}")
    print(f"{name} ok")

# favicon.ico multi-résolution (16/32/48) à la racine public/
fav = draw_icon(256, 0.08)
fav.convert("RGB").save("C:/_Perso/UNIVERSE3D/frontend/public/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
print("favicon.ico ok")
