"""热负荷计算器

核心热负荷计算引擎，支持：
- 开门热侵入计算
- 箱体热侵入计算
- 呼吸热计算
- 时间步温度仿真
- 冷量平衡分析
"""

import math
from dataclasses import dataclass
from typing import List, Dict, Optional, Tuple
from pathlib import Path

from pre_cool_validator.models import (
    VehicleConfig,
    LoadingPlan,
    BatchItem,
    SimulationResult,
    BatchSimulationResult,
    TimeStepData,
    ProductParams,
)


@dataclass
class HeatLoadComponents:
    """热负荷组件"""
    door_infiltration: float = 0.0
    ambient_conduction: float = 0.0
    respiration: float = 0.0
    product_cooling: float = 0.0
    total: float = 0.0


class HeatCalculator:
    """热负荷计算器"""

    AIR_DENSITY = 1.2
    AIR_SPECIFIC_HEAT = 1.005
    DOOR_INFILTRATION_COEFF = 15.0
    TIME_STEP_MINUTES = 1.0

    def __init__(self, time_step_minutes: float = 1.0):
        """
        初始化计算器

        Args:
            time_step_minutes: 时间步长（分钟），默认1分钟
        """
        self.TIME_STEP_MINUTES = time_step_minutes

    def calculate_door_infiltration(
        self,
        door_area: float,
        ambient_temp: float,
        cabin_temp: float,
        duration_minutes: float,
        wind_speed: float = 0.0,
    ) -> Tuple[float, float]:
        """
        计算开门热侵入

        Args:
            door_area: 门面积 (m²)
            ambient_temp: 环境温度 (°C)
            cabin_temp: 车厢内温度 (°C)
            duration_minutes: 开门时长 (分钟)
            wind_speed: 风速 (m/s)，默认0

        Returns:
            Tuple[float, float]: (总热量 kJ, 平均功率 kW)
        """
        delta_t = ambient_temp - cabin_temp
        if delta_t <= 0:
            return 0.0, 0.0

        air_change_rate = self.DOOR_INFILTRATION_COEFF
        if wind_speed > 0:
            air_change_rate *= (1 + 0.1 * wind_speed)

        volume_exchanged_per_hour = air_change_rate * door_area * math.sqrt(delta_t)
        volume_exchanged = volume_exchanged_per_hour * (duration_minutes / 60)

        mass_exchanged = volume_exchanged * self.AIR_DENSITY

        heat_kj = mass_exchanged * self.AIR_SPECIFIC_HEAT * delta_t
        power_kw = heat_kj / (duration_minutes * 60) if duration_minutes > 0 else 0.0

        return heat_kj, power_kw

    def calculate_ambient_conduction(
        self,
        surface_area: float,
        insulation_k: float,
        ambient_temp: float,
        cabin_temp: float,
        duration_minutes: float,
    ) -> Tuple[float, float]:
        """
        计算箱体热传导

        Args:
            surface_area: 箱体表面积 (m²)
            insulation_k: 隔热系数 (W/m²·°C)
            ambient_temp: 环境温度 (°C)
            cabin_temp: 车厢内温度 (°C)
            duration_minutes: 持续时间 (分钟)

        Returns:
            Tuple[float, float]: (总热量 kJ, 平均功率 kW)
        """
        delta_t = ambient_temp - cabin_temp
        if delta_t <= 0:
            return 0.0, 0.0

        power_kw = (surface_area * insulation_k * delta_t) / 1000
        heat_kj = power_kw * duration_minutes * 60

        return heat_kj, power_kw

    def calculate_respiration_heat(
        self,
        mass: float,
        respiration_rate: float,
        temp_c: float,
        duration_minutes: float,
        base_temp: float = 20.0,
        q10: float = 2.0,
    ) -> Tuple[float, float]:
        """
        计算呼吸热（基于Q10模型）

        Args:
            mass: 货品质量 (kg)
            respiration_rate: 基准呼吸速率 (W/kg，通常在20°C时)
            temp_c: 当前温度 (°C)
            duration_minutes: 持续时间 (分钟)
            base_temp: 基准温度 (°C)，默认20°C
            q10: Q10系数，默认2.0

        Returns:
            Tuple[float, float]: (总热量 kJ, 平均功率 kW)
        """
        temp_factor = (temp_c - base_temp) / 10
        adjusted_rate = respiration_rate * (q10 ** temp_factor)

        power_kw = (mass * adjusted_rate) / 1000
        heat_kj = power_kw * duration_minutes * 60

        return heat_kj, power_kw

    def calculate_product_cooling_load(
        self,
        mass: float,
        specific_heat: float,
        initial_temp: float,
        target_temp: float,
    ) -> float:
        """
        计算货品冷却所需总热量

        Args:
            mass: 质量 (kg)
            specific_heat: 比热容 (kJ/kg·°C)
            initial_temp: 初始温度 (°C)
            target_temp: 目标温度 (°C)

        Returns:
            float: 需要移除的总热量 (kJ)
        """
        delta_t = initial_temp - target_temp
        if delta_t <= 0:
            return 0.0

        return mass * specific_heat * delta_t

    def calculate_temp_change(
        self,
        mass: float,
        specific_heat: float,
        net_heat_kj: float,
    ) -> float:
        """
        计算温度变化

        Args:
            mass: 质量 (kg)
            specific_heat: 比热容 (kJ/kg·°C)
            net_heat_kj: 净热量变化（移除为负，增加为正）(kJ)

        Returns:
            float: 温度变化 (°C)
        """
        if mass <= 0 or specific_heat <= 0:
            return 0.0

        return net_heat_kj / (mass * specific_heat)

    def simulate(
        self,
        plan: LoadingPlan,
        vehicle: VehicleConfig,
        products: Dict[str, ProductParams],
    ) -> SimulationResult:
        """
        执行完整的时间步仿真

        Args:
            plan: 装车计划
            vehicle: 车辆配置
            products: 货品参数字典

        Returns:
            SimulationResult: 仿真结果
        """
        try:
            total_steps = int(plan.total_precool_time / self.TIME_STEP_MINUTES)

            batch_states: Dict[str, Dict] = {}
            for batch in plan.batches:
                product = products.get(batch.product_id)
                if product is None:
                    raise ValueError(f"未找到货品参数: {batch.product_id}")

                specific_heat = batch.specific_heat_override or product.specific_heat

                batch_states[batch.batch_id] = {
                    "batch": batch,
                    "product": product,
                    "current_temp": batch.initial_temp,
                    "specific_heat": specific_heat,
                    "time_to_target": None,
                    "reached_target": False,
                    "time_steps": [],
                    "total_heat_removed": 0.0,
                    "peak_heat_load": 0.0,
                    "heat_loads": [],
                }

            total_cooling_required = 0.0
            for batch in plan.batches:
                product = products.get(batch.product_id)
                if product:
                    specific_heat = batch.specific_heat_override or product.specific_heat
                    total_cooling_required += self.calculate_product_cooling_load(
                        batch.mass, specific_heat, batch.initial_temp, batch.target_temp
                    )

            total_cooling_provided = 0.0
            total_door_infiltration = 0.0
            total_ambient_conduction = 0.0
            total_respiration = 0.0

            for step in range(total_steps):
                current_time = step * self.TIME_STEP_MINUTES

                is_door_open = current_time < plan.door_open_duration

                step_heat_loads: Dict[str, HeatLoadComponents] = {}
                step_total_heat_load = 0.0

                for batch_id, state in batch_states.items():
                    batch = state["batch"]
                    product = state["product"]

                    if current_time < batch.arrival_time:
                        continue

                    current_temp = state["current_temp"]
                    specific_heat = state["specific_heat"]

                    load = HeatLoadComponents()

                    if is_door_open:
                        _, door_power = self.calculate_door_infiltration(
                            vehicle.door_area,
                            plan.ambient_temp,
                            current_temp,
                            self.TIME_STEP_MINUTES,
                        )
                        load.door_infiltration = door_power

                    _, cond_power = self.calculate_ambient_conduction(
                        vehicle.cargo_surface_area,
                        vehicle.insulation_k,
                        plan.ambient_temp,
                        current_temp,
                        self.TIME_STEP_MINUTES,
                    )
                    load.ambient_conduction = cond_power

                    if product.respiration_rate > 0:
                        _, resp_power = self.calculate_respiration_heat(
                            batch.mass,
                            product.respiration_rate,
                            current_temp,
                            self.TIME_STEP_MINUTES,
                        )
                        load.respiration = resp_power

                    temp_diff = current_temp - batch.target_temp
                    if temp_diff > 0:
                        cooling_needed_kj = batch.mass * specific_heat * temp_diff
                        cooling_power = cooling_needed_kj / (self.TIME_STEP_MINUTES * 60)
                        load.product_cooling = cooling_power

                    load.total = (
                        load.door_infiltration
                        + load.ambient_conduction
                        + load.respiration
                        + load.product_cooling
                    )

                    step_heat_loads[batch_id] = load
                    step_total_heat_load += load.total

                effective_cooling_power = self._allocate_cooling(
                    step_heat_loads,
                    vehicle.cooling_capacity,
                    batch_states,
                )

                total_cooling_provided += effective_cooling_power * self.TIME_STEP_MINUTES * 60

                step_door_kj, _ = self.calculate_door_infiltration(
                    vehicle.door_area,
                    plan.ambient_temp,
                    self._get_avg_cabin_temp(batch_states),
                    self.TIME_STEP_MINUTES,
                ) if is_door_open else (0.0, 0.0)
                total_door_infiltration += step_door_kj

                step_cond_kj = 0.0
                for batch_id, state in batch_states.items():
                    if current_time >= state["batch"].arrival_time:
                        kj, _ = self.calculate_ambient_conduction(
                            vehicle.cargo_surface_area / len(batch_states),
                            vehicle.insulation_k,
                            plan.ambient_temp,
                            state["current_temp"],
                            self.TIME_STEP_MINUTES,
                        )
                        step_cond_kj += kj
                total_ambient_conduction += step_cond_kj

                for batch_id, state in batch_states.items():
                    batch = state["batch"]
                    product = state["product"]

                    if current_time < batch.arrival_time:
                        continue

                    load = step_heat_loads.get(batch_id, HeatLoadComponents())
                    cooling_for_batch = self._get_batch_cooling_allocation(
                        batch_id,
                        load,
                        effective_cooling_power,
                        vehicle.cooling_capacity,
                    )

                    net_heat = (
                        (load.door_infiltration + load.ambient_conduction + load.respiration)
                        * self.TIME_STEP_MINUTES
                        * 60
                        - cooling_for_batch * self.TIME_STEP_MINUTES * 60
                    )

                    temp_change = self.calculate_temp_change(
                        batch.mass, state["specific_heat"], net_heat
                    )
                    new_temp = state["current_temp"] + temp_change
                    new_temp = max(new_temp, batch.target_temp - 5)

                    if product.respiration_rate > 0:
                        resp_kj, _ = self.calculate_respiration_heat(
                            batch.mass, product.respiration_rate, new_temp, self.TIME_STEP_MINUTES
                        )
                        total_respiration += resp_kj

                    time_step_data = TimeStepData(
                        time_minute=current_time + self.TIME_STEP_MINUTES,
                        batch_temp=new_temp,
                        heat_load=load.total,
                        cooling_provided=cooling_for_batch,
                        ambient_heat_infiltration=load.door_infiltration + load.ambient_conduction,
                        respiration_heat=load.respiration,
                    )
                    state["time_steps"].append(time_step_data)

                    if load.total > state["peak_heat_load"]:
                        state["peak_heat_load"] = load.total
                    state["heat_loads"].append(load.total)

                    if (
                        not state["reached_target"]
                        and new_temp <= batch.target_temp
                    ):
                        state["reached_target"] = True
                        state["time_to_target"] = current_time + self.TIME_STEP_MINUTES

                    state["current_temp"] = new_temp
                    if net_heat < 0:
                        state["total_heat_removed"] += abs(net_heat)

            batch_results = []
            for batch_id, state in batch_states.items():
                avg_heat_load = (
                    sum(state["heat_loads"]) / len(state["heat_loads"])
                    if state["heat_loads"]
                    else 0.0
                )

                batch_result = BatchSimulationResult(
                    batch_id=state["batch"].batch_id,
                    product_name=state["batch"].product_name,
                    initial_temp=state["batch"].initial_temp,
                    target_temp=state["batch"].target_temp,
                    final_temp=state["current_temp"],
                    time_to_target=state["time_to_target"],
                    reached_target=state["reached_target"],
                    time_steps=state["time_steps"],
                    total_heat_removed=state["total_heat_removed"],
                    peak_heat_load=state["peak_heat_load"],
                    avg_heat_load=avg_heat_load,
                )
                batch_results.append(batch_result)

            cooling_surplus = total_cooling_provided - (
                total_cooling_required
                + total_door_infiltration
                + total_ambient_conduction
                + total_respiration
            )

            return SimulationResult(
                plan_id=plan.plan_id,
                vehicle_id=plan.vehicle_id,
                ambient_temp=plan.ambient_temp,
                total_precool_time=plan.total_precool_time,
                door_open_duration=plan.door_open_duration,
                vehicle_cooling_capacity=vehicle.cooling_capacity,
                batch_results=batch_results,
                total_cooling_required=total_cooling_required,
                total_cooling_provided=total_cooling_provided,
                cooling_surplus=cooling_surplus,
                door_heat_infiltration=total_door_infiltration,
                ambient_heat_infiltration=total_ambient_conduction,
                respiration_heat_total=total_respiration,
                success=True,
            )

        except Exception as e:
            return SimulationResult(
                plan_id=plan.plan_id if plan else "unknown",
                vehicle_id=plan.vehicle_id if plan else "unknown",
                ambient_temp=plan.ambient_temp if plan else 0.0,
                total_precool_time=plan.total_precool_time if plan else 0,
                door_open_duration=plan.door_open_duration if plan else 0,
                vehicle_cooling_capacity=vehicle.cooling_capacity if vehicle else 0.0,
                success=False,
                error_message=str(e),
            )

    def _get_avg_cabin_temp(self, batch_states: Dict[str, Dict]) -> float:
        """获取车厢平均温度"""
        temps = [s["current_temp"] for s in batch_states.values()]
        return sum(temps) / len(temps) if temps else 25.0

    def _allocate_cooling(
        self,
        step_heat_loads: Dict[str, HeatLoadComponents],
        total_capacity: float,
        batch_states: Dict[str, Dict],
    ) -> float:
        """
        分配制冷能力

        按各批次的热负荷比例分配制冷量。
        """
        total_demand = sum(load.total for load in step_heat_loads.values())

        if total_demand <= 0:
            return 0.0

        effective_cooling = min(total_capacity, total_demand)
        return effective_cooling

    def _get_batch_cooling_allocation(
        self,
        batch_id: str,
        load: HeatLoadComponents,
        total_cooling: float,
        total_capacity: float,
    ) -> float:
        """获取单个批次分配的制冷量"""
        if total_capacity <= 0:
            return 0.0
        return total_cooling * (load.total / total_capacity) if total_capacity > 0 else 0.0
