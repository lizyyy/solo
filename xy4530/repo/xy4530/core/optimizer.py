from __future__ import annotations
from typing import Dict, List, Optional, Tuple, Any
import copy
from .models import (
    RoomTopology, Room, Valve, FanCurve, PressureCalculationResult,
    OptimizationResult, ProjectData
)
from .calculator import PressureCalculator


class ValveOptimizer:
    MAX_ADJUSTMENT_STEP = 10.0
    MIN_OPENING = 10.0
    MAX_OPENING = 95.0
    PRESSURE_TOLERANCE = 1.0
    AIR_CHANGE_TOLERANCE = 0.10

    def __init__(self, topology: RoomTopology):
        self.topology = topology
        self.calculator = PressureCalculator(topology)

    def estimate_required_flow_adjustment(
        self,
        result: PressureCalculationResult,
        room: Room
    ) -> Tuple[Optional[float], Optional[float]]:
        supply_adjust_pct = None
        return_adjust_pct = None
        
        pressure_deviation = result.pressure_deviation
        current_supply = result.supply_airflow or 0
        current_return = result.return_airflow or 0
        
        if abs(pressure_deviation) > self.PRESSURE_TOLERANCE:
            net_flow_needed = pressure_deviation * 20
            
            if pressure_deviation < 0:
                if current_supply > 0:
                    supply_adjust_pct = min(20, (net_flow_needed / current_supply) * 100)
                else:
                    supply_adjust_pct = 15
            else:
                if current_supply > 0:
                    supply_adjust_pct = max(-20, (net_flow_needed / current_supply) * 100)
        
        if result.target_air_change_rate and result.air_change_rate is not None:
            target_ach = result.target_air_change_rate
            current_ach = result.air_change_rate
            
            if abs(current_ach - target_ach) / target_ach > self.AIR_CHANGE_TOLERANCE:
                flow_ratio = target_ach / current_ach if current_ach > 0 else 1.5
                ach_adjust_pct = (flow_ratio - 1) * 100
                
                if supply_adjust_pct is None:
                    supply_adjust_pct = ach_adjust_pct
                else:
                    if abs(ach_adjust_pct) > abs(supply_adjust_pct):
                        supply_adjust_pct = ach_adjust_pct
        
        if supply_adjust_pct is not None:
            supply_adjust_pct = max(-self.MAX_ADJUSTMENT_STEP, min(self.MAX_ADJUSTMENT_STEP, supply_adjust_pct))
        
        if result.leakage_flow and result.leakage_flow > 50:
            if current_return > 0:
                return_adjust_pct = min(10, (result.leakage_flow / current_return) * 100)
            else:
                return_adjust_pct = 5
        
        return supply_adjust_pct, return_adjust_pct

    def calculate_valve_adjustment(
        self,
        current_opening: float,
        flow_adjust_pct: float,
        is_supply: bool = True
    ) -> float:
        if abs(flow_adjust_pct) < 1:
            return current_opening
        
        opening_change = flow_adjust_pct * 0.7
        
        new_opening = current_opening + opening_change
        new_opening = max(self.MIN_OPENING, min(self.MAX_OPENING, new_opening))
        
        return round(new_opening, 1)

    def optimize_single_pass(self) -> Dict[str, PressureCalculationResult]:
        initial_results = self.calculator.calculate()
        
        adjusted_topology = copy.deepcopy(self.topology)
        valve_adjustments: Dict[str, float] = {}
        
        for room_id, result in initial_results.items():
            room = self.topology.rooms.get(room_id)
            if not room:
                continue
            
            supply_adj_pct, return_adj_pct = self.estimate_required_flow_adjustment(result, room)
            
            if supply_adj_pct is not None and abs(supply_adj_pct) > 1:
                supply_valve = adjusted_topology.supply_valves.get(f"S_{room_id}")
                if supply_valve:
                    new_opening = self.calculate_valve_adjustment(
                        supply_valve.current_opening,
                        supply_adj_pct,
                        is_supply=True
                    )
                    valve_adjustments[f"S_{room_id}"] = new_opening - supply_valve.current_opening
                    supply_valve.current_opening = new_opening
            
            if return_adj_pct is not None and abs(return_adj_pct) > 1:
                return_valve = adjusted_topology.return_valves.get(f"R_{room_id}")
                if return_valve:
                    new_opening = self.calculate_valve_adjustment(
                        return_valve.current_opening,
                        return_adj_pct,
                        is_supply=False
                    )
                    valve_adjustments[f"R_{room_id}"] = new_opening - return_valve.current_opening
                    return_valve.current_opening = new_opening
        
        new_calculator = PressureCalculator(adjusted_topology)
        new_results = new_calculator.calculate()
        
        for room_id, result in new_results.items():
            supply_adj = valve_adjustments.get(f"S_{room_id}")
            return_adj = valve_adjustments.get(f"R_{room_id}")
            
            if supply_adj is not None:
                result.supply_valve_adjustment = supply_adj
            if return_adj is not None:
                result.return_valve_adjustment = return_adj
            
            initial_result = initial_results.get(room_id)
            if initial_result:
                result.issues = [
                    f"[调阀前] {issue}" for issue in initial_result.issues
                ]
                if not result.is_pressure_ok or not result.is_air_change_ok:
                    if not result.is_pressure_ok:
                        result.issues.append(f"[调阀后] 压差仍有偏差: {result.pressure_deviation:+.1f} Pa")
                    if not result.is_air_change_ok and result.air_change_deviation is not None:
                        result.issues.append(f"[调阀后] 换气次数仍不足")
        
        return new_results

    def analyze_issues(self, results: Dict[str, PressureCalculationResult]) -> OptimizationResult:
        opt_result = OptimizationResult()
        opt_result.room_results = results
        
        pressure_issues = []
        air_change_issues = []
        door_issues = []
        particle_issues = []
        all_valve_adjustments: Dict[str, float] = {}
        
        for room_id, result in results.items():
            room = self.topology.rooms.get(room_id)
            room_name = room.name if room else room_id
            
            if not result.is_pressure_ok:
                pressure_issues.append(f"{room_name} ({room_id})")
            
            if not result.is_air_change_ok:
                air_change_issues.append(f"{room_name} ({room_id})")
            
            for issue in result.issues:
                if "开门" in issue or "门" in issue:
                    if room_name not in door_issues:
                        door_issues.append(f"{room_name} ({room_id})")
                if "粒子" in issue:
                    if room_name not in particle_issues:
                        particle_issues.append(f"{room_name} ({room_id})")
            
            if result.supply_valve_adjustment is not None:
                all_valve_adjustments[f"S_{room_id}"] = result.supply_valve_adjustment
            if result.return_valve_adjustment is not None:
                all_valve_adjustments[f"R_{room_id}"] = result.return_valve_adjustment
        
        opt_result.pressure_issues = pressure_issues
        opt_result.air_change_issues = air_change_issues
        opt_result.door_disturbance_issues = door_issues
        opt_result.particle_issues = particle_issues
        opt_result.valve_adjustments = all_valve_adjustments
        opt_result.total_issues = (
            len(pressure_issues) + 
            len(air_change_issues) + 
            len(door_issues) + 
            len(particle_issues)
        )
        
        remarks = []
        if opt_result.total_issues == 0:
            remarks.append("系统状态良好，所有参数均在要求范围内。")
        else:
            if len(pressure_issues) > 0:
                remarks.append(f"发现 {len(pressure_issues)} 个房间存在压差问题。")
            if len(air_change_issues) > 0:
                remarks.append(f"发现 {len(air_change_issues)} 个房间存在换气次数不足问题。")
            if len(door_issues) > 0:
                remarks.append(f"发现 {len(door_issues)} 个房间存在开门扰动问题。")
            if len(particle_issues) > 0:
                remarks.append(f"发现 {len(particle_issues)} 个房间存在粒子浓度超标问题。")
        
        opt_result.remarks = remarks
        
        return opt_result

    def optimize(self) -> OptimizationResult:
        optimized_results = self.optimize_single_pass()
        return self.analyze_issues(optimized_results)

    def apply_manual_correction(
        self,
        room_id: str,
        supply_valve_adjustment: Optional[float] = None,
        return_valve_adjustment: Optional[float] = None,
        pressure_override: Optional[float] = None,
        notes: str = ""
    ) -> Dict[str, Any]:
        correction = {
            "room_id": room_id,
            "supply_valve_adjustment": supply_valve_adjustment,
            "return_valve_adjustment": return_valve_adjustment,
            "pressure_override": pressure_override,
            "notes": notes,
            "applied": False
        }
        
        if supply_valve_adjustment is not None:
            valve = self.topology.supply_valves.get(f"S_{room_id}")
            if valve:
                valve.current_opening = max(
                    self.MIN_OPENING,
                    min(self.MAX_OPENING, valve.current_opening + supply_valve_adjustment)
                )
                correction["applied"] = True
        
        if return_valve_adjustment is not None:
            valve = self.topology.return_valves.get(f"R_{room_id}")
            if valve:
                valve.current_opening = max(
                    self.MIN_OPENING,
                    min(self.MAX_OPENING, valve.current_opening + return_valve_adjustment)
                )
                correction["applied"] = True
        
        return correction
