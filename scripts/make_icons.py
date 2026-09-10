from PIL import Image, ImageDraw
import os

out = r"D:\ai\Mimo\wa-chats-backup-pro\icons"
os.makedirs(out, exist_ok=True)

def make_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    margin = max(1, size // 16)
    d.ellipse([margin, margin, size - margin, size - margin], fill=(37, 211, 102, 255))
    inset = int(size * 0.22)
    width = max(1, size // 16)
    d.ellipse([inset, inset, size - inset, size - inset], outline=(255, 255, 255, 255), width=width)
    cx, cy = size // 2, size // 2
    d.line([cx, cy, cx, cy - int(size * 0.18)], fill=(255, 255, 255, 255), width=max(1, size // 18))
    d.line([cx, cy, cx + int(size * 0.14), cy], fill=(255, 255, 255, 255), width=max(1, size // 18))
    r = max(1, size // 24)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255, 255))
    path = os.path.join(out, f"icon{size}.png")
    img.save(path, "PNG")
    print(path, img.size)

for s in (16, 32, 48, 128):
    make_icon(s)
