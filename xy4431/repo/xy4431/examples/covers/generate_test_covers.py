from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

covers_dir = Path(__file__).parent

cover_specs = [
    ("cover_ep001.jpg", 1400, 1400, "EP 001", (100, 150, 100)),
    ("cover_ep002.jpg", 3000, 3000, "EP 002", (100, 100, 150)),
    ("cover_ep003.jpg", 1400, 1400, "EP 003", (150, 100, 100)),
    ("cover_ep004.jpg", 1000, 1000, "EP 004", (150, 150, 100)),
]

for filename, width, height, text, color in cover_specs:
    img = Image.new("RGB", (width, height), color)
    draw = ImageDraw.Draw(img)
    
    try:
        font_size = min(width, height) // 10
        font = ImageFont.truetype("Arial.ttf", font_size)
    except (IOError, OSError):
        font = ImageFont.load_default()
    
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (width - text_width) // 2
    y = (height - text_height) // 2
    draw.text((x, y), text, fill=(255, 255, 255), font=font)
    
    img.save(covers_dir / filename, "JPEG", quality=90)
    print(f"Created: {filename} ({width}x{height})")

print("\n✅ 测试封面图已生成")
print("\n说明:")
print("- cover_ep001.jpg: 1400x1400 (合规，正方形)")
print("- cover_ep002.jpg: 3000x3000 (合规，正方形)")
print("- cover_ep003.jpg: 1400x1400 (合规，正方形)")
print("- cover_ep004.jpg: 1000x1000 (尺寸过小，会 FAIL)")
