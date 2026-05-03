from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator


class WaterQualityParams(BaseModel):
    temperature: float = Field(..., ge=0, le=40, description="水温(℃)")
    ph: float = Field(..., ge=0, le=14, description="pH值")
    ammonia_nitrogen: float = Field(..., ge=0, description="氨氮(mg/L)")
    nitrite: float = Field(..., ge=0, description="亚硝酸盐(mg/L)")
    salinity: float = Field(..., ge=0, description="盐度(‰)")
    dissolved_oxygen: float = Field(..., ge=0, description="溶解氧(mg/L)")
    turbidity: Optional[float] = Field(None, ge=0, description="浊度(NTU)")
    alkalinity: Optional[float] = Field(None, ge=0, description="碱度(mg/L)")
    hardness: Optional[float] = Field(None, ge=0, description="硬度(mg/L)")


class ThresholdParams(BaseModel):
    ammonia_nitrogen_warning: float = Field(0.5, ge=0, description="氨氮警告阈值(mg/L)")
    ammonia_nitrogen_danger: float = Field(1.0, ge=0, description="氨氮危险阈值(mg/L)")
    nitrite_warning: float = Field(0.15, ge=0, description="亚硝酸盐警告阈值(mg/L)")
    nitrite_danger: float = Field(0.3, ge=0, description="亚硝酸盐危险阈值(mg/L)")
    ph_min: float = Field(7.0, ge=0, le=14, description="pH最小值")
    ph_max: float = Field(8.5, ge=0, le=14, description="pH最大值")
    ph_change_rate: float = Field(0.3, ge=0, description="pH突变阈值(单位/小时)")
    salinity_min: float = Field(0, ge=0, description="盐度最小值(‰)")
    salinity_max: float = Field(35, ge=0, description="盐度最大值(‰)")
    salinity_gradient: float = Field(2.0, ge=0, description="盐度梯度阈值(‰)")
    do_min: float = Field(4.0, ge=0, description="溶解氧最小值(mg/L)")
    do_critical: float = Field(2.0, ge=0, description="溶解氧临界值(mg/L)")
    temp_min: float = Field(18.0, ge=0, description="水温最小值(℃)")
    temp_max: float = Field(32.0, ge=0, description="水温最大值(℃)")

    @field_validator("ph_max")
    @classmethod
    def validate_ph_range(cls, v: float, info: dict) -> float:
        if "ph_min" in info.data and v <= info.data["ph_min"]:
            raise ValueError("pH最大值必须大于最小值")
        return v

    @field_validator("ammonia_nitrogen_danger")
    @classmethod
    def validate_ammonia_thresholds(cls, v: float, info: dict) -> float:
        if "ammonia_nitrogen_warning" in info.data and v <= info.data["ammonia_nitrogen_warning"]:
            raise ValueError("氨氮危险阈值必须大于警告阈值")
        return v

    @field_validator("nitrite_danger")
    @classmethod
    def validate_nitrite_thresholds(cls, v: float, info: dict) -> float:
        if "nitrite_warning" in info.data and v <= info.data["nitrite_warning"]:
            raise ValueError("亚硝酸盐危险阈值必须大于警告阈值")
        return v


class SimulationParams(BaseModel):
    simulation_hours: int = Field(24, ge=1, le=168, description="模拟时长(小时)")
    time_step: float = Field(1.0, ge=0.1, le=4.0, description="时间步长(小时)")
    feed_rate: float = Field(0.0, ge=0, description="投喂率(kg/小时)")
    feed_protein_content: float = Field(40.0, ge=0, le=100, description="饲料蛋白质含量(%)")
    aeration_rate: float = Field(0.0, ge=0, description="曝气速率(mg/L/小时)")
    water_exchange_rate: float = Field(0.0, ge=0, le=1.0, description="换水速率(体积比例/小时)")
    probiotics_dosage: float = Field(0.0, ge=0, description="益生菌添加量(g/立方米)")
    probiotics_type: Optional[str] = Field(None, description="益生菌类型")
    probiotics_efficiency: float = Field(0.3, ge=0, le=1.0, description="益生菌处理效率")
    source_water_ph: float = Field(8.0, ge=0, le=14, description="水源pH值")
    source_water_salinity: float = Field(0.0, ge=0, description="水源盐度(‰)")
    source_water_ammonia: float = Field(0.0, ge=0, description="水源氨氮(mg/L)")
    source_water_nitrite: float = Field(0.0, ge=0, description="水源亚硝酸盐(mg/L)")
    temperature_variation: float = Field(0.0, description="水温变化幅度(℃/天)")
    use_nitrification: bool = Field(True, description="是否启用硝化作用模型")
    use_denitrification: bool = Field(False, description="是否启用反硝化作用模型")
    custom_params: Optional[Dict[str, Any]] = Field(None, description="自定义参数")
