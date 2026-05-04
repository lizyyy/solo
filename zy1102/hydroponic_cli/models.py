"""数据模型模块 - 定义水培系统的数据结构"""
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from datetime import datetime, date
from enum import Enum


class CropStage(Enum):
    """作物生长阶段"""
    SEEDLING = "seedling"
    VEGETATIVE = "vegetative"
    FLOWERING = "flowering"
    FRUITING = "fruiting"
    MATURE = "mature"


class RecipeType(Enum):
    """营养液配方类型"""
    GENERAL = "general"
    LEAFY_GREEN = "leafy_green"
    FRUITING = "fruiting"
    HERB = "herb"


@dataclass
class Reservoir:
    """水培桶/储液桶"""
    id: str
    name: str
    max_capacity: float
    capacity_unit: str = "L"
    description: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def max_capacity_liters(self) -> float:
        from .units import normalize_volume_to_liters
        return normalize_volume_to_liters(self.max_capacity, self.capacity_unit)


@dataclass
class Crop:
    """作物信息"""
    id: str
    name: str
    common_name: Optional[str] = None
    stages: Dict[str, 'CropStageInfo'] = field(default_factory=dict)
    description: Optional[str] = None
    
    def get_stage_info(self, stage: str) -> Optional['CropStageInfo']:
        return self.stages.get(stage)


@dataclass
class CropStageInfo:
    """作物阶段信息"""
    stage: str
    target_ec_min: float
    target_ec_max: float
    target_ec_unit: str = "mS/cm"
    target_ph_min: float = 5.5
    target_ph_max: float = 6.5
    recommended_recipe: Optional[str] = None
    notes: Optional[str] = None
    
    @property
    def target_ec_min_ms(self) -> float:
        from .units import normalize_ec_to_ms
        return normalize_ec_to_ms(self.target_ec_min, self.target_ec_unit)
    
    @property
    def target_ec_max_ms(self) -> float:
        from .units import normalize_ec_to_ms
        return normalize_ec_to_ms(self.target_ec_max, self.target_ec_unit)
    
    @property
    def target_ec_optimal(self) -> float:
        return (self.target_ec_min_ms + self.target_ec_max_ms) / 2
    
    @property
    def target_ph_optimal(self) -> float:
        return (self.target_ph_min + self.target_ph_max) / 2


@dataclass
class Recipe:
    """营养液配方"""
    id: str
    name: str
    type: str
    a_solution: 'SolutionInfo'
    b_solution: 'SolutionInfo'
    mixing_ratio: float = 1.0
    description: Optional[str] = None
    incompatibility_notes: Optional[str] = None
    source: Optional[str] = None


@dataclass
class SolutionInfo:
    """溶液信息（A液或B液）"""
    name: str
    concentration_per_ml: float
    ec_per_ml_per_liter: float
    unit: str = "mL"
    npk_ratio: Optional[str] = None
    key_elements: List[str] = field(default_factory=list)


@dataclass
class Reading:
    """检测读数"""
    id: str
    reservoir_id: str
    timestamp: datetime
    ec_value: float
    ec_unit: str
    ph_value: float
    volume: Optional[float] = None
    volume_unit: str = "L"
    temperature: Optional[float] = None
    notes: Optional[str] = None
    source: str = "manual"
    
    @property
    def ec_value_ms(self) -> float:
        from .units import normalize_ec_to_ms
        return normalize_ec_to_ms(self.ec_value, self.ec_unit)
    
    @property
    def volume_liters(self) -> Optional[float]:
        if self.volume is None:
            return None
        from .units import normalize_volume_to_liters
        return normalize_volume_to_liters(self.volume, self.volume_unit)


@dataclass
class NutrientInventory:
    """营养液库存"""
    id: str
    recipe_id: str
    solution_type: str
    current_volume: float
    volume_unit: str = "mL"
    minimum_threshold: float = 100.0
    expiration_date: Optional[date] = None
    batch_number: Optional[str] = None
    
    @property
    def current_volume_ml(self) -> float:
        from .units import convert_volume
        return convert_volume(self.current_volume, self.volume_unit, "mL")


@dataclass
class ReservoirState:
    """储液桶当前状态"""
    reservoir_id: str
    current_volume: float
    current_ec: float
    current_ph: float
    crop_id: Optional[str] = None
    crop_stage: Optional[str] = None
    recipe_id: Optional[str] = None
    last_reading_time: Optional[datetime] = None
    evaporation_rate_per_day: float = 0.05
    nutrient_uptake_rate: float = 0.02
    
    @property
    def current_ec_ms(self) -> float:
        return self.current_ec
    
    @property
    def current_volume_liters(self) -> float:
        return self.current_volume


@dataclass
class DailyAction:
    """每日操作建议"""
    day: int
    date: date
    reservoir_id: str
    actions: List[str]
    add_water_liters: float = 0.0
    add_a_ml: float = 0.0
    add_b_ml: float = 0.0
    add_acid_ml: float = 0.0
    add_base_ml: float = 0.0
    drain_liters: float = 0.0
    requires_full_change: bool = False
    expected_ec: Optional[float] = None
    expected_ph: Optional[float] = None
    expected_volume: Optional[float] = None
    warnings: List[str] = field(default_factory=list)
    notes: List[str] = field(default_factory=list)


@dataclass
class SimulationResult:
    """模拟结果"""
    reservoir_id: str
    start_date: date
    end_date: date
    total_days: int
    daily_actions: List[DailyAction]
    summary: 'SimulationSummary'
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)


@dataclass
class SimulationSummary:
    """模拟摘要"""
    total_water_added_liters: float = 0.0
    total_a_added_ml: float = 0.0
    total_b_added_ml: float = 0.0
    total_acid_added_ml: float = 0.0
    total_base_added_ml: float = 0.0
    total_drained_liters: float = 0.0
    full_changes_required: int = 0
    ec_out_of_range_days: int = 0
    ph_out_of_range_days: int = 0
    average_ec: float = 0.0
    average_ph: float = 0.0
    end_ec: float = 0.0
    end_ph: float = 0.0
    end_volume: float = 0.0


@dataclass
class StrategyComparison:
    """策略比较"""
    strategy_name: str
    description: str
    total_water_liters: float
    total_nutrient_ml: float
    total_acid_base_ml: float
    full_changes: int
    estimated_cost: float
    risk_score: float
    risk_factors: List[str]
    key_benefits: List[str]
    key_risks: List[str]


@dataclass
class ValidationResult:
    """校验结果"""
    valid: bool
    errors: List['ValidationError']
    warnings: List['ValidationWarning']
    info: List[str]


@dataclass
class ValidationError:
    """校验错误"""
    field: str
    value: Any
    message: str
    severity: str = "error"
    source_file: Optional[str] = None
    row_index: Optional[int] = None


@dataclass
class ValidationWarning:
    """校验警告"""
    field: str
    value: Any
    message: str
    severity: str = "warning"
    source_file: Optional[str] = None
    row_index: Optional[int] = None


@dataclass
class DataBundle:
    """数据集合"""
    reservoirs: Dict[str, Reservoir]
    crops: Dict[str, Crop]
    recipes: Dict[str, Recipe]
    readings: List[Reading]
    inventory: Dict[str, NutrientInventory]
    validation_result: Optional[ValidationResult] = None
