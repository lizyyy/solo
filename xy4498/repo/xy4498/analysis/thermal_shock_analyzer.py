import numpy as np
from typing import List, Optional, Dict, Any, Tuple
from dataclasses import dataclass

from models import (
    TemperatureLog, BodyThickness, KilnPosition,
    ThermalShockRisk
)


class ThermalShockAnalyzer:
    """热冲击风险分析器"""
    
    RISK_LEVEL_LOW = '低'
    RISK_LEVEL_MEDIUM = '中'
    RISK_LEVEL_HIGH = '高'
    
    DEFAULT_THICKNESS_THRESHOLD = 1.5  # 厚度阈值（厘米）
    DEFAULT_RATE_THRESHOLD = 2.0  # 升温速率阈值（°C/分钟）
    DEFAULT_CRITICAL_TEMP_RANGE = (200, 600)  # 临界温度范围（石英晶型转变区）
    
    def __init__(self,
                 thickness_threshold: float = DEFAULT_THICKNESS_THRESHOLD,
                 rate_threshold: float = DEFAULT_RATE_THRESHOLD,
                 critical_temp_range: Tuple[float, float] = DEFAULT_CRITICAL_TEMP_RANGE):
        """
        初始化热冲击风险分析器
        
        Args:
            thickness_threshold: 坯体厚度阈值
            rate_threshold: 升温速率阈值
            critical_temp_range: 临界温度范围（石英晶型转变区）
        """
        self.thickness_threshold = thickness_threshold
        self.rate_threshold = rate_threshold
        self.critical_temp_range = critical_temp_range
        self.results: List[ThermalShockRisk] = []
    
    def analyze(self,
                temperature_logs: List[TemperatureLog],
                kiln_positions: List[KilnPosition],
                body_thicknesses: List[BodyThickness]) -> List[ThermalShockRisk]:
        """
        分析热冲击风险
        
        Args:
            temperature_logs: 温度日志列表
            kiln_positions: 窑位列表
            body_thicknesses: 坯体厚度列表
        
        Returns:
            热冲击风险分析结果列表
        """
        self.results = []
        
        if not temperature_logs or not kiln_positions:
            return self.results
        
        temp_change_rate = self._calculate_max_temp_change_rate(temperature_logs)
        
        thickness_map = {
            bt.position_id: bt.thickness
            for bt in body_thicknesses
        }
        
        for position in kiln_positions:
            thickness = thickness_map.get(position.id, 1.0)
            
            risk_level, risk_factors, max_rate = self._assess_risk(
                position, thickness, temperature_logs, temp_change_rate
            )
            
            recommendation = self._generate_recommendation(risk_level, risk_factors)
            
            thermal_shock_risk = ThermalShockRisk(
                position_id=position.id,
                position_code=position.code,
                risk_level=risk_level,
                risk_factors=risk_factors,
                max_temp_change_rate=max_rate,
                body_thickness=thickness,
                recommendation=recommendation
            )
            
            self.results.append(thermal_shock_risk)
        
        return self.results
    
    def _calculate_max_temp_change_rate(self,
                                         logs: List[TemperatureLog]) -> float:
        """计算最大温度变化率"""
        if len(logs) < 2:
            return 0.0
        
        sorted_logs = sorted(logs, key=lambda x: x.time)
        max_rate = 0.0
        
        for i in range(1, len(sorted_logs)):
            time_diff = sorted_logs[i].time - sorted_logs[i-1].time
            temp_diff = sorted_logs[i].temperature - sorted_logs[i-1].temperature
            
            if time_diff > 0:
                rate = abs(temp_diff) / time_diff
                max_rate = max(max_rate, rate)
        
        return max_rate
    
    def _assess_risk(self,
                     position: KilnPosition,
                     thickness: float,
                     logs: List[TemperatureLog],
                     max_rate: float) -> Tuple[str, List[str], float]:
        """
        评估热冲击风险
        
        Returns:
            (风险等级, 风险因素列表, 最大温度变化率)
        """
        risk_factors = []
        risk_score = 0
        
        if thickness >= self.thickness_threshold:
            risk_factors.append(f'坯体厚度较大 ({thickness:.1f}cm)')
            risk_score += 2
        
        if thickness >= self.thickness_threshold * 1.5:
            risk_factors.append(f'坯体超厚 ({thickness:.1f}cm)')
            risk_score += 1
        
        if max_rate > self.rate_threshold:
            risk_factors.append(f'升温速率过快 ({max_rate:.2f}°C/分钟)')
            risk_score += 3
        
        critical_temp_logs = [
            log for log in logs
            if self.critical_temp_range[0] <= log.temperature <= self.critical_temp_range[1]
        ]
        
        if critical_temp_logs and len(critical_temp_logs) >= 2:
            critical_logs_sorted = sorted(critical_temp_logs, key=lambda x: x.time)
            for i in range(1, len(critical_logs_sorted)):
                time_diff = critical_logs_sorted[i].time - critical_logs_sorted[i-1].time
                temp_diff = critical_logs_sorted[i].temperature - critical_logs_sorted[i-1].temperature
                
                if time_diff > 0:
                    rate = abs(temp_diff) / time_diff
                    if rate > self.rate_threshold * 0.8:
                        risk_factors.append(
                            f'临界温度区({self.critical_temp_range[0]}-{self.critical_temp_range[1]}°C)升温较快'
                        )
                        risk_score += 2
                        break
        
        if risk_score >= 5:
            risk_level = self.RISK_LEVEL_HIGH
        elif risk_score >= 2:
            risk_level = self.RISK_LEVEL_MEDIUM
        else:
            risk_level = self.RISK_LEVEL_LOW
        
        return risk_level, risk_factors, max_rate
    
    def _generate_recommendation(self,
                                 risk_level: str,
                                 risk_factors: List[str]) -> str:
        """生成建议"""
        recommendations = []
        
        if risk_level == self.RISK_LEVEL_HIGH:
            recommendations.append('【高风险】建议：')
            recommendations.append('1. 降低临界温度区(200-600°C)的升温速率')
            recommendations.append('2. 考虑增加保温阶段')
            recommendations.append('3. 对于厚坯体，建议采用更长的烧成周期')
            
        elif risk_level == self.RISK_LEVEL_MEDIUM:
            recommendations.append('【中等风险】建议：')
            recommendations.append('1. 注意监控升温速率')
            recommendations.append('2. 厚坯体可适当延长保温时间')
            
        else:
            recommendations.append('【低风险】正常烧成即可')
        
        if '升温速率过快' in str(risk_factors):
            recommendations.append('建议检查并优化升温程序')
        
        if '坯体厚度较大' in str(risk_factors) or '坯体超厚' in str(risk_factors):
            recommendations.append('厚坯体建议采用更保守的烧成曲线')
        
        return '\n'.join(recommendations)
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取热冲击风险统计信息"""
        if not self.results:
            return {
                'count': 0,
                'by_risk_level': {},
                'high_risk_positions': []
            }
        
        by_risk = {}
        high_risk = []
        
        for result in self.results:
            by_risk[result.risk_level] = by_risk.get(result.risk_level, 0) + 1
            
            if result.risk_level == self.RISK_LEVEL_HIGH:
                high_risk.append({
                    'position_code': result.position_code,
                    'risk_factors': result.risk_factors,
                    'max_rate': result.max_temp_change_rate,
                    'thickness': result.body_thickness
                })
        
        return {
            'count': len(self.results),
            'by_risk_level': by_risk,
            'high_risk_count': len(high_risk),
            'high_risk_positions': high_risk
        }
    
    def get_high_risk_positions(self) -> List[ThermalShockRisk]:
        """获取高风险窑位"""
        return [r for r in self.results if r.risk_level == self.RISK_LEVEL_HIGH]
    
    def get_medium_risk_positions(self) -> List[ThermalShockRisk]:
        """获取中等风险窑位"""
        return [r for r in self.results if r.risk_level == self.RISK_LEVEL_MEDIUM]
