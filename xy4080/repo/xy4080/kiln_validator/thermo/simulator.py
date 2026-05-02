"""热模拟引擎 - 基于简化热传导模型估算坯体内外温差"""

from pathlib import Path
from typing import List, Optional, Dict, Any
from dataclasses import dataclass

import numpy as np

from kiln_validator.models import (
    KilnConfig,
    FiringPlan,
    Workpiece,
    ThermoStep,
    ThermoSimulationResult,
    SegmentType,
)


SPECIFIC_HEAT_CLAY = 850.0
DENSITY_CLAY = 2000.0
CONVECTION_COEFFICIENT = 20.0


class ThermalSimulator:
    """
    热模拟引擎
    
    使用简化的双层模型（表面+中心）估算坯体的热响应：
    - 考虑坯体厚度对热传导的影响
    - 时间常数与厚度平方成正比
    - 计算每个时间步的内外温差
    
    物理模型：
    - 表面温度响应：T_surface = T_oven - (T_oven - T_surface_prev) * exp(-dt/tau_surface)
    - 中心温度响应：T_core = T_surface - (T_surface - T_core_prev) * exp(-dt/tau_core)
    """

    def __init__(self, config: KilnConfig):
        self.config = config
        self.time_step_min = config.time_step_minutes
        self.time_step_sec = self.time_step_min * 60.0

    def simulate(
        self,
        plan: FiringPlan,
        workpiece_thickness_cm: float,
    ) -> ThermoSimulationResult:
        """
        运行完整热模拟
        
        Args:
            plan: 烧成计划
            workpiece_thickness_cm: 坯体厚度（厘米）
            
        Returns:
            ThermoSimulationResult 热模拟结果
        """
        tau_surface, tau_core = self._calculate_time_constants(workpiece_thickness_cm)
        
        surface_temp = 25.0
        core_temp = 25.0
        
        steps: List[ThermoStep] = []
        
        total_minutes = plan.total_duration_minutes
        step_count = int(np.ceil(total_minutes / self.time_step_min))
        
        previous_oven_temp = 25.0
        ramp_rate_buffer = []
        
        for step_idx in range(step_count):
            current_minutes = step_idx * self.time_step_min
            
            oven_temp = plan.get_temperature_at_time(current_minutes)
            if oven_temp is None:
                oven_temp = previous_oven_temp
            
            segment = plan.get_segment_at_time(current_minutes)
            segment_name = segment.name if segment else None
            
            delta_oven_surface = oven_temp - surface_temp
            surface_temp = self._update_temperature(
                current_temp=surface_temp,
                ambient_temp=oven_temp,
                tau=tau_surface,
            )
            
            delta_surface_core = surface_temp - core_temp
            core_temp = self._update_temperature(
                current_temp=core_temp,
                ambient_temp=surface_temp,
                tau=tau_core,
            )
            
            actual_delta_surface_core = surface_temp - core_temp
            actual_delta_oven_surface = oven_temp - surface_temp
            
            instant_ramp_rate = self._calculate_instant_ramp_rate(
                current_oven_temp=oven_temp,
                previous_oven_temp=previous_oven_temp,
                ramp_rate_buffer=ramp_rate_buffer,
            )
            
            step = ThermoStep(
                step_index=step_idx,
                time_minutes=current_minutes,
                oven_temperature_c=round(oven_temp, 2),
                surface_temperature_c=round(surface_temp, 2),
                core_temperature_c=round(core_temp, 2),
                delta_surface_core_c=round(actual_delta_surface_core, 2),
                delta_oven_surface_c=round(actual_delta_oven_surface, 2),
                ramp_rate_instant_c_per_hour=round(instant_ramp_rate, 2) if instant_ramp_rate is not None else None,
                segment_name=segment_name,
            )
            steps.append(step)
            
            previous_oven_temp = oven_temp
        
        return ThermoSimulationResult(
            workpiece_thickness_cm=workpiece_thickness_cm,
            time_step_minutes=self.time_step_min,
            steps=steps,
        )

    def _calculate_time_constants(self, thickness_cm: float) -> tuple[float, float]:
        """
        计算时间常数（秒）
        
        时间常数与厚度平方成正比（傅里叶数关系）
        
        Args:
            thickness_cm: 厚度（厘米）
            
        Returns:
            (表面时间常数, 中心时间常数)
        """
        thickness_m = thickness_cm / 100.0
        
        k = self.config.thermal_conductivity_clay
        rho = DENSITY_CLAY
        c = SPECIFIC_HEAT_CLAY
        
        h = CONVECTION_COEFFICIENT
        
        characteristic_length = thickness_m / 2.0
        
        biot = h * characteristic_length / k
        
        if biot < 0.1:
            tau = rho * c * thickness_m / (2 * h)
            return tau, tau
        
        tau_surface = rho * c * thickness_m / (4 * h)
        
        fourier_factor = 0.5
        tau_core = (rho * c * thickness_m ** 2) / (np.pi ** 2 * k) * fourier_factor
        
        thickness_factor = thickness_cm ** 2
        tau_core = 120.0 + 60.0 * thickness_factor
        
        return tau_surface, tau_core

    def _update_temperature(
        self,
        current_temp: float,
        ambient_temp: float,
        tau: float,
    ) -> float:
        """
        基于指数响应更新温度
        
        T(t) = T_ambient - (T_ambient - T_initial) * exp(-dt/tau)
        """
        if tau <= 0:
            return ambient_temp
        
        temp_diff = ambient_temp - current_temp
        if abs(temp_diff) < 0.01:
            return ambient_temp
        
        dt = self.time_step_sec
        
        exponent = -dt / tau
        factor = np.exp(exponent)
        
        new_temp = ambient_temp - (ambient_temp - current_temp) * factor
        
        return new_temp

    def _calculate_instant_ramp_rate(
        self,
        current_oven_temp: float,
        previous_oven_temp: float,
        ramp_rate_buffer: List[float],
        window_size: int = 3,
    ) -> Optional[float]:
        """计算瞬时升温速率（平滑窗口）"""
        step_change = current_oven_temp - previous_oven_temp
        rate_per_step = step_change * (60.0 / self.time_step_min)
        
        ramp_rate_buffer.append(rate_per_step)
        if len(ramp_rate_buffer) > window_size:
            ramp_rate_buffer.pop(0)
        
        if len(ramp_rate_buffer) < 2:
            return None
        
        return float(np.mean(ramp_rate_buffer))


def run_thermal_simulation(
    plan: FiringPlan,
    workpiece_thickness_cm: float,
    config: Optional[KilnConfig] = None,
) -> ThermoSimulationResult:
    """
    便捷函数：运行热模拟
    
    Args:
        plan: 烧成计划
        workpiece_thickness_cm: 坯体厚度
        config: 窑炉配置（默认使用默认配置）
        
    Returns:
        热模拟结果
    """
    if config is None:
        config = KilnConfig.create_default()
    
    simulator = ThermalSimulator(config)
    return simulator.simulate(plan, workpiece_thickness_cm)


def run_simulation_for_multiple_thicknesses(
    plan: FiringPlan,
    thicknesses_cm: List[float],
    config: Optional[KilnConfig] = None,
) -> Dict[float, ThermoSimulationResult]:
    """
    为多个厚度值运行模拟
    
    Returns:
        字典：{厚度: 模拟结果}
    """
    if config is None:
        config = KilnConfig.create_default()
    
    simulator = ThermalSimulator(config)
    results = {}
    
    for thickness in sorted(set(thicknesses_cm)):
        results[thickness] = simulator.simulate(plan, thickness)
    
    return results
