import numpy as np
from typing import Dict, Tuple, Optional
from config import Config

class MicroplasticClassifier:
    FEATURE_COLUMNS = [
        'area', 'perimeter', 'aspect_ratio', 'circularity',
        'solidity', 'extent', 'mean_intensity'
    ]
    
    THRESHOLDS = {
        'fiber': {
            'aspect_ratio_min': 3.0,
            'circularity_max': 0.4,
            'solidity_max': 0.85
        },
        'bubble': {
            'circularity_min': 0.85,
            'solidity_min': 0.9,
            'mean_intensity_min': 150
        },
        'scratch': {
            'aspect_ratio_min': 5.0,
            'circularity_max': 0.2,
            'solidity_max': 0.7
        }
    }
    
    @classmethod
    def classify(cls, features: Dict) -> Tuple[str, float]:
        if not features:
            return 'unclear', 0.0
        
        aspect_ratio = features.get('aspect_ratio', 1.0) or 1.0
        circularity = features.get('circularity', 0.5) or 0.5
        solidity = features.get('solidity', 0.5) or 0.5
        mean_intensity = features.get('mean_intensity', 100) or 100
        
        scores = cls._calculate_scores(aspect_ratio, circularity, solidity, mean_intensity)
        
        best_class = max(scores, key=scores.get)
        best_score = scores[best_class]
        
        if best_score < 0.3:
            return 'unclear', 0.3
        
        confidence = min(best_score, 0.95)
        
        return best_class, confidence
    
    @classmethod
    def _calculate_scores(cls, aspect_ratio: float, circularity: float, 
                         solidity: float, mean_intensity: float) -> Dict[str, float]:
        scores = {}
        
        fiber_score = cls._calculate_fiber_score(aspect_ratio, circularity, solidity)
        bubble_score = cls._calculate_bubble_score(circularity, solidity, mean_intensity)
        scratch_score = cls._calculate_scratch_score(aspect_ratio, circularity, solidity)
        particle_score = cls._calculate_particle_score(fiber_score, bubble_score, scratch_score)
        unclear_score = 0.3
        
        scores['fiber'] = fiber_score
        scores['bubble'] = bubble_score
        scores['scratch'] = scratch_score
        scores['particle'] = particle_score
        scores['unclear'] = unclear_score
        
        return scores
    
    @classmethod
    def _calculate_fiber_score(cls, aspect_ratio: float, circularity: float, solidity: float) -> float:
        score = 0.0
        
        if aspect_ratio > cls.THRESHOLDS['fiber']['aspect_ratio_min']:
            ar_score = min((aspect_ratio - 3.0) / 7.0, 0.4)
            score += ar_score
        
        if circularity < cls.THRESHOLDS['fiber']['circularity_max']:
            circ_score = (0.4 - circularity) / 0.4 * 0.3
            score += circ_score
        
        if solidity < cls.THRESHOLDS['fiber']['solidity_max']:
            sol_score = (0.85 - solidity) / 0.85 * 0.3
            score += sol_score
        
        return score
    
    @classmethod
    def _calculate_bubble_score(cls, circularity: float, solidity: float, mean_intensity: float) -> float:
        score = 0.0
        
        if circularity > cls.THRESHOLDS['bubble']['circularity_min']:
            circ_score = min((circularity - 0.85) / 0.15, 0.4)
            score += circ_score
        
        if solidity > cls.THRESHOLDS['bubble']['solidity_min']:
            sol_score = min((solidity - 0.9) / 0.1, 0.3)
            score += sol_score
        
        if mean_intensity > cls.THRESHOLDS['bubble']['mean_intensity_min']:
            int_score = min((mean_intensity - 150) / 100, 0.3)
            score += int_score
        
        return score
    
    @classmethod
    def _calculate_scratch_score(cls, aspect_ratio: float, circularity: float, solidity: float) -> float:
        score = 0.0
        
        if aspect_ratio > cls.THRESHOLDS['scratch']['aspect_ratio_min']:
            ar_score = min((aspect_ratio - 5.0) / 10.0, 0.4)
            score += ar_score
        
        if circularity < cls.THRESHOLDS['scratch']['circularity_max']:
            circ_score = (0.2 - circularity) / 0.2 * 0.3
            score += circ_score
        
        if solidity < cls.THRESHOLDS['scratch']['solidity_max']:
            sol_score = (0.7 - solidity) / 0.7 * 0.3
            score += sol_score
        
        return score
    
    @classmethod
    def _calculate_particle_score(cls, fiber_score: float, bubble_score: float, 
                                   scratch_score: float) -> float:
        max_other = max(fiber_score, bubble_score, scratch_score)
        if max_other < 0.4:
            return 0.5 + (0.5 - max_other) * 0.5
        return max(0.1, 0.5 - max_other * 0.5)
    
    @classmethod
    def assess_risk(cls, classification: str, features: Dict) -> str:
        if classification == 'fiber':
            return 'high'
        elif classification == 'particle':
            area = features.get('area', 0)
            if area and area > 1000:
                return 'medium'
            return 'low'
        elif classification in ['bubble', 'scratch']:
            return 'low'
        else:
            return 'medium'
    
    @classmethod
    def get_classification_label(cls, class_name: str) -> str:
        return Config.CLASSIFICATION_LABELS.get(class_name, class_name)
    
    @classmethod
    def get_risk_label(cls, risk_level: str) -> str:
        return Config.RISK_LEVELS.get(risk_level, risk_level)
