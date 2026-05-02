import math
from typing import Optional, Dict, List, Tuple
from dataclasses import dataclass

from bend_checker.models.material import Material
from bend_checker.models.part import Part, Bend, BendDirection


@dataclass
class UnfoldResult:
    part_number: str
    unfolded_length: float
    unfolded_width: float
    total_bend_deduction: float
    bend_details: List[Dict]
    k_factors_used: Dict[str, float]
    warnings: List[str]


class UnfoldCalculator:
    
    @staticmethod
    def calculate_single_bend(
        bend: Bend,
        material: Material,
        bend_length: float = 100.0
    ) -> Dict:
        k_factor = bend.k_factor_override or material.get_k_factor_for_radius(bend.bend_radius)
        bend_deduction = material.calculate_bend_deduction(
            bend.bend_angle,
            bend.bend_radius,
            k_factor
        )
        
        neutral_axis_length = math.pi * (bend.bend_radius + k_factor * material.thickness) * bend.bend_angle / 180
        
        angle_rad = math.radians(bend.bend_angle)
        inside_set_back = (bend.bend_radius + material.thickness) * math.tan(angle_rad / 2)
        outside_set_back = (bend.bend_radius + material.thickness * 2) * math.tan(angle_rad / 2)
        
        return {
            'bend_id': bend.id,
            'bend_angle': bend.bend_angle,
            'bend_radius': bend.bend_radius,
            'k_factor': k_factor,
            'bend_deduction': bend_deduction,
            'neutral_axis_length': neutral_axis_length,
            'inside_set_back': inside_set_back,
            'outside_set_back': outside_set_back,
            'bend_length': bend_length,
        }
    
    @staticmethod
    def calculate_part_unfold(
        part: Part,
        material_library,
        bend_length: float = 100.0
    ) -> UnfoldResult:
        material = material_library.get_material(part.material_grade, part.material_thickness)
        
        if not material:
            default_k = 0.33
            warnings = [f"未找到材料 {part.material_grade} (厚度{part.material_thickness}mm)，使用默认K因子 {default_k}"]
        else:
            default_k = material.k_factor
            warnings = []
        
        total_bend_deduction = 0.0
        bend_details = []
        k_factors_used = {}
        
        for bend in part.bends:
            if material:
                detail = UnfoldCalculator.calculate_single_bend(bend, material, bend_length)
            else:
                detail = {
                    'bend_id': bend.id,
                    'bend_angle': bend.bend_angle,
                    'bend_radius': bend.bend_radius,
                    'k_factor': bend.k_factor_override or default_k,
                    'bend_deduction': UnfoldCalculator._simple_bend_deduction(
                        bend.bend_angle,
                        bend.bend_radius,
                        part.material_thickness,
                        bend.k_factor_override or default_k
                    ),
                    'neutral_axis_length': 0.0,
                    'inside_set_back': 0.0,
                    'outside_set_back': 0.0,
                    'bend_length': bend_length,
                }
            
            total_bend_deduction += detail['bend_deduction']
            bend_details.append(detail)
            k_factors_used[bend.id] = detail['k_factor']
        
        if material:
            if part.overall_length > 0 and part.overall_width > 0:
                unfolded_length = part.overall_length - total_bend_deduction
                unfolded_width = part.overall_width
            else:
                unfolded_length = UnfoldCalculator._estimate_unfolded_size(part, bend_details, 'length')
                unfolded_width = UnfoldCalculator._estimate_unfolded_size(part, bend_details, 'width')
        else:
            unfolded_length = part.overall_length - total_bend_deduction if part.overall_length > 0 else 0.0
            unfolded_width = part.overall_width if part.overall_width > 0 else 0.0
        
        for bend in part.bends:
            if bend.bend_radius < part.material_thickness * 0.8:
                warnings.append(f"折弯 {bend.id}: 折弯半径 {bend.bend_radius}mm 过小，建议最小 {part.material_thickness * 0.8}mm")
            if bend.flange_length < part.material_thickness * 3:
                warnings.append(f"折弯 {bend.id}: 法兰长度 {bend.flange_length}mm 过短，建议最小 {part.material_thickness * 3}mm")
        
        return UnfoldResult(
            part_number=part.part_number,
            unfolded_length=round(unfolded_length, 3),
            unfolded_width=round(unfolded_width, 3),
            total_bend_deduction=round(total_bend_deduction, 3),
            bend_details=bend_details,
            k_factors_used=k_factors_used,
            warnings=warnings
        )
    
    @staticmethod
    def _simple_bend_deduction(
        bend_angle: float,
        bend_radius: float,
        thickness: float,
        k_factor: float
    ) -> float:
        angle_rad = math.radians(bend_angle)
        inside_set_back = (bend_radius + thickness) * math.tan(angle_rad / 2)
        neutral_axis_length = math.pi * (bend_radius + k_factor * thickness) * bend_angle / 180
        return round(2 * inside_set_back - neutral_axis_length, 3)
    
    @staticmethod
    def _estimate_unfolded_size(part: Part, bend_details: List[Dict], dimension: str) -> float:
        total_inside = 0.0
        num_bends = len(part.bends)
        
        if dimension == 'length':
            for bend in part.bends:
                total_inside += bend.inside_length
            if num_bends > 0:
                total_inside += part.bends[-1].flange_length
                total_inside += part.bends[0].flange_length
        else:
            total_inside = part.overall_width if part.overall_width > 0 else 100.0
        
        total_bd = sum(d['bend_deduction'] for d in bend_details)
        
        return round(total_inside - total_bd, 3)
    
    @staticmethod
    def calculate_blank_size(
        material_thickness: float,
        bends: List[Dict],
        overall_dimension: float,
        k_factor: float = 0.33
    ) -> float:
        total_bd = 0.0
        for bend_info in bends:
            angle = bend_info.get('angle', 90.0)
            radius = bend_info.get('radius', material_thickness)
            bd = UnfoldCalculator._simple_bend_deduction(angle, radius, material_thickness, k_factor)
            total_bd += bd
        
        return round(overall_dimension - total_bd, 3)
