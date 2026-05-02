"""水力计算模块 - 核心水力计算公式实现。"""

import math
from typing import Optional, Tuple, List

import numpy as np

from zha_beng_yan_suan_qi.types import PumpCurve, GateLimit


class HydraulicCalculator:
    """水力计算器类。"""
    
    GRAVITY = 9.81
    
    @staticmethod
    def calculate_pump_flow(
        pump_curve: PumpCurve,
        inner_level: float,
        outer_level: float,
        is_running: bool = True,
    ) -> Tuple[float, float]:
        """
        计算泵站实际流量和功率。
        
        根据内外水位差计算实际扬程，然后从泵曲线插值得到实际流量和功率。
        
        Args:
            pump_curve: 泵曲线数据
            inner_level: 内河水位 (米)
            outer_level: 外河水位 (米)
            is_running: 泵是否正在运行
            
        Returns:
            (实际流量 m³/h, 实际功率 kW)
        """
        if not is_running:
            return 0.0, 0.0
        
        actual_head = outer_level - inner_level
        
        if actual_head < 0:
            actual_head = 0
        
        heads = np.array(pump_curve.head_m)
        flows = np.array(pump_curve.flow_m3h)
        powers = np.array(pump_curve.power_kw)
        
        if len(heads) < 2:
            if actual_head <= pump_curve.rated_head_m:
                return pump_curve.rated_flow_m3h, pump_curve.rated_power_kw
            else:
                return 0.0, 0.0
        
        if actual_head < heads[0]:
            flow = flows[0]
            power = powers[0]
        elif actual_head > heads[-1]:
            flow = 0.0
            power = 0.0
        else:
            flow = np.interp(actual_head, heads, flows)
            power = np.interp(actual_head, heads, powers)
        
        return max(0.0, flow), max(0.0, power)
    
    @staticmethod
    def calculate_gate_flow(
        gate_limit: GateLimit,
        inner_level: float,
        outer_level: float,
        opening: float,
    ) -> Tuple[float, bool]:
        """
        计算闸门过流量及判断是否可能倒灌。
        
        采用宽顶堰流公式计算，考虑自由出流和淹没出流两种情况。
        
        Args:
            gate_limit: 闸门限制参数
            inner_level: 内河水位 (米)
            outer_level: 外河水位 (米)
            opening: 闸门开度 (米)
            
        Returns:
            (过流量 m³/h, 是否倒灌)
        """
        opening = max(gate_limit.min_opening, min(opening, gate_limit.max_opening))
        
        if opening <= 0:
            return 0.0, False
        
        sill_elev = gate_limit.sill_elevation
        width = gate_limit.width_m
        cd = gate_limit.discharge_coefficient
        
        h_up = max(inner_level - sill_elev, 0)
        h_down = max(outer_level - sill_elev, 0)
        
        if inner_level > outer_level:
            flow_direction = 1
            h1 = h_up
            h2 = h_down
        else:
            flow_direction = -1
            h1 = h_down
            h2 = h_up
        
        if h1 <= 0:
            return 0.0, False
        
        if h2 / h1 < 0.8:
            m = 0.385
            flow = cd * m * width * math.sqrt(2 * HydraulicCalculator.GRAVITY) * (h1 ** 1.5)
        else:
            sigma = 1.0 - 0.5 * ((h2 / h1 - 0.8) / 0.2)
            sigma = max(0, min(1, sigma))
            m = 0.385
            flow = cd * m * sigma * width * math.sqrt(2 * HydraulicCalculator.GRAVITY) * (h1 ** 1.5)
        
        flow *= 3600
        actual_flow = flow * flow_direction
        
        is_backflow = (actual_flow < 0) and (outer_level > inner_level)
        
        return abs(actual_flow), is_backflow
    
    @staticmethod
    def calculate_storage_change(
        initial_storage: float,
        inflow: float,
        pump_total_flow: float,
        gate_total_flow: float,
        step_hours: float,
    ) -> float:
        """
        计算库容变化。
        
        Args:
            initial_storage: 初始库容 (立方米)
            inflow: 入流量 (立方米/小时，包括降雨产流)
            pump_total_flow: 泵站总排水量 (立方米/小时，正值表示外排)
            gate_total_flow: 闸门总流量 (立方米/小时，正值表示外排，负值表示倒灌)
            step_hours: 时间步长 (小时)
            
        Returns:
            新的库容 (立方米)
        """
        net_flow = inflow - pump_total_flow - gate_total_flow
        
        storage_change = net_flow * step_hours
        
        new_storage = initial_storage + storage_change
        
        return new_storage
    
    @staticmethod
    def calculate_level_from_storage(
        storage: float,
        channel_area: float,
        capacity: float,
        base_level: float = 0.0,
    ) -> float:
        """
        根据库容计算水位。
        
        假设河道为棱柱体，水位与库容呈线性关系（简化模型）。
        
        Args:
            storage: 当前库容 (立方米)
            channel_area: 河道水面面积 (平方米)
            capacity: 最大库容 (立方米)
            base_level: 基准水位 (米)，对应库容为0时的水位
            
        Returns:
            水位 (米)
        """
        storage = max(0, min(storage, capacity))
        
        level = base_level + (storage / channel_area)
        
        return level
    
    @staticmethod
    def calculate_storage_from_level(
        level: float,
        channel_area: float,
        capacity: float,
        base_level: float = 0.0,
    ) -> float:
        """
        根据水位计算库容。
        
        Args:
            level: 当前水位 (米)
            channel_area: 河道水面面积 (平方米)
            capacity: 最大库容 (立方米)
            base_level: 基准水位 (米)
            
        Returns:
            库容 (立方米)
        """
        effective_level = max(0, level - base_level)
        
        storage = effective_level * channel_area
        
        storage = max(0, min(storage, capacity))
        
        return storage
    
    @staticmethod
    def calculate_rainfall_inflow(
        rainfall_mm: float,
        duration_hours: float,
        catchment_area: float,
        runoff_coefficient: float = 0.6,
    ) -> float:
        """
        计算降雨产流。
        
        Args:
            rainfall_mm: 降雨量 (毫米)
            duration_hours: 降雨时长 (小时)
            catchment_area: 汇水面积 (平方公里)
            runoff_coefficient: 径流系数 (0-1)
            
        Returns:
            平均入流量 (立方米/小时)
        """
        if duration_hours <= 0:
            return 0.0
        
        rainfall_m = rainfall_mm / 1000
        
        catchment_area_m2 = catchment_area * 1_000_000
        
        total_runoff_m3 = rainfall_m * catchment_area_m2 * runoff_coefficient
        
        inflow_m3h = total_runoff_m3 / duration_hours
        
        return inflow_m3h
    
    @staticmethod
    def check_overtopping_risk(
        inner_level: float,
        critical_level: float,
        warning_level: Optional[float] = None,
    ) -> Tuple[bool, str, float]:
        """
        检查漫顶风险。
        
        Args:
            inner_level: 内河水位 (米)
            critical_level: 保证水位 (米)
            warning_level: 警戒水位 (米)，可选
            
        Returns:
            (是否有风险, 风险等级描述, 超出值)
        """
        if inner_level >= critical_level:
            return True, "critical", inner_level - critical_level
        elif warning_level and inner_level >= warning_level:
            return True, "warning", inner_level - warning_level
        return False, "normal", 0.0
    
    @staticmethod
    def check_backflow_risk(
        inner_level: float,
        outer_level: float,
        gate_opening: float = 0.0,
    ) -> Tuple[bool, float]:
        """
        检查倒灌风险。
        
        当外河水位高于内河水位且闸门开启时存在倒灌风险。
        
        Args:
            inner_level: 内河水位 (米)
            outer_level: 外河水位 (米)
            gate_opening: 闸门开度 (米)
            
        Returns:
            (是否有风险, 水位差)
        """
        level_diff = outer_level - inner_level
        
        if level_diff > 0 and gate_opening > 0:
            return True, level_diff
        elif level_diff > 0:
            return False, level_diff
        
        return False, level_diff
    
    @staticmethod
    def check_pump_cycle_violation(
        last_state_change: float,
        current_time: float,
        min_cycle_hours: float,
    ) -> Tuple[bool, float]:
        """
        检查泵启停间隔是否违反最小周期限制。
        
        Args:
            last_state_change: 上次状态改变的时间戳 (小时)
            current_time: 当前时间戳 (小时)
            min_cycle_hours: 最小启停间隔 (小时)
            
        Returns:
            (是否违规, 距满足要求还需等待的时间)
        """
        time_since_change = current_time - last_state_change
        
        if time_since_change < min_cycle_hours:
            return True, min_cycle_hours - time_since_change
        
        return False, 0.0
    
    @staticmethod
    def check_energy_limit(
        current_energy: float,
        daily_limit: Optional[float],
        hours_elapsed: float,
    ) -> Tuple[bool, float]:
        """
        检查能耗是否超限。
        
        Args:
            current_energy: 当前已消耗能量 (千瓦时)
            daily_limit: 每日能耗上限 (千瓦时)
            hours_elapsed: 已过去的小时数
            
        Returns:
            (是否超限, 超出量或剩余量)
        """
        if daily_limit is None or daily_limit <= 0:
            return False, 0.0
        
        projected_daily = current_energy * (24 / max(hours_elapsed, 0.01))
        
        if current_energy > daily_limit:
            return True, current_energy - daily_limit
        elif projected_daily > daily_limit * 1.1:
            return True, projected_daily - daily_limit
        
        return False, daily_limit - current_energy
    
    @staticmethod
    def interpolate_water_level(
        records: List,
        target_time: float,
        time_key: str = 'timestamp',
        level_key: str = 'inner_level',
    ) -> Optional[float]:
        """
        插值获取指定时间的水位。
        
        Args:
            records: 水位记录列表
            target_time: 目标时间 (小时，从某个基准点开始)
            time_key: 时间字段名
            level_key: 水位字段名
            
        Returns:
            插值后的水位，无数据时返回None
        """
        if not records:
            return None
        
        if len(records) == 1:
            return getattr(records[0], level_key)
        
        times = []
        levels = []
        
        for record in records:
            ts = getattr(record, time_key)
            if hasattr(ts, 'timestamp'):
                times.append(ts.timestamp() / 3600)
            else:
                times.append(float(ts))
            levels.append(getattr(record, level_key))
        
        if target_time <= times[0]:
            return levels[0]
        if target_time >= times[-1]:
            return levels[-1]
        
        return float(np.interp(target_time, times, levels))
