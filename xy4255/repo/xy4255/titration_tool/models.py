"""数据模型定义"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Dict, Optional, Any


class SampleType(Enum):
    """样品类型枚举"""
    UNKNOWN = "unknown"
    STANDARD = "standard"
    BLANK = "blank"
    QUALITY_CONTROL = "qc"


class DataQuality(Enum):
    """数据质量枚举"""
    GOOD = "good"
    SUSPECT = "suspect"
    BAD = "bad"


@dataclass
class TitrationPoint:
    """单滴定点数据"""
    volume: float
    ph: float
    temperature: Optional[float] = None
    index: int = 0
    is_outlier: bool = False
    outlier_reason: Optional[str] = None


@dataclass
class TitrationCurve:
    """完整滴定曲线"""
    sample_id: str
    sample_type: SampleType = SampleType.UNKNOWN
    points: List[TitrationPoint] = field(default_factory=list)
    temperature: Optional[float] = None
    source_file: str = ""
    
    initial_ph: Optional[float] = None
    final_ph: Optional[float] = None
    min_ph: Optional[float] = None
    max_ph: Optional[float] = None
    
    def __post_init__(self):
        if self.points:
            self.initial_ph = self.points[0].ph
            self.final_ph = self.points[-1].ph
            ph_values = [p.ph for p in self.points]
            self.min_ph = min(ph_values)
            self.max_ph = max(ph_values)


@dataclass
class EquivalencePoint:
    """等当点结果"""
    volume: float
    ph: float
    method: str
    index: int
    derivative_value: float
    confidence: float


@dataclass
class FitResult:
    """拟合分析结果"""
    sample_id: str
    original_curve: TitrationCurve
    smoothed_curve: Optional[TitrationCurve] = None
    blank_corrected: bool = False
    blank_volume: Optional[float] = None
    
    equivalence_points: List[EquivalencePoint] = field(default_factory=list)
    primary_equivalence: Optional[EquivalencePoint] = None
    
    outliers: List[int] = field(default_factory=list)
    outlier_count: int = 0
    
    statistics: Dict[str, Any] = field(default_factory=dict)
    quality: DataQuality = DataQuality.GOOD
    warnings: List[str] = field(default_factory=list)


@dataclass
class StockSolution:
    """母液配置"""
    name: str
    formula: str
    concentration: float
    concentration_unit: str = "mol/L"
    pka: Optional[List[float]] = None
    is_acid: bool = True
    density: Optional[float] = None
    purity: Optional[float] = None


@dataclass
class BufferSystem:
    """缓冲体系定义"""
    name: str
    acid: StockSolution
    base: StockSolution
    effective_ph_range: tuple
    description: str = ""


@dataclass
class BufferRecipe:
    """缓冲液配方"""
    target_ph: float
    target_volume: float
    temperature: float
    system_name: str
    
    acid_volume: float
    base_volume: float
    theoretical_ph: float
    buffer_capacity: float
    ph_deviation: float
    
    acid_mass: Optional[float] = None
    base_mass: Optional[float] = None
    warnings: List[str] = field(default_factory=list)
    is_outside_optimal_range: bool = False


@dataclass
class AnalysisParams:
    """分析参数配置"""
    smoothing_window: int = 5
    smoothing_polyorder: int = 2
    equivalence_point_method: str = "second_derivative"
    derivative_threshold: float = 0.1
    outlier_method: str = "iqr"
    outlier_iqr_factor: float = 1.5
    blank_correction_enabled: bool = True


@dataclass
class ExperimentConfig:
    """实验配置"""
    experiment_name: str = "未命名实验"
    created_at: datetime = field(default_factory=datetime.now)
    analyst: str = ""
    
    analysis_params: AnalysisParams = field(default_factory=AnalysisParams)
    
    stock_solutions: Dict[str, StockSolution] = field(default_factory=dict)
    buffer_systems: Dict[str, BufferSystem] = field(default_factory=dict)
    
    notes: str = ""


@dataclass
class ImportResult:
    """导入结果"""
    file_path: str
    sample_id: str
    success: bool
    point_count: int = 0
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    curve: Optional[TitrationCurve] = None


@dataclass
class ExperimentReport:
    """实验报告数据结构"""
    report_id: str
    config: ExperimentConfig
    generated_at: datetime = field(default_factory=datetime.now)
    fit_results: List[FitResult] = field(default_factory=list)
    buffer_recipe: Optional[BufferRecipe] = None
    summary_statistics: Dict[str, Any] = field(default_factory=dict)
    quality_assessment: str = "PASS"


def default_stock_solutions() -> Dict[str, StockSolution]:
    """获取默认母液配置"""
    return {
        "HCl_0.1M": StockSolution(
            name="0.1M 盐酸",
            formula="HCl",
            concentration=0.1,
            pka=[-7.0],
            is_acid=True,
        ),
        "NaOH_0.1M": StockSolution(
            name="0.1M 氢氧化钠",
            formula="NaOH",
            concentration=0.1,
            pka=[15.7],
            is_acid=False,
        ),
        "NaH2PO4_0.1M": StockSolution(
            name="0.1M 磷酸二氢钠",
            formula="NaH2PO4",
            concentration=0.1,
            pka=[2.15, 7.20, 12.35],
            is_acid=True,
        ),
        "Na2HPO4_0.1M": StockSolution(
            name="0.1M 磷酸氢二钠",
            formula="Na2HPO4",
            concentration=0.1,
            pka=[2.15, 7.20, 12.35],
            is_acid=False,
        ),
        "Acetic_0.1M": StockSolution(
            name="0.1M 乙酸",
            formula="CH3COOH",
            concentration=0.1,
            pka=[4.76],
            is_acid=True,
        ),
        "NaAcetate_0.1M": StockSolution(
            name="0.1M 乙酸钠",
            formula="CH3COONa",
            concentration=0.1,
            pka=[4.76],
            is_acid=False,
        ),
        "Tris_HCl_0.1M": StockSolution(
            name="0.1M Tris-HCl",
            formula="Tris-HCl",
            concentration=0.1,
            pka=[8.3],
            is_acid=True,
        ),
        "Tris_Base_0.1M": StockSolution(
            name="0.1M Tris碱",
            formula="Tris",
            concentration=0.1,
            pka=[8.3],
            is_acid=False,
        ),
    }


def default_buffer_systems(stocks: Dict[str, StockSolution]) -> Dict[str, BufferSystem]:
    """获取默认缓冲体系配置"""
    return {
        "Phosphate": BufferSystem(
            name="磷酸盐缓冲液",
            acid=stocks["NaH2PO4_0.1M"],
            base=stocks["Na2HPO4_0.1M"],
            effective_ph_range=(5.8, 8.0),
            description="常用生理缓冲液，适用于pH 5.8-8.0范围",
        ),
        "Acetate": BufferSystem(
            name="乙酸-乙酸钠缓冲液",
            acid=stocks["Acetic_0.1M"],
            base=stocks["NaAcetate_0.1M"],
            effective_ph_range=(3.6, 5.6),
            description="适用于酸性条件的缓冲液",
        ),
        "Tris": BufferSystem(
            name="Tris缓冲液",
            acid=stocks["Tris_HCl_0.1M"],
            base=stocks["Tris_Base_0.1M"],
            effective_ph_range=(7.0, 9.0),
            description="常用生化缓冲液，温度依赖性较大",
        ),
    }


def default_experiment_config() -> ExperimentConfig:
    """获取默认实验配置"""
    stocks = default_stock_solutions()
    return ExperimentConfig(
        experiment_name="默认酸碱滴定实验",
        analysis_params=AnalysisParams(),
        stock_solutions=stocks,
        buffer_systems=default_buffer_systems(stocks),
    )
