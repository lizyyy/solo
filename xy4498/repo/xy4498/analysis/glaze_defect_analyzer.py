import numpy as np
from typing import List, Optional, Dict, Any, Tuple
from dataclasses import dataclass

from models import (
    TemperatureLog, DefectRecord, KilnPosition,
    GlazeRecipe, GlazeDefectAssociation
)


class GlazeDefectAnalyzer:
    """釉面缺陷关联分析器"""
    
    DEFECT_CAUSES = {
        '开裂': [
            '升温过快导致釉面和坯体膨胀系数不匹配',
            '冷却阶段降温过快',
            '坯体厚度不均',
            '釉料熔融温度与烧成曲线不匹配'
        ],
        '气泡': [
            '升温过快，釉面过早封闭',
            '窑内气氛问题',
            '釉料配方中挥发性成分过多',
            '保温时间不足'
        ],
        '针孔': [
            '釉层过薄',
            '烧成温度不够',
            '釉料熔融不充分',
            '釉料中气泡破裂后未流平'
        ],
        '缩釉': [
            '釉料与坯体结合不良',
            '坯体表面清洁不充分',
            '釉层过厚',
            '升温速率不当'
        ],
        '流釉': [
            '烧成温度过高',
            '保温时间过长',
            '釉层过厚',
            '釉料熔融温度过低'
        ],
        '色差': [
            '窑内温度分布不均',
            '釉料配方批次差异',
            '烧成气氛不一致',
            '冷却速率影响'
        ]
    }
    
    def __init__(self):
        """初始化釉面缺陷关联分析器"""
        self.results: List[GlazeDefectAssociation] = []
    
    def analyze(self,
                temperature_logs: List[TemperatureLog],
                defect_records: List[DefectRecord],
                kiln_positions: List[KilnPosition],
                glaze_recipes: List[GlazeRecipe]) -> List[GlazeDefectAssociation]:
        """
        分析釉面缺陷关联
        
        Args:
            temperature_logs: 温度日志列表
            defect_records: 缺陷记录列表
            kiln_positions: 窑位列表
            glaze_recipes: 釉料配方列表
        
        Returns:
            釉面缺陷关联分析结果列表
        """
        self.results = []
        
        if not defect_records:
            return self.results
        
        position_map = {p.id: p for p in kiln_positions}
        glaze_map = {g.id: g for g in glaze_recipes}
        
        max_temp = self._get_max_temperature(temperature_logs)
        
        for defect in defect_records:
            position = position_map.get(defect.position_id)
            
            if position is None:
                continue
            
            glaze_recipe = None
            if position.glaze_recipe_id:
                glaze_recipe = glaze_map.get(position.glaze_recipe_id)
            
            possible_causes = self._identify_possible_causes(
                defect.defect_type,
                temperature_logs,
                glaze_recipe,
                max_temp
            )
            
            related_factors = self._analyze_related_factors(
                temperature_logs,
                glaze_recipe,
                max_temp
            )
            
            heating_rate_at_melting = None
            cooling_rate_at_melting = None
            
            if glaze_recipe and glaze_recipe.melting_temperature:
                heating_rate_at_melting = self._get_rate_at_temp(
                    temperature_logs,
                    glaze_recipe.melting_temperature,
                    is_heating=True
                )
                cooling_rate_at_melting = self._get_rate_at_temp(
                    temperature_logs,
                    glaze_recipe.melting_temperature,
                    is_heating=False
                )
            
            temp_difference = None
            if glaze_recipe and glaze_recipe.melting_temperature and max_temp:
                temp_difference = max_temp - glaze_recipe.melting_temperature
            
            association = GlazeDefectAssociation(
                defect_id=defect.id,
                defect_type=defect.defect_type,
                position_id=defect.position_id,
                position_code=position.code,
                glaze_recipe_id=glaze_recipe.id if glaze_recipe else None,
                glaze_recipe_name=glaze_recipe.name if glaze_recipe else None,
                possible_causes=possible_causes,
                related_factors=related_factors,
                glaze_melting_temp=glaze_recipe.melting_temperature if glaze_recipe else None,
                actual_max_temp=max_temp,
                temp_difference=temp_difference,
                heating_rate_at_melting=heating_rate_at_melting,
                cooling_rate_at_melting=cooling_rate_at_melting
            )
            
            self.results.append(association)
        
        return self.results
    
    def _identify_possible_causes(self,
                                    defect_type: str,
                                    temperature_logs: List[TemperatureLog],
                                    glaze_recipe: Optional[GlazeRecipe],
                                    max_temp: Optional[float]) -> List[str]:
        """识别可能的原因"""
        causes = []
        
        base_causes = self.DEFECT_CAUSES.get(defect_type, [])
        
        if base_causes:
            causes.extend(base_causes[:2])
        
        avg_heating_rate = self._calculate_avg_heating_rate(temperature_logs)
        
        if avg_heating_rate and avg_heating_rate > 3.0:
            if defect_type in ['开裂', '气泡']:
                causes.append(f'平均升温速率较高 ({avg_heating_rate:.2f}°C/分钟)')
        
        if glaze_recipe and glaze_recipe.melting_temperature and max_temp:
            temp_diff = max_temp - glaze_recipe.melting_temperature
            
            if temp_diff < 20:
                causes.append(f'烧成温度接近釉料熔融温度，可能导致熔融不充分')
            elif temp_diff > 100:
                causes.append(f'烧成温度过高，可能导致釉料过度熔融')
        
        if not causes and base_causes:
            causes = base_causes
        
        return causes
    
    def _analyze_related_factors(self,
                                   temperature_logs: List[TemperatureLog],
                                   glaze_recipe: Optional[GlazeRecipe],
                                   max_temp: Optional[float]) -> Dict[str, Any]:
        """分析相关因素"""
        factors = {}
        
        avg_heating_rate = self._calculate_avg_heating_rate(temperature_logs)
        if avg_heating_rate:
            factors['avg_heating_rate'] = avg_heating_rate
        
        if max_temp:
            factors['max_temperature'] = max_temp
        
        if glaze_recipe:
            factors['glaze_recipe'] = glaze_recipe.name
            if glaze_recipe.melting_temperature:
                factors['glaze_melting_temp'] = glaze_recipe.melting_temperature
                if max_temp:
                    factors['temp_margin'] = max_temp - glaze_recipe.melting_temperature
        
        return factors
    
    def _get_max_temperature(self, logs: List[TemperatureLog]) -> Optional[float]:
        """获取最高温度"""
        if not logs:
            return None
        return max(log.temperature for log in logs)
    
    def _calculate_avg_heating_rate(self, logs: List[TemperatureLog]) -> Optional[float]:
        """计算平均升温速率"""
        if len(logs) < 2:
            return None
        
        sorted_logs = sorted(logs, key=lambda x: x.time)
        
        total_temp_diff = 0
        total_time_diff = 0
        count = 0
        
        for i in range(1, len(sorted_logs)):
            time_diff = sorted_logs[i].time - sorted_logs[i-1].time
            temp_diff = sorted_logs[i].temperature - sorted_logs[i-1].temperature
            
            if time_diff > 0 and temp_diff > 0:
                total_temp_diff += temp_diff
                total_time_diff += time_diff
                count += 1
        
        if total_time_diff > 0:
            return total_temp_diff / total_time_diff
        
        return None
    
    def _get_rate_at_temp(self,
                           logs: List[TemperatureLog],
                           target_temp: float,
                           is_heating: bool) -> Optional[float]:
        """获取目标温度附近的升温/冷却速率"""
        if len(logs) < 2:
            return None
        
        sorted_logs = sorted(logs, key=lambda x: x.time)
        
        closest_idx = None
        min_diff = float('inf')
        
        for i, log in enumerate(sorted_logs):
            diff = abs(log.temperature - target_temp)
            if diff < min_diff:
                min_diff = diff
                closest_idx = i
        
        if closest_idx is None:
            return None
        
        if is_heating:
            if closest_idx > 0:
                time_diff = sorted_logs[closest_idx].time - sorted_logs[closest_idx-1].time
                temp_diff = sorted_logs[closest_idx].temperature - sorted_logs[closest_idx-1].temperature
                if time_diff > 0:
                    return temp_diff / time_diff
        else:
            if closest_idx < len(sorted_logs) - 1:
                time_diff = sorted_logs[closest_idx+1].time - sorted_logs[closest_idx].time
                temp_diff = sorted_logs[closest_idx].temperature - sorted_logs[closest_idx+1].temperature
                if time_diff > 0:
                    return temp_diff / time_diff
        
        return None
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取釉面缺陷关联统计信息"""
        if not self.results:
            return {
                'count': 0,
                'by_defect_type': {},
                'by_recipe': {}
            }
        
        by_defect_type = {}
        by_recipe = {}
        
        for result in self.results:
            by_defect_type[result.defect_type] = by_defect_type.get(result.defect_type, 0) + 1
            
            if result.glaze_recipe_name:
                by_recipe[result.glaze_recipe_name] = by_recipe.get(result.glaze_recipe_name, 0) + 1
        
        return {
            'count': len(self.results),
            'by_defect_type': by_defect_type,
            'by_recipe': by_recipe
        }
    
    def get_defects_by_type(self, defect_type: str) -> List[GlazeDefectAssociation]:
        """按缺陷类型获取关联分析结果"""
        return [r for r in self.results if r.defect_type == defect_type]
    
    def get_defects_by_recipe(self, recipe_name: str) -> List[GlazeDefectAssociation]:
        """按釉料配方获取关联分析结果"""
        return [r for r in self.results if r.glaze_recipe_name == recipe_name]
