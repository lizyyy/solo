"""生成合成测试图像用于镜头瑕疵检测演示"""

import os
import sys
from pathlib import Path
from typing import Tuple

import numpy as np
from PIL import Image, ImageFilter, ImageDraw


def generate_normal_image(size: Tuple[int, int] = (800, 600)) -> Image.Image:
    """生成正常的测试图像（均匀渐变背景）"""
    width, height = size
    x = np.linspace(0, 255, width)
    y = np.linspace(0, 255, height)
    xv, yv = np.meshgrid(x, y)

    r = ((xv + yv) / 2).astype(np.uint8)
    g = ((128 + xv / 2 + yv / 4)).astype(np.uint8)
    b = ((64 + xv / 4 + yv / 2)).astype(np.uint8)

    rgb = np.stack([r, g, b], axis=2)
    img = Image.fromarray(rgb, "RGB")

    return img


def generate_dark_corner_image(
    size: Tuple[int, int] = (800, 600),
    corner_factor: float = 0.6,
) -> Image.Image:
    """生成带暗角的测试图像"""
    width, height = size
    cx, cy = width / 2, height / 2
    max_dist = np.sqrt(cx**2 + cy**2)

    x = np.arange(width)
    y = np.arange(height)
    xv, yv = np.meshgrid(x, y)

    dist = np.sqrt((xv - cx)**2 + (yv - cy)**2)
    normalized_dist = dist / max_dist

    brightness = 1.0 - (1.0 - corner_factor) * normalized_dist

    base = generate_normal_image(size)
    base_arr = np.array(base).astype(np.float64)

    for channel in range(3):
        base_arr[:, :, channel] *= brightness[:, :, np.newaxis]

    base_arr = np.clip(base_arr, 0, 255).astype(np.uint8)
    return Image.fromarray(base_arr, "RGB")


def generate_color_shift_image(
    size: Tuple[int, int] = (800, 600),
    shift_red: float = 0.8,
    shift_green: float = 1.0,
    shift_blue: float = 1.2,
) -> Image.Image:
    """生成带色偏的测试图像"""
    base = generate_normal_image(size)
    base_arr = np.array(base).astype(np.float64)

    base_arr[:, :, 0] *= shift_red
    base_arr[:, :, 1] *= shift_green
    base_arr[:, :, 2] *= shift_blue

    base_arr = np.clip(base_arr, 0, 255).astype(np.uint8)
    return Image.fromarray(base_arr, "RGB")


def generate_blurry_image(
    size: Tuple[int, int] = (800, 600),
    blur_radius: float = 8.0,
) -> Image.Image:
    """生成模糊的测试图像（模拟偏心或对焦问题）"""
    base = generate_normal_image(size)
    blurred = base.filter(ImageFilter.GaussianBlur(radius=blur_radius))

    draw = ImageDraw.Draw(blurred)
    for i in range(5):
        x = np.random.randint(50, size[0] - 50)
        y = np.random.randint(50, size[1] - 50)
        r = np.random.randint(20, 60)
        color = tuple(np.random.randint(100, 255, 3))
        draw.ellipse([x - r, y - r, x + r, y + r], fill=color)

    blurred = blurred.filter(ImageFilter.GaussianBlur(radius=blur_radius / 2))
    return blurred


def generate_dead_pixel_image(
    size: Tuple[int, int] = (800, 600),
    dead_count: int = 15,
    hot_count: int = 5,
) -> Image.Image:
    """生成带坏点和热点的测试图像"""
    base = generate_normal_image(size)
    base_arr = np.array(base).astype(np.uint8)

    for _ in range(dead_count):
        x = np.random.randint(0, size[0])
        y = np.random.randint(0, size[1])
        base_arr[y, x, :] = 0

        for dx in [-1, 0, 1]:
            for dy in [-1, 0, 1]:
                if 0 <= x + dx < size[0] and 0 <= y + dy < size[1]:
                    base_arr[y + dy, x + dx, :] = np.minimum(
                        base_arr[y + dy, x + dx, :], 30
                    )

    for _ in range(hot_count):
        x = np.random.randint(0, size[0])
        y = np.random.randint(0, size[1])
        base_arr[y, x, :] = 255

        for dx in [-1, 0, 1]:
            for dy in [-1, 0, 1]:
                if 0 <= x + dx < size[0] and 0 <= y + dy < size[1]:
                    base_arr[y + dy, x + dx, :] = np.maximum(
                        base_arr[y + dy, x + dx, :], 220
                    )

    return Image.fromarray(base_arr, "RGB")


def generate_noisy_image(
    size: Tuple[int, int] = (800, 600),
    noise_std: float = 30.0,
) -> Image.Image:
    """生成带噪点的测试图像"""
    base = generate_normal_image(size)
    base_arr = np.array(base).astype(np.float64)

    noise = np.random.normal(0, noise_std, base_arr.shape)
    noisy = base_arr + noise
    noisy = np.clip(noisy, 0, 255).astype(np.uint8)

    return Image.fromarray(noisy, "RGB")


def generate_mold_image(
    size: Tuple[int, int] = (800, 600),
    mold_count: int = 3,
) -> Image.Image:
    """生成带霉斑的测试图像"""
    base = generate_dark_corner_image(size, corner_factor=0.7)
    base_arr = np.array(base).astype(np.float64)

    for _ in range(mold_count):
        cx = np.random.randint(size[0] // 4, 3 * size[0] // 4)
        cy = np.random.randint(size[1] // 4, 3 * size[1] // 4)
        radius = np.random.randint(30, 80)

        y, x = np.ogrid[:size[1], :size[0]]
        dist_from_center = np.sqrt((x - cx)**2 + (y - cy)**2)

        mask = dist_from_center <= radius
        fade_factor = np.maximum(0, 1 - dist_from_center / radius)

        for channel in range(3):
            base_arr[:, :, channel] = np.where(
                mask,
                base_arr[:, :, channel] * (0.3 + 0.7 * fade_factor),
                base_arr[:, :, channel],
            )

        base_arr[:, :, 1] = np.where(
            mask,
            base_arr[:, :, 1] * 0.9,
            base_arr[:, :, 1],
        )

    base_arr = np.clip(base_arr, 0, 255).astype(np.uint8)
    return Image.fromarray(base_arr, "RGB")


def main(output_dir: str = "examples/images"):
    """生成所有测试图像"""
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    print(f"生成测试图像到: {out_path.absolute()}")

    print("\n1. 正常图像 (LENS-005)")
    for i in range(2):
        img = generate_normal_image()
        img.save(out_path / f"LENS-005_{i+1}.png")
        print(f"   - LENS-005_{i+1}.png")

    print("\n2. 暗角图像 (LENS-001)")
    for i in range(2):
        img = generate_dark_corner_image()
        img.save(out_path / f"LENS-001_{i+1}.png")
        print(f"   - LENS-001_{i+1}.png")

    print("\n3. 色偏图像 (LENS-002)")
    for i in range(2):
        img = generate_color_shift_image(shift_red=0.7, shift_green=1.0, shift_blue=1.3)
        img.save(out_path / f"LENS-002_{i+1}.png")
        print(f"   - LENS-002_{i+1}.png")

    print("\n4. 模糊图像 (LENS-004)")
    for i in range(2):
        img = generate_blurry_image(blur_radius=6.0 + i * 2)
        img.save(out_path / f"LENS-004_{i+1}.png")
        print(f"   - LENS-004_{i+1}.png")

    print("\n5. 坏点+霉斑混合图像 (LENS-003)")
    for i in range(2):
        img = generate_dead_pixel_image(dead_count=20 + i * 5, hot_count=3 + i)
        img.save(out_path / f"LENS-003_{i+1}.png")
        print(f"   - LENS-003_{i+1}.png")

    print("\n6. 额外测试图像")
    img = generate_mold_image()
    img.save(out_path / f"test_mold.png")
    print(f"   - test_mold.png")

    img = generate_noisy_image()
    img.save(out_path / f"test_noise.png")
    print(f"   - test_noise.png")

    print(f"\n✓ 总共生成了 {len(list(out_path.glob('*.png')))} 张测试图像")
    return out_path


if __name__ == "__main__":
    output = sys.argv[1] if len(sys.argv) > 1 else "examples/images"
    main(output)
