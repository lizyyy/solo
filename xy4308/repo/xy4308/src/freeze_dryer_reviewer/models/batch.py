"""批次数据模型"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class RecipeInfo(BaseModel):
    """配方信息"""
    product_name: str = Field(..., description="产品名称")
    batch_size_ml: float = Field(..., description="批次体积(ml)")
    vial_count: int = Field(..., description="西林瓶数量")
    fill_volume_ml: float = Field(..., description="灌装体积(ml)")
    collapse_temp_c: Optional[float] = Field(None, description="塌陷温度(°C)")
    eutectic_temp_c: Optional[float] = Field(None, description="共晶温度(°C)")
    formulation: Optional[str] = Field(None, description="配方信息")
    concentration_mg_ml: Optional[float] = Field(None, description="浓度(mg/ml)")


class BatchMetadata(BaseModel):
    """批次元数据"""
    batch_id: str = Field(..., description="批次号")
    product_name: str = Field(..., description="产品名称")
    equipment_id: str = Field(..., description="设备编号")
    operator: Optional[str] = Field(None, description="操作人员")
    start_time: Optional[datetime] = Field(None, description="开始时间")
    end_time: Optional[datetime] = Field(None, description="结束时间")
    duration_hours: Optional[float] = Field(None, description="总时长(小时)")
    comments: Optional[str] = Field(None, description="备注")
    additional_info: Dict[str, Any] = Field(default_factory=dict, description="附加信息")


class PhaseData(BaseModel):
    """工艺阶段数据"""
    phase_name: str = Field(..., description="阶段名称")
    start_time: Optional[datetime] = Field(None, description="开始时间")
    end_time: Optional[datetime] = Field(None, description="结束时间")
    duration_minutes: Optional[float] = Field(None, description="时长(分钟)")
    target_temp_c: Optional[float] = Field(None, description="目标温度(°C)")
    target_vacuum_mtorr: Optional[float] = Field(None, description="目标真空度(mTorr)")
    ramp_rate_c_min: Optional[float] = Field(None, description="升温速率(°C/min)")
    additional_params: Dict[str, Any] = Field(default_factory=dict, description="附加参数")


class BatchData(BaseModel):
    """完整批次数据"""
    metadata: BatchMetadata = Field(..., description="批次元数据")
    recipe: Optional[RecipeInfo] = Field(None, description="配方信息")
    phases: List[PhaseData] = Field(default_factory=list, description="工艺阶段列表")
    shelf_temp: Optional["TemperatureData"] = Field(None, description="搁板温度数据")
    product_temp: Optional["TemperatureData"] = Field(None, description="产品探针温度数据")
    vacuum: Optional["VacuumData"] = Field(None, description="腔体真空数据")
    moisture: Optional["MoistureData"] = Field(None, description="水分数据")
    additional_sensors: Dict[str, "SensorData"] = Field(default_factory=dict, description="其他传感器数据")
    check_results: List[Dict[str, Any]] = Field(default_factory=list, description="规则检查结果")
    simulation_results: Dict[str, Any] = Field(default_factory=dict, description="模拟计算结果")
    raw_data_files: Dict[str, str] = Field(default_factory=dict, description="原始数据文件路径")
    validation_errors: List[str] = Field(default_factory=list, description="数据验证错误")
    
    class Config:
        arbitrary_types_allowed = True
    
    @property
    def total_duration_hours(self) -> Optional[float]:
        """计算总时长"""
        if self.metadata.start_time and self.metadata.end_time:
            return (self.metadata.end_time - self.metadata.start_time).total_seconds() / 3600
        return self.metadata.duration_hours
    
    @property
    def primary_drying_duration(self) -> Optional[float]:
        """计算一次干燥时长"""
        for phase in self.phases:
            if "primary" in phase.phase_name.lower() or "一次" in phase.phase_name:
                return phase.duration_minutes
        return None
    
    @property
    def secondary_drying_duration(self) -> Optional[float]:
        """计算二次干燥时长"""
        for phase in self.phases:
            if "secondary" in phase.phase_name.lower() or "二次" in phase.phase_name:
                return phase.duration_minutes
        return None
    
    def get_sensor_by_name(self, name: str) -> Optional["SensorData"]:
        """根据名称获取传感器数据"""
        name_lower = name.lower()
        if "shelf" in name_lower and self.shelf_temp:
            return self.shelf_temp
        if "product" in name_lower and self.product_temp:
            return self.product_temp
        if "vacuum" in name_lower and self.vacuum:
            return self.vacuum
        if "moisture" in name_lower and self.moisture:
            return self.moisture
        return self.additional_sensors.get(name)
    
    def has_valid_data(self) -> bool:
        """检查是否有有效数据"""
        return any([
            self.shelf_temp is not None and len(self.shelf_temp.timestamps) > 0,
            self.product_temp is not None and len(self.product_temp.timestamps) > 0,
            self.vacuum is not None and len(self.vacuum.timestamps) > 0,
        ])
    
    def add_validation_error(self, error: str):
        """添加验证错误"""
        self.validation_errors.append(error)
