"""
数据模型模块 - 定义配方、原料、批次、规则等核心数据类
"""

from dataclasses import dataclass, field
from datetime import date
from enum import Enum
from typing import Dict, List, Optional, Any


class Unit(Enum):
    """单位枚举类"""
    GRAM = "g"
    MILLIGRAM = "mg"
    KILOGRAM = "kg"
    MILLILITER = "ml"
    LITER = "l"
    DROP = "drop"
    PERCENT = "%"
    
    @classmethod
    def from_string(cls, unit_str: str) -> 'Unit':
        """从字符串创建单位"""
        unit_str = unit_str.strip().lower()
        mapping = {
            'g': cls.GRAM,
            'gram': cls.GRAM,
            'mg': cls.MILLIGRAM,
            'milligram': cls.MILLIGRAM,
            'kg': cls.KILOGRAM,
            'kilogram': cls.KILOGRAM,
            'ml': cls.MILLILITER,
            'milliliter': cls.MILLILITER,
            'l': cls.LITER,
            'liter': cls.LITER,
            'drop': cls.DROP,
            'drops': cls.DROP,
            '%': cls.PERCENT,
            'percent': cls.PERCENT,
        }
        if unit_str not in mapping:
            raise ValueError(f"未知的单位: {unit_str}")
        return mapping[unit_str]
    
    def to_grams(self, amount: float, density: float = 1.0) -> float:
        """转换为克数"""
        if self == Unit.GRAM:
            return amount
        elif self == Unit.MILLIGRAM:
            return amount / 1000.0
        elif self == Unit.KILOGRAM:
            return amount * 1000.0
        elif self == Unit.MILLILITER:
            return amount * density
        elif self == Unit.LITER:
            return amount * 1000 * density
        elif self == Unit.DROP:
            return amount * 0.05  # 假设1滴约0.05克
        elif self == Unit.PERCENT:
            raise ValueError("百分比单位不能直接转换为克数")
        return amount


class AllergenType(Enum):
    """过敏原类型枚举"""
    LINALOOL = "linalool"
    LIMONENE = "limonene"
    CITRONELLOL = "citronellol"
    GERANIOL = "geraniol"
    EUGENOL = "eugenol"
    ISOEUGENOL = "isoeugenol"
    CINNAMAL = "cinnamal"
    CINNAMYL_ALCOHOL = "cinnamyl alcohol"
    FARNESOL = "farnesol"
    BENZYL_ALCOHOL = "benzyl alcohol"
    BENZYL_SALICYLATE = "benzyl salicylate"
    COUMARIN = "coumarin"
    ANISE_ALCOHOL = "anise alcohol"
    AMYL_CINNAMAL = "amyl cinnamal"
    AMYL_CINNAMYL_ALCOHOL = "amyl cinnamyl alcohol"
    HYDROXYCITRONELLAL = "hydroxycitronellal"


@dataclass
class RawMaterial:
    """原料基础信息"""
    id: str
    name: str
    cas_number: Optional[str] = None
    molecular_weight: Optional[float] = None
    density: float = 1.0  # g/ml
    flash_point: Optional[float] = None  # °C
    allergens: List[AllergenType] = field(default_factory=list)
    is_ethanol: bool = False
    is_fragrance: bool = True
    unit_cost: Optional[float] = None  # 元/克


@dataclass
class FormulaIngredient:
    """配方原料项"""
    raw_material_id: str
    amount: float
    unit: Unit
    batch_number: Optional[str] = None
    notes: Optional[str] = None


@dataclass
class Formula:
    """配方数据"""
    id: str
    name: str
    version: str
    created_date: date
    total_amount: float
    unit: Unit
    ingredients: List[FormulaIngredient] = field(default_factory=list)
    notes: Optional[str] = None


@dataclass
class RawMaterialBatch:
    """原料批次信息"""
    batch_number: str
    raw_material_id: str
    manufacture_date: date
    expiry_date: date
    supplier: Optional[str] = None
    supplier_batch: Optional[str] = None
    quantity: float = 0.0
    unit: Unit = Unit.GRAM
    purity: float = 1.0
    notes: Optional[str] = None
    
    @property
    def is_expired(self) -> bool:
        """检查是否过期"""
        return date.today() > self.expiry_date
    
    @property
    def days_until_expiry(self) -> int:
        """距离过期的天数"""
        delta = self.expiry_date - date.today()
        return max(0, delta.days)


@dataclass
class IFRARule:
    """IFRA 规则"""
    raw_material_id: str
    limit_type: str  # 'max_concentration', 'banned', 'restricted'
    limit_value: Optional[float] = None  # 百分比浓度
    product_category: Optional[str] = None
    effective_date: Optional[date] = None
    notes: Optional[str] = None


@dataclass
class AllergenRule:
    """过敏原规则"""
    allergen_type: AllergenType
    reporting_threshold: float = 0.001  # 0.1% 阈值
    restriction_limit: Optional[float] = None
    notes: Optional[str] = None


@dataclass
class RuleSet:
    """规则集合"""
    name: str
    version: str
    ifra_rules: List[IFRARule] = field(default_factory=list)
    allergen_rules: List[AllergenRule] = field(default_factory=list)
    banned_substances: List[str] = field(default_factory=list)  # raw_material_id 列表


@dataclass
class CalculationResult:
    """配方计算结果"""
    formula_id: str
    target_amount: float
    target_unit: Unit
    total_cost: float
    ethanol_content: float  # 克数
    fragrance_content: float  # 克数
    ethanol_ratio: float  # 乙醇占比
    fragrance_ratio: float  # 香精占比
    ingredient_details: List['IngredientCalculation'] = field(default_factory=list)


@dataclass
class IngredientCalculation:
    """单种原料计算结果"""
    raw_material_id: str
    raw_material_name: str
    original_amount: float
    original_unit: Unit
    calculated_amount: float
    calculated_unit: Unit
    cost: Optional[float] = None
    percentage: float = 0.0


@dataclass
class CheckResult:
    """检查结果"""
    passed: bool
    warnings: List['CheckWarning'] = field(default_factory=list)
    errors: List['CheckError'] = field(default_factory=list)


@dataclass
class CheckWarning:
    """检查警告"""
    code: str
    message: str
    severity: str = "warning"
    context: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CheckError:
    """检查错误"""
    code: str
    message: str
    severity: str = "error"
    context: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ProjectConfig:
    """项目配置"""
    project_name: str
    data_directory: str
    default_currency: str = "CNY"
    drop_conversion: float = 0.05  # 克/滴
    default_density: float = 1.0  # g/ml
