from dataclasses import dataclass
from typing import List, Tuple, Optional
from enum import Enum


class DefectSeverity(Enum):
    MINOR = "minor"
    MEDIUM = "medium"
    MAJOR = "major"
    CRITICAL = "critical"


@dataclass
class DefectZone:
    id: str
    x_mm: float
    y_mm: float
    width_mm: float
    height_mm: float
    severity: DefectSeverity
    description: str = ""
    
    def contains(self, x: float, y: float, width: float, height: float) -> bool:
        return not (
            x + width <= self.x_mm or
            x >= self.x_mm + self.width_mm or
            y + height <= self.y_mm or
            y >= self.y_mm + self.height_mm
        )
    
    def get_overlap_area(self, x: float, y: float, width: float, height: float) -> float:
        overlap_x1 = max(x, self.x_mm)
        overlap_y1 = max(y, self.y_mm)
        overlap_x2 = min(x + width, self.x_mm + self.width_mm)
        overlap_y2 = min(y + height, self.y_mm + self.height_mm)
        
        if overlap_x2 > overlap_x1 and overlap_y2 > overlap_y1:
            return (overlap_x2 - overlap_x1) * (overlap_y2 - overlap_y1)
        return 0.0


class DefectAvoider:
    SEVERITY_WEIGHTS = {
        DefectSeverity.MINOR: 1,
        DefectSeverity.MEDIUM: 3,
        DefectSeverity.MAJOR: 5,
        DefectSeverity.CRITICAL: 10,
    }
    
    def __init__(self, defects: List[DefectZone]):
        self.defects = defects
    
    def check_placement(self, x: float, y: float, width: float, height: float) -> Tuple[bool, List[Tuple[DefectZone, float]]]:
        overlapping = []
        for defect in self.defects:
            overlap_area = defect.get_overlap_area(x, y, width, height)
            if overlap_area > 0:
                overlapping.append((defect, overlap_area))
        
        return len(overlapping) == 0, overlapping
    
    def calculate_defect_penalty(self, x: float, y: float, width: float, height: float) -> float:
        penalty = 0.0
        for defect in self.defects:
            overlap_area = defect.get_overlap_area(x, y, width, height)
            if overlap_area > 0:
                piece_area = width * height
                overlap_ratio = overlap_area / piece_area
                weight = self.SEVERITY_WEIGHTS.get(defect.severity, 1)
                penalty += overlap_ratio * weight
        return penalty
    
    def find_valid_positions(self, width: float, height: float, fabric_width: float, fabric_length: float, existing_pieces: List[dict]) -> List[dict]:
        valid_positions = []
        
        y = 0
        while y + height <= fabric_length:
            x = 0
            while x + width <= fabric_width:
                no_defect, _ = self.check_placement(x, y, width, height)
                no_overlap = self._check_no_overlap(x, y, width, height, existing_pieces)
                
                if no_defect and no_overlap:
                    penalty = self.calculate_defect_penalty(x, y, width, height)
                    valid_positions.append({
                        'x': x,
                        'y': y,
                        'penalty': penalty
                    })
                
                x += 10
            y += 10
        
        valid_positions.sort(key=lambda p: (p['penalty'], p['y'], p['x']))
        return valid_positions
    
    def _check_no_overlap(self, x: float, y: float, width: float, height: float, existing_pieces: List[dict]) -> bool:
        for piece in existing_pieces:
            px = piece['x']
            py = piece['y']
            pw = piece['width']
            ph = piece['height']
            
            if not (
                x + width <= px or
                x >= px + pw or
                y + height <= py or
                y >= py + ph
            ):
                return False
        return True
    
    def get_all_defects(self) -> List[DefectZone]:
        return self.defects
    
    def get_defects_by_severity(self, severity: DefectSeverity) -> List[DefectZone]:
        return [d for d in self.defects if d.severity == severity]
