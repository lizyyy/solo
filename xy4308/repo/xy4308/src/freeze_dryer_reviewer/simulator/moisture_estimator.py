"""残余水分估算模型"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
import numpy as np

from ..models import (
    BatchData, TemperatureData, VacuumData, MoistureData, RecipeInfo
)


@dataclass
class MoistureResult:
    """残余水分计算结果"""
    estimated_residual_moisture_pct: float = 0.0
    estimated_bound_water_pct: float = 0.0
    estimated_free_water_pct: float = 0.0
    estimated_drying_rate_pct_h: float = 0.0
    estimated_secondary_drying_end_time: Optional[datetime] = None
    time_profile: List[Dict[str, Any]] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "estimated_residual_moisture_pct": self.estimated_residual_moisture_pct,
            "estimated_bound_water_pct": self.estimated_bound_water_pct,
            "estimated_free_water_pct": self.estimated_free_water_pct,
            "estimated_drying_rate_pct_h": self.estimated_drying_rate_pct_h,
            "estimated_secondary_drying_end_time": (
                self.estimated_secondary_drying_end_time.isoformat()
                if self.estimated_secondary_drying_end_time else None
            ),
            "time_profile": self.time_profile,
            "details": self.details,
            "warnings": self.warnings,
        }


class MoistureEstimator:
    """
    残余水分估算器
    
    基于以下原理进行估算：
    1. 一次干燥去除游离水
    2. 二次干燥去除结合水
    3. 温度和真空度影响解吸速率
    4. 基于Arrhenius方程估算水分去除速率
    
    关键参数：
    - 典型产品初始水分：约90%（对于液体制剂）
    - 一次干燥后水分：约8-15%
    - 目标残余水分：通常<3%
    """
    
    TYPICAL_INITIAL_MOISTURE_PCT = 90.0
    TYPICAL_POST_PRIMARY_MOISTURE_PCT = 10.0
    TYPICAL_TARGET_MOISTURE_PCT = 2.0
    
    ACTIVATION_ENERGY = 50000.0
    GAS_CONSTANT = 8.314
    
    def __init__(self):
        self.warnings: List[str] = []
    
    def estimate(self, batch: BatchData) -> MoistureResult:
        """执行残余水分估算"""
        result = MoistureResult()
        
        if batch.moisture and batch.moisture.values:
            result = self._estimate_from_measured_data(batch)
        elif batch.shelf_temp or batch.product_temp:
            result = self._estimate_from_process_data(batch)
        else:
            result.warnings.append("缺少温度数据或水分测量数据，无法进行水分估算")
            return result
        
        result.warnings.extend(self.warnings)
        
        return result
    
    def _estimate_from_measured_data(self, batch: BatchData) -> MoistureResult:
        """基于实际测量的水分数据进行估算"""
        result = MoistureResult()
        
        moisture_stats = batch.moisture.get_stats()
        
        current_moisture = moisture_stats.get("mean", 5.0)
        
        result.estimated_residual_moisture_pct = current_moisture
        
        if len(batch.moisture.values) >= 2:
            time_diff_h = 0.0
            if len(batch.moisture.timestamps) >= 2:
                time_diff_h = (
                    batch.moisture.timestamps[-1] - batch.moisture.timestamps[0]
                ).total_seconds() / 3600
            
            if time_diff_h > 0:
                moisture_diff = batch.moisture.values[0] - batch.moisture.values[-1]
                drying_rate = moisture_diff / time_diff_h
                result.estimated_drying_rate_pct_h = drying_rate
        
        result.estimated_bound_water_pct = max(0.0, current_moisture - 2.0)
        result.estimated_free_water_pct = max(0.0, current_moisture - result.estimated_bound_water_pct)
        
        time_profile = []
        for i, sample in enumerate(batch.moisture.samples):
            time_profile.append({
                "time": sample.get("time", datetime.now()).isoformat() if sample.get("time") else None,
                "moisture_pct": sample.get("moisture_pct", 0.0),
                "sample_id": sample.get("sample_id"),
                "location": sample.get("location"),
                "is_measured": True,
            })
        
        result.time_profile = time_profile
        result.details = {
            "source": "measured_data",
            "measurement_count": len(batch.moisture.values),
            "moisture_stats": moisture_stats,
        }
        
        return result
    
    def _estimate_from_process_data(self, batch: BatchData) -> MoistureResult:
        """基于工艺数据进行估算"""
        result = MoistureResult()
        
        recipe = batch.recipe
        
        initial_moisture = self.TYPICAL_INITIAL_MOISTURE_PCT
        target_moisture = self.TYPICAL_TARGET_MOISTURE_PCT
        
        shelf_temp_data = batch.shelf_temp
        product_temp_data = batch.product_temp
        vacuum_data = batch.vacuum
        
        if shelf_temp_data and len(shelf_temp_data) > 0:
            temps = np.array(shelf_temp_data.values)
            timestamps = shelf_temp_data.timestamps
            
            drying_phases = self._identify_drying_phases(timestamps, temps)
            
            time_profile = []
            current_moisture = initial_moisture
            cumulative_time_h = 0.0
            
            for i, (phase, start_idx, end_idx) in enumerate(drying_phases):
                phase_temps = temps[start_idx:end_idx+1]
                phase_start = timestamps[start_idx]
                phase_end = timestamps[end_idx]
                phase_duration_h = (phase_end - phase_start).total_seconds() / 3600
                
                avg_temp = float(np.mean(phase_temps))
                
                drying_rate = self._calculate_desorption_rate(avg_temp)
                
                if phase == "primary":
                    moisture_removed = min(
                        current_moisture - self.TYPICAL_POST_PRIMARY_MOISTURE_PCT,
                        drying_rate * phase_duration_h * 5
                    )
                else:
                    moisture_removed = drying_rate * phase_duration_h
                
                moisture_removed = min(moisture_removed, current_moisture - target_moisture)
                current_moisture = max(target_moisture, current_moisture - moisture_removed)
                cumulative_time_h += phase_duration_h
                
                time_profile.append({
                    "time": phase_end.isoformat(),
                    "phase": phase,
                    "phase_duration_h": phase_duration_h,
                    "average_temp_c": avg_temp,
                    "moisture_removed_pct": moisture_removed,
                    "cumulative_moisture_pct": current_moisture,
                    "drying_rate_pct_h": drying_rate,
                    "is_estimated": True,
                })
            
            result.estimated_residual_moisture_pct = current_moisture
            result.estimated_drying_rate_pct_h = self._calculate_desorption_rate(
                float(np.mean(temps)) if len(temps) > 0 else 20.0
            )
            
            result.estimated_bound_water_pct = max(0.0, current_moisture - 1.0)
            result.estimated_free_water_pct = max(0.0, current_moisture - result.estimated_bound_water_pct)
            
            result.time_profile = time_profile
            result.details = {
                "source": "process_data",
                "initial_moisture_assumption_pct": initial_moisture,
                "target_moisture_pct": target_moisture,
                "drying_phases_identified": len(drying_phases),
                "note": "基于工艺数据的估算值，建议使用实际水分测量数据进行校准"
            }
            result.warnings.append("水分含量为基于工艺数据的估算值，建议使用实际水分测量数据进行校准")
        
        else:
            result.estimated_residual_moisture_pct = 5.0
            result.estimated_drying_rate_pct_h = 0.5
            result.details = {
                "source": "default_assumptions",
                "note": "数据不足，使用默认值"
            }
            result.warnings.append("温度数据不足，使用默认水分估算值")
        
        return result
    
    def _identify_drying_phases(
        self, 
        timestamps: List[datetime], 
        temperatures: np.ndarray
    ) -> List[Tuple[str, int, int]]:
        """识别干燥阶段"""
        phases = []
        
        if len(temperatures) < 10:
            return [("unknown", 0, len(temperatures) - 1)]
        
        temp_gradient = np.gradient(temperatures)
        
        freeze_start = 0
        for i in range(1, len(temperatures)):
            if temperatures[i] < -30 and temperatures[i-1] > temperatures[i]:
                freeze_start = i
                break
        
        freezing_end = freeze_start
        for i in range(freeze_start, len(temperatures)):
            if temperatures[i] > -40 and temperatures[i] < temperatures[i-1]:
                continue
            if temperatures[i] > -30:
                freezing_end = i
                break
        
        primary_start = freezing_end
        primary_end = primary_start
        
        for i in range(primary_start, len(temperatures)):
            if temperatures[i] > 0 and temperatures[i] > temperatures[i-1]:
                if i > primary_start + 10:
                    primary_end = i
                    break
        
        if primary_end == primary_start:
            primary_end = len(temperatures) - 1
        
        secondary_start = primary_end
        secondary_end = len(temperatures) - 1
        
        if primary_start < primary_end:
            phases.append(("primary", primary_start, primary_end))
        
        if secondary_start < secondary_end:
            phases.append(("secondary", secondary_start, secondary_end))
        
        if not phases:
            phases.append(("unknown", 0, len(temperatures) - 1))
        
        return phases
    
    def _calculate_desorption_rate(self, temperature_c: float) -> float:
        """
        基于Arrhenius方程计算解吸速率
        
        解吸速率随温度升高呈指数增加
        典型值：
        - 25°C: ~0.2 %/h
        - 40°C: ~0.5 %/h
        """
        temperature_k = temperature_c + 273.15
        
        base_rate = 0.1
        
        arrhenius_factor = np.exp(
            -self.ACTIVATION_ENERGY / (self.GAS_CONSTANT * temperature_k)
        )
        
        reference_factor = np.exp(
            -self.ACTIVATION_ENERGY / (self.GAS_CONSTANT * 298.15)
        )
        
        relative_rate = arrhenius_factor / reference_factor
        
        return max(0.01, base_rate * relative_rate)
    
    def estimate_secondary_drying_time(
        self,
        current_moisture_pct: float,
        target_moisture_pct: float,
        temperature_c: float,
        vacuum_mtorr: float = 100.0
    ) -> float:
        """
        估算达到目标水分所需的二次干燥时间
        
        返回：小时数
        """
        if current_moisture_pct <= target_moisture_pct:
            return 0.0
        
        moisture_to_remove = current_moisture_pct - target_moisture_pct
        
        drying_rate = self._calculate_desorption_rate(temperature_c)
        
        vacuum_factor = max(0.5, min(1.5, 100.0 / max(vacuum_mtorr, 50.0)))
        
        adjusted_rate = drying_rate * vacuum_factor
        
        if adjusted_rate <= 0:
            return float('inf')
        
        return moisture_to_remove / adjusted_rate
