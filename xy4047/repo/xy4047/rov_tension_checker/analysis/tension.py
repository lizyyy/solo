"""张力计算模块"""

import math
from dataclasses import dataclass
from typing import Optional

from rov_tension_checker.analysis.catenary import (
    CatenaryCalculator,
    CatenaryResult,
)
from rov_tension_checker.config.models import (
    CableSpec,
    ROVSpec,
    RiskThresholds,
)


@dataclass
class TensionCalculationResult:
    top_tension: float
    bottom_tension: float
    horizontal_force: float
    vertical_force_rov: float
    effective_weight_rov: float
    current_drag_force: float
    thrust_contribution: float
    safety_margin: float
    tension_ratio: float
    catenary_result: Optional[CatenaryResult] = None


class TensionCalculator:
    SEA_WATER_DENSITY = 1025.0
    
    def __init__(
        self,
        cable_spec: CableSpec,
        rov_spec: ROVSpec,
        risk_thresholds: Optional[RiskThresholds] = None
    ):
        self.cable_spec = cable_spec
        self.rov_spec = rov_spec
        self.risk_thresholds = risk_thresholds or RiskThresholds()
        self.catenary_calc = CatenaryCalculator(
            cable_weight_in_water=cable_spec.weight_in_water
        )
    
    def calculate_drag_force(
        self,
        cable_length: float,
        cable_diameter: float,
        current_speed: float,
        current_direction: float,
        rov_heading: Optional[float] = None
    ) -> float:
        if current_speed <= 0 or cable_length <= 0:
            return 0.0
        
        Cd = 1.2
        
        projected_area = cable_length * cable_diameter
        
        dynamic_pressure = 0.5 * self.SEA_WATER_DENSITY * current_speed**2
        
        drag = Cd * dynamic_pressure * projected_area
        
        return drag
    
    def calculate_rov_vertical_force(
        self,
        rov_depth: float,
        rov_thrust_vertical: Optional[float] = None
    ) -> float:
        effective_weight = -self.rov_spec.weight_in_water
        
        if rov_thrust_vertical is not None:
            effective_weight -= rov_thrust_vertical
        
        return effective_weight
    
    def calculate_rov_horizontal_force(
        self,
        rov_thrust_horizontal: Optional[float] = None
    ) -> float:
        if rov_thrust_horizontal is None:
            return 0.0
        return rov_thrust_horizontal
    
    def calculate_effective_bottom_force(
        self,
        rov_depth: float,
        rov_thrust_forward: Optional[float] = None,
        rov_thrust_vertical: Optional[float] = None,
        current_speed: Optional[float] = None,
        cable_length: Optional[float] = None
    ) -> tuple[float, float]:
        horizontal_force = self.calculate_rov_horizontal_force(rov_thrust_forward)
        vertical_force = self.calculate_rov_vertical_force(rov_depth, rov_thrust_vertical)
        
        if current_speed is not None and cable_length is not None:
            drag = self.calculate_drag_force(
                cable_length,
                self.cable_spec.diameter,
                current_speed,
                0,
                None
            )
            horizontal_force += drag
        
        return horizontal_force, vertical_force
    
    def calculate(
        self,
        cable_length: float,
        rov_depth: float,
        horizontal_offset: float,
        rov_thrust_forward: Optional[float] = None,
        rov_thrust_vertical: Optional[float] = None,
        current_speed: Optional[float] = None
    ) -> TensionCalculationResult:
        if cable_length <= 0 or rov_depth <= 0:
            return self._create_invalid_result()
        
        bottom_h_force, bottom_v_force = self.calculate_effective_bottom_force(
            rov_depth,
            rov_thrust_forward,
            rov_thrust_vertical,
            current_speed,
            cable_length
        )
        
        min_length_needed = math.sqrt(horizontal_offset**2 + rov_depth**2)
        if cable_length < min_length_needed:
            tension_estimate = self.cable_spec.weight_in_water * cable_length
            return TensionCalculationResult(
                top_tension=tension_estimate + abs(bottom_h_force + bottom_v_force),
                bottom_tension=abs(bottom_h_force + bottom_v_force),
                horizontal_force=bottom_h_force,
                vertical_force_rov=bottom_v_force,
                effective_weight_rov=self.calculate_rov_vertical_force(rov_depth, rov_thrust_vertical),
                current_drag_force=0,
                thrust_contribution=rov_thrust_forward or 0,
                safety_margin=-1.0,
                tension_ratio=1.1,
                catenary_result=None
            )
        
        try:
            catenary_result = self.catenary_calc.calculate_from_length(
                total_length=cable_length,
                depth=rov_depth,
                horizontal_offset=horizontal_offset,
                bottom_force=math.sqrt(bottom_h_force**2 + bottom_v_force**2)
            )
        except Exception:
            return self._create_invalid_result()
        
        top_tension = catenary_result.top_tension
        bottom_tension = catenary_result.bottom_tension
        
        working_limit = self.cable_spec.working_tension_limit
        if top_tension > 0 and working_limit > 0:
            tension_ratio = top_tension / working_limit
            safety_margin = 1.0 - tension_ratio
        else:
            tension_ratio = 0.0
            safety_margin = 1.0
        
        current_drag = 0.0
        if current_speed is not None and current_speed > 0:
            current_drag = self.calculate_drag_force(
                cable_length,
                self.cable_spec.diameter,
                current_speed,
                0,
                None
            )
        
        return TensionCalculationResult(
            top_tension=top_tension,
            bottom_tension=bottom_tension,
            horizontal_force=bottom_h_force,
            vertical_force_rov=bottom_v_force,
            effective_weight_rov=self.calculate_rov_vertical_force(rov_depth, rov_thrust_vertical),
            current_drag_force=current_drag,
            thrust_contribution=rov_thrust_forward or 0,
            safety_margin=safety_margin,
            tension_ratio=tension_ratio,
            catenary_result=catenary_result
        )
    
    def estimate_horizontal_offset(
        self,
        cable_length: float,
        rov_depth: float
    ) -> float:
        return self.catenary_calc.estimate_horizontal_offset(cable_length, rov_depth)
    
    def _create_invalid_result(self) -> TensionCalculationResult:
        return TensionCalculationResult(
            top_tension=0.0,
            bottom_tension=0.0,
            horizontal_force=0.0,
            vertical_force_rov=0.0,
            effective_weight_rov=0.0,
            current_drag_force=0.0,
            thrust_contribution=0.0,
            safety_margin=0.0,
            tension_ratio=0.0,
            catenary_result=None
        )
