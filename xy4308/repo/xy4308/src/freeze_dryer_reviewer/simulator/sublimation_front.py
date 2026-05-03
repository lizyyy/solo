"""升华前沿模拟计算模型"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
import numpy as np

from ..models import (
    BatchData, TemperatureData, VacuumData, RecipeInfo
)


@dataclass
class SublimationResult:
    """升华前沿计算结果"""
    estimated_sublimation_rate_g_h: float = 0.0
    estimated_remaining_ice_mass_g: float = 0.0
    estimated_subline_position_mm: float = 0.0
    estimated_primary_drying_end_time: Optional[datetime] = None
    estimated_primary_drying_completion_pct: float = 0.0
    time_profile: List[Dict[str, Any]] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "estimated_sublimation_rate_g_h": self.estimated_sublimation_rate_g_h,
            "estimated_remaining_ice_mass_g": self.estimated_remaining_ice_mass_g,
            "estimated_subline_position_mm": self.estimated_subline_position_mm,
            "estimated_primary_drying_end_time": (
                self.estimated_primary_drying_end_time.isoformat()
                if self.estimated_primary_drying_end_time else None
            ),
            "estimated_primary_drying_completion_pct": self.estimated_primary_drying_completion_pct,
            "time_profile": self.time_profile,
            "details": self.details,
            "warnings": self.warnings,
        }


class SublimationFrontSimulator:
    """
    升华前沿模拟器
    
    基于以下原理进行估算：
    1. 产品温度与搁板温度的差异反映升华界面位置
    2. 真空度和温度影响升华速率
    3. 通过热传导方程估算升华界面移动
    
    关键参数：
    - 冰的升华热：~2835 J/g
    - 冰的热导率：~2.2 W/(m·K)
    - 产品层热导率：~0.1 W/(m·K)（典型值）
    """
    
    LATENT_HEAT_SUBLIMATION = 2835.0
    ICE_THERMAL_CONDUCTIVITY = 2.2
    PRODUCT_THERMAL_CONDUCTIVITY = 0.1
    ICE_DENSITY = 0.92
    VIAL_DIAMETER_MM = 22.0
    
    def __init__(self):
        self.warnings: List[str] = []
    
    def simulate(self, batch: BatchData) -> SublimationResult:
        """执行升华前沿模拟"""
        result = SublimationResult()
        
        if not batch.shelf_temp and not batch.product_temp:
            result.warnings.append("缺少温度数据，无法进行升华前沿模拟")
            return result
        
        recipe = batch.recipe
        
        vial_count = 100
        fill_volume_ml = 5.0
        
        if recipe:
            if recipe.vial_count > 0:
                vial_count = recipe.vial_count
            if recipe.fill_volume_ml > 0:
                fill_volume_ml = recipe.fill_volume_ml
        
        initial_water_mass = vial_count * fill_volume_ml * 1.0
        
        if batch.shelf_temp and batch.product_temp:
            result = self._calculate_from_temperature_difference(
                batch.shelf_temp, 
                batch.product_temp,
                batch.vacuum,
                initial_water_mass,
                fill_volume_ml
            )
        elif batch.product_temp:
            result = self._calculate_from_product_temp(
                batch.product_temp,
                initial_water_mass,
                fill_volume_ml
            )
        elif batch.shelf_temp:
            result = self._calculate_from_shelf_temp(
                batch.shelf_temp,
                initial_water_mass,
                fill_volume_ml
            )
        
        result.warnings.extend(self.warnings)
        
        return result
    
    def _calculate_from_temperature_difference(
        self, 
        shelf_temp: TemperatureData,
        product_temp: TemperatureData,
        vacuum: Optional[VacuumData],
        initial_water_mass: float,
        fill_volume_ml: float
    ) -> SublimationResult:
        """基于搁板温度和产品温度差异计算"""
        result = SublimationResult()
        
        min_len = min(len(shelf_temp), len(product_temp))
        if min_len < 5:
            result.warnings.append("数据点不足，模拟结果可能不准确")
        
        common_times = []
        temp_differences = []
        
        for i in range(min_len):
            common_times.append(product_temp.timestamps[i])
            shelf_val = shelf_temp.get_value_at_time(product_temp.timestamps[i])
            prod_val = product_temp.values[i]
            
            if shelf_val is not None:
                temp_differences.append(shelf_val - prod_val)
            else:
                temp_differences.append(0.0)
        
        avg_temp_diff = np.mean(temp_differences) if temp_differences else 0
        
        vial_radius_m = (self.VIAL_DIAMETER_MM / 2) / 1000
        fill_height_mm = (fill_volume_ml / (3.1416 * (self.VIAL_DIAMETER_MM / 2) ** 2)) * 1000
        
        sublimation_rate = self._estimate_sublimation_rate(
            avg_temp_diff, 
            fill_height_mm,
            vial_radius_m
        )
        
        total_sublimed = 0.0
        time_profile = []
        
        for i in range(min_len):
            if i > 0:
                time_diff_h = (common_times[i] - common_times[i-1]).total_seconds() / 3600
                instantaneous_rate = self._estimate_sublimation_rate(
                    temp_differences[i],
                    fill_height_mm,
                    (self.VIAL_DIAMETER_MM / 2) / 1000
                )
                total_sublimed += instantaneous_rate * time_diff_h
            
            remaining_ice = initial_water_mass - total_sublimed
            completion_pct = min(100.0, (total_sublimed / initial_water_mass) * 100) if initial_water_mass > 0 else 0
            
            subline_position = fill_height_mm * (remaining_ice / initial_water_mass) if initial_water_mass > 0 else 0
            
            time_profile.append({
                "time": common_times[i].isoformat(),
                "temperature_difference_c": temp_differences[i],
                "instantaneous_sublimation_rate_g_h": self._estimate_sublimation_rate(
                    temp_differences[i],
                    fill_height_mm,
                    (self.VIAL_DIAMETER_MM / 2) / 1000
                ),
                "cumulative_sublimed_g": total_sublimed,
                "remaining_ice_g": max(0.0, remaining_ice),
                "subline_position_mm": subline_position,
                "completion_pct": completion_pct,
            })
        
        result.estimated_sublimation_rate_g_h = sublimation_rate
        result.estimated_remaining_ice_mass_g = max(0.0, initial_water_mass - total_sublimed)
        
        if time_profile:
            last_profile = time_profile[-1]
            result.estimated_subline_position_mm = last_profile["subline_position_mm"]
            result.estimated_primary_drying_completion_pct = last_profile["completion_pct"]
        
        result.time_profile = time_profile
        result.details = {
            "initial_water_mass_g": initial_water_mass,
            "fill_volume_ml": fill_volume_ml,
            "vial_count": int(initial_water_mass / fill_volume_ml) if fill_volume_ml > 0 else 0,
            "average_temperature_difference_c": float(avg_temp_diff),
            "estimated_fill_height_mm": fill_height_mm,
        }
        
        return result
    
    def _estimate_sublimation_rate(
        self, 
        temp_diff: float, 
        fill_height_mm: float,
        vial_radius_m: float
    ) -> float:
        """估算升华速率"""
        if temp_diff <= 0:
            return 0.0
        
        fill_height_m = fill_height_mm / 1000
        
        thermal_resistance = fill_height_m / (self.PRODUCT_THERMAL_CONDUCTIVITY * 3.1416 * vial_radius_m ** 2)
        
        heat_transfer_rate = temp_diff / thermal_resistance if thermal_resistance > 0 else 0
        
        sublimation_rate_g_s = heat_transfer_rate / self.LATENT_HEAT_SUBLIMATION
        sublimation_rate_g_h = sublimation_rate_g_s * 3600
        
        return max(0.0, sublimation_rate_g_h)
    
    def _calculate_from_product_temp(
        self,
        product_temp: TemperatureData,
        initial_water_mass: float,
        fill_volume_ml: float
    ) -> SublimationResult:
        """仅基于产品温度进行估算"""
        result = SublimationResult()
        
        if len(product_temp) < 5:
            result.warnings.append("产品温度数据点不足")
            return result
        
        temp_stats = product_temp.get_stats()
        avg_temp = temp_stats.get("mean", -40.0)
        
        base_rate = 0.1 * max(0.0, -avg_temp)
        
        time_profile = []
        total_sublimed = 0.0
        
        for i, ts in enumerate(product_temp.timestamps):
            if i > 0:
                time_diff_h = (ts - product_temp.timestamps[i-1]).total_seconds() / 3600
                total_sublimed += base_rate * time_diff_h
            
            remaining_ice = initial_water_mass - total_sublimed
            completion_pct = min(100.0, (total_sublimed / initial_water_mass) * 100) if initial_water_mass > 0 else 0
            
            fill_height_mm = (fill_volume_ml / (3.1416 * (self.VIAL_DIAMETER_MM / 2) ** 2)) * 1000
            subline_position = fill_height_mm * (remaining_ice / initial_water_mass) if initial_water_mass > 0 else 0
            
            time_profile.append({
                "time": ts.isoformat(),
                "product_temperature_c": product_temp.values[i],
                "instantaneous_sublimation_rate_g_h": base_rate,
                "cumulative_sublimed_g": total_sublimed,
                "remaining_ice_g": max(0.0, remaining_ice),
                "subline_position_mm": subline_position,
                "completion_pct": completion_pct,
                "note": "基于产品温度的估算（粗略）"
            })
        
        result.estimated_sublimation_rate_g_h = base_rate
        result.estimated_remaining_ice_mass_g = max(0.0, initial_water_mass - total_sublimed)
        
        if time_profile:
            last_profile = time_profile[-1]
            result.estimated_subline_position_mm = last_profile["subline_position_mm"]
            result.estimated_primary_drying_completion_pct = last_profile["completion_pct"]
        
        result.time_profile = time_profile
        result.details = {
            "initial_water_mass_g": initial_water_mass,
            "fill_volume_ml": fill_volume_ml,
            "average_product_temp_c": avg_temp,
            "note": "基于产品温度的粗略估算，建议同时提供搁板温度数据"
        }
        result.warnings.append("仅基于产品温度进行估算，结果可能不够准确，建议同时提供搁板温度数据")
        
        return result
    
    def _calculate_from_shelf_temp(
        self,
        shelf_temp: TemperatureData,
        initial_water_mass: float,
        fill_volume_ml: float
    ) -> SublimationResult:
        """仅基于搁板温度进行估算"""
        result = SublimationResult()
        
        temp_stats = shelf_temp.get_stats()
        avg_temp = temp_stats.get("mean", -20.0)
        
        base_rate = 0.05 * max(0.0, avg_temp + 50)
        
        result.estimated_sublimation_rate_g_h = base_rate
        result.estimated_remaining_ice_mass_g = initial_water_mass * 0.5
        result.estimated_subline_position_mm = 5.0
        result.estimated_primary_drying_completion_pct = 50.0
        
        result.details = {
            "initial_water_mass_g": initial_water_mass,
            "fill_volume_ml": fill_volume_ml,
            "average_shelf_temp_c": avg_temp,
            "note": "基于搁板温度的粗略估算"
        }
        result.warnings.append("仅基于搁板温度进行估算，结果可能不够准确，建议同时提供产品温度数据")
        
        return result
