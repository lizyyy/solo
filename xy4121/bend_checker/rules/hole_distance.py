from dataclasses import dataclass
from typing import List, Dict, Optional, Tuple
from enum import Enum

from bend_checker.models.part import Part, Bend, Hole, HoleType


class HoleRiskLevel(Enum):
    SAFE = "safe"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class HoleDistanceIssue:
    hole_id: str
    risk_level: HoleRiskLevel
    description: str
    distance_to_bend: float
    minimum_required: float
    bend_id: Optional[str]
    suggestion: str


@dataclass
class HoleDistanceResult:
    part_number: str
    has_risks: bool
    issues: List[HoleDistanceIssue]
    safe_holes: int
    at_risk_holes: int
    recommendations: List[str]


class HoleDistanceChecker:
    
    @staticmethod
    def check_all(
        part: Part,
        custom_min_distances: Optional[Dict[str, float]] = None
    ) -> HoleDistanceResult:
        issues: List[HoleDistanceIssue] = []
        recommendations: List[str] = []
        
        for hole in part.holes:
            min_distance = HoleDistanceChecker._calculate_minimum_distance(
                hole, part.material_thickness, custom_min_distances
            )
            
            nearest_bend_info = HoleDistanceChecker._find_nearest_bend(
                hole, part.bends, part.material_thickness
            )
            
            if nearest_bend_info:
                distance = nearest_bend_info['distance']
                nearest_bend = nearest_bend_info['bend']
                
                hole.distance_to_nearest_bend = distance
                
                if distance < min_distance:
                    risk_level = HoleDistanceChecker._determine_risk_level(
                        distance, min_distance, part.material_thickness
                    )
                    
                    description = (
                        f"孔 {hole.id} 距离折弯 {nearest_bend.id} 仅 {distance:.2f}mm，"
                        f"最小要求 {min_distance:.2f}mm"
                    )
                    
                    suggestion = HoleDistanceChecker._generate_suggestion(
                        hole, nearest_bend, distance, min_distance, risk_level
                    )
                    
                    issues.append(HoleDistanceIssue(
                        hole_id=hole.id,
                        risk_level=risk_level,
                        description=description,
                        distance_to_bend=distance,
                        minimum_required=min_distance,
                        bend_id=nearest_bend.id,
                        suggestion=suggestion
                    ))
                    
                    if risk_level == HoleRiskLevel.CRITICAL:
                        recommendations.append(
                            f"紧急: 孔 {hole.id} 位置过近，建议重新设计"
                        )
        
        at_risk_count = len(issues)
        safe_count = len(part.holes) - at_risk_count
        
        if at_risk_count > 0:
            recommendations.append(
                f"共发现 {at_risk_count} 个孔存在边距风险，建议在折弯前核实"
            )
        
        return HoleDistanceResult(
            part_number=part.part_number,
            has_risks=len(issues) > 0,
            issues=issues,
            safe_holes=safe_count,
            at_risk_holes=at_risk_count,
            recommendations=recommendations
        )
    
    @staticmethod
    def _calculate_minimum_distance(
        hole: Hole,
        material_thickness: float,
        custom_rules: Optional[Dict[str, float]] = None
    ) -> float:
        if custom_rules and hole.id in custom_rules:
            return custom_rules[hole.id]
        
        base_multiplier = 2.0
        
        if hole.hole_type == HoleType.CIRCULAR:
            if hole.diameter:
                if hole.diameter > material_thickness * 3:
                    base_multiplier = 2.5
                elif hole.diameter < material_thickness:
                    base_multiplier = 1.5
        elif hole.hole_type == HoleType.SLOTTED:
            base_multiplier = 2.5
        
        return material_thickness * base_multiplier
    
    @staticmethod
    def _find_nearest_bend(
        hole: Hole,
        bends: List[Bend],
        material_thickness: float
    ) -> Optional[Dict]:
        if not bends:
            return None
        
        nearest = None
        min_distance = float('inf')
        
        for bend in bends:
            if hole.distance_to_nearest_bend is not None:
                distance = hole.distance_to_nearest_bend
            else:
                distance = HoleDistanceChecker._estimate_distance(
                    hole, bend, material_thickness
                )
            
            if distance < min_distance:
                min_distance = distance
                nearest = {'bend': bend, 'distance': distance}
        
        return nearest
    
    @staticmethod
    def _estimate_distance(
        hole: Hole,
        bend: Bend,
        material_thickness: float
    ) -> float:
        return max(
            bend.flange_length - material_thickness,
            material_thickness * 1.5
        )
    
    @staticmethod
    def _determine_risk_level(
        actual: float,
        required: float,
        thickness: float
    ) -> HoleRiskLevel:
        ratio = actual / required
        
        if ratio >= 1.0:
            return HoleRiskLevel.SAFE
        elif ratio >= 0.7:
            return HoleRiskLevel.WARNING
        else:
            return HoleRiskLevel.CRITICAL
    
    @staticmethod
    def _generate_suggestion(
        hole: Hole,
        bend: Bend,
        actual: float,
        required: float,
        risk_level: HoleRiskLevel
    ) -> str:
        if risk_level == HoleRiskLevel.CRITICAL:
            return (
                f"孔边距严重不足，建议：1) 移动孔位置至少 {required:.1f}mm；"
                f"2) 或更改工艺为先折弯后冲孔；3) 或扩大折弯半径"
            )
        elif risk_level == HoleRiskLevel.WARNING:
            return (
                f"孔边距偏近，建议：1) 实际生产前试折验证；"
                f"2) 注意控制折弯力；3) 如允许，调整孔位置 {required - actual:.1f}mm"
            )
        else:
            return "边距符合要求"
    
    @staticmethod
    def check_single_hole(
        hole: Hole,
        bends: List[Bend],
        material_thickness: float
    ) -> Dict:
        min_distance = HoleDistanceChecker._calculate_minimum_distance(hole, material_thickness)
        nearest = HoleDistanceChecker._find_nearest_bend(hole, bends, material_thickness)
        
        if not nearest:
            return {
                'hole_id': hole.id,
                'status': 'no_adjacent_bends',
                'nearest_bend': None,
                'distance': None,
                'minimum_required': min_distance,
                'risk_level': 'safe'
            }
        
        distance = nearest['distance']
        risk = HoleDistanceChecker._determine_risk_level(distance, min_distance, material_thickness)
        
        return {
            'hole_id': hole.id,
            'status': 'checked',
            'nearest_bend': nearest['bend'].id,
            'distance': round(distance, 2),
            'minimum_required': round(min_distance, 2),
            'risk_level': risk.value,
            'deviation': round(distance - min_distance, 2)
        }
    
    @staticmethod
    def get_hole_summary(part: Part) -> Dict:
        hole_types = {}
        total_holes = len(part.holes)
        
        for hole in part.holes:
            hole_type = hole.hole_type.value
            if hole_type not in hole_types:
                hole_types[hole_type] = 0
            hole_types[hole_type] += 1
        
        return {
            'part_number': part.part_number,
            'total_holes': total_holes,
            'by_type': hole_types,
            'holes_with_defined_distance': sum(
                1 for h in part.holes if h.distance_to_nearest_bend is not None
            )
        }
