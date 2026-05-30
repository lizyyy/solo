"""
核心数据模型定义
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from enum import Enum
from datetime import datetime


class ResourceType(Enum):
    """资源类型枚举"""
    WATER = "water"
    ENERGY = "energy"
    LIGHT = "light"
    TEMPERATURE = "temperature"


class CropStatus(Enum):
    """作物状态枚举"""
    SEED = "seed"
    SPROUT = "sprout"
    GROWING = "growing"
    FLOWERING = "flowering"
    FRUITING = "fruiting"
    HARVESTABLE = "harvestable"
    DEAD = "dead"


class GameStatus(Enum):
    """游戏状态枚举"""
    NOT_STARTED = "not_started"
    RUNNING = "running"
    PAUSED = "paused"
    SUCCESS = "success"
    FAILED = "failed"


class FailureReason(Enum):
    """失败原因枚举"""
    ENERGY_NEGATIVE = "energy_negative"
    WATER_CYCLE_BROKEN = "water_cycle_broken"
    TEMPERATURE_OUT_OF_RANGE = "temperature_out_of_range"
    CROP_ALL_DEAD = "crop_all_dead"
    SANDSTORM_DAMAGE = "sandstorm_damage"


@dataclass
class Crop:
    """作物模型"""
    id: str
    name: str
    species: str
    status: CropStatus = CropStatus.SEED
    health: float = 100.0
    growth_stage: int = 0
    growth_progress: float = 0.0
    water_consumption: float = 10.0
    energy_consumption: float = 5.0
    optimal_temp_min: float = 18.0
    optimal_temp_max: float = 28.0
    optimal_light_hours: float = 12.0
    current_water: float = 50.0
    current_light_exposure: float = 0.0
    planted_at: Optional[datetime] = None
    harvest_yield: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class GreenhouseModule:
    """温室舱模块"""
    id: str
    name: str
    capacity: int
    crops: List[Crop] = field(default_factory=list)
    temperature: float = 22.0
    target_temperature: float = 22.0
    humidity: float = 60.0
    light_intensity: float = 0.0
    light_on: bool = False
    insulation_level: int = 3
    energy_efficiency: float = 0.85
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class WaterTank:
    """水箱模型"""
    id: str
    name: str
    capacity: float = 1000.0
    current_level: float = 800.0
    purification_rate: float = 5.0
    leak_rate: float = 0.1
    connected_modules: List[str] = field(default_factory=list)
    is_circulating: bool = True
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Battery:
    """电池模型"""
    id: str
    name: str
    capacity: float = 500.0
    current_charge: float = 400.0
    charge_rate: float = 20.0
    discharge_rate: float = 15.0
    efficiency: float = 0.9
    is_charging: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SandstormEvent:
    """沙尘暴事件"""
    id: str
    name: str
    severity: int
    duration: int
    remaining_duration: int = 0
    light_blockage: float = 0.5
    temperature_drop: float = 10.0
    damage_factor: float = 0.1
    is_active: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class GameState:
    """游戏状态"""
    id: str
    name: str
    round: int = 0
    max_rounds: int = 30
    status: GameStatus = GameStatus.NOT_STARTED
    greenhouse_modules: List[GreenhouseModule] = field(default_factory=list)
    crops: List[Crop] = field(default_factory=list)
    water_tanks: List[WaterTank] = field(default_factory=list)
    batteries: List[Battery] = field(default_factory=list)
    current_sandstorm: Optional[SandstormEvent] = None
    upcoming_events: List[SandstormEvent] = field(default_factory=list)
    total_energy_production: float = 0.0
    total_energy_consumption: float = 0.0
    total_water_production: float = 0.0
    total_water_consumption: float = 0.0
    target_yield: float = 100.0
    current_yield: float = 0.0
    failure_reason: Optional[FailureReason] = None
    failure_details: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class DataSource:
    """数据源信息，用于追踪数据来源"""
    file_path: str
    line_number: Optional[int]
    sheet_name: Optional[str]
    version: str
    is_supplement: bool = False
    is_deprecated: bool = False
    import_timestamp: datetime = field(default_factory=datetime.now)
    raw_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ValidationError:
    """验证错误信息"""
    error_code: str
    error_message: str
    severity: str
    source: Optional[DataSource]
    object_id: Optional[str]
    object_type: Optional[str]
    field_name: Optional[str]
    current_value: Any
    expected_range: Optional[str]
    timestamp: datetime = field(default_factory=datetime.now)
