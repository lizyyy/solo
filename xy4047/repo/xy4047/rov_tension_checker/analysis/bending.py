"""弯曲半径计算模块"""

import math
from dataclasses import dataclass
from typing import List, Optional

from rov_tension_checker.analysis.catenary import (
    CatenaryPoint,
    CatenaryResult,
)
from rov_tension_checker.config.models import CableSpec


@dataclass
class BendingCalculationResult:
    minimum_radius: float
    minimum_radius_location: str
    radius_at_top: float
    radius_at_bottom: float
    radius_safety_margin: float
    bending_stress: Optional[float] = None
    is_critical: bool = False
    is_warning: bool = False


class BendingRadiusCalculator:
    E = 1.0e11
    
    def __init__(self, cable_spec: CableSpec):
        self.cable_spec = cable_spec
    
    def calculate_radius(
        self,
        tension: float,
        cable_weight_per_unit: Optional[float] = None
    ) -> float:
        if tension <= 0:
            return 0.0
        
        if cable_weight_per_unit is None:
            cable_weight_per_unit = self.cable_spec.weight_in_water
        
        if cable_weight_per_unit <= 0:
            return float('inf')
        
        return tension / cable_weight_per_unit
    
    def calculate_from_catenary(
        self,
        catenary_result: CatenaryResult
    ) -> BendingCalculationResult:
        if not catenary_result.points:
            return self._create_invalid_result()
        
        points = catenary_result.points
        
        min_radius = float('inf')
        min_radius_idx = 0
        
        for i, point in enumerate(points):
            radius = self.calculate_radius(point.tension)
            if radius < min_radius:
                min_radius = radius
                min_radius_idx = i
        
        top_radius = self.calculate_radius(points[0].tension)
        bottom_radius = self.calculate_radius(points[-1].tension)
        
        if min_radius_idx == 0:
            location = "顶端 (母船端)"
        elif min_radius_idx == len(points) - 1:
            location = "底端 (ROV端)"
        else:
            total_length = points[-1].s
            min_point = points[min_radius_idx]
            position_ratio = min_point.s / total_length
            if position_ratio < 0.33:
                location = f"上1/3段 ({position_ratio*100:.0f}%)"
            elif position_ratio < 0.66:
                location = f"中段 ({position_ratio*100:.0f}%)"
            else:
                location = f"下1/3段 ({position_ratio*100:.0f}%)"
        
        spec_min_radius = self.cable_spec.min_bending_radius
        if spec_min_radius > 0:
            safety_margin = (min_radius - spec_min_radius) / spec_min_radius
        else:
            safety_margin = 1.0
        
        bending_stress = None
        if min_radius > 0:
            y = self.cable_spec.diameter / 2
            bending_stress = self.E * y / min_radius
        
        return BendingCalculationResult(
            minimum_radius=min_radius,
            minimum_radius_location=location,
            radius_at_top=top_radius,
            radius_at_bottom=bottom_radius,
            radius_safety_margin=safety_margin,
            bending_stress=bending_stress
        )
    
    def check_criticality(
        self,
        result: BendingCalculationResult,
        warning_ratio: float = 1.2,
        critical_ratio: float = 1.05
    ) -> BendingCalculationResult:
        spec_min_radius = self.cable_spec.min_bending_radius
        
        if spec_min_radius <= 0:
            return result
        
        warning_threshold = spec_min_radius * warning_ratio
        critical_threshold = spec_min_radius * critical_ratio
        
        result.is_warning = result.minimum_radius <= warning_threshold
        result.is_critical = result.minimum_radius <= critical_threshold
        
        return result
    
    def calculate_angle_gradient(
        self,
        current_angle: float,
        previous_angle: float,
        time_delta: float
    ) -> float:
        if time_delta <= 0:
            return 0.0
        
        angle_diff = abs(current_angle - previous_angle)
        if angle_diff > 180:
            angle_diff = 360 - angle_diff
        
        return angle_diff / time_delta
    
    def _create_invalid_result(self) -> BendingCalculationResult:
        return BendingCalculationResult(
            minimum_radius=0.0,
            minimum_radius_location="未知",
            radius_at_top=0.0,
            radius_at_bottom=0.0,
            radius_safety_margin=0.0,
            bending_stress=None
        )
