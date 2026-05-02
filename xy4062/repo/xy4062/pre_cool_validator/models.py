"""数据模型定义

定义货品热参数、车辆配置、装车计划、仿真结果和风险评估的数据模型。
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, validator


class RiskType(str, Enum):
    """风险类型枚举"""
    PRECOOL_INSUFFICIENT = "precool_insufficient"
    COOLING_CAPACITY_INSUFFICIENT = "cooling_capacity_insufficient"
    DOOR_OPEN_TOO_LONG = "door_open_too_long"
    TARGET_TEMP_CONFLICT = "target_temp_conflict"
    BATCH_TIMEOUT = "batch_timeout"
    AMBIENT_TEMP_HIGH = "ambient_temp_high"


class RiskSeverity(str, Enum):
    """风险严重程度"""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ProductParams(BaseModel):
    """货品热参数模型"""
    product_id: str = Field(..., description="货品唯一标识")
    product_name: str = Field(..., description="货品名称")
    specific_heat: float = Field(..., gt=0, description="比热容 (kJ/kg·°C)")
    density: float = Field(..., gt=0, description="密度 (kg/m³)")
    default_target_temp: float = Field(..., description="默认目标温度 (°C)")
    max_precool_time: int = Field(..., gt=0, description="最大预冷时间 (分钟)")
    heat_transfer_coeff: float = Field(default=10.0, gt=0, description="表面换热系数 (W/m²·°C)")
    respiration_rate: float = Field(default=0.0, ge=0, description="呼吸热 (W/kg)")
    notes: Optional[str] = Field(default=None, description="备注")

    class Config:
        schema_extra = {
            "example": {
                "product_id": "APPLE_FUJI",
                "product_name": "红富士苹果",
                "specific_heat": 3.65,
                "density": 500,
                "default_target_temp": 0,
                "max_precool_time": 120,
                "heat_transfer_coeff": 12.0,
                "respiration_rate": 0.005,
            }
        }


class VehicleConfig(BaseModel):
    """车辆配置模型"""
    vehicle_id: str = Field(..., description="车辆唯一标识")
    vehicle_name: str = Field(..., description="车辆名称")
    cargo_volume: float = Field(..., gt=0, description="货箱容积 (m³)")
    cargo_surface_area: float = Field(..., gt=0, description="货箱表面积 (m²)")
    insulation_k: float = Field(..., gt=0, description="箱体隔热系数 (W/m²·°C)")
    cooling_capacity: float = Field(..., gt=0, description="制冷量 (kW)")
    fan_airflow: float = Field(..., gt=0, description="风机风量 (m³/h)")
    door_area: float = Field(..., gt=0, description="门面积 (m²)")
    ambient_temp_standard: float = Field(default=30.0, description="标准环境温度 (°C)")
    max_door_open_duration: int = Field(default=30, description="最大允许开门时长 (分钟)")
    notes: Optional[str] = Field(default=None, description="备注")

    @validator('cargo_surface_area')
    def validate_surface_area(cls, v, values):
        if 'cargo_volume' in values:
            volume = values['cargo_volume']
            min_surface = 6 * (volume ** (2/3))
            if v < min_surface * 0.8:
                raise ValueError(f"表面积过小，建议至少 {min_surface:.2f} m²")
        return v

    class Config:
        schema_extra = {
            "example": {
                "vehicle_id": "REF_001",
                "vehicle_name": "4.2米冷藏车",
                "cargo_volume": 18.0,
                "cargo_surface_area": 42.0,
                "insulation_k": 0.4,
                "cooling_capacity": 8.0,
                "fan_airflow": 3000.0,
                "door_area": 4.0,
                "ambient_temp_standard": 30.0,
                "max_door_open_duration": 30,
            }
        }


class BatchItem(BaseModel):
    """批次货品项模型"""
    batch_id: str = Field(..., description="批次唯一标识")
    product_id: str = Field(..., description="关联的货品ID")
    product_name: str = Field(..., description="货品名称")
    volume: float = Field(..., gt=0, description="体积 (m³)")
    mass: float = Field(..., gt=0, description="质量 (kg)")
    initial_temp: float = Field(..., description="初温 (°C)")
    target_temp: float = Field(..., description="目标温度 (°C)")
    arrival_time: int = Field(default=0, ge=0, description="到达时间点 (分钟，相对于预冷开始)")
    deadline_time: Optional[int] = Field(default=None, description="必须降到目标温度的时间点 (分钟)")
    specific_heat_override: Optional[float] = Field(default=None, gt=0, description="覆盖比热容 (kJ/kg·°C)")
    notes: Optional[str] = Field(default=None, description="备注")

    @validator('mass')
    def calculate_mass_if_needed(cls, v, values):
        if v <= 0 and 'volume' in values and 'product_id' in values:
            return v
        return v

    class Config:
        schema_extra = {
            "example": {
                "batch_id": "B001",
                "product_id": "APPLE_FUJI",
                "product_name": "红富士苹果",
                "volume": 2.5,
                "mass": 1250,
                "initial_temp": 15.0,
                "target_temp": 0.0,
                "arrival_time": 0,
                "deadline_time": 90,
            }
        }


class LoadingPlan(BaseModel):
    """装车计划模型"""
    plan_id: str = Field(..., description="计划唯一标识")
    plan_name: Optional[str] = Field(default=None, description="计划名称")
    vehicle_id: str = Field(..., description="使用的车辆ID")
    ambient_temp: float = Field(..., description="实际环境温度 (°C)")
    total_precool_time: int = Field(..., gt=0, description="总预冷时间 (分钟)")
    door_open_duration: int = Field(default=0, ge=0, description="开门总时长 (分钟)")
    batches: List[BatchItem] = Field(default_factory=list, description="批次列表")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    notes: Optional[str] = Field(default=None, description="备注")

    def get_total_volume(self) -> float:
        """获取总货物体积"""
        return sum(batch.volume for batch in self.batches)

    def get_total_mass(self) -> float:
        """获取总货品质量"""
        return sum(batch.mass for batch in self.batches)

    def get_unique_target_temps(self) -> List[float]:
        """获取所有不同的目标温度"""
        return sorted(list({batch.target_temp for batch in self.batches}))

    class Config:
        schema_extra = {
            "example": {
                "plan_id": "PLAN_20260501_001",
                "plan_name": "北京新发地配送",
                "vehicle_id": "REF_001",
                "ambient_temp": 32.0,
                "total_precool_time": 120,
                "door_open_duration": 25,
                "batches": [],
            }
        }


class TimeStepData(BaseModel):
    """单个时间步数据"""
    time_minute: float = Field(..., description="时间点 (分钟)")
    batch_temp: float = Field(..., description="批次温度 (°C)")
    heat_load: float = Field(..., description="该时间步热负荷 (kW)")
    cooling_provided: float = Field(..., description="提供的冷量 (kW)")
    ambient_heat_infiltration: float = Field(default=0.0, description="环境热侵入 (kW)")
    respiration_heat: float = Field(default=0.0, description="呼吸热 (kW)")


class BatchSimulationResult(BaseModel):
    """单批次仿真结果"""
    batch_id: str = Field(..., description="批次ID")
    product_name: str = Field(..., description="货品名称")
    initial_temp: float = Field(..., description="初始温度 (°C)")
    target_temp: float = Field(..., description="目标温度 (°C)")
    final_temp: float = Field(..., description="最终温度 (°C)")
    time_to_target: Optional[float] = Field(default=None, description="达到目标温度的时间 (分钟)")
    reached_target: bool = Field(default=False, description="是否达到目标温度")
    time_steps: List[TimeStepData] = Field(default_factory=list, description="时间步数据序列")
    total_heat_removed: float = Field(default=0.0, description="总移除热量 (kJ)")
    peak_heat_load: float = Field(default=0.0, description="峰值热负荷 (kW)")
    avg_heat_load: float = Field(default=0.0, description="平均热负荷 (kW)")


class SimulationResult(BaseModel):
    """整体仿真结果"""
    plan_id: str = Field(..., description="计划ID")
    vehicle_id: str = Field(..., description="车辆ID")
    ambient_temp: float = Field(..., description="环境温度 (°C)")
    total_precool_time: int = Field(..., description="总预冷时间 (分钟)")
    door_open_duration: int = Field(..., description="开门时长 (分钟)")
    vehicle_cooling_capacity: float = Field(..., description="车辆制冷量 (kW)")
    batch_results: List[BatchSimulationResult] = Field(default_factory=list, description="各批次仿真结果")
    total_cooling_required: float = Field(default=0.0, description="总需冷量 (kJ)")
    total_cooling_provided: float = Field(default=0.0, description="总供冷量 (kJ)")
    cooling_surplus: float = Field(default=0.0, description="冷量盈余 (kJ)")
    door_heat_infiltration: float = Field(default=0.0, description="开门热侵入总量 (kJ)")
    ambient_heat_infiltration: float = Field(default=0.0, description="箱体热侵入总量 (kJ)")
    respiration_heat_total: float = Field(default=0.0, description="呼吸热总量 (kJ)")
    simulated_at: datetime = Field(default_factory=datetime.now, description="仿真时间")
    success: bool = Field(default=True, description="仿真是否成功")
    error_message: Optional[str] = Field(default=None, description="错误信息")


class RiskAssessment(BaseModel):
    """风险评估结果"""
    risk_type: RiskType = Field(..., description="风险类型")
    severity: RiskSeverity = Field(..., description="严重程度")
    message: str = Field(..., description="风险描述")
    affected_batches: List[str] = Field(default_factory=list, description="受影响批次ID列表")
    details: Dict[str, Any] = Field(default_factory=dict, description="详细信息")
    suggestion: Optional[str] = Field(default=None, description="改进建议")


class RiskReport(BaseModel):
    """风险报告"""
    plan_id: str = Field(..., description="计划ID")
    total_risks: int = Field(default=0, description="总风险数")
    high_severity: int = Field(default=0, description="高风险数")
    medium_severity: int = Field(default=0, description="中风险数")
    low_severity: int = Field(default=0, description="低风险数")
    risks: List[RiskAssessment] = Field(default_factory=list, description="风险列表")
    overall_pass: bool = Field(default=True, description="整体是否通过")
    assessed_at: datetime = Field(default_factory=datetime.now, description="评估时间")


class ProjectConfig(BaseModel):
    """项目配置（存储所有货品和车辆配置）"""
    products: Dict[str, ProductParams] = Field(default_factory=dict, description="货品参数字典")
    vehicles: Dict[str, VehicleConfig] = Field(default_factory=dict, description="车辆配置字典")
    version: str = Field(default="1.0", description="配置版本")
    last_updated: datetime = Field(default_factory=datetime.now, description="最后更新时间")

    def add_product(self, product: ProductParams) -> None:
        """添加或更新货品参数"""
        self.products[product.product_id] = product
        self.last_updated = datetime.now()

    def add_vehicle(self, vehicle: VehicleConfig) -> None:
        """添加或更新车辆配置"""
        self.vehicles[vehicle.vehicle_id] = vehicle
        self.last_updated = datetime.now()

    def get_product(self, product_id: str) -> Optional[ProductParams]:
        """获取货品参数"""
        return self.products.get(product_id)

    def get_vehicle(self, vehicle_id: str) -> Optional[VehicleConfig]:
        """获取车辆配置"""
        return self.vehicles.get(vehicle_id)
