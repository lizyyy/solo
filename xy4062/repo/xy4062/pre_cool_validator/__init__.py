"""预冷装车热负荷校验器

一个用于冷链仓配工程师的本地科学计算 CLI 工具，
用于仿真装车过程中的温度变化和热负荷评估。
"""

__version__ = "1.0.0"
__author__ = "冷链仓配工程团队"

from pre_cool_validator.models import (
    ProductParams,
    VehicleConfig,
    LoadingPlan,
    BatchItem,
    SimulationResult,
    RiskAssessment,
    RiskType,
)
from pre_cool_validator.heat_calculator import HeatCalculator
from pre_cool_validator.risk_engine import RiskEngine

__all__ = [
    "ProductParams",
    "VehicleConfig",
    "LoadingPlan",
    "BatchItem",
    "SimulationResult",
    "RiskAssessment",
    "RiskType",
    "HeatCalculator",
    "RiskEngine",
]
