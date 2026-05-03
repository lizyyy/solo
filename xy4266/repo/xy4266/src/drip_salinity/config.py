"""配置模型模块 - 定义作物、基质、阈值等配置数据结构"""

from datetime import date
from typing import Optional, List
from enum import Enum
from pydantic import BaseModel, Field, validator


class CropType(str, Enum):
    """作物类型枚举"""
    TOMATO = "番茄"
    CUCUMBER = "黄瓜"
    PEPPER = "辣椒"
    LETTUCE = "生菜"
    STRAWBERRY = "草莓"


class SubstrateType(str, Enum):
    """基质类型枚举"""
    COCO_PEAT = "椰糠"
    PEAT_MOSS = "泥炭"
    PERLITE = "珍珠岩"
    VERMICULITE = "蛭石"
    ROCKWOOL = "岩棉"
    MIXED = "混合基质"


class ECUnit(str, Enum):
    """EC单位枚举"""
    MS_CM = "mS/cm"
    US_CM = "μS/cm"
    DS_M = "dS/m"


class CropConfig(BaseModel):
    """作物配置"""
    crop_type: CropType = Field(..., description="作物类型")
    variety: str = Field(default="普通品种", description="品种名称")
    planting_date: date = Field(description="定植日期")
    expected_ec_range: tuple[float, float] = Field(
        default=(2.0, 3.5),
        description="适宜EC范围 (mS/cm)"
    )
    max_tolerated_ec: float = Field(
        default=5.0,
        description="最大耐受EC值 (mS/cm)"
    )
    min_irrigation_volume: float = Field(
        default=1.0,
        description="最小灌溉量 (L/株/天)"
    )
    stage: str = Field(default="营养生长期", description="当前生育阶段")

    class Config:
        schema_extra = {
            "example": {
                "crop_type": "番茄",
                "variety": "普通品种",
                "planting_date": "2024-01-15",
                "expected_ec_range": [2.0, 3.5],
                "max_tolerated_ec": 5.0,
                "min_irrigation_volume": 1.0,
                "stage": "营养生长期"
            }
        }


class SubstrateConfig(BaseModel):
    """基质配置"""
    substrate_type: SubstrateType = Field(..., description="基质类型")
    volume_per_bed: float = Field(..., description="每畦基质体积 (L)")
    initial_water_content: float = Field(
        default=60.0,
        description="初始含水率 (%)"
    )
    field_capacity: float = Field(
        default=70.0,
        description="田间持水量 (%)"
    )
    wilting_point: float = Field(
        default=20.0,
        description="萎蔫点 (%)"
    )
    buffer_capacity: float = Field(
        default=10.0,
        description="基质缓冲能力 (meq/100g)"
    )

    class Config:
        schema_extra = {
            "example": {
                "substrate_type": "椰糠",
                "volume_per_bed": 100.0,
                "initial_water_content": 60.0,
                "field_capacity": 70.0,
                "wilting_point": 20.0,
                "buffer_capacity": 10.0
            }
        }


class ThresholdConfig(BaseModel):
    """阈值配置"""
    max_drainage_ratio: float = Field(
        default=0.4,
        description="最大排液率 (排液量/灌溉量)"
    )
    min_drainage_ratio: float = Field(
        default=0.1,
        description="最小排液率"
    )
    ec_warning_threshold: float = Field(
        default=4.0,
        description="EC预警阈值 (mS/cm)"
    )
    ec_danger_threshold: float = Field(
        default=5.0,
        description="EC危险阈值 (mS/cm)"
    )
    water_content_low_threshold: float = Field(
        default=35.0,
        description="含水率低阈值 (%)"
    )
    water_content_high_threshold: float = Field(
        default=65.0,
        description="含水率高阈值 (%)"
    )
    salt_accumulation_rate: float = Field(
        default=0.2,
        description="盐分累积速率阈值 (mS/cm/天)"
    )
    flushing_ec_reduction_target: float = Field(
        default=1.0,
        description="冲洗目标EC降低值 (mS/cm)"
    )

    class Config:
        schema_extra = {
            "example": {
                "max_drainage_ratio": 0.4,
                "min_drainage_ratio": 0.1,
                "ec_warning_threshold": 4.0,
                "ec_danger_threshold": 5.0,
                "water_content_low_threshold": 35.0,
                "water_content_high_threshold": 65.0,
                "salt_accumulation_rate": 0.2,
                "flushing_ec_reduction_target": 1.0
            }
        }


class BedConfig(BaseModel):
    """单畦配置"""
    bed_id: str = Field(..., description="畦号标识")
    plant_count: int = Field(default=100, description="植株数量")
    row_number: int = Field(default=1, description="行号")
    location: Optional[str] = Field(default=None, description="位置描述")

    class Config:
        schema_extra = {
            "example": {
                "bed_id": "A01",
                "plant_count": 100,
                "row_number": 1,
                "location": "东区第一行"
            }
        }


class ProjectConfig(BaseModel):
    """完整项目配置"""
    project_name: str = Field(default="温室滴灌项目", description="项目名称")
    created_at: date = Field(default_factory=date.today, description="创建日期")
    crop: CropConfig = Field(..., description="作物配置")
    substrate: SubstrateConfig = Field(..., description="基质配置")
    thresholds: ThresholdConfig = Field(default_factory=ThresholdConfig, description="阈值配置")
    beds: List[BedConfig] = Field(default_factory=list, description="畦配置列表")
    default_ec_unit: ECUnit = Field(
        default=ECUnit.MS_CM,
        description="默认EC单位"
    )
    notes: Optional[str] = Field(default=None, description="备注")

    @validator('beds')
    def check_unique_bed_ids(cls, v):
        """检查畦号是否唯一"""
        bed_ids = [bed.bed_id for bed in v]
        if len(bed_ids) != len(set(bed_ids)):
            raise ValueError("畦号不能重复")
        return v

    class Config:
        schema_extra = {
            "example": {
                "project_name": "番茄种植示范区",
                "created_at": "2024-01-20",
                "crop": {
                    "crop_type": "番茄",
                    "variety": "普通品种",
                    "planting_date": "2024-01-15",
                    "expected_ec_range": [2.0, 3.5],
                    "max_tolerated_ec": 5.0,
                    "min_irrigation_volume": 1.0,
                    "stage": "营养生长期"
                },
                "substrate": {
                    "substrate_type": "椰糠",
                    "volume_per_bed": 100.0,
                    "initial_water_content": 60.0,
                    "field_capacity": 70.0,
                    "wilting_point": 20.0,
                    "buffer_capacity": 10.0
                },
                "thresholds": {
                    "max_drainage_ratio": 0.4,
                    "min_drainage_ratio": 0.1,
                    "ec_warning_threshold": 4.0,
                    "ec_danger_threshold": 5.0,
                    "water_content_low_threshold": 35.0,
                    "water_content_high_threshold": 65.0,
                    "salt_accumulation_rate": 0.2,
                    "flushing_ec_reduction_target": 1.0
                },
                "beds": [
                    {"bed_id": "A01", "plant_count": 100, "row_number": 1},
                    {"bed_id": "A02", "plant_count": 100, "row_number": 1}
                ],
                "default_ec_unit": "mS/cm"
            }
        }
