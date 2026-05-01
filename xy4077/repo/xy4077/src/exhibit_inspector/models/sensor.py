"""传感器记录模型"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class SensorType(str, Enum):
    """传感器类型"""
    SHOCK = "shock"
    TEMPERATURE = "temperature"
    HUMIDITY = "humidity"
    MULTI = "multi"


class UnitType(str, Enum):
    """单位类型"""
    G = "g"
    CELSIUS = "celsius"
    FAHRENHEIT = "fahrenheit"
    PERCENT = "percent"


class SensorRecord(BaseModel):
    """传感器记录"""
    record_id: str = Field(..., description="记录唯一标识")
    box_id: str = Field(..., description="展箱编号")
    sensor_id: str = Field(..., description="传感器编号")
    sensor_type: SensorType = Field(..., description="传感器类型")
    timestamp: str = Field(..., description="记录时间，ISO 格式")
    
    value: Optional[float] = Field(None, description="测量值（单值格式）")
    unit: Optional[UnitType] = Field(None, description="测量单位（单值格式）")
    
    x_accel_g: Optional[float] = Field(None, description="X轴加速度，单位 g")
    y_accel_g: Optional[float] = Field(None, description="Y轴加速度，单位 g")
    z_accel_g: Optional[float] = Field(None, description="Z轴加速度，单位 g")
    combined_accel_g: Optional[float] = Field(None, description="合成加速度，单位 g")
    
    temperature_celsius: Optional[float] = Field(None, description="温度，单位 °C")
    humidity_pct: Optional[float] = Field(None, description="湿度，单位 %")
    
    raw_value: Optional[float] = Field(None, description="原始值（未转换单位）")
    raw_unit: Optional[UnitType] = Field(None, description="原始单位")
    
    source_file: Optional[str] = Field(None, description="来源文件")
    line_number: Optional[int] = Field(None, description="源文件行号")
    
    def get_max_accel_g(self) -> Optional[float]:
        """获取最大加速度值"""
        values = []
        if self.x_accel_g is not None:
            values.append(abs(self.x_accel_g))
        if self.y_accel_g is not None:
            values.append(abs(self.y_accel_g))
        if self.z_accel_g is not None:
            values.append(abs(self.z_accel_g))
        if self.combined_accel_g is not None:
            values.append(abs(self.combined_accel_g))
        
        if values:
            return max(values)
        return None
    
    def get_temperature_celsius(self) -> Optional[float]:
        """获取温度值（摄氏度）"""
        if self.temperature_celsius is not None:
            return self.temperature_celsius
        if self.sensor_type == SensorType.TEMPERATURE and self.value is not None:
            if self.unit == UnitType.CELSIUS:
                return self.value
            if self.unit == UnitType.FAHRENHEIT:
                return (self.value - 32) * 5 / 9
        return None
    
    def get_humidity_pct(self) -> Optional[float]:
        """获取湿度值（百分比）"""
        if self.humidity_pct is not None:
            return self.humidity_pct
        if self.sensor_type == SensorType.HUMIDITY and self.value is not None:
            if self.unit == UnitType.PERCENT:
                return self.value
        return None
