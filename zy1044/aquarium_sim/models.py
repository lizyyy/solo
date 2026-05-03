"""
数据模型定义
"""
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from enum import Enum


class FishSize(Enum):
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"


class FiltrationLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class RiskLevel(Enum):
    SAFE = "safe"
    WARNING = "warning"
    DANGER = "danger"
    CRITICAL = "critical"


@dataclass
class Fish:
    size: FishSize
    quantity: int


@dataclass
class WaterChange:
    day: int
    percentage: float


@dataclass
class AddFish:
    day: int
    quantity: int
    size: FishSize


@dataclass
class WaterQuality:
    day: int
    ammonia: float
    nitrite: float
    nitrate: float
    ph: float


@dataclass
class RiskAssessment:
    day: int
    ammonia_risk: RiskLevel
    nitrite_risk: RiskLevel
    nitrate_risk: RiskLevel
    overall_risk: RiskLevel
    reasons: List[str]
    suggestions: List[str]


@dataclass
class Scenario:
    name: str
    tank_volume: float
    fish: List[Fish]
    filtration_level: FiltrationLevel
    daily_feeding_amount: float
    initial_ammonia: float
    initial_nitrite: float
    initial_nitrate: float
    initial_ph: float
    water_changes: List[WaterChange]
    add_fish: List[AddFish]
    simulation_days: int = 14


@dataclass
class SimulationResult:
    scenario: Scenario
    daily_quality: List[WaterQuality]
    daily_risks: List[RiskAssessment]
    summary: Dict[str, Any]
