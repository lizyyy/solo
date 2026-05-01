
from PIL import Image, ImageDraw
import os

def create_sample_plate(filename, num_colonies=3):
    img = Image.new('RGB', (400, 400), color='#f5f5dc')
    draw = ImageDraw.Draw(img)
    
    draw.ellipse([20, 20, 380, 380], outline='#8b4513', width=3)
    
    colonies = [
        (100, 100, 150, 150),
        (200, 150, 245, 195),
        (300, 100, 355, 155),
        (150, 250, 190, 290)
    ]
    
    for i in range(min(num_colonies, len(colonies))):
        x1, y1, x2, y2 = colonies[i]
        draw.ellipse([x1, y1, x2, y2], fill='#fffacd', outline='#daa520', width=2)
    
    img.save(filename)

os.makedirs('sample_data/images', exist_ok=True)

create_sample_plate('sample_data/images/plate_001.jpg', 4)
create_sample_plate('sample_data/images/plate_002.jpg', 2)
create_sample_plate('sample_data/images/plate_003.jpg', 3)

print("Sample images generated successfully!")
