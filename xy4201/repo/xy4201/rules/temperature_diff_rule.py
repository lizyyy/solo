"""
层间温差规则
检查各层之间的温差是否过大
"""

from datetime import datetime
from typing import List, Dict, Optional
from .base_rule import BaseRule
from ..models import (
    Risk, RiskType, RiskLevel, 
    TemperaturePoint, FiringRecord
)


class TemperatureDifferenceRule(BaseRule):
    """层间温差检查规则"""
    
    def __init__(self,
                 max_allowed_diff: float = 30.0,  # 最大允许温差 (°C)
                 warning_diff: float = 20.0,  # 警告级温差
                 high_risk_temp_threshold: float = 800.0):  # 高温风险阈值
        super().__init__(
            name="层间温差检查",
            description="检查窑炉各层之间的温差是否超过允许范围"
        )
        self.max_allowed_diff = max_allowed_diff
        self.warning_diff = warning_diff
        self.high_risk_temp_threshold = high_risk_temp_threshold
        self.risk_counter = 0
    
    def check(self, firing_record: FiringRecord) -> List[Risk]:
        """
        检查层间温差
        
        Args:
            firing_record: 烧成记录
            
        Returns:
            风险列表
        """
        self.clear()
        risks: List[Risk] = []
        
        if not firing_record.temperature_data:
            self.add_warning("没有温度数据，无法检查层间温差")
            return risks
        
        layer_count = self._get_layer_count(firing_record.temperature_data)
        if layer_count < 2:
            self.add_warning("温度数据层少于2层，无法检查层间温差")
            return risks
        
        consecutive_exceeds = {}  # 跟踪连续超限的时间
        max_consecutive_exceeds = {}  # 记录最大的连续超限
        
        for point in firing_record.temperature_data:
            diff = point.temperature_difference
            
            if diff > self.warning_diff:
                layer_pair = self._get_max_diff_layers(point.temperatures)
                
                if diff > self.max_allowed_diff:
                    risk_key = f"{layer_pair[0]}-{layer_pair[1]}"
                    if risk_key not in consecutive_exceeds:
                        consecutive_exceeds[risk_key] = {
                            'start_time': point.timestamp,
                            'max_diff': diff,
                            'max_temp': point.max_temperature,
                            'layers': layer_pair
                        }
                    else:
                        if diff > consecutive_exceeds[risk_key]['max_diff']:
                            consecutive_exceeds[risk_key]['max_diff'] = diff
                            consecutive_exceeds[risk_key]['max_temp'] = point.max_temperature
                else:
                    risk = self._create_warning_risk(point, diff, layer_pair)
                    risks.append(risk)
        
        for risk_key, exceed_info in consecutive_exceeds.items():
            risk = self._create_high_risk(exceed_info)
            risks.append(risk)
        
        return risks
    
    def _get_layer_count(self, points: List[TemperaturePoint]) -> int:
        """获取温度数据的层数"""
        if not points:
            return 0
        return len(points[0].temperatures)
    
    def _get_max_diff_layers(self, temperatures: Dict[str, float]) -> tuple:
        """获取温差最大的两个层"""
        if len(temperatures) < 2:
            return ("", "")
        
        sorted_layers = sorted(temperatures.items(), key=lambda x: x[1])
        return (sorted_layers[0][0], sorted_layers[-1][0])
    
    def _create_warning_risk(self,
                              point: TemperaturePoint,
                              diff: float,
                              layer_pair: tuple) -> Risk:
        """创建温差警告风险"""
        self.risk_counter += 1
        
        is_high_temp = point.avg_temperature >= self.high_risk_temp_threshold
        
        if is_high_temp:
            level = RiskLevel.MEDIUM
        else:
            level = RiskLevel.LOW
        
        cold_layer, hot_layer = layer_pair
        
        return Risk(
            risk_id=f"DIFF-{self.risk_counter:04d}",
            risk_type=RiskType.TEMPERATURE_DIFFERENCE,
            level=level,
            title=f"层间温差警告",
            description=f"在 {point.timestamp.strftime('%Y-%m-%d %H:%M')} 时，"
                       f"层间温差为 {diff:.1f}°C，"
                       f"超过警告阈值 {self.warning_diff:.1f}°C。\n"
                       f"最高温层 '{hot_layer}': {point.temperatures.get(hot_layer, 0):.1f}°C\n"
                       f"最低温层 '{cold_layer}': {point.temperatures.get(cold_layer, 0):.1f}°C\n"
                       f"平均温度: {point.avg_temperature:.1f}°C",
            timestamp=point.timestamp,
            related_data={
                "temperature_difference": diff,
                "warning_threshold": self.warning_diff,
                "hot_layer": hot_layer,
                "cold_layer": cold_layer,
                "hot_temperature": point.temperatures.get(hot_layer, 0),
                "cold_temperature": point.temperatures.get(cold_layer, 0),
                "average_temperature": point.avg_temperature
            }
        )
    
    def _create_high_risk(self, exceed_info: Dict) -> Risk:
        """创建高风险温差"""
        self.risk_counter += 1
        
        diff = exceed_info['max_diff']
        max_temp = exceed_info['max_temp']
        cold_layer, hot_layer = exceed_info['layers']
        
        is_high_temp = max_temp >= self.high_risk_temp_threshold
        
        if diff > self.max_allowed_diff + 20 and is_high_temp:
            level = RiskLevel.CRITICAL
        elif diff > self.max_allowed_diff + 10:
            level = RiskLevel.HIGH
        else:
            level = RiskLevel.MEDIUM
        
        return Risk(
            risk_id=f"DIFF-{self.risk_counter:04d}",
            risk_type=RiskType.TEMPERATURE_DIFFERENCE,
            level=level,
            title=f"层间温差过大 - 严重警告",
            description=f"在 {exceed_info['start_time'].strftime('%Y-%m-%d %H:%M')} 开始，"
                       f"层间温差达到 {diff:.1f}°C，"
                       f"严重超过限值 {self.max_allowed_diff:.1f}°C。\n"
                       f"最高温层 '{hot_layer}': {exceed_info.get('max_temp', 0):.1f}°C\n"
                       f"最低温层 '{cold_layer}': {exceed_info.get('max_temp', 0) - diff:.1f}°C\n"
                       f"{'⚠️ 高温阶段温差过大，可能导致釉面效果不均或作品开裂！' if is_high_temp else ''}",
            timestamp=exceed_info['start_time'],
            related_data={
                "temperature_difference": diff,
                "max_allowed_diff": self.max_allowed_diff,
                "excess_diff": diff - self.max_allowed_diff,
                "hot_layer": hot_layer,
                "cold_layer": cold_layer,
                "max_temperature": max_temp,
                "is_high_temperature_phase": is_high_temp
            }
        )
