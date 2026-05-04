"""图片特征提取模块"""

import cv2
import numpy as np
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Tuple, Optional, Dict
from PIL import Image as PILImage

from ..config import get_config


@dataclass
class ColorFeatures:
    avg_bgr: Tuple[float, float, float]
    avg_hsv: Tuple[float, float, float]
    avg_lab: Tuple[float, float, float]
    hist_bgr: np.ndarray
    hist_hsv: np.ndarray
    dominant_colors: List[Tuple[Tuple[int, int, int], float]]
    color_contrast: float
    brightness: float

    def to_dict(self) -> Dict:
        return {
            "avg_bgr": list(self.avg_bgr),
            "avg_hsv": list(self.avg_hsv),
            "avg_lab": list(self.avg_lab),
            "dominant_colors": [(list(c), w) for c, w in self.dominant_colors],
            "color_contrast": self.color_contrast,
            "brightness": self.brightness,
        }

    def similarity(self, other: "ColorFeatures") -> float:
        hist_sim = cv2.compareHist(
            self.hist_hsv.astype(np.float32),
            other.hist_hsv.astype(np.float32),
            cv2.HISTCMP_CORREL
        )
        hsv_diff = np.abs(np.array(self.avg_hsv) - np.array(other.avg_hsv))
        hsv_sim = 1.0 - (hsv_diff.sum() / (180 + 255 + 255))
        return (hist_sim + hsv_sim) / 2

    def color_difference(self, other: "ColorFeatures") -> float:
        lab_diff = np.abs(np.array(self.avg_lab) - np.array(other.avg_lab))
        return lab_diff.sum()


@dataclass
class ContourFeatures:
    total_contours: int
    contour_areas: List[float]
    contour_perimeters: List[float]
    avg_area: float
    avg_perimeter: float
    max_area: float
    max_perimeter: float
    contour_density: float
    edge_intensity: float

    def to_dict(self) -> Dict:
        return {
            "total_contours": self.total_contours,
            "avg_area": self.avg_area,
            "avg_perimeter": self.avg_perimeter,
            "max_area": self.max_area,
            "max_perimeter": self.max_perimeter,
            "contour_density": self.contour_density,
            "edge_intensity": self.edge_intensity,
        }

    def similarity(self, other: "ContourFeatures") -> float:
        if self.total_contours == 0 and other.total_contours == 0:
            return 1.0
        if self.total_contours == 0 or other.total_contours == 0:
            return 0.0

        features1 = np.array([
            self.avg_area, self.avg_perimeter,
            self.max_area, self.max_perimeter,
            self.contour_density, self.edge_intensity
        ])
        features2 = np.array([
            other.avg_area, other.avg_perimeter,
            other.max_area, other.max_perimeter,
            other.contour_density, other.edge_intensity
        ])

        norm_features1 = features1 / (np.linalg.norm(features1) + 1e-8)
        norm_features2 = features2 / (np.linalg.norm(features2) + 1e-8)

        return float(np.dot(norm_features1, norm_features2))


@dataclass
class BubbleFeatures:
    bubble_count: int
    total_bubble_area: float
    avg_bubble_area: float
    max_bubble_area: float
    bubble_area_ratio: float
    bubble_locations: List[Tuple[int, int, float]] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return {
            "bubble_count": self.bubble_count,
            "total_bubble_area": self.total_bubble_area,
            "avg_bubble_area": self.avg_bubble_area,
            "max_bubble_area": self.max_bubble_area,
            "bubble_area_ratio": self.bubble_area_ratio,
            "bubble_locations": [(x, y, a) for x, y, a in self.bubble_locations],
        }

    def is_abnormal(self, threshold_ratio: float = 0.02, threshold_count: int = 5) -> bool:
        return self.bubble_area_ratio > threshold_ratio or self.bubble_count >= threshold_count


@dataclass
class ImageFeatures:
    image_path: str
    width: int
    height: int
    color: ColorFeatures
    contour: ContourFeatures
    bubble: BubbleFeatures
    feature_vector: np.ndarray

    def to_dict(self) -> Dict:
        return {
            "image_path": self.image_path,
            "width": self.width,
            "height": self.height,
            "color": self.color.to_dict(),
            "contour": self.contour.to_dict(),
            "bubble": self.bubble.to_dict(),
        }

    def similarity(self, other: "ImageFeatures") -> float:
        color_sim = self.color.similarity(other.color)
        contour_sim = self.contour.similarity(other.contour)
        return (color_sim * 0.6 + contour_sim * 0.4)


class ImageFeatureExtractor:
    def __init__(self, config=None):
        self.config = config or get_config()
        self.image_config = self.config.image

    def load_image(self, image_path: str) -> np.ndarray:
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"无法读取图片: {image_path}")
        return img

    def resize_image(self, img: np.ndarray) -> np.ndarray:
        return cv2.resize(img, self.image_config.resize_size)

    def extract_color_features(self, img: np.ndarray) -> ColorFeatures:
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        avg_bgr = tuple(float(c) for c in cv2.mean(img)[:3])
        avg_hsv = tuple(float(c) for c in cv2.mean(hsv)[:3])
        avg_lab = tuple(float(c) for c in cv2.mean(lab)[:3])

        hist_bgr = cv2.calcHist([img], [0, 1, 2], None,
                                [self.image_config.color_histogram_bins] * 3,
                                [0, 256, 0, 256, 0, 256])
        hist_bgr = cv2.normalize(hist_bgr, hist_bgr).flatten()

        hist_hsv = cv2.calcHist([hsv], [0, 1, 2], None,
                                [self.image_config.color_histogram_bins] * 3,
                                [0, 180, 0, 256, 0, 256])
        hist_hsv = cv2.normalize(hist_hsv, hist_hsv).flatten()

        dominant_colors = self._extract_dominant_colors(img)

        color_contrast = float(gray.std())
        brightness = float(gray.mean())

        return ColorFeatures(
            avg_bgr=avg_bgr,
            avg_hsv=avg_hsv,
            avg_lab=avg_lab,
            hist_bgr=hist_bgr,
            hist_hsv=hist_hsv,
            dominant_colors=dominant_colors,
            color_contrast=color_contrast,
            brightness=brightness,
        )

    def _extract_dominant_colors(self, img: np.ndarray, n_colors: int = 5) -> List[Tuple[Tuple[int, int, int], float]]:
        pixels = img.reshape(-1, 3).astype(np.float32)

        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.2)
        _, labels, centers = cv2.kmeans(
            pixels, n_colors, None, criteria, 10, cv2.KMEANS_RANDOM_CENTERS
        )

        unique_labels, counts = np.unique(labels, return_counts=True)
        total = counts.sum()

        result = []
        for label, count in zip(unique_labels, counts):
            color = tuple(int(c) for c in centers[label])
            weight = count / total
            result.append((color, float(weight)))

        result.sort(key=lambda x: x[1], reverse=True)
        return result

    def extract_contour_features(self, img: np.ndarray) -> ContourFeatures:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)

        edges = cv2.Canny(blurred, 50, 150)

        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        areas = []
        perimeters = []
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area >= self.image_config.min_contour_area:
                areas.append(area)
                perimeters.append(cv2.arcLength(cnt, True))

        total_contours = len(areas)
        avg_area = float(np.mean(areas)) if areas else 0.0
        avg_perimeter = float(np.mean(perimeters)) if perimeters else 0.0
        max_area = float(np.max(areas)) if areas else 0.0
        max_perimeter = float(np.max(perimeters)) if perimeters else 0.0

        h, w = img.shape[:2]
        total_area = h * w
        contour_density = sum(areas) / total_area if total_area > 0 else 0.0

        edge_intensity = float(edges.sum() / (edges.size * 255.0)) if edges.size > 0 else 0.0

        return ContourFeatures(
            total_contours=total_contours,
            contour_areas=areas,
            contour_perimeters=perimeters,
            avg_area=avg_area,
            avg_perimeter=avg_perimeter,
            max_area=max_area,
            max_perimeter=max_perimeter,
            contour_density=contour_density,
            edge_intensity=edge_intensity,
        )

    def extract_bubble_features(self, img: np.ndarray) -> BubbleFeatures:
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

        lower_white = np.array([0, 0, 180])
        upper_white = np.array([180, 50, 255])
        mask_white = cv2.inRange(hsv, lower_white, upper_white)

        lower_light = np.array([0, 0, 200])
        upper_light = np.array([180, 30, 255])
        mask_light = cv2.inRange(hsv, lower_light, upper_light)

        mask = cv2.bitwise_or(mask_white, mask_light)

        kernel = np.ones((3, 3), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=1)

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        bubble_areas = []
        bubble_locations = []
        h, w = img.shape[:2]
        total_area = h * w

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area > 20:
                M = cv2.moments(cnt)
                if M["m00"] > 0:
                    cx = int(M["m10"] / M["m00"])
                    cy = int(M["m01"] / M["m00"])
                    bubble_areas.append(area)
                    bubble_locations.append((cx, cy, area))

        bubble_count = len(bubble_areas)
        total_bubble_area = sum(bubble_areas)
        avg_bubble_area = total_bubble_area / bubble_count if bubble_count > 0 else 0
        max_bubble_area = max(bubble_areas) if bubble_areas else 0
        bubble_area_ratio = total_bubble_area / total_area if total_area > 0 else 0

        return BubbleFeatures(
            bubble_count=bubble_count,
            total_bubble_area=total_bubble_area,
            avg_bubble_area=avg_bubble_area,
            max_bubble_area=max_bubble_area,
            bubble_area_ratio=bubble_area_ratio,
            bubble_locations=bubble_locations,
        )

    def build_feature_vector(self, color: ColorFeatures, contour: ContourFeatures, bubble: BubbleFeatures) -> np.ndarray:
        features = []

        features.extend(list(color.avg_bgr))
        features.extend(list(color.avg_hsv))
        features.extend(list(color.avg_lab))
        features.append(color.color_contrast)
        features.append(color.brightness)

        features.append(contour.total_contours)
        features.append(contour.avg_area)
        features.append(contour.avg_perimeter)
        features.append(contour.max_area)
        features.append(contour.contour_density)
        features.append(contour.edge_intensity)

        features.append(bubble.bubble_count)
        features.append(bubble.total_bubble_area)
        features.append(bubble.avg_bubble_area)
        features.append(bubble.max_bubble_area)
        features.append(bubble.bubble_area_ratio)

        return np.array(features, dtype=np.float32)

    def extract(self, image_path: str) -> ImageFeatures:
        img = self.load_image(image_path)
        resized = self.resize_image(img)

        color_features = self.extract_color_features(resized)
        contour_features = self.extract_contour_features(resized)
        bubble_features = self.extract_bubble_features(resized)

        feature_vector = self.build_feature_vector(
            color_features, contour_features, bubble_features
        )

        h, w = img.shape[:2]

        return ImageFeatures(
            image_path=image_path,
            width=w,
            height=h,
            color=color_features,
            contour=contour_features,
            bubble=bubble_features,
            feature_vector=feature_vector,
        )


def extract_image_features(image_path: str, config=None) -> ImageFeatures:
    extractor = ImageFeatureExtractor(config)
    return extractor.extract(image_path)
