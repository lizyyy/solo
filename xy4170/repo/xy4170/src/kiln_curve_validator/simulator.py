"""数值模拟模块 - 分段热惯性曲线模拟、表里温差计算、热功分析"""

import math
from dataclasses import dataclass
from typing import List, Tuple, Optional, Dict, Any
import numpy as np

from .models import (
    PlannedCurve,
    CurveSegment,
    SegmentType,
    KilnParameters,
    FiringRecipe,
    SimulationResult,
)


@dataclass
class ThermalState:
    """热状态快照"""
    time_minutes: float
    surface_temp: float
    core_temp: float
    heating_rate: float
    thermal_inertia_effect: float


class ThermalInertiaSimulator:
    """热惯性模拟器"""

    SPECIFIC_HEAT_CERAMIC = 850.0
    DENSITY_CERAMIC = 2200.0

    def __init__(self, kiln: KilnParameters, recipe: FiringRecipe):
        self.kiln = kiln
        self.recipe = recipe
        self.thermal_inertia_factor = kiln.thermal_inertia_factor
        self.body_thickness = recipe.total_thickness / 100.0
        self.thermal_conductivity = recipe.body.thermal_conductivity

    def simulate_segment(
        self,
        segment: CurveSegment,
        initial_temp: float,
        time_step: float = 0.5
    ) -> List[ThermalState]:
        """模拟单个曲线段的热行为"""
        states: List[ThermalState] = []
        current_time = 0.0
        surface_temp = initial_temp
        core_temp = initial_temp

        total_duration = segment.duration
        target_temp = segment.end_temp

        if segment.segment_type == SegmentType.RAMP:
            target_rate = segment.rate or (target_temp - initial_temp) / max(total_duration, 1e-6)

            while current_time < total_duration:
                ideal_surface_temp = initial_temp + target_rate * current_time

                inertia_effect = self._calculate_inertia_effect(
                    current_temp=surface_temp,
                    target_temp_step=ideal_surface_temp,
                    rate=abs(target_rate)
                )

                actual_surface_temp = ideal_surface_temp - inertia_effect

                core_temp = self._calculate_core_temperature(
                    surface_temp=actual_surface_temp,
                    previous_core=core_temp,
                    time_step=time_step
                )

                actual_rate = (actual_surface_temp - surface_temp) / time_step if time_step > 0 else 0
                surface_temp = actual_surface_temp

                states.append(ThermalState(
                    time_minutes=current_time,
                    surface_temp=surface_temp,
                    core_temp=core_temp,
                    heating_rate=actual_rate,
                    thermal_inertia_effect=inertia_effect
                ))

                current_time += time_step

        elif segment.segment_type == SegmentType.HOLD:
            hold_temp = segment.start_temp

            while current_time < total_duration:
                inertia_effect = self._calculate_hold_inertia(
                    surface_temp=surface_temp,
                    hold_temp=hold_temp,
                    elapsed_time=current_time,
                    total_duration=total_duration
                )

                surface_temp = hold_temp - inertia_effect

                core_temp = self._calculate_core_temperature(
                    surface_temp=surface_temp,
                    previous_core=core_temp,
                    time_step=time_step
                )

                states.append(ThermalState(
                    time_minutes=current_time,
                    surface_temp=surface_temp,
                    core_temp=core_temp,
                    heating_rate=0.0,
                    thermal_inertia_effect=inertia_effect
                ))

                current_time += time_step

        elif segment.segment_type == SegmentType.COOL:
            cool_rate = abs(segment.rate or (segment.start_temp - target_temp) / max(total_duration, 1e-6))

            while current_time < total_duration:
                ideal_surface_temp = initial_temp - cool_rate * current_time

                inertia_effect = self._calculate_cooling_inertia(
                    current_temp=surface_temp,
                    target_temp_step=ideal_surface_temp,
                    rate=cool_rate
                )

                actual_surface_temp = ideal_surface_temp + inertia_effect

                core_temp = self._calculate_core_temperature(
                    surface_temp=actual_surface_temp,
                    previous_core=core_temp,
                    time_step=time_step
                )

                actual_rate = (actual_surface_temp - surface_temp) / time_step if time_step > 0 else 0
                surface_temp = actual_surface_temp

                states.append(ThermalState(
                    time_minutes=current_time,
                    surface_temp=surface_temp,
                    core_temp=core_temp,
                    heating_rate=actual_rate,
                    thermal_inertia_effect=-inertia_effect
                ))

                current_time += time_step

        return states

    def _calculate_inertia_effect(
        self,
        current_temp: float,
        target_temp_step: float,
        rate: float
    ) -> float:
        """计算升温阶段的热惯性效应"""
        delta_T = target_temp_step - current_temp

        if delta_T <= 0:
            return 0.0

        thickness_factor = self.body_thickness * 100

        inertia_base = (
            self.thermal_inertia_factor *
            math.log(1 + rate) *
            (thickness_factor / 2.0)
        )

        temp_factor = 1.0 + (current_temp / 800.0) ** 1.5
        inertia_effect = inertia_base * temp_factor * 0.01

        max_inertia = rate * self.thermal_inertia_factor * 2.0
        return min(inertia_effect, max_inertia)

    def _calculate_hold_inertia(
        self,
        surface_temp: float,
        hold_temp: float,
        elapsed_time: float,
        total_duration: float
    ) -> float:
        """计算保温阶段的热惯性效应（温度回升/下降）"""
        if elapsed_time < 1.0:
            return 5.0 * self.thermal_inertia_factor
        else:
            decay = math.exp(-elapsed_time / (total_duration * 0.3))
            return 2.0 * self.thermal_inertia_factor * decay

    def _calculate_cooling_inertia(
        self,
        current_temp: float,
        target_temp_step: float,
        rate: float
    ) -> float:
        """计算冷却阶段的热惯性效应"""
        delta_T = current_temp - target_temp_step

        if delta_T <= 0:
            return 0.0

        thickness_factor = self.body_thickness * 100

        inertia_base = (
            self.thermal_inertia_factor * 0.8 *
            math.log(1 + rate) *
            (thickness_factor / 2.5)
        )

        temp_factor = 1.0 + (current_temp / 600.0) ** 1.2
        inertia_effect = inertia_base * temp_factor * 0.01

        max_inertia = rate * self.thermal_inertia_factor * 1.5
        return min(inertia_effect, max_inertia)

    def _calculate_core_temperature(
        self,
        surface_temp: float,
        previous_core: float,
        time_step: float
    ) -> float:
        """
        简化的一维热传导模型计算中心温度
        使用傅里叶定律的简化形式
        """
        if time_step <= 0:
            return previous_core

        alpha = self.thermal_conductivity / (self.DENSITY_CERAMIC * self.SPECIFIC_HEAT_CERAMIC)
        alpha_minutes = alpha * 60.0

        L = self.body_thickness / 2.0
        if L <= 0:
            return surface_temp

        delta_T = surface_temp - previous_core
        time_factor = 1.0 - math.exp(-alpha_minutes * time_step / (L ** 2))

        core_temp_change = delta_T * time_factor
        new_core = previous_core + core_temp_change

        return new_core


class FullCurveSimulator:
    """完整曲线模拟器"""

    def __init__(self, kiln: KilnParameters, recipe: FiringRecipe, time_step: float = 0.5):
        self.kiln = kiln
        self.recipe = recipe
        self.time_step = time_step
        self.simulator = ThermalInertiaSimulator(kiln, recipe)

    def simulate_planned_curve(self, planned_curve: PlannedCurve) -> SimulationResult:
        """模拟完整计划曲线"""
        all_states: List[ThermalState] = []
        current_temp = 25.0
        accumulated_time = 0.0

        for segment in planned_curve.segments:
            segment_states = self.simulator.simulate_segment(
                segment=segment,
                initial_temp=current_temp,
                time_step=self.time_step
            )

            for state in segment_states:
                state.time_minutes += accumulated_time
                all_states.append(state)

            if segment_states:
                current_temp = segment_states[-1].surface_temp

            accumulated_time += segment.duration

        return self._states_to_simulation_result(all_states)

    def _states_to_simulation_result(self, states: List[ThermalState]) -> SimulationResult:
        """将热状态列表转换为模拟结果对象"""
        if not states:
            return SimulationResult(
                simulated_temperatures=[],
                time_points=[],
                thermal_inertia_effects=[],
                lag_times=[],
                core_surface_diff=[]
            )

        temperatures = [s.surface_temp for s in states]
        time_points = [s.time_minutes for s in states]
        inertia_effects = [s.thermal_inertia_effect for s in states]

        lag_times = self._calculate_lag_times(states)
        core_surface_diff = [s.core_temp - s.surface_temp for s in states]

        return SimulationResult(
            simulated_temperatures=temperatures,
            time_points=time_points,
            thermal_inertia_effects=inertia_effects,
            lag_times=lag_times,
            core_surface_diff=core_surface_diff
        )

    def _calculate_lag_times(self, states: List[ThermalState]) -> List[float]:
        """计算各时间点的滞后时间"""
        if not states:
            return []

        lag_times: List[float] = []

        for i, state in enumerate(states):
            temp_diff = state.surface_temp - state.core_temp

            if abs(temp_diff) < 0.1:
                lag_times.append(0.0)
            else:
                current_rate = abs(state.heating_rate) if i > 0 else 0.5

                if current_rate > 0.01:
                    lag = abs(temp_diff) / current_rate
                else:
                    lag = 0.0

                lag_times.append(lag)

        return lag_times


class ThermalWorkCalculator:
    """热功计算器"""

    @staticmethod
    def calculate_segment_thermal_work(
        segment: CurveSegment,
        kiln: KilnParameters,
        ambient_temp: float = 25.0
    ) -> Dict[str, float]:
        """计算单个曲线段的热功"""
        result: Dict[str, float] = {}

        if segment.segment_type == SegmentType.RAMP:
            delta_T = abs(segment.end_temp - segment.start_temp)
            mass_estimate = kiln.chamber_volume * 0.3

            specific_heat_avg = ThermalWorkCalculator._estimate_specific_heat(
                (segment.start_temp + segment.end_temp) / 2
            )

            theoretical_energy = mass_estimate * specific_heat_avg * delta_T

            power_used = kiln.power_rating * 0.8
            actual_energy = power_used * segment.duration * 60

            efficiency = min(1.0, theoretical_energy / max(actual_energy, 1.0))

            result = {
                'theoretical_energy_kj': theoretical_energy / 1000.0,
                'actual_energy_kj': actual_energy / 1000.0,
                'efficiency': efficiency,
                'temperature_range': delta_T,
                'duration_minutes': segment.duration
            }

        elif segment.segment_type == SegmentType.HOLD:
            power_hold = kiln.power_rating * 0.4
            hold_energy = power_hold * segment.duration * 60

            heat_loss = ThermalWorkCalculator._estimate_heat_loss(
                segment.start_temp,
                kiln,
                ambient_temp
            ) * segment.duration * 60

            result = {
                'hold_energy_kj': hold_energy / 1000.0,
                'heat_loss_kj': heat_loss / 1000.0,
                'hold_temp': segment.start_temp,
                'duration_minutes': segment.duration
            }

        elif segment.segment_type == SegmentType.COOL:
            delta_T = segment.start_temp - segment.end_temp
            mass_estimate = kiln.chamber_volume * 0.3

            specific_heat_avg = ThermalWorkCalculator._estimate_specific_heat(
                (segment.start_temp + segment.end_temp) / 2
            )

            released_energy = mass_estimate * specific_heat_avg * delta_T

            result = {
                'released_energy_kj': released_energy / 1000.0,
                'cooling_range': delta_T,
                'duration_minutes': segment.duration,
                'avg_cooling_rate': delta_T / max(segment.duration, 1.0)
            }

        return result

    @staticmethod
    def calculate_total_thermal_work(
        planned_curve: PlannedCurve,
        kiln: KilnParameters,
        ambient_temp: float = 25.0
    ) -> Dict[str, Any]:
        """计算整个曲线的总热功"""
        total_heating_kj = 0.0
        total_hold_kj = 0.0
        total_released_kj = 0.0
        segment_results = []

        for segment in planned_curve.segments:
            work = ThermalWorkCalculator.calculate_segment_thermal_work(
                segment, kiln, ambient_temp
            )
            segment_results.append(work)

            if segment.segment_type == SegmentType.RAMP:
                total_heating_kj += work.get('actual_energy_kj', 0)
            elif segment.segment_type == SegmentType.HOLD:
                total_hold_kj += work.get('hold_energy_kj', 0)
            elif segment.segment_type == SegmentType.COOL:
                total_released_kj += work.get('released_energy_kj', 0)

        total_input_kj = total_heating_kj + total_hold_kj

        return {
            'total_heating_energy_kj': total_heating_kj,
            'total_hold_energy_kj': total_hold_kj,
            'total_input_energy_kj': total_input_kj,
            'total_released_energy_kj': total_released_kj,
            'estimated_efficiency': total_released_kj / max(total_input_kj, 1.0),
            'segment_results': segment_results,
            'total_duration_minutes': planned_curve.get_total_duration()
        }

    @staticmethod
    def _estimate_specific_heat(temp: float) -> float:
        """估算特定温度下陶瓷的比热容 (J/kg·K)"""
        base_cp = 850.0

        if temp < 500:
            cp = base_cp + temp * 0.3
        elif temp < 1000:
            cp = 1000.0 + (temp - 500) * 0.5
        else:
            cp = 1250.0

        return cp

    @staticmethod
    def _estimate_heat_loss(temp: float, kiln: KilnParameters, ambient: float) -> float:
        """估算保温阶段的热损失功率 (W)"""
        delta_T = temp - ambient
        if delta_T <= 0:
            return 0.0

        surface_area = 6 * (kiln.chamber_volume / 1000.0) ** (2/3)

        insulation_factor = 1.0 / kiln.thermal_inertia_factor

        heat_loss = (
            10.0 * insulation_factor * surface_area *
            (delta_T / 100.0) ** 1.25
        )

        return heat_loss
