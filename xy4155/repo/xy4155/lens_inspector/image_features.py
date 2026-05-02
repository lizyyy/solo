"""镜头瑕疵分拣台 - 图像特征提取模块"""

import os
import uuid
from pathlib import Path
from typing import Tuple, List, Optional
from dataclasses import dataclass

import numpy as np
import cv2
from skimage import filters, feature

from .models import ImageFeatures, DefectDetection, DefectType


class ImageFeatureExtractor:
    def __init__(
        self,
        resize_max_dim: int = 1024,
        sharpness_threshold: float = 100.0,
        dark_corner_threshold: float = 0.85,
        color_shift_threshold: float = 15.0,
        dead_pixel_threshold: float = 20.0,
        hot_pixel_threshold: float = 235.0,
    ):
        self.resize_max_dim = resize_max_dim
        self.sharpness_threshold = sharpness_threshold
        self.dark_corner_threshold = dark_corner_threshold
        self.color_shift_threshold = color_shift_threshold
        self.dead_pixel_threshold = dead_pixel_threshold
        self.hot_pixel_threshold = hot_pixel_threshold

    def load_and_preprocess(self, image_path: str) -> Tuple[np.ndarray, np.ndarray]:
        img = cv2.imread(str(image_path))
        if img is None:
            raise ValueError(f"无法读取图像: {image_path}")

        h, w = img.shape[:2]
        if max(h, w) > self.resize_max_dim:
            scale = self.resize_max_dim / max(h, w)
            new_w = int(w * scale)
            new_h = int(h * scale)
            img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)

        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        return rgb, gray

    def extract_sharpness(self, gray: np.ndarray) -> Tuple[float, float]:
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        sharpness = laplacian.var()

        if sharpness < self.sharpness_threshold:
            score = min(1.0, self.sharpness_threshold / (sharpness + 1e-6))
        else:
            score = max(0.0, 1.0 - (sharpness / (self.sharpness_threshold * 10)))

        return sharpness, score

    def extract_dark_corner(self, gray: np.ndarray) -> float:
        h, w = gray.shape
        corner_size = min(h, w) // 4

        corners = [
            gray[:corner_size, :corner_size],
            gray[:corner_size, -corner_size:],
            gray[-corner_size:, :corner_size],
            gray[-corner_size:, -corner_size:],
        ]

        center = gray[h // 4 : 3 * h // 4, w // 4 : 3 * w // 4]

        corner_means = [np.mean(c) for c in corners]
        center_mean = np.mean(center)

        if center_mean < 1e-6:
            return 0.0

        corner_ratios = [cm / (center_mean + 1e-6) for cm in corner_means]
        avg_ratio = np.mean(corner_ratios)

        dark_corner_score = max(0.0, 1.0 - avg_ratio)

        if avg_ratio < self.dark_corner_threshold:
            dark_corner_score = min(1.0, dark_corner_score * 1.5)

        return dark_corner_score

    def extract_color_shift(self, rgb: np.ndarray) -> Tuple[float, float, float, float]:
        r = rgb[:, :, 0].astype(np.float64)
        g = rgb[:, :, 1].astype(np.float64)
        b = rgb[:, :, 2].astype(np.float64)

        r_mean = np.mean(r)
        g_mean = np.mean(g)
        b_mean = np.mean(b)

        avg_mean = (r_mean + g_mean + b_mean) / 3.0

        r_shift = abs(r_mean - avg_mean)
        g_shift = abs(g_mean - avg_mean)
        b_shift = abs(b_mean - avg_mean)

        max_shift = max(r_shift, g_shift, b_shift)
        color_shift_score = min(1.0, max_shift / self.color_shift_threshold)

        return r_shift, g_shift, b_shift, color_shift_score

    def detect_dead_and_hot_pixels(
        self, gray: np.ndarray
    ) -> Tuple[int, List[Tuple[int, int, float]], int, List[Tuple[int, int, float]]]:
        h, w = gray.shape
        dead_pixels = []
        hot_pixels = []

        _, binary_dead = cv2.threshold(gray, self.dead_pixel_threshold, 255, cv2.THRESH_BINARY_INV)
        kernel = np.ones((3, 3), np.uint8)
        binary_dead = cv2.morphologyEx(binary_dead.astype(np.uint8), cv2.MORPH_OPEN, kernel)

        dead_labels, dead_stats = cv2.connectedComponentsWithStats(binary_dead, connectivity=8)[:2]

        for i in range(1, dead_labels):
            mask = (dead_labels == i).astype(np.uint8)
            intensity = np.mean(gray[mask > 0])
            coords = np.where(mask > 0)
            if len(coords[0]) > 0:
                center_y, center_x = int(np.mean(coords[0])), int(np.mean(coords[1]))
                dead_pixels.append((center_y, center_x, float(intensity)))

        _, binary_hot = cv2.threshold(gray, self.hot_pixel_threshold, 255, cv2.THRESH_BINARY)
        binary_hot = cv2.morphologyEx(binary_hot.astype(np.uint8), cv2.MORPH_OPEN, kernel)

        hot_labels, hot_stats = cv2.connectedComponentsWithStats(binary_hot, connectivity=8)[:2]

        for i in range(1, hot_labels):
            mask = (hot_labels == i).astype(np.uint8)
            intensity = np.mean(gray[mask > 0])
            coords = np.where(mask > 0)
            if len(coords[0]) > 0:
                center_y, center_x = int(np.mean(coords[0])), int(np.mean(coords[1]))
                hot_pixels.append((center_y, center_x, float(intensity)))

        return len(dead_pixels), dead_pixels, len(hot_pixels), hot_pixels

    def extract_brightness_and_contrast(
        self, gray: np.ndarray
    ) -> Tuple[float, float, float, float]:
        brightness_mean = np.mean(gray)
        brightness_std = np.std(gray)

        contrast = np.max(gray) - np.min(gray)

        if brightness_mean < 1e-6:
            normalized_contrast = 0.0
        else:
            normalized_contrast = contrast / (brightness_mean + 1e-6)

        return brightness_mean, brightness_std, contrast, normalized_contrast

    def extract_noise_level(self, gray: np.ndarray) -> float:
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        noise = gray.astype(np.float64) - blurred.astype(np.float64)
        noise_std = np.std(noise)

        noise_level = min(1.0, noise_std / 50.0)

        return noise_level

    def extract_edge_intensity(self, gray: np.ndarray) -> float:
        edges = feature.canny(gray, sigma=1.0)
        edge_intensity = np.mean(edges.astype(np.float64))

        return edge_intensity

    def extract_all_features(
        self, image_path: str, image_id: Optional[str] = None
    ) -> Tuple[ImageFeatures, List[DefectDetection]]:
        if image_id is None:
            image_id = os.path.splitext(os.path.basename(image_path))[0]

        rgb, gray = self.load_and_preprocess(image_path)

        sharpness, sharpness_score = self.extract_sharpness(gray)
        dark_corner_score = self.extract_dark_corner(gray)
        r_shift, g_shift, b_shift, color_shift_score = self.extract_color_shift(rgb)

        dead_count, dead_heatmap, hot_count, hot_heatmap = self.detect_dead_and_hot_pixels(
            gray
        )

        brightness_mean, brightness_std, contrast, _ = self.extract_brightness_and_contrast(
            gray
        )
        noise_level = self.extract_noise_level(gray)
        edge_intensity = self.extract_edge_intensity(gray)

        features = ImageFeatures(
            image_id=image_id,
            file_path=str(image_path),
            sharpness=sharpness,
            sharpness_score=sharpness_score,
            dark_corner_score=dark_corner_score,
            color_shift_r=r_shift,
            color_shift_g=g_shift,
            color_shift_b=b_shift,
            color_shift_score=color_shift_score,
            dead_pixel_count=dead_count,
            dead_pixel_heatmap=dead_heatmap,
            hot_pixel_count=hot_count,
            hot_pixel_heatmap=hot_heatmap,
            brightness_mean=brightness_mean,
            brightness_std=brightness_std,
            contrast=contrast,
            noise_level=noise_level,
            edge_intensity=edge_intensity,
        )

        defects = self._features_to_defects(features, image_id, gray.shape)

        return features, defects

    def _features_to_defects(
        self, features: ImageFeatures, image_id: str, shape: Tuple[int, int]
    ) -> List[DefectDetection]:
        defects = []
        h, w = shape

        if features.sharpness_score > 0.5:
            defects.append(
                DefectDetection(
                    defect_id=f"def_{uuid.uuid4().hex[:8]}",
                    defect_type=DefectType.DECENTERING
                    if features.sharpness_score > 0.7
                    else DefectType.UNKNOWN,
                    confidence=features.sharpness_score,
                    location=(h // 2, w // 2),
                    area=0.0,
                    severity="高" if features.sharpness_score > 0.7 else "中",
                    image_id=image_id,
                    description=f"清晰度异常: {features.sharpness:.2f}",
                )
            )

        if features.dark_corner_score > 0.3:
            defects.append(
                DefectDetection(
                    defect_id=f"def_{uuid.uuid4().hex[:8]}",
                    defect_type=DefectType.DARK_CORNER,
                    confidence=features.dark_corner_score,
                    location=(h // 4, w // 4),
                    area=0.25,
                    severity="高" if features.dark_corner_score > 0.5 else "中",
                    image_id=image_id,
                    description=f"暗角评分: {features.dark_corner_score:.3f}",
                )
            )

        if features.color_shift_score > 0.4:
            defects.append(
                DefectDetection(
                    defect_id=f"def_{uuid.uuid4().hex[:8]}",
                    defect_type=DefectType.COLOR_SHIFT,
                    confidence=features.color_shift_score,
                    location=(h // 2, w // 2),
                    area=1.0,
                    severity="高" if features.color_shift_score > 0.7 else "中",
                    image_id=image_id,
                    description=f"色偏评分: {features.color_shift_score:.3f}",
                )
            )

        if features.dead_pixel_count > 0:
            for y, x, intensity in features.dead_pixel_heatmap[:5]:
                defects.append(
                    DefectDetection(
                        defect_id=f"def_{uuid.uuid4().hex[:8]}",
                        defect_type=DefectType.DEAD_PIXEL,
                        confidence=0.9,
                        location=(y, x),
                        area=0.001,
                        severity="中" if features.dead_pixel_count > 5 else "低",
                        image_id=image_id,
                        description=f"坏点强度: {intensity:.1f}",
                    )
                )

        if features.hot_pixel_count > 0:
            for y, x, intensity in features.hot_pixel_heatmap[:5]:
                defects.append(
                    DefectDetection(
                        defect_id=f"def_{uuid.uuid4().hex[:8]}",
                        defect_type=DefectType.HOT_PIXEL,
                        confidence=0.9,
                        location=(y, x),
                        area=0.001,
                        severity="中" if features.hot_pixel_count > 5 else "低",
                        image_id=image_id,
                        description=f"热点强度: {intensity:.1f}",
                    )
                )

        if features.noise_level > 0.5:
            defects.append(
                DefectDetection(
                    defect_id=f"def_{uuid.uuid4().hex[:8]}",
                    defect_type=DefectType.UNKNOWN,
                    confidence=features.noise_level,
                    location=(h // 2, w // 2),
                    area=1.0,
                    severity="中",
                    image_id=image_id,
                    description=f"噪点水平: {features.noise_level:.3f}",
                )
            )

        return defects
