from datetime import time, datetime
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field

from .models import (
    BatterySpec, Load, SolarPanel, Plan, WeatherProfile,
    DeviceType, LoadPriority, HourlyData
)


class UnitConverter:
    """单位转换器 - Wh/W/Ah 等单位换算"""
    
    @staticmethod
    def ah_to_wh(ah: float, voltage: float) -> float:
        """Ah (安时) 转换为 Wh (瓦时)"""
        return ah * voltage
    
    @staticmethod
    def wh_to_ah(wh: float, voltage: float) -> float:
        """Wh (瓦时) 转换为 Ah (安时)"""
        if voltage <= 0:
            raise ValueError("电压必须大于 0")
        return wh / voltage
    
    @staticmethod
    def w_to_a(watts: float, voltage: float) -> float:
        """W (瓦特) 转换为 A (安培)"""
        if voltage <= 0:
            raise ValueError("电压必须大于 0")
        return watts / voltage
    
    @staticmethod
    def a_to_w(amps: float, voltage: float) -> float:
        """A (安培) 转换为 W (瓦特)"""
        return amps * voltage
    
    @staticmethod
    def soc_to_wh(soc_percent: float, total_capacity_wh: float) -> float:
        """SOC (百分比) 转换为 Wh (瓦时)"""
        return total_capacity_wh * (soc_percent / 100.0)
    
    @staticmethod
    def wh_to_soc(wh: float, total_capacity_wh: float) -> float:
        """Wh (瓦时) 转换为 SOC (百分比)"""
        if total_capacity_wh <= 0:
            raise ValueError("总容量必须大于 0")
        return (wh / total_capacity_wh) * 100.0
    
    @staticmethod
    def calculate_energy(power_w: float, duration_hours: float) -> float:
        """根据功率和时间计算能耗 (Wh)"""
        return power_w * duration_hours
    
    @staticmethod
    def apply_efficiency(power: float, efficiency_percent: float) -> float:
        """应用效率转换（考虑损耗）"""
        return power * (efficiency_percent / 100.0)


@dataclass
class SimulationState:
    """模拟状态"""
    current_soc_percent: float
    current_energy_wh: float
    total_consumption_wh: float = 0.0
    total_solar_generation_wh: float = 0.0
    blackout_hour: Optional[int] = None
    hourly_data: List[Dict[str, Any]] = field(default_factory=list)


class LoadScheduler:
    """负载调度器 - 按时间段叠加负载"""
    
    @staticmethod
    def is_load_active(load: Load, hour: int) -> bool:
        """检查负载在指定小时是否激活"""
        load_start_hour = load.start_time.hour
        load_end_hour = load.end_time.hour
        
        if load_end_hour > load_start_hour:
            return load_start_hour <= hour < load_end_hour
        else:
            return hour >= load_start_hour or hour < load_end_hour
    
    @staticmethod
    def get_active_loads(loads: List[Load], hour: int) -> Tuple[List[Load], List[Load]]:
        """获取指定小时的活跃负载，返回 (DC负载列表, AC负载列表)"""
        dc_loads = []
        ac_loads = []
        
        for load in loads:
            if LoadScheduler.is_load_active(load, hour):
                if load.device_type == DeviceType.DC:
                    dc_loads.append(load)
                else:
                    ac_loads.append(load)
        
        return dc_loads, ac_loads
    
    @staticmethod
    def calculate_total_load_power(
        dc_loads: List[Load],
        ac_loads: List[Load],
        battery_voltage: float,
        inverter_efficiency_percent: float
    ) -> Tuple[float, float, float]:
        """计算总负载功率，返回 (DC总功率, AC总功率, 考虑损耗后的总功率)"""
        dc_power = sum(
            load.get_effective_power(battery_voltage, inverter_efficiency_percent)
            for load in dc_loads
        )
        ac_power = sum(
            load.get_effective_power(battery_voltage, inverter_efficiency_percent)
            for load in ac_loads
        )
        
        total_power = dc_power + ac_power
        return dc_power, ac_power, total_power
    
    @staticmethod
    def check_overlapping_loads(loads: List[Load]) -> List[Tuple[Load, Load]]:
        """检查负载时间重叠，返回重叠的负载对列表"""
        overlaps = []
        
        for i, load1 in enumerate(loads):
            for j, load2 in enumerate(loads[i + 1:], start=i + 1):
                if LoadScheduler._do_times_overlap(load1, load2):
                    overlaps.append((load1, load2))
        
        return overlaps
    
    @staticmethod
    def _do_times_overlap(load1: Load, load2: Load) -> bool:
        """检查两个负载的时间是否重叠"""
        start1 = load1.start_time.hour
        end1 = load1.end_time.hour
        start2 = load2.start_time.hour
        end2 = load2.end_time.hour
        
        if end1 > start1 and end2 > start2:
            return start1 < end2 and start2 < end1
        elif end1 <= start1 and end2 > start2:
            return end2 > start1 or start2 < end1
        elif end1 > start1 and end2 <= start2:
            return end1 > start2 or start1 < end2
        else:
            return True


class SolarCalculator:
    """太阳能计算器 - 太阳能分段输入和天气折减"""
    
    @staticmethod
    def calculate_hourly_generation(
        panels: List[SolarPanel],
        hour: int,
        weather_factor: float
    ) -> float:
        """计算指定小时的太阳能发电量"""
        total_generation = 0.0
        for panel in panels:
            generation = panel.get_hourly_output(hour, weather_factor)
            total_generation += generation
        return total_generation
    
    @staticmethod
    def get_default_solar_profile(start_hour: int, end_hour: int) -> Dict[int, float]:
        """获取默认的太阳能发电曲线（以中午12点为峰值的钟形曲线）"""
        profile = {}
        mid_hour = (start_hour + end_hour) // 2
        
        for hour in range(start_hour, end_hour):
            distance_from_mid = abs(hour - mid_hour)
            max_distance = mid_hour - start_hour
            if max_distance > 0:
                ratio = 1.0 - (distance_from_mid / max_distance)
                profile[hour] = max(0.1, ratio)
            else:
                profile[hour] = 1.0
        
        return profile


class BatterySimulator:
    """电池模拟器 - 核心模拟逻辑"""
    
    def __init__(
        self,
        battery: BatterySpec,
        loads: List[Load],
        solar_panels: List[SolarPanel],
        plan: Plan
    ):
        self.battery = battery
        self.loads = loads
        self.solar_panels = solar_panels
        self.plan = plan
        self.converter = UnitConverter()
        self.load_scheduler = LoadScheduler()
        self.solar_calc = SolarCalculator()
    
    def _get_weather_factor(self) -> float:
        """获取天气折减系数"""
        return self.plan.weather.factor_percent / 100.0
    
    def _calculate_voltage_from_soc(self, soc_percent: float) -> float:
        """根据 SOC 估算电池电压（简化模型）"""
        min_soc = self.battery.min_soc_percent
        max_soc = self.battery.max_soc_percent
        nominal_voltage = self.battery.voltage
        
        if soc_percent <= min_soc:
            return nominal_voltage * 0.9
        elif soc_percent >= max_soc:
            return nominal_voltage * 1.05
        else:
            soc_ratio = (soc_percent - min_soc) / (max_soc - min_soc)
            voltage_range = nominal_voltage * 0.15
            return nominal_voltage * 0.9 + voltage_range * soc_ratio
    
    def simulate(self) -> SimulationState:
        """执行完整模拟"""
        weather_factor = self._get_weather_factor()
        initial_energy = self.converter.soc_to_wh(
            self.battery.initial_soc_percent,
            self.battery.capacity_wh
        )
        
        state = SimulationState(
            current_soc_percent=self.battery.initial_soc_percent,
            current_energy_wh=initial_energy
        )
        
        for hour_offset in range(self.plan.simulation_duration_hours):
            actual_hour = (self.plan.simulation_start_hour + hour_offset) % 24
            
            if state.blackout_hour is not None:
                state.hourly_data.append(self._create_empty_hourly_data(actual_hour))
                continue
            
            dc_loads, ac_loads = self.load_scheduler.get_active_loads(
                self.loads, actual_hour
            )
            
            dc_power, ac_power, total_load_power = self.load_scheduler.calculate_total_load_power(
                dc_loads, ac_loads,
                self.battery.voltage,
                self.battery.inverter_efficiency_percent
            )
            
            solar_generation = self.solar_calc.calculate_hourly_generation(
                self.solar_panels, actual_hour, weather_factor
            )
            effective_solar = self.converter.apply_efficiency(
                solar_generation,
                self.battery.charge_efficiency_percent
            )
            
            net_power = effective_solar - total_load_power
            energy_change = net_power
            
            state.total_consumption_wh += total_load_power
            state.total_solar_generation_wh += solar_generation
            
            new_energy = state.current_energy_wh + energy_change
            min_allowed_energy = self.converter.soc_to_wh(
                self.battery.min_soc_percent,
                self.battery.capacity_wh
            )
            max_allowed_energy = self.converter.soc_to_wh(
                self.battery.max_soc_percent,
                self.battery.capacity_wh
            )
            
            is_blackout = False
            if new_energy < min_allowed_energy:
                state.blackout_hour = actual_hour
                new_energy = min_allowed_energy
                is_blackout = True
            elif new_energy > max_allowed_energy:
                new_energy = max_allowed_energy
            
            state.current_energy_wh = new_energy
            state.current_soc_percent = self.converter.wh_to_soc(
                new_energy, self.battery.capacity_wh
            )
            
            hourly_data = self._create_hourly_data(
                hour=actual_hour,
                state=state,
                dc_loads=dc_loads,
                ac_loads=ac_loads,
                dc_power=dc_power,
                ac_power=ac_power,
                total_load_power=total_load_power,
                solar_generation=solar_generation,
                effective_solar=effective_solar,
                net_power=net_power,
                energy_change=energy_change,
                is_blackout=is_blackout
            )
            state.hourly_data.append(hourly_data)
        
        return state
    
    def _create_hourly_data(
        self,
        hour: int,
        state: SimulationState,
        dc_loads: List[Load],
        ac_loads: List[Load],
        dc_power: float,
        ac_power: float,
        total_load_power: float,
        solar_generation: float,
        effective_solar: float,
        net_power: float,
        energy_change: float,
        is_blackout: bool
    ) -> Dict[str, Any]:
        """创建每小时数据记录"""
        voltage = self._calculate_voltage_from_soc(state.current_soc_percent)
        
        return {
            "hour": hour,
            "soc_percent": round(state.current_soc_percent, 2),
            "battery_voltage": round(voltage, 2),
            "total_load_w": round(total_load_power, 2),
            "dc_load_w": round(dc_power, 2),
            "ac_load_w": round(ac_power, 2),
            "solar_input_w": round(solar_generation, 2),
            "effective_solar_w": round(effective_solar, 2),
            "net_power_w": round(net_power, 2),
            "energy_change_wh": round(energy_change, 2),
            "dc_loads": [load.name for load in dc_loads],
            "ac_loads": [load.name for load in ac_loads],
            "is_blackout": is_blackout
        }
    
    def _create_empty_hourly_data(self, hour: int) -> Dict[str, Any]:
        """创建断电后的空数据记录"""
        return {
            "hour": hour,
            "soc_percent": round(self.battery.min_soc_percent, 2),
            "battery_voltage": round(self.battery.voltage * 0.9, 2),
            "total_load_w": 0.0,
            "dc_load_w": 0.0,
            "ac_load_w": 0.0,
            "solar_input_w": 0.0,
            "effective_solar_w": 0.0,
            "net_power_w": 0.0,
            "energy_change_wh": 0.0,
            "dc_loads": [],
            "ac_loads": [],
            "is_blackout": True,
            "note": "已断电"
        }
