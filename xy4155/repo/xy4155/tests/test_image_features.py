import os
import tempfile
import pytest
import numpy as np
from pathlib import Path
from unittest.mock import patch, MagicMock

import cv2

from lens_inspector.image_features import ImageFeatureExtractor
from lens_inspector.models import DefectType


class TestImageFeatureExtractor:
    def test_init_default_values(self):
        extractor = ImageFeatureExtractor()
        assert extractor.resize_max_dim == 1024
        assert extractor.sharpness_threshold == 100.0

    def test_init_custom_values(self):
        extractor = ImageFeatureExtractor(
            resize_max_dim=2048,
            sharpness_threshold=200.0,
        )
        assert extractor.resize_max_dim == 2048
        assert extractor.sharpness_threshold == 200.0

    def test_load_and_preprocess_with_valid_image(self, tmp_path):
        test_image = np.random.randint(0, 256, (500, 600, 3), dtype=np.uint8)
        image_path = tmp_path / "test.jpg"
        cv2.imwrite(str(image_path), cv2.cvtColor(test_image, cv2.COLOR_RGB2BGR))

        extractor = ImageFeatureExtractor()
        rgb, gray = extractor.load_and_preprocess(str(image_path))

        assert rgb.shape == (500, 600, 3)
        assert gray.shape == (500, 600)

    def test_load_and_preprocess_resize_large_image(self, tmp_path):
        large_image = np.random.randint(0, 256, (2000, 3000, 3), dtype=np.uint8)
        image_path = tmp_path / "large_test.jpg"
        cv2.imwrite(str(image_path), cv2.cvtColor(large_image, cv2.COLOR_RGB2BGR))

        extractor = ImageFeatureExtractor(resize_max_dim=1024)
        rgb, gray = extractor.load_and_preprocess(str(image_path))

        assert max(rgb.shape[:2]) <= 1024
        assert max(gray.shape[:2]) <= 1024

    def test_extract_sharpness_blurry_image(self):
        blurry = np.ones((100, 100), dtype=np.uint8) * 128

        extractor = ImageFeatureExtractor()
        sharpness, score = extractor.extract_sharpness(blurry)

        assert sharpness >= 0
        assert 0 <= score <= 1

    def test_extract_dark_corner_uniform_image(self):
        uniform = np.ones((100, 100), dtype=np.uint8) * 200

        extractor = ImageFeatureExtractor()
        score = extractor.extract_dark_corner(uniform)

        assert 0 <= score <= 1

    def test_extract_color_shift_white_balance(self):
        white_image = np.ones((100, 100, 3), dtype=np.uint8) * 200

        extractor = ImageFeatureExtractor()
        r_shift, g_shift, b_shift, score = extractor.extract_color_shift(white_image)

        assert r_shift >= 0
        assert g_shift >= 0
        assert b_shift >= 0
        assert 0 <= score <= 1

    def test_extract_color_shift_red_tinted(self):
        tinted = np.zeros((100, 100, 3), dtype=np.uint8)
        tinted[:, :, 0] = 200
        tinted[:, :, 1] = 100
        tinted[:, :, 2] = 100

        extractor = ImageFeatureExtractor()
        r_shift, g_shift, b_shift, score = extractor.extract_color_shift(tinted)

        assert score > 0.1

    def test_detect_dead_and_hot_pixels_clean(self):
        clean = np.ones((100, 100), dtype=np.uint8) * 128

        extractor = ImageFeatureExtractor()
        dead_count, dead_heat, hot_count, hot_heat = extractor.detect_dead_and_hot_pixels(clean)

        assert dead_count == 0
        assert hot_count == 0

    def test_detect_dead_and_hot_pixels_with_defects(self):
        test_image = np.ones((100, 100), dtype=np.uint8) * 128

        test_image[50:52, 50:52] = 0
        test_image[60:62, 60:62] = 255

        extractor = ImageFeatureExtractor(
            dead_pixel_threshold=10.0,
            hot_pixel_threshold=245.0,
        )
        dead_count, dead_heat, hot_count, hot_heat = extractor.detect_dead_and_hot_pixels(test_image)

        assert dead_count > 0
        assert hot_count > 0

    def test_extract_brightness_and_contrast(self):
        gray = np.random.randint(50, 200, (100, 100), dtype=np.uint8)

        extractor = ImageFeatureExtractor()
        mean, std, contrast, normalized = extractor.extract_brightness_and_contrast(gray)

        assert 0 <= mean <= 255
        assert std >= 0
        assert contrast >= 0

    def test_extract_noise_level(self):
        clean = np.ones((100, 100), dtype=np.uint8) * 128
        noisy = clean + np.random.randint(-20, 20, (100, 100), dtype=np.int16)
        noisy = np.clip(noisy, 0, 255).astype(np.uint8)

        extractor = ImageFeatureExtractor()
        clean_noise = extractor.extract_noise_level(clean)
        noisy_noise = extractor.extract_noise_level(noisy)

        assert noisy_noise > clean_noise

    def test_extract_edge_intensity(self):
        flat = np.ones((100, 100), dtype=np.uint8) * 128
        edgy = flat.copy()
        edgy[50:, :] = 200

        extractor = ImageFeatureExtractor()
        flat_edges = extractor.extract_edge_intensity(flat)
        edgy_edges = extractor.extract_edge_intensity(edgy)

        assert edgy_edges > flat_edges

    def test_extract_all_features_creates_defects(self, tmp_path):
        test_image = np.random.randint(0, 256, (100, 100, 3), dtype=np.uint8)
        image_path = tmp_path / "test.jpg"
        cv2.imwrite(str(image_path), cv2.cvtColor(test_image, cv2.COLOR_RGB2BGR))

        extractor = ImageFeatureExtractor()
        features, defects = extractor.extract_all_features(str(image_path), "test_id")

        assert features.image_id == "test_id"
        assert isinstance(defects, list)
