import json
import random
from typing import Dict, List, Any

NOISE_KEYWORD_MAPPING = {
    '轴承故障': ['轴承', '磨损', '疲劳', '剥落', '裂纹'],
    '叶轮失衡': ['叶轮', '失衡', '震动', '抖动', '摆动'],
    '气蚀': ['气蚀', '气泡', '空化', '噪音', '嘶嘶'],
    '密封泄漏': ['密封', '泄漏', '滴水', '漏水'],
    '电机故障': ['电机', '线圈', '绝缘', '过载'],
    '管道共振': ['管道', '共振', '共鸣', '敲击'],
    '正常运行': ['正常', '平稳', '无异响', '良好']
}

FEATURE_RANGES = {
    '正常运行': {'rms': (0.02, 0.08), 'peak_freq': (50, 200), 'centroid': (100, 300), 'harmonic': (0.85, 0.98)},
    '轴承故障': {'rms': (0.15, 0.5), 'peak_freq': (2000, 5000), 'centroid': (800, 2000), 'harmonic': (0.3, 0.6)},
    '叶轮失衡': {'rms': (0.1, 0.35), 'peak_freq': (100, 500), 'centroid': (200, 600), 'harmonic': (0.5, 0.8)},
    '气蚀': {'rms': (0.08, 0.25), 'peak_freq': (5000, 15000), 'centroid': (2000, 6000), 'harmonic': (0.1, 0.4)},
    '密封泄漏': {'rms': (0.05, 0.15), 'peak_freq': (1000, 3000), 'centroid': (1000, 2500), 'harmonic': (0.4, 0.7)},
    '电机故障': {'rms': (0.2, 0.45), 'peak_freq': (100, 1000), 'centroid': (300, 1200), 'harmonic': (0.3, 0.7)},
    '管道共振': {'rms': (0.1, 0.3), 'peak_freq': (50, 300), 'centroid': (100, 500), 'harmonic': (0.6, 0.85)}
}

class AcousticFeatureExtractor:
    def __init__(self):
        self.extraction_method = "text_keyword_based_placeholder"
    
    def extract(self, noise_description: str, record_id: str) -> Dict[str, Any]:
        matched_types = self._match_noise_types(noise_description)
        
        if matched_types:
            primary_type = matched_types[0]
            features = self._generate_features_for_type(primary_type)
        else:
            primary_type = '正常运行'
            features = self._generate_features_for_type('正常运行')
        
        feature_vector = self._create_feature_vector(features)
        
        return {
            'record_id': record_id,
            'rms_level': round(features['rms'], 4),
            'peak_frequency': round(features['peak_freq'], 2),
            'spectral_centroid': round(features['centroid'], 2),
            'harmonic_ratio': round(features['harmonic'], 4),
            'noise_type_keywords': json.dumps(matched_types, ensure_ascii=False),
            'feature_vector': json.dumps(feature_vector),
            'extraction_method': self.extraction_method
        }
    
    def _match_noise_types(self, description: str) -> List[str]:
        matched = []
        for noise_type, keywords in NOISE_KEYWORD_MAPPING.items():
            for keyword in keywords:
                if keyword in description:
                    matched.append(noise_type)
                    break
        return matched if matched else ['正常运行']
    
    def _generate_features_for_type(self, noise_type: str) -> Dict[str, float]:
        ranges = FEATURE_RANGES.get(noise_type, FEATURE_RANGES['正常运行'])
        return {
            'rms': random.uniform(*ranges['rms']),
            'peak_freq': random.uniform(*ranges['peak_freq']),
            'centroid': random.uniform(*ranges['centroid']),
            'harmonic': random.uniform(*ranges['harmonic'])
        }
    
    def _create_feature_vector(self, features: Dict[str, float]) -> List[float]:
        return [
            features['rms'],
            features['peak_freq'] / 15000,
            features['centroid'] / 6000,
            features['harmonic']
        ]
