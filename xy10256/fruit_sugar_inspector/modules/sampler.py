import random
from typing import Dict, List, Any
from .config import SAMPLING_RULES


class Sampler:
    def __init__(self, seed: int = None):
        self.samples = []
        self.sampling_stats = {}
        if seed is not None:
            random.seed(seed)

    def calculate_sample_size(self, batch_size: int) -> Dict[str, Any]:
        rules = SAMPLING_RULES
        ratio_samples = int(batch_size * rules['sample_ratio'])
        sample_size = max(rules['min_sample_count'], ratio_samples)
        sample_size = min(sample_size, batch_size)
        
        return {
            'batch_size': batch_size,
            'sample_size': sample_size,
            'sample_ratio': sample_size / batch_size if batch_size > 0 else 0,
            'meets_min_requirement': sample_size >= rules['min_sample_count'],
            'meets_recommended': sample_size >= rules['recommended_sample_count'],
            'min_required': rules['min_sample_count'],
            'recommended': rules['recommended_sample_count']
        }

    def select_samples(self, measurements: List[Dict[str, Any]], sample_size: int, 
                       strategy: str = 'random') -> List[Dict[str, Any]]:
        if len(measurements) < sample_size:
            sample_size = len(measurements)
        
        if strategy == 'random':
            self.samples = random.sample(measurements, sample_size)
        elif strategy == 'stratified':
            self.samples = self._stratified_sampling(measurements, sample_size)
        else:
            self.samples = random.sample(measurements, sample_size)
        
        return self.samples

    def _stratified_sampling(self, measurements: List[Dict[str, Any]], sample_size: int) -> List[Dict[str, Any]]:
        sugars = [m['sugar'] for m in measurements]
        min_sugar = min(sugars)
        max_sugar = max(sugars)
        range_size = (max_sugar - min_sugar) / 3 if max_sugar > min_sugar else 1
        
        strata = {
            'low': [m for m in measurements if m['sugar'] < min_sugar + range_size],
            'medium': [m for m in measurements if min_sugar + range_size <= m['sugar'] < min_sugar + 2 * range_size],
            'high': [m for m in measurements if m['sugar'] >= min_sugar + 2 * range_size]
        }
        
        per_stratum = sample_size // 3
        samples = []
        for name, items in strata.items():
            if len(items) <= per_stratum:
                samples.extend(items)
            else:
                samples.extend(random.sample(items, per_stratum))
        
        remaining = sample_size - len(samples)
        if remaining > 0:
            all_items = [m for m in measurements if m not in samples]
            if all_items:
                samples.extend(random.sample(all_items, min(remaining, len(all_items))))
        
        return samples

    def get_sampling_stats(self) -> Dict[str, Any]:
        if not self.samples:
            return {}
        
        sugars = [s['sugar'] for s in self.samples]
        return {
            'sample_count': len(self.samples),
            'sugar_min': min(sugars),
            'sugar_max': max(sugars),
            'sugar_avg': sum(sugars) / len(sugars),
            'sugar_variance': self._calculate_variance(sugars),
            'sample_ids': [s.get('id', 'N/A') for s in self.samples]
        }

    def _calculate_variance(self, data: List[float]) -> float:
        if len(data) < 2:
            return 0.0
        mean = sum(data) / len(data)
        return sum((x - mean) ** 2 for x in data) / (len(data) - 1)
