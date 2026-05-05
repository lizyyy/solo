from __future__ import annotations
from typing import Dict, List, Optional, Tuple, Any
import math
import numpy as np
from scipy.interpolate import interp1d
from .models import (
    RoomTopology, Room, Valve, FanCurve, AccessLog, ParticleCount,
    Adjacency, PressureCalculationResult, FanCurvePoint
)


class PressureCalculator:
    PRESSURE_TOLERANCE = 2.0
    AIR_CHANGE_TOLERANCE = 0.15
    LEAKAGE_COEFFICIENT = 0.65
    AIR_DENSITY = 1.2

    def __init__(self, topology: RoomTopology):
        self.topology = topology
        self._fan_interpolators: Dict[str, interp1d] = {}
        self._init_fan_curves()

    def _init_fan_curves(self):
        for fan_id, fan in self.topology.fan_curves.items():
            if fan.curve_points:
                flows = [p.flow_rate for p in fan.curve_points]
                pressures = [p.static_pressure for p in fan.curve_points]
                if len(flows) >= 2:
                    self._fan_interpolators[fan_id] = interp1d(
                        flows, pressures, kind='linear', fill_value='extrapolate'
                    )

    def calculate_valve_flow(self, valve: Valve, system_pressure: float) -> float:
        if valve.actual_flow is not None:
            return valve.actual_flow
        
        opening_ratio = valve.current_opening / 100.0
        
        if valve.kv_value is not None:
            kv_effective = valve.kv_value * opening_ratio
            if system_pressure > 0:
                flow = kv_effective * math.sqrt(system_pressure / 1000) * 3600
            else:
                flow = 0
        else:
            flow = valve.rated_flow * opening_ratio
        
        return max(0, flow)

    def get_fan_pressure(self, fan_id: str, total_flow: float) -> float:
        fan = self.topology.fan_curves.get(fan_id)
        if not fan:
            return 500.0
        
        if fan_id in self._fan_interpolators:
            interpolator = self._fan_interpolators[fan_id]
            base_pressure = float(interpolator(total_flow))
        else:
            base_pressure = fan.design_static_pressure or 500.0
        
        if fan.current_frequency and fan.current_frequency != 50:
            freq_ratio = fan.current_frequency / 50.0
            base_pressure = base_pressure * (freq_ratio ** 2)
        
        return max(0, base_pressure)

    def calculate_leakage_flow(
        self, 
        room_id: str, 
        room_pressure: float, 
        adjacent_rooms: Dict[str, float]
    ) -> float:
        total_leakage = 0.0
        
        for adj in self.topology.adjacencies:
            other_room = None
            pressure_diff = 0.0
            
            if adj.room_a == room_id and adj.room_b in adjacent_rooms:
                other_room = adj.room_b
                pressure_diff = room_pressure - adjacent_rooms[other_room]
            elif adj.room_b == room_id and adj.room_a in adjacent_rooms:
                other_room = adj.room_a
                pressure_diff = room_pressure - adjacent_rooms[other_room]
            
            if other_room is not None:
                door_area = adj.door_area or 2.0
                leak_coeff = adj.leakage_coefficient or 0.1
                
                if pressure_diff > 0:
                    flow = (leak_coeff * door_area * 
                            math.sqrt(abs(pressure_diff) / self.AIR_DENSITY) * 3600)
                elif pressure_diff < 0:
                    flow = -(leak_coeff * door_area * 
                             math.sqrt(abs(pressure_diff) / self.AIR_DENSITY) * 3600)
                else:
                    flow = 0
                
                total_leakage += flow
        
        pressure_to_atm = room_pressure
        if abs(pressure_to_atm) > 0.1:
            general_leak = self.LEAKAGE_COEFFICIENT * 0.5 * math.sqrt(abs(pressure_to_atm)) * 3600
            if pressure_to_atm < 0:
                general_leak = -general_leak
            total_leakage += general_leak
        
        return total_leakage

    def solve_pressure_network(
        self,
        supply_flows: Dict[str, float],
        return_flows: Dict[str, float]
    ) -> Dict[str, float]:
        rooms = list(self.topology.rooms.keys())
        n_rooms = len(rooms)
        
        if n_rooms == 0:
            return {}
        
        pressures = {}
        for room_id, room in self.topology.rooms.items():
            pressures[room_id] = room.target_pressure
        
        for _ in range(100):
            converged = True
            new_pressures = pressures.copy()
            
            for room_id in rooms:
                room = self.topology.rooms.get(room_id)
                if not room:
                    continue
                
                supply = supply_flows.get(room_id, 0)
                return_flow = return_flows.get(room_id, 0)
                
                net_flow = supply - return_flow
                leakage = self.calculate_leakage_flow(room_id, pressures[room_id], pressures)
                
                flow_error = net_flow - leakage
                
                if abs(flow_error) > 1:
                    pressure_adjustment = flow_error * 0.05
                    new_pressures[room_id] = pressures[room_id] + pressure_adjustment
                    new_pressures[room_id] = max(-50, min(100, new_pressures[room_id]))
                    converged = False
            
            pressures = new_pressures
            
            if converged:
                break
        
        return pressures

    def calculate_system_flows(self) -> Tuple[Dict[str, float], Dict[str, float]]:
        supply_flows: Dict[str, float] = {}
        return_flows: Dict[str, float] = {}
        
        for fan_id, fan in self.topology.fan_curves.items():
            total_supply_needed = 0
            total_return_needed = 0
            
            for room_id in fan.supply_rooms:
                valve = self.topology.supply_valves.get(f"S_{room_id}")
                if valve:
                    supply_pressure = self.get_fan_pressure(fan_id, 10000)
                    flow = self.calculate_valve_flow(valve, supply_pressure)
                    supply_flows[room_id] = flow
                    total_supply_needed += flow
            
            for room_id in fan.return_rooms:
                valve = self.topology.return_valves.get(f"R_{room_id}")
                if valve:
                    return_pressure = 100
                    flow = self.calculate_valve_flow(valve, return_pressure)
                    return_flows[room_id] = flow
                    total_return_needed += flow
        
        for room_id in self.topology.rooms:
            if room_id not in supply_flows:
                supply_flows[room_id] = 0
            if room_id not in return_flows:
                return_flows[room_id] = 0
        
        return supply_flows, return_flows

    def check_pressure_gradient(self, room_id: str, room_pressure: float, all_pressures: Dict[str, float]) -> List[str]:
        issues = []
        
        for adj in self.topology.adjacencies:
            other_room = None
            required_diff = 0
            
            if adj.room_a == room_id:
                other_room = adj.room_b
                required_diff = adj.required_differential
                if adj.pressure_direction == 'b_to_a':
                    required_diff = -required_diff
            elif adj.room_b == room_id:
                other_room = adj.room_a
                required_diff = adj.required_differential
                if adj.pressure_direction == 'a_to_b':
                    required_diff = -required_diff
            
            if other_room and other_room in all_pressures:
                actual_diff = room_pressure - all_pressures[other_room]
                
                if required_diff > 0:
                    if actual_diff < required_diff - self.PRESSURE_TOLERANCE:
                        issues.append(f"与 {other_room} 压差不足: 实际 {actual_diff:.1f} Pa, 要求 {required_diff} Pa")
                elif required_diff < 0:
                    if actual_diff > required_diff + self.PRESSURE_TOLERANCE:
                        issues.append(f"与 {other_room} 压差方向错误: 实际 {actual_diff:.1f} Pa, 要求 {required_diff} Pa")
        
        return issues

    def check_door_disturbance(self, room_id: str) -> List[str]:
        issues = []
        
        room_logs = [log for log in self.topology.access_logs if log.room_id == room_id]
        
        for log in room_logs:
            if log.duration > 10:
                issues.append(f"门 {log.door_id} 开门时间过长: {log.duration:.1f}秒")
            
            if log.pressure_difference_during_open is not None:
                if abs(log.pressure_difference_during_open) < 2:
                    issues.append(f"开门 {log.door_id} 时压差过低: {log.pressure_difference_during_open:.1f} Pa")
        
        recent_logs = [log for log in room_logs[-10:]]
        total_open_time = sum(log.duration for log in recent_logs)
        if total_open_time > 120:
            issues.append(f"近期开门总时间过长: {total_open_time:.0f}秒")
        
        return issues

    def check_particle_count(self, room_id: str) -> List[str]:
        issues = []
        
        room_counts = [pc for pc in self.topology.particle_counts if pc.room_id == room_id]
        
        for pc in room_counts:
            if pc.limit_value is not None and pc.concentration > pc.limit_value:
                issues.append(
                    f"{pc.particle_size}μm 粒子浓度超标: {pc.concentration:.0f} 个/m³ "
                    f"(限值 {pc.limit_value:.0f})"
                )
            elif pc.is_pass is False:
                issues.append(f"{pc.particle_size}μm 粒子检测不达标")
        
        return issues

    def calculate(self) -> Dict[str, PressureCalculationResult]:
        supply_flows, return_flows = self.calculate_system_flows()
        pressures = self.solve_pressure_network(supply_flows, return_flows)
        
        results: Dict[str, PressureCalculationResult] = {}
        
        for room_id, room in self.topology.rooms.items():
            supply = supply_flows.get(room_id, 0)
            return_flow = return_flows.get(room_id, 0)
            pressure = pressures.get(room_id, room.target_pressure)
            
            if room.volume > 0 and supply > 0:
                air_change_rate = supply / room.volume
            else:
                air_change_rate = 0
            
            pressure_deviation = pressure - room.target_pressure
            
            issues = []
            
            is_pressure_ok = abs(pressure_deviation) <= self.PRESSURE_TOLERANCE
            if not is_pressure_ok:
                issues.append(f"压差偏差: {pressure_deviation:+.1f} Pa (目标 {room.target_pressure} Pa)")
            
            gradient_issues = self.check_pressure_gradient(room_id, pressure, pressures)
            issues.extend(gradient_issues)
            
            target_air_change = room.target_air_change_rate
            is_air_change_ok = True
            air_change_deviation = None
            
            if target_air_change and target_air_change > 0:
                air_change_deviation = (air_change_rate - target_air_change) / target_air_change
                is_air_change_ok = abs(air_change_deviation) <= self.AIR_CHANGE_TOLERANCE
                if not is_air_change_ok:
                    issues.append(
                        f"换气次数不足: {air_change_rate:.1f} 次/小时 "
                        f"(目标 {target_air_change} 次/小时)"
                    )
            
            door_issues = self.check_door_disturbance(room_id)
            issues.extend(door_issues)
            
            particle_issues = self.check_particle_count(room_id)
            issues.extend(particle_issues)
            
            leakage = self.calculate_leakage_flow(room_id, pressure, pressures)
            
            result = PressureCalculationResult(
                room_id=room_id,
                calculated_pressure=pressure,
                target_pressure=room.target_pressure,
                pressure_deviation=pressure_deviation,
                supply_airflow=supply,
                return_airflow=return_flow,
                exhaust_airflow=max(0, supply - return_flow),
                air_change_rate=air_change_rate,
                target_air_change_rate=target_air_change,
                air_change_deviation=air_change_deviation,
                leakage_flow=leakage,
                is_pressure_ok=is_pressure_ok and len(gradient_issues) == 0,
                is_air_change_ok=is_air_change_ok,
                issues=issues
            )
            
            results[room_id] = result
        
        return results
