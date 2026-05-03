"""
蒸散量计算器 - 计算潜在蒸散量和实际蒸散量
"""

import math
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple


class EvapotranspirationCalculator:
    """
    蒸散量计算器
    
    基于FAO Penman-Monteith方程计算参考蒸散量
    """
    
    def __init__(self):
        self.psychrometric_constant = 0.0665
    
    def calculate_et0(self, temperature: float, relative_humidity: float,
                      wind_speed: float, solar_radiation: float,
                      atmospheric_pressure: float = 101.3,
                      elevation: float = 0.0) -> float:
        """
        计算参考作物蒸散量（FAO Penman-Monteith方程）
        
        Args:
            temperature: 平均气温（℃）
            relative_humidity: 相对湿度（%）
            wind_speed: 风速（m/s）
            solar_radiation: 太阳辐射（MJ·m⁻²·day⁻¹）
            atmospheric_pressure: 大气压（kPa），默认101.3（海平面）
            elevation: 海拔高度（m），用于校正大气压
            
        Returns:
            参考蒸散量ET0（mm/day）
        """
        if elevation > 0:
            atmospheric_pressure = 101.3 * ((293 - 0.0065 * elevation) / 293) ** 5.26
        
        delta = self._calculate_slope_vapor_pressure(temperature)
        
        gamma = self.psychrometric_constant
        
        es = self._calculate_saturation_vapor_pressure(temperature)
        ea = es * (relative_humidity / 100.0)
        vpd = es - ea
        
        rn = solar_radiation * 0.77
        g = 0.0
        
        term1 = 0.408 * delta * (rn - g)
        term2 = gamma * (900.0 / (temperature + 273.0)) * wind_speed * vpd
        denominator = delta + gamma * (1 + 0.34 * wind_speed)
        
        et0 = (term1 + term2) / denominator
        
        return max(0.0, et0)
    
    def _calculate_slope_vapor_pressure(self, temperature: float) -> float:
        """
        计算饱和水汽压曲线斜率
        
        Δ = 4098 * es / (T + 237.3)²
        """
        es = self._calculate_saturation_vapor_pressure(temperature)
        delta = 4098.0 * es / (temperature + 237.3) ** 2
        return delta
    
    def _calculate_saturation_vapor_pressure(self, temperature: float) -> float:
        """
        计算饱和水汽压
        
        es = 0.6108 * exp(17.27 * T / (T + 237.3))
        """
        es = 0.6108 * math.exp(17.27 * temperature / (temperature + 237.3))
        return es
    
    def calculate_actual_evapotranspiration(self, et0: float, 
                                               kc: float,
                                               moisture_stress_factor: float = 1.0) -> float:
        """
        计算实际蒸散量
        
        ETc = Kc * ET0
        ETa = Ks * ETc
        
        Args:
            et0: 参考蒸散量（mm/day）
            kc: 作物系数
            moisture_stress_factor: 水分胁迫系数（0-1），1表示无胁迫
            
        Returns:
            实际蒸散量（mm/day）
        """
        etc = kc * et0
        eta = moisture_stress_factor * etc
        return max(0.0, eta)
    
    def get_crop_coefficient(self, growth_stage: str, crop_type: str = '蔬菜') -> float:
        """
        获取不同生长阶段的作物系数
        
        Args:
            growth_stage: 生长阶段
                - '催芽期' / 'germination'
                - '幼苗期' / 'seedling'
                - '成苗期' / 'growing'
                - '炼苗期' / 'hardening'
            crop_type: 作物类型
            
        Returns:
            作物系数Kc
        """
        stage_lower = growth_stage.lower()
        
        if '催芽' in growth_stage or 'germination' in stage_lower:
            return 0.5
        elif '幼苗' in growth_stage or 'seedling' in stage_lower:
            return 0.7
        elif '成苗' in growth_stage or 'growing' in stage_lower:
            return 1.0
        elif '炼苗' in growth_stage or 'hardening' in stage_lower:
            return 0.6
        else:
            return 0.8
    
    def calculate_water_deficit(self, current_moisture: float, 
                                  field_capacity: float,
                                  wilting_point: float,
                                  et0: float, kc: float = 0.8) -> Dict:
        """
        计算水分亏缺和灌溉需求
        
        Args:
            current_moisture: 当前基质含水量（体积含水量 %）
            field_capacity: 田间持水量（体积含水量 %）
            wilting_point: 萎蔫点（体积含水量 %）
            et0: 参考蒸散量（mm/day）
            kc: 作物系数
            
        Returns:
            包含水分亏缺信息的字典
        """
        available_water_max = field_capacity - wilting_point
        management_allowable_depletion = available_water_max * 0.5
        
        current_available = current_moisture - wilting_point
        current_available = max(0, current_available)
        
        depletion_percent = 1.0 - (current_available / available_water_max) if available_water_max > 0 else 1.0
        depletion_percent = max(0, min(1.0, depletion_percent))
        
        eta = self.calculate_actual_evapotranspiration(et0, kc)
        
        days_until_wilting = 0
        if eta > 0:
            days_until_wilting = current_available / (eta / 10)
        
        irrigation_needed_mm = max(0, (field_capacity - current_moisture) / 100 * 100)
        
        moisture_stress_level = self._assess_moisture_stress(
            current_moisture, field_capacity, wilting_point
        )
        
        return {
            'current_moisture': round(current_moisture, 1),
            'field_capacity': round(field_capacity, 1),
            'wilting_point': round(wilting_point, 1),
            'available_water_max': round(available_water_max, 1),
            'current_available': round(current_available, 1),
            'depletion_percent': round(depletion_percent * 100, 1),
            'actual_evapotranspiration': round(eta, 2),
            'days_until_wilting': round(days_until_wilting, 1),
            'irrigation_needed_mm': round(irrigation_needed_mm, 1),
            'stress_level': moisture_stress_level
        }
    
    def _assess_moisture_stress(self, current_moisture: float,
                                 field_capacity: float,
                                 wilting_point: float) -> Dict:
        """评估水分胁迫程度"""
        available_range = field_capacity - wilting_point
        optimal_low = field_capacity - available_range * 0.3
        optimal_high = field_capacity
        
        if current_moisture <= wilting_point:
            return {
                'level': 'critical',
                'status': '严重干旱',
                'immediate_action': '立即浇水',
                'score': 1
            }
        elif current_moisture < optimal_low:
            deficit = (optimal_low - current_moisture) / available_range
            if deficit > 0.3:
                return {
                    'level': 'high',
                    'status': '干旱',
                    'immediate_action': '建议浇水',
                    'score': 2
                }
            else:
                return {
                    'level': 'medium',
                    'status': '偏干',
                    'immediate_action': '密切关注',
                    'score': 3
                }
        elif current_moisture <= optimal_high:
            return {
                'level': 'normal',
                'status': '适宜',
                'immediate_action': '维持现状',
                'score': 5
            }
        else:
            excess = (current_moisture - optimal_high) / available_range
            if excess > 0.2:
                return {
                    'level': 'critical',
                    'status': '过湿积水',
                    'immediate_action': '停止浇水，增加通风',
                    'score': 1
                }
            else:
                return {
                    'level': 'high',
                    'status': '偏湿',
                    'immediate_action': '减少浇水',
                    'score': 3
                }
    
    def estimate_tray_water_loss(self, et0: float, tray_area: float = 0.3,
                                   crop_coverage: float = 0.8, kc: float = 0.8) -> float:
        """
        估算单个苗盘的水分损失量
        
        Args:
            et0: 参考蒸散量（mm/day）
            tray_area: 苗盘面积（m²），标准穴盘约0.3 m²
            crop_coverage: 作物覆盖度（0-1）
            kc: 作物系数
            
        Returns:
            苗盘每日水分损失量（升/天）
        """
        effective_area = tray_area * crop_coverage
        water_loss_m3 = (et0 / 1000) * effective_area * kc
        water_loss_liters = water_loss_m3 * 1000
        
        return water_loss_liters
