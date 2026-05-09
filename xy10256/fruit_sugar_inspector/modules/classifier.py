from typing import Dict, List, Any
from collections import Counter
from .config import GRADE_STANDARDS, SAMPLING_RULES


class Classifier:
    def __init__(self):
        self.classification_results = []
        self.grade_distribution = {}
        self.batch_grade = None

    def classify_sample(self, sample: Dict[str, Any], fruit_type: str) -> Dict[str, Any]:
        standards = GRADE_STANDARDS.get(fruit_type)
        if not standards:
            raise ValueError(f"未知水果类型: {fruit_type}")
        
        sugar = sample.get('sugar', 0)
        valid_range = standards['valid_range']
        
        is_valid = valid_range['min'] <= sugar <= valid_range['max']
        
        grade = None
        for grade_name, criteria in standards['grades'].items():
            min_sugar = criteria.get('min_sugar')
            max_sugar = criteria.get('max_sugar')
            
            if min_sugar is None and max_sugar is not None:
                if sugar < max_sugar:
                    grade = grade_name
                    break
            elif max_sugar is None and min_sugar is not None:
                if sugar >= min_sugar:
                    grade = grade_name
                    break
            elif min_sugar is not None and max_sugar is not None:
                if min_sugar <= sugar < max_sugar:
                    grade = grade_name
                    break
        
        return {
            'sample_id': sample.get('id', 'N/A'),
            'sugar': sugar,
            'grade': grade,
            'is_valid': is_valid,
            'near_boundary': self._is_near_boundary(sugar, standards),
            'original_sample': sample
        }

    def classify_all_samples(self, samples: List[Dict[str, Any]], fruit_type: str) -> List[Dict[str, Any]]:
        self.classification_results = [
            self.classify_sample(sample, fruit_type) for sample in samples
        ]
        return self.classification_results

    def _is_near_boundary(self, sugar: float, standards: Dict[str, Any]) -> Dict[str, Any]:
        boundaries = []
        for grade_name, criteria in standards['grades'].items():
            min_sugar = criteria.get('min_sugar')
            max_sugar = criteria.get('max_sugar')
            
            if min_sugar is not None:
                boundaries.append({'value': min_sugar, 'type': 'min', 'grade': grade_name})
            if max_sugar is not None:
                boundaries.append({'value': max_sugar, 'type': 'max', 'grade': grade_name})
        
        threshold = 0.3
        near_boundaries = []
        for b in boundaries:
            diff = abs(sugar - b['value'])
            if diff <= threshold:
                near_boundaries.append({
                    'boundary_value': b['value'],
                    'boundary_type': b['type'],
                    'adjacent_grade': b['grade'],
                    'distance': diff
                })
        
        return {
            'is_near': len(near_boundaries) > 0,
            'near_boundaries': near_boundaries
        }

    def determine_batch_grade(self) -> Dict[str, Any]:
        if not self.classification_results:
            return {'batch_grade': None, 'confidence': 0, 'distribution': {}}
        
        grades = [r['grade'] for r in self.classification_results if r['grade'] is not None]
        if not grades:
            return {'batch_grade': None, 'confidence': 0, 'distribution': {}}
        
        grade_count = Counter(grades)
        total = len(grades)
        self.grade_distribution = {
            grade: {'count': count, 'percentage': count / total} 
            for grade, count in grade_count.items()
        }
        
        grade_order = ['特级', '一级', '二级', '等外']
        sorted_grades = sorted(
            self.grade_distribution.items(),
            key=lambda x: grade_order.index(x[0]) if x[0] in grade_order else 99
        )
        
        primary_grade = max(self.grade_distribution.items(), key=lambda x: x[1]['percentage'])[0]
        primary_percentage = self.grade_distribution[primary_grade]['percentage']
        confidence = self._calculate_confidence(primary_percentage, total)
        
        self.batch_grade = {
            'batch_grade': primary_grade,
            'confidence': confidence,
            'distribution': self.grade_distribution,
            'total_samples': total
        }
        
        return self.batch_grade

    def _calculate_confidence(self, primary_percentage: float, sample_size: int) -> float:
        import math
        
        if sample_size < 10:
            return 0.5
        
        margin_of_error = 1.96 * math.sqrt(
            (primary_percentage * (1 - primary_percentage)) / sample_size
        )
        
        confidence = 1 - margin_of_error
        confidence = max(0.5, min(0.99, confidence))
        
        return confidence
