import os
import math
import numpy as np
from PIL import Image, ImageDraw
from config import UPLOAD_DIR, IMAGE_MAX_SIZE, TILT_THRESHOLD_DEGREES


def save_upload_image(file_bytes: bytes, filename: str) -> str:
    path = os.path.join(UPLOAD_DIR, filename)
    with open(path, "wb") as f:
        f.write(file_bytes)
    return path


def load_image(image_path: str) -> Image.Image:
    return Image.open(image_path).convert("RGB")


def resize_if_needed(image: Image.Image) -> Image.Image:
    if image.width > IMAGE_MAX_SIZE[0] or image.height > IMAGE_MAX_SIZE[1]:
        image.thumbnail(IMAGE_MAX_SIZE, Image.LANCZOS)
    return image


def to_grayscale_array(image: Image.Image) -> np.ndarray:
    gray = image.convert("L")
    return np.array(gray)


def detect_tilt_angle(image: Image.Image) -> float:
    arr = to_grayscale_array(image)
    h, w = arr.shape
    edges = np.zeros_like(arr, dtype=np.float32)
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            gx = int(arr[y, x + 1]) - int(arr[y, x - 1])
            gy = int(arr[y + 1, x]) - int(arr[y - 1, x])
            edges[y, x] = math.sqrt(gx * gx + gy * gy)

    threshold = np.percentile(edges[edges > 0], 90)
    strong_ys, strong_xs = np.where(edges > threshold)

    if len(strong_xs) < 10:
        return 0.0

    rows = np.unique(strong_ys)
    step = max(1, len(rows) // 20)
    sampled_rows = rows[::step]

    angles = []
    for row_y in sampled_rows:
        mask = strong_ys == row_y
        if mask.sum() < 3:
            continue
        xs = strong_xs[mask]
        center_x = xs.mean()
        local_mask = (strong_ys >= row_y - 5) & (strong_ys <= row_y + 5)
        if local_mask.sum() < 3:
            continue
        local_ys = strong_ys[local_mask].astype(np.float64)
        local_xs = strong_xs[local_mask].astype(np.float64)
        if np.std(local_xs) < 1:
            continue
        coeffs = np.polyfit(local_xs, local_ys, 1)
        angle = math.degrees(math.atan(coeffs[0]))
        angles.append(angle)

    if not angles:
        return 0.0

    angles = np.array(angles)
    median_angle = float(np.median(angles))
    return -median_angle


def correct_tilt(image: Image.Image, angle: float) -> Image.Image:
    if abs(angle) < 0.01:
        return image.copy()
    return image.rotate(angle, expand=True, fillcolor="white")


def detect_text_regions(image: Image.Image) -> list:
    arr = to_grayscale_array(image)
    h, w = arr.shape
    binary = (arr < 200).astype(np.uint8)
    horizontal_proj = np.sum(binary, axis=1)
    row_threshold = max(np.mean(horizontal_proj) * 0.1, 1)
    in_row = False
    rows = []
    start = 0
    for i, val in enumerate(horizontal_proj):
        if val > row_threshold and not in_row:
            in_row = True
            start = i
        elif val <= row_threshold and in_row:
            in_row = False
            rows.append((start, i))
    if in_row:
        rows.append((start, h - 1))
    return rows


def detect_chars_in_row(image: Image.Image, row_start: int, row_end: int) -> list:
    arr = to_grayscale_array(image)
    row_arr = arr[row_start:row_end + 1, :]
    binary = (row_arr < 200).astype(np.uint8)
    vertical_proj = np.sum(binary, axis=0)
    char_threshold = max(np.mean(vertical_proj[vertical_proj > 0]) * 0.1, 1) if np.any(vertical_proj > 0) else 1
    in_char = False
    chars = []
    start = 0
    for i, val in enumerate(vertical_proj):
        if val > char_threshold and not in_char:
            in_char = True
            start = i
        elif val <= char_threshold and in_char:
            in_char = False
            chars.append((start, i))
    if in_char:
        chars.append((start, len(vertical_proj) - 1))
    return chars


def detect_signature_region(image: Image.Image, text_rows: list) -> dict:
    arr = to_grayscale_array(image)
    h, w = arr.shape
    bottom_start = int(h * 0.6)
    if text_rows:
        last_row_end = text_rows[-1][1]
        bottom_start = max(bottom_start, last_row_end - int(h * 0.1))

    right_start = int(w * 0.6)
    region = arr[bottom_start:, right_start:]
    if region.size == 0:
        return {"detected": False, "region": None}

    ink_ratio = np.sum(region < 200) / region.size
    if ink_ratio > 0.005:
        return {
            "detected": True,
            "region": {
                "x": right_start,
                "y": bottom_start,
                "width": w - right_start,
                "height": h - bottom_start,
                "ink_ratio": float(ink_ratio),
            },
        }
    return {"detected": False, "region": None}


def generate_annotated_image(
    image: Image.Image,
    text_rows: list,
    char_positions_per_row: list,
    signature_info: dict,
    tilt_angle: float,
) -> Image.Image:
    annotated = image.copy()
    draw = ImageDraw.Draw(annotated)
    w, h = annotated.size

    for row_start, row_end in text_rows:
        draw.rectangle([2, row_start, w - 2, row_end], outline="blue", width=1)

    for chars in char_positions_per_row:
        for i in range(len(chars) - 1):
            cx1 = (chars[i][0] + chars[i][1]) // 2
            cx2 = (chars[i + 1][0] + chars[i + 1][1]) // 2
            mid_y = (text_rows[0][0] + text_rows[0][1]) // 2 if text_rows else h // 2
            draw.line([(cx1, mid_y - 3), (cx2, mid_y - 3)], fill="green", width=1)

    if signature_info.get("detected") and signature_info.get("region"):
        r = signature_info["region"]
        draw.rectangle(
            [r["x"], r["y"], r["x"] + r["width"], r["y"] + r["height"]],
            outline="red",
            width=2,
        )

    draw.text((10, 10), f"Tilt: {tilt_angle:.2f}°", fill="red")

    return annotated


def generate_sample_image(width: int = 800, height: int = 1200) -> Image.Image:
    img = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(img)
    char_size = 60
    margin = 80
    line_spacing = 100
    char_spacing = 80

    for row in range(8):
        y = margin + row * (char_size + line_spacing)
        for col in range(8):
            x = margin + col * (char_size + char_spacing)
            if row == 7 and col >= 5:
                continue
            draw.rectangle(
                [x, y, x + char_size, y + char_size],
                outline="black",
                width=2,
            )

    sig_x = width - margin - char_size * 2
    sig_y = height - margin - char_size
    draw.text((sig_x, sig_y), "落款", fill="black")

    return img
