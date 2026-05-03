from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum

from .models import (
    BatterySpec, Load, SolarPanel, Plan, LoadPriority, DeviceType
)
from .calculator import (
    SimulationState, LoadScheduler, UnitConverter
)


class RiskLevel(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class RiskType(str, Enum):
    OVERLOAD = "overload"
    BLACKOUT = "blackout"
    LOW_SOC = "low_soc"
    UNDER_VOLTAGE = "under_voltage"
    SOLAR_INSUFFICIENT = "solar_insufficient"
    TIME_OVERLAP = "time_overlap"
    CRITICAL_DEVICE_OFF = "critical_device_off"


@dataclass
class Risk:
    """风险信息"""
    risk_type: RiskType
    level: RiskLevel
    message: str
    hour: Optional[int] = None
    affected_devices: List[str] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "risk_type": self.risk_type.value,
            "level": self.level.value,
            "message": self.message,
            "hour": self.hour,
            "affected_devices": self.affected_devices,
            "details": self.details
        }


class RiskAnalyzer:
    """风险分析器 - 检测过载、欠压、补电不足、关键设备断电等风险"""
    
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
    
    def analyze_all(self, simulation_state: SimulationState) -> List[Risk]:
        """执行所有风险分析"""
        risks: List[Risk] = []
        
        risks.extend(self._check_time_overlaps())
        risks.extend(self._check_inverter_overload())
        risks.extend(self._check_blackout_risk(simulation_state))
        risks.extend(self._check_low_soc_risk(simulation_state))
        risks.extend(self._check_solar_insufficiency(simulation_state))
        risks.extend(self._check_critical_device_risks(simulation_state))
        
        return sorted(risks, key=lambda r: self._risk_level_order(r.level))
    
    def _risk_level_order(self, level: RiskLevel) -> int:
        order = {
            RiskLevel.CRITICAL: 0,
            RiskLevel.HIGH: 1,
            RiskLevel.MEDIUM: 2,
            RiskLevel.LOW: 3
        }
        return order.get(level, 4)
    
    def _check_time_overlaps(self) -> List[Risk]:
        """检查负载时间重叠"""
        risks: List[Risk] = []
        overlaps = self.load_scheduler.check_overlapping_loads(self.loads)
        
        for load1, load2 in overlaps:
            risks.append(Risk(
                risk_type=RiskType.TIME_OVERLAP,
                level=RiskLevel.MEDIUM,
                message=f"设备 '{load1.name}' 和 '{load2.name}' 的使用时间存在重叠",
                affected_devices=[load1.name, load2.name],
                details={
                    "device1": {
                        "name": load1.name,
                        "start": str(load1.start_time),
                        "end": str(load1.end_time)
                    },
                    "device2": {
                        "name": load2.name,
                        "start": str(load2.start_time),
                        "end": str(load2.end_time)
                    }
                }
            ))
        
        return risks
    
    def _check_inverter_overload(self) -> List[Risk]:
        """检查逆变器过载风险"""
        risks: List[Risk] = []
        inverter_max = self.battery.inverter_max_power_w
        
        for hour in range(24):
            dc_loads, ac_loads = self.load_scheduler.get_active_loads(self.loads, hour)
            
            dc_power, ac_power, total_power = self.load_scheduler.calculate_total_load_power(
                dc_loads, ac_loads,
                self.battery.voltage,
                self.battery.inverter_efficiency_percent
            )
            
            actual_ac_power = sum(load.actual_power_w for load in ac_loads)
            
            if actual_ac_power > inverter_max:
                overload_amount = actual_ac_power - inverter_max
                risks.append(Risk(
                    risk_type=RiskType.OVERLOAD,
                    level=RiskLevel.CRITICAL,
                    message=f"在 {hour:02d}:00 时，AC 负载总功率 ({actual_ac_power:.1f}W) 超出逆变器上限 ({inverter_max:.1f}W)，超载 {overload_amount:.1f}W",
                    hour=hour,
                    affected_devices=[load.name for load in ac_loads],
                    details={
                        "total_ac_power": actual_ac_power,
                        "inverter_max": inverter_max,
                        "overload_amount": overload_amount,
                        "ac_devices": [load.name for load in ac_loads]
                    }
                ))
        
        return risks
    
    def _check_blackout_risk(self, state: SimulationState) -> List[Risk]:
        """检查断电风险"""
        risks: List[Risk] = []
        
        if state.blackout_hour is not None:
            risks.append(Risk(
                risk_type=RiskType.BLACKOUT,
                level=RiskLevel.CRITICAL,
                message=f"预计在 {state.blackout_hour:02d}:00 左右电池电量耗尽，发生断电",
                hour=state.blackout_hour,
                details={
                    "blackout_hour": state.blackout_hour,
                    "min_soc_percent": self.battery.min_soc_percent
                }
            ))
        
        return risks
    
    def _check_low_soc_risk(self, state: SimulationState) -> List[Risk]:
        """检查低 SOC 风险"""
        risks: List[Risk] = []
        warning_threshold = self.battery.min_soc_percent + 10.0
        
        for hourly_data in state.hourly_data:
            soc = hourly_data.get("soc_percent", 100.0)
            hour = hourly_data.get("hour", 0)
            is_blackout = hourly_data.get("is_blackout", False)
            
            if is_blackout:
                continue
            
            if self.battery.min_soc_percent < soc <= warning_threshold:
                risks.append(Risk(
                    risk_type=RiskType.LOW_SOC,
                    level=RiskLevel.HIGH,
                    message=f"在 {hour:02d}:00 时，SOC 降至 {soc:.1f}%，接近最低允许值 {self.battery.min_soc_percent}%",
                    hour=hour,
                    details={
                        "current_soc": soc,
                        "min_soc": self.battery.min_soc_percent
                    }
                ))
                break
        
        return risks
    
    def _check_solar_insufficiency(self, state: SimulationState) -> List[Risk]:
        """检查太阳能补电不足风险"""
        risks: List[Risk] = []
        
        if not self.solar_panels:
            return risks
        
        total_solar = state.total_solar_generation_wh
        total_consumption = state.total_consumption_wh
        
        net_needed = total_consumption - (
            self.converter.soc_to_wh(
                self.battery.initial_soc_percent - self.battery.min_soc_percent,
                self.battery.capacity_wh
            )
        )
        
        if total_solar < net_needed and net_needed > 0:
            deficit = net_needed - total_solar
            percentage = (deficit / net_needed * 100 if net_needed > 0 else 0)
            
            risks.append(Risk(
                risk_type=RiskType.SOLAR_INSUFFICIENT,
                level=RiskLevel.HIGH,
                message=f"太阳能补电不足。总发电量 {total_solar:.0f}Wh，需要补充 {net_needed:.0f}Wh，缺口 {deficit:.0f}Wh ({percentage:.0f}%)",
                details={
                    "total_solar_wh": total_solar,
                    "needed_wh": net_needed,
                    "deficit_wh": deficit,
                    "deficit_percent": percentage
                }
            ))
        
        return risks
    
    def _check_critical_device_risks(self, state: SimulationState) -> List[Risk]:
        """检查关键设备断电风险"""
        risks: List[Risk] = []
        
        if state.blackout_hour is None:
            return risks
        
        critical_loads = [
            load for load in self.loads 
            if load.priority == LoadPriority.CRITICAL
        ]
        
        for load in critical_loads:
            load_start = load.start_time.hour
            load_end = load.end_time.hour
            
            if load_end > load_start:
                is_during_blackout = (
                    load_start <= state.blackout_hour < load_end)
            else:
                is_during_blackout = (
                    state.blackout_hour >= load_start or 
                    state.blackout_hour < load_end
                )
            
            if is_during_blackout:
                risks.append(Risk(
                    risk_type=RiskType.CRITICAL_DEVICE_OFF,
                    level=RiskLevel.CRITICAL,
                    message=f"关键设备 '{load.name}' 在 {state.blackout_hour:02d}:00 断电时仍在使用中",
                    hour=state.blackout_hour,
                    affected_devices=[load.name],
                    details={
                        "device": load.name,
                        "device_start": str(load.start_time),
                        "device_end": str(load.end_time),
                        "blackout_hour": state.blackout_hour
                    }
                ))
        
        return risks
    
    def generate_recommendations(self, risks: List[Risk]) -> List[str]:
        """根据风险生成建议"""
        recommendations: List[str] = []
        seen_recommendations = set()
        
        for risk in risks:
            recs = self._get_recommendations_for_risk(risk)
            for rec in recs:
                if rec not in seen_recommendations:
                    seen_recommendations.add(rec)
                    recommendations.append(rec)
        
        if not risks:
            recommendations.append("当前配置看起来安全，请继续监控。")
        
        return recommendations
    
    def _get_recommendations_for_risk(self, risk: Risk) -> List[str]:
        """为特定风险的建议"""
        recommendations: List[str] = []
        
        if risk.risk_type == RiskType.OVERLOAD:
            recommendations.append("建议：错开大功率电器的使用时间，避免同时开启多个 AC 负载。")
            recommendations.append("建议：考虑使用更大功率的逆变器，或者改用 DC 供电的设备。")
        
        elif risk.risk_type == RiskType.BLACKOUT:
            recommendations.append("建议：减少高功耗设备的使用时间，或者缩短使用时长。")
            recommendations.append("建议：考虑增加电池容量，或者增加太阳能板功率。")
            recommendations.append("建议：将非关键设备的使用时间调整到太阳能发电高峰期。")
        
        elif risk.risk_type == RiskType.LOW_SOC:
            recommendations.append("建议：在 SOC 接近最低值前关闭非关键设备，延长续航时间。")
            recommendations.append("建议：考虑降低最低 SOC 阈值（不建议低于 10%）。")
        
        elif risk.risk_type == RiskType.SOLAR_INSUFFICIENT:
            recommendations.append("建议：增加太阳能板数量或功率。")
            recommendations.append("建议：选择日照充足的使用时间调整到中午时段。")
            recommendations.append("建议：考虑使用天气情况，阴天时减少设备使用。")
        
        elif risk.risk_type == RiskType.TIME_OVERLAP:
            recommendations.append("建议：调整重叠设备的使用时间，避免同时使用。")
        
        elif risk.risk_type == RiskType.CRITICAL_DEVICE_OFF:
            recommendations.append(f"建议：为关键设备单独配备备用电源，或调整使用时间。")
        
        return recommendations
