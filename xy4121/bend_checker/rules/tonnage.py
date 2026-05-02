import math
from dataclasses import dataclass
from typing import List, Dict, Optional, Tuple

from bend_checker.models.part import Part, Bend
from bend_checker.models.material import Material, MaterialLibrary
from bend_checker.models.machine import Machine, MachineLibrary
from bend_checker.models.die import Die, DieSet


@dataclass
class TonnageResult:
    part_number: str
    total_tonnage: float
    per_bend_tonnage: Dict[str, float]
    suitable_machines: List[str]
    overloaded_machines: List[str]
    warnings: List[str]
    safety_factor_used: float


class TonnageCalculator:
    
    SAFETY_FACTOR = 1.25
    
    @staticmethod
    def calculate(
        part: Part,
        material_library: MaterialLibrary,
        machine_library: MachineLibrary,
        die_set: Optional[DieSet] = None,
        bend_length: float = 100.0
    ) -> TonnageResult:
        per_bend_tonnage = {}
        total_tonnage = 0.0
        warnings = []
        
        material = material_library.get_material(part.material_grade, part.material_thickness)
        
        if not material:
            default_uts = 400.0
            warnings.append(f"未找到材料 {part.material_grade}，使用默认抗拉强度 {default_uts} MPa")
        else:
            default_uts = material.tensile_strength
        
        for bend in part.bends:
            v_width = None
            if die_set and bend.die_v_width:
                die = die_set.get_die(bend.die_v_width)
                if die:
                    v_width = die.v_width
            
            if v_width is None:
                v_width = part.material_thickness * 8
            
            tonnage = TonnageCalculator._calculate_single_tonnage(
                material_thickness=part.material_thickness,
                bend_length=bend_length,
                v_width=v_width,
                tensile_strength=default_uts,
                bend_angle=bend.bend_angle
            )
            
            tonnage_with_safety = tonnage * TonnageCalculator.SAFETY_FACTOR
            
            per_bend_tonnage[bend.id] = round(tonnage_with_safety, 2)
            total_tonnage += tonnage_with_safety
        
        suitable_machines = []
        overloaded_machines = []
        
        for machine in machine_library.machines.values():
            if machine.can_handle_tonnage(total_tonnage):
                suitable_machines.append(machine.id)
            else:
                overloaded_machines.append(machine.id)
        
        max_available = machine_library.get_max_tonnage_available()
        if total_tonnage > max_available * 0.8:
            warnings.append(
                f"总吨位 {round(total_tonnage, 1)} 吨接近或超过车间最大设备能力 ({max_available} 吨的80%)"
            )
        
        return TonnageResult(
            part_number=part.part_number,
            total_tonnage=round(total_tonnage, 2),
            per_bend_tonnage=per_bend_tonnage,
            suitable_machines=suitable_machines,
            overloaded_machines=overloaded_machines,
            warnings=warnings,
            safety_factor_used=TonnageCalculator.SAFETY_FACTOR
        )
    
    @staticmethod
    def _calculate_single_tonnage(
        material_thickness: float,
        bend_length: float,
        v_width: float,
        tensile_strength: float,
        bend_angle: float = 90.0
    ) -> float:
        base_tonnage = (tensile_strength * bend_length * material_thickness ** 2) / (1000 * v_width)
        
        angle_factor = bend_angle / 90.0
        
        if bend_angle > 90.0:
            angle_factor = 1.0 + (bend_angle - 90.0) / 180.0
        
        return base_tonnage * angle_factor
    
    @staticmethod
    def calculate_for_parameters(
        material_thickness: float,
        bend_length: float,
        v_width: Optional[float] = None,
        tensile_strength: float = 400.0,
        bend_angle: float = 90.0,
        safety_factor: float = 1.25
    ) -> float:
        if v_width is None:
            v_width = material_thickness * 8
        
        tonnage = TonnageCalculator._calculate_single_tonnage(
            material_thickness=material_thickness,
            bend_length=bend_length,
            v_width=v_width,
            tensile_strength=tensile_strength,
            bend_angle=bend_angle
        )
        
        return round(tonnage * safety_factor, 2)
    
    @staticmethod
    def suggest_minimum_machine(
        total_tonnage: float,
        machine_library: MachineLibrary
    ) -> Optional[Machine]:
        suitable = machine_library.find_suitable_machines(total_tonnage)
        return suitable[0] if suitable else None
    
    @staticmethod
    def check_machine_suitability(
        machine: Machine,
        total_tonnage: float,
        bend_length: float = 0.0
    ) -> Dict:
        can_handle = machine.is_suitable_for(total_tonnage, bend_length)
        
        tonnage_ratio = total_tonnage / (machine.max_tonnage * 0.8)
        
        status = 'suitable'
        message = '设备适合此折弯任务'
        
        if tonnage_ratio > 1.0:
            status = 'overloaded'
            message = f'吨位超载: 需要 {total_tonnage:.1f} 吨，设备安全负载为 {machine.max_tonnage * 0.8:.1f} 吨'
        elif tonnage_ratio > 0.9:
            status = 'marginal'
            message = f'吨位接近上限: 已使用 {tonnage_ratio * 100:.0f}% 的安全负载'
        elif tonnage_ratio < 0.2:
            status = 'oversized'
            message = f'设备过大: 仅使用 {tonnage_ratio * 100:.0f}% 的安全负载，考虑使用更小设备'
        
        return {
            'machine_id': machine.id,
            'machine_name': machine.name,
            'status': status,
            'message': message,
            'tonnage_used': total_tonnage,
            'safe_capacity': machine.max_tonnage * 0.8,
            'utilization_percent': round(tonnage_ratio * 100, 1)
        }
    
    @staticmethod
    def get_tonnage_breakdown(
        part: Part,
        material_library: MaterialLibrary,
        bend_lengths: Optional[Dict[str, float]] = None
    ) -> List[Dict]:
        breakdown = []
        
        material = material_library.get_material(part.material_grade, part.material_thickness)
        uts = material.tensile_strength if material else 400.0
        
        for bend in part.bends:
            bl = bend_lengths.get(bend.id, 100.0) if bend_lengths else 100.0
            v_width = part.material_thickness * 8
            
            base = TonnageCalculator._calculate_single_tonnage(
                part.material_thickness, bl, v_width, uts, bend.bend_angle
            )
            with_safety = base * TonnageCalculator.SAFETY_FACTOR
            
            breakdown.append({
                'bend_id': bend.id,
                'bend_angle': bend.bend_angle,
                'bend_radius': bend.bend_radius,
                'bend_length': bl,
                'base_tonnage': round(base, 2),
                'with_safety_factor': round(with_safety, 2),
                'v_width_used': v_width
            })
        
        return breakdown
