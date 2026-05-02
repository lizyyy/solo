
from typing import Dict, List, Tuple
from data_loader import Colony, SampleImage


class RuleValidator:
    def __init__(self, rules: Dict):
        self.rules = rules
        self.min_confidence = rules.get('min_confidence', 0.5)
        self.min_size = rules.get('min_size', 10)
        self.max_size = rules.get('max_size', 1000)
        self.max_overlap = rules.get('max_overlap', 0.7)
    
    def validate_colony(self, colony: Colony) -&gt; Tuple[bool, List[str]]:
        issues = []
        valid = True
        
        if colony.confidence &lt; self.min_confidence:
            issues.append(f"低置信度: {colony.confidence:.2f} &lt; {self.min_confidence}")
            valid = False
        
        size = colony.width * colony.height
        if size &lt; self.min_size * self.min_size:
            issues.append(f"尺寸过小: {size} &lt; {self.min_size}^2")
            valid = False
        
        if size &gt; self.max_size * self.max_size:
            issues.append(f"尺寸过大: {size} &gt; {self.max_size}^2")
            valid = False
        
        return valid, issues
    
    def check_overlap(self, colonies: List[Colony]) -&gt; List[Tuple[str, str, float]]:
        overlaps = []
        for i, c1 in enumerate(colonies):
            for j, c2 in enumerate(colonies[i+1:], i+1):
                iou = self._calculate_iou(c1, c2)
                if iou &gt; self.max_overlap:
                    overlaps.append((c1.colony_id, c2.colony_id, iou))
        return overlaps
    
    def _calculate_iou(self, c1: Colony, c2: Colony) -&gt; float:
        x1 = max(c1.x, c2.x)
        y1 = max(c1.y, c2.y)
        x2 = min(c1.x + c1.width, c2.x + c2.width)
        y2 = min(c1.y + c1.height, c2.y + c2.height)
        
        if x2 &lt;= x1 or y2 &lt;= y1:
            return 0.0
        
        intersection = (x2 - x1) * (y2 - y1)
        area1 = c1.width * c1.height
        area2 = c2.width * c2.height
        union = area1 + area2 - intersection
        
        return intersection / union if union &gt; 0 else 0.0
    
    def validate_image(self, sample_image: SampleImage) -&gt; Dict:
        results = {
            'valid_colonies': [],
            'invalid_colonies': [],
            'overlaps': [],
            'total_colonies': len(sample_image.colonies)
        }
        
        for colony in sample_image.colonies:
            valid, issues = self.validate_colony(colony)
            if valid:
                results['valid_colonies'].append(colony.colony_id)
            else:
                results['invalid_colonies'].append((colony.colony_id, issues))
        
        results['overlaps'] = self.check_overlap(sample_image.colonies)
        
        return results

