"""传感器数据模型"""
from datetime import datetime
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field
import numpy as np


class SensorData(BaseModel):
    """基础传感器数据"""
    sensor_name: str = Field(..., description="传感器名称")
    sensor_id: Optional[str] = Field(None, description="传感器编号")
    unit: str = Field(..., description="单位")
    timestamps: List[datetime] = Field(default_factory=list, description="时间戳列表")
    values: List[float] = Field(default_factory=list, description="数值列表")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="传感器元数据")
    
    class Config:
        arbitrary_types_allowed = True
    
    def __len__(self) -> int:
        """返回数据点数量"""
        return len(self.timestamps)
    
    def validate_consistency(self) -> List[str]:
        """验证数据一致性"""
        errors = []
        if len(self.timestamps) != len(self.values):
            errors.append(f"时间戳数量({len(self.timestamps)})与数值数量({len(self.values)})不一致")
        if len(self.timestamps) == 0:
            errors.append("数据为空")
        return errors
    
    def get_value_at_time(self, target_time: datetime) -> Optional[float]:
        """获取指定时间点的数值（线性插值）"""
        if len(self.timestamps) < 2:
            return None if not self.values else self.values[0]
        
        for i, ts in enumerate(self.timestamps):
            if ts >= target_time:
                if i == 0:
                    return self.values[0]
                t1, t2 = self.timestamps[i-1], ts
                v1, v2 = self.values[i-1], self.values[i]
                
                if t2 == t1:
                    return (v1 + v2) / 2
                
                ratio = (target_time - t1).total_seconds() / (t2 - t1).total_seconds()
                return v1 + (v2 - v1) * ratio
        
        return self.values[-1] if self.values else None
    
    def get_time_range(self) -> Optional[tuple]:
        """获取时间范围"""
        if not self.timestamps:
            return None
        return (self.timestamps[0], self.timestamps[-1])
    
    def get_value_range(self) -> Optional[tuple]:
        """获取数值范围"""
        if not self.values:
            return None
        return (min(self.values), max(self.values))
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        if not self.values:
            return {"count": 0}
        
        values_np = np.array(self.values)
        return {
            "count": len(self.values),
            "mean": float(np.mean(values_np)),
            "std": float(np.std(values_np)),
            "min": float(np.min(values_np)),
            "max": float(np.max(values_np)),
            "median": float(np.median(values_np)),
        }
    
    def slice_by_time(self, start_time: datetime, end_time: datetime) -> "SensorData":
        """按时间范围切片"""
        indices = [
            i for i, ts in enumerate(self.timestamps)
            if start_time <= ts <= end_time
        ]
        
        return self.__class__(
            sensor_name=self.sensor_name,
            sensor_id=self.sensor_id,
            unit=self.unit,
            timestamps=[self.timestamps[i] for i in indices],
            values=[self.values[i] for i in indices],
            metadata=self.metadata.copy(),
        )


class TemperatureData(SensorData):
    """温度传感器数据"""
    unit: str = "°C"
    
    def has_exceeded(self, threshold_c: float) -> bool:
        """检查是否超过阈值"""
        if not self.values:
            return False
        return max(self.values) > threshold_c
    
    def get_exceedance_periods(self, threshold_c: float) -> List[Dict[str, Any]]:
        """获取超过阈值的时间段"""
        periods = []
        if len(self.values) < 2:
            return periods
        
        in_exceedance = False
        start_idx = None
        
        for i, val in enumerate(self.values):
            if val > threshold_c:
                if not in_exceedance:
                    in_exceedance = True
                    start_idx = i
            else:
                if in_exceedance:
                    periods.append({
                        "start_time": self.timestamps[start_idx],
                        "end_time": self.timestamps[i-1],
                        "duration_minutes": (self.timestamps[i-1] - self.timestamps[start_idx]).total_seconds() / 60,
                        "max_temp": max(self.values[start_idx:i]),
                        "avg_temp": sum(self.values[start_idx:i]) / (i - start_idx),
                    })
                    in_exceedance = False
        
        if in_exceedance and start_idx is not None:
            periods.append({
                "start_time": self.timestamps[start_idx],
                "end_time": self.timestamps[-1],
                "duration_minutes": (self.timestamps[-1] - self.timestamps[start_idx]).total_seconds() / 60,
                "max_temp": max(self.values[start_idx:]),
                "avg_temp": sum(self.values[start_idx:]) / (len(self.values) - start_idx),
            })
        
        return periods


class VacuumData(SensorData):
    """真空传感器数据"""
    unit: str = "mTorr"
    
    def get_fluctuations(self, threshold_mtorr: float = 50.0, window_minutes: float = 5.0) -> List[Dict[str, Any]]:
        """检测真空波动"""
        fluctuations = []
        if len(self.values) < 2:
            return fluctuations
        
        timestamps_np = np.array([t.timestamp() for t in self.timestamps])
        values_np = np.array(self.values)
        
        window_seconds = window_minutes * 60
        
        for i, ts in enumerate(timestamps_np):
            window_mask = (timestamps_np >= ts - window_seconds) & (timestamps_np <= ts + window_seconds)
            window_values = values_np[window_mask]
            
            if len(window_values) >= 3:
                fluctuation = max(window_values) - min(window_values)
                if fluctuation > threshold_mtorr:
                    fluctuations.append({
                        "time": self.timestamps[i],
                        "fluctuation_mtorr": float(fluctuation),
                        "window_minutes": window_minutes,
                        "max_in_window": float(max(window_values)),
                        "min_in_window": float(min(window_values)),
                    })
        
        merged_fluctuations = []
        for f in fluctuations:
            if not merged_fluctuations:
                merged_fluctuations.append(f)
            else:
                last = merged_fluctuations[-1]
                time_diff = (f["time"] - last["time"]).total_seconds() / 60
                if time_diff < window_minutes:
                    last["fluctuation_mtorr"] = max(last["fluctuation_mtorr"], f["fluctuation_mtorr"])
                    last["max_in_window"] = max(last["max_in_window"], f["max_in_window"])
                    last["min_in_window"] = min(last["min_in_window"], f["min_in_window"])
                    last["end_time"] = f["time"]
                else:
                    merged_fluctuations.append(f)
        
        return merged_fluctuations


class MoistureData(BaseModel):
    """水分数据"""
    measurement_type: str = Field(..., description="测量类型")
    unit: str = Field("%", description="单位")
    
    samples: List[Dict[str, Any]] = Field(default_factory=list, description="水分样品数据")
    timestamps: List[datetime] = Field(default_factory=list, description="测量时间戳")
    values: List[float] = Field(default_factory=list, description="水分含量数值")
    
    class Config:
        arbitrary_types_allowed = True
    
    def add_sample(self, time: datetime, moisture_pct: float, sample_id: Optional[str] = None,
                    location: Optional[str] = None, method: Optional[str] = None):
        """添加水分样品"""
        self.timestamps.append(time)
        self.values.append(moisture_pct)
        sample_data = {
            "time": time,
            "moisture_pct": moisture_pct,
        }
        if sample_id:
            sample_data["sample_id"] = sample_id
        if location:
            sample_data["location"] = location
        if method:
            sample_data["method"] = method
        self.samples.append(sample_data)
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        if not self.values:
            return {"count": 0}
        
        values_np = np.array(self.values)
        return {
            "count": len(self.values),
            "mean": float(np.mean(values_np)),
            "std": float(np.std(values_np)),
            "min": float(np.min(values_np)),
            "max": float(np.max(values_np)),
            "median": float(np.median(values_np)),
        }
    
    def get_primary_drying_removal_rate(self, shelf_temp_data: Optional[TemperatureData] = None) -> Optional[float]:
        """估算一次干燥阶段的水分去除速率"""
        if len(self.values) < 2:
            return None
        
        time_diff = (self.timestamps[-1] - self.timestamps[0]).total_seconds() / 3600
        moisture_diff = self.values[0] - self.values[-1]
        
        if time_diff > 0:
            return moisture_diff / time_diff
        
        return None
