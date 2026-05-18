from PIL import Image, ImageDraw
import os


def create_test_image(path, size, color, text=""):
    img = Image.new('RGB', size, color=color)
    draw = ImageDraw.Draw(img)
    if text:
        draw.text((10, 10), text, fill=(255, 255, 255))
    img.save(path)
    print(f"Created: {path}")


def main():
    base_dir = "test_samples"
    
    create_test_image(f"{base_dir}/normal_image_v1.0.jpg", (400, 300), (100, 100, 200), "Normal v1.0")
    create_test_image(f"{base_dir}/normal_image_v2.0.png", (500, 400), (100, 200, 100), "Normal v2.0")
    create_test_image(f"{base_dir}/sample_model_resnet.jpg", (300, 250), (200, 100, 100), "Model ResNet")
    
    create_test_image(f"{base_dir}/thumbnail_small.jpg", (100, 80), (150, 150, 50), "Thumb 1")
    create_test_image(f"{base_dir}/tiny_image.png", (50, 50), (50, 150, 150), "Tiny")
    create_test_image(f"{base_dir}/narrow_wide.jpg", (150, 300), (150, 50, 150), "Narrow")
    
    create_test_image(f"{base_dir}/duplicate_a.jpg", (250, 200), (200, 200, 100), "Duplicate")
    img = Image.open(f"{base_dir}/duplicate_a.jpg")
    img.save(f"{base_dir}/duplicate_b.jpg")
    print(f"Created: {base_dir}/duplicate_b.jpg (copy)")
    
    create_test_image(f"{base_dir}/subdir/nested_v1.0.jpg", (350, 350), (50, 50, 100), "Nested v1.0")
    create_test_image(f"{base_dir}/subdir/nested_ver2.jpg", (280, 220), (100, 50, 50), "Nested ver2")
    
    print("\n✓ Test images generated successfully!")
    print(f"  Location: {os.path.abspath(base_dir)}")


if __name__ == "__main__":
    main()
