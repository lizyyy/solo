from datetime import datetime
from typing import Dict

from graders.config import COLOR_CATEGORIES, RULE_CONFIG
from graders.models import Sample, ExtractedFeatures, AreaFeature, ColorFeature


class ColorExtractor:
    COLOR_RGB_MAP = {
        "褐色": {"r": 139, "g": 69, "b": 19},
        "黄褐色": {"r": 194, "g": 140, "b": 88},
        "黄色": {"r": 255, "g": 215, "b": 0},
        "浅褐色": {"r": 199, "g": 129, "b": 96},
        "枯黄": {"r": 218, "g": 165, "b": 32},
        "正常绿色": {"r": 34, "g": 139, "b": 34},
    }
    
    @staticmethod
    def _rgb_to_hsv(r: float, g: float, b: float) -> tuple:
        r_norm, g_norm, b_norm = r / 255.0, g / 255.0, b / 255.0
        
        max_val = max(r_norm, g_norm, b_norm)
        min_val = min(r_norm, g_norm, b_norm)
        delta = max_val - min_val
        
        h = 0.0
        if delta != 0:
            if max_val == r_norm:
                h = 60 * (((g_norm - b_norm) / delta) + 0)
            elif max_val == g_norm:
                h = 60 * (((b_norm - r_norm) / delta) + 2)
            elif max_val == b_norm:
                h = 60 * (((r_norm - g_norm) / delta) + 4)
        
        if h < 0:
            h += 360
        
        s = delta / max_val if max_val != 0 else 0
        v = max_val
        
        return h, s, v
    
    @classmethod
    def extract(cls, color_name: str) -> ColorFeature:
        if color_name not in cls.COLOR_RGB_MAP:
            color_name = "褐色"
        
        rgb = cls.COLOR_RGB_MAP[color_name]
        h, s, v = cls._rgb_to_hsv(rgb["r"], rgb["g"], rgb["b"])
        
        brown_index = 0.0
        yellow_index = 0.0
        
        if color_name in ["褐色", "浅褐色"]:
            brown_index = 0.8 + (0.2 if color_name == "褐色" else 0.1)
            yellow_index = 0.2
        elif color_name == "黄褐色":
            brown_index = 0.5
            yellow_index = 0.6
        elif color_name == "黄色":
            brown_index = 0.1
            yellow_index = 0.9
        elif color_name == "枯黄":
            brown_index = 0.3
            yellow_index = 0.7
        else:
            brown_index = 0.4
            yellow_index = 0.3
        
        return ColorFeature(
            r=rgb["r"], g=rgb["g"], b=rgb["b"],
            h=h, s=s, v=v,
            color_category=color_name,
            brown_index=brown_index,
            yellow_index=yellow_index
        )


class AreaExtractor:
    @staticmethod
    def extract(lesion_area_cm2: float, leaf_area_cm2: float) -> AreaFeature:
        if leaf_area_cm2 == 0:
            return AreaFeature(
                lesion_area_cm2=lesion_area_cm2,
                leaf_area_cm2=leaf_area_cm2,
                lesion_ratio=0.0
            )
        
        lesion_ratio = min(lesion_area_cm2 / leaf_area_cm2, 1.0)
        
        return AreaFeature(
            lesion_area_cm2=lesion_area_cm2,
            leaf_area_cm2=leaf_area_cm2,
            lesion_ratio=lesion_ratio
        )


class FeatureExtractor:
    @staticmethod
    def extract(sample: Sample) -> ExtractedFeatures:
        area_features = AreaExtractor.extract(
            sample.lesion_area_cm2,
            sample.leaf_area_cm2
        )
        
        color_features = ColorExtractor.extract(
            sample.lesion_color
        )
        
        return ExtractedFeatures(
            sample_id=sample.sample_id,
            area_features=area_features,
            color_features=color_features,
            extracted_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        )
