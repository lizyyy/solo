"""
升温速率规则
检查升温速率是否超限
"""

from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from .base_rule import BaseRule
from ..models import (
    Risk, RiskType, RiskLevel, 
    TemperaturePoint, FiringPlan, FiringSegment, FiringRecord
)


class HeatingRateRule(BaseRule):
    """升温速率检查规则"""
    
    def __init__(self, 
                 default_max_rate: float = 200.0,  # 默认最大升温速率 (°C/hour)
                 rate_tolerance: float = 10.0,  # 允许的偏差
                 window_minutes: int = 10):  # 计算速率的时间窗口（分钟）
        super().__init__(
            name="升温速率检查",
            description="检查实际升温速率是否超过计划或预设限值"
        )
        self.default_max_rate = default_max_rate
        self.rate_tolerance = rate_tolerance
        self.window_minutes = window_minutes
        self.risk_counter = 0
    
    def check(self, firing_record: FiringRecord) -> List[Risk]:
        """
        检查升温速率
        
        Args:
            firing_record: 烧成记录
            
        Returns:
            风险列表
        """
        self.clear()
        risks: List[Risk] = []
        
        if not firing_record.temperature_data:
            self.add_warning("没有温度数据，无法检查升温速率")
            return risks
        
        temperature_points = sorted(firing_record.temperature_data, key=lambda p: p.timestamp)
        
        if len(temperature_points) < 2:
            self.add_warning("温度数据点不足，无法计算升温速率")
            return risks
        
        max_rates = self._get_max_rates(firing_record.firing_plan)
        
        for i, point in enumerate(temperature_points):
            current_rates = self._calculate_rates_at_point(temperature_points, i)
            
            for layer_name, rate in current_rates.items():
                max_allowed = self._get_max_rate_for_time(max_rates, point.timestamp)
                
                if rate > (max_allowed + self.rate_tolerance):
                    risk = self._create_rate_risk(
                        point=point,
                        layer_name=layer_name,
                        actual_rate=rate,
                        max_rate=max_allowed
                    )
                    risks.append(risk)
        
        return risks
    
    def _get_max_rates(self, firing_plan: Optional[FiringPlan]) -> List[Tuple[datetime, datetime, float]]:
        """
        根据烧成计划获取各时间段的最大允许升温速率
        
        Returns:
            列表，每项为 (开始时间, 结束时间, 最大速率)
        """
        if not firing_plan or not firing_plan.segments:
            return [(None, None, self.default_max_rate)]
        
        rates = []
        current_time = None
        
        for segment in firing_plan.segments:
            if segment.rate > 0:
                duration_hours = segment.temperature_range / segment.rate if segment.rate > 0 else 0
                duration = timedelta(hours=duration_hours)
                
                start_time = current_time if current_time else datetime.min
                end_time = start_time + duration
                
                rates.append((start_time, end_time, segment.rate))
                current_time = end_time
            
            if segment.hold_time:
                if current_time:
                    start_hold = current_time
                    end_hold = start_hold + segment.hold_time
                    rates.append((start_hold, end_hold, 0.0))
                    current_time = end_hold
        
        return rates if rates else [(None, None, self.default_max_rate)]
    
    def _get_max_rate_for_time(self, 
                                max_rates: List[Tuple[datetime, datetime, float]], 
                                timestamp: datetime) -> float:
        """获取指定时间点的最大允许升温速率"""
        for start, end, rate in max_rates:
            if start is None and end is None:
                return rate
            if start <= timestamp <= end:
                return rate
            if timestamp < start:
                return rate
        
        return max_rates[-1][2] if max_rates else self.default_max_rate
    
    def _calculate_rates_at_point(self, 
                                   points: List[TemperaturePoint], 
                                   current_index: int) -> Dict[str, float]:
        """
        计算指定点的升温速率
        
        Args:
            points: 温度点列表（已排序）
            current_index: 当前点索引
            
        Returns:
            各层的升温速率字典
        """
        if current_index == 0:
            return {}
        
        current_point = points[current_index]
        prev_point = points[current_index - 1]
        
        time_delta = current_point.timestamp - prev_point.timestamp
        time_hours = time_delta.total_seconds() / 3600
        
        if time_hours <= 0:
            return {}
        
        rates: Dict[str, float] = {}
        
        for layer_name in current_point.temperatures.keys():
            if layer_name in prev_point.temperatures:
                temp_delta = current_point.temperatures[layer_name] - prev_point.temperatures[layer_name]
                rate = temp_delta / time_hours
                rates[layer_name] = rate
        
        return rates
    
    def _create_rate_risk(self, 
                           point: TemperaturePoint,
                           layer_name: str,
                           actual_rate: float,
                           max_rate: float) -> Risk:
        """创建升温速率超限风险"""
        self.risk_counter += 1
        
        excess_rate = actual_rate - max_rate
        
        if excess_rate > 50:
            level = RiskLevel.CRITICAL
        elif excess_rate > 30:
            level = RiskLevel.HIGH
        elif excess_rate > 15:
            level = RiskLevel.MEDIUM
        else:
            level = RiskLevel.LOW
        
        return Risk(
            risk_id=f"RATE-{self.risk_counter:04d}",
            risk_type=RiskType.RATE_EXCEEDED,
            level=level,
            title=f"升温速率超限 - {layer_name}",
            description=f"在 {point.timestamp.strftime('%Y-%m-%d %H:%M')} 时，"
                       f"{layer_name} 升温速率为 {actual_rate:.1f}°C/小时，"
                       f"超过限值 {max_rate:.1f}°C/小时，"
                       f"超限 {excess_rate:.1f}°C/小时。"
                       f"当前温度：{point.temperatures.get(layer_name, 0):.1f}°C",
            timestamp=point.timestamp,
            related_data={
                "layer": layer_name,
                "actual_rate": actual_rate,
                "max_rate": max_rate,
                "excess_rate": excess_rate,
                "temperature": point.temperatures.get(layer_name, 0)
            }
        )
