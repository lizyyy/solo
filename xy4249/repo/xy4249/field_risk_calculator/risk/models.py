from enum import Enum
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from datetime import datetime


class RiskLevel(Enum):
    LOW = "低风险"
    MEDIUM = "中风险"
    HIGH = "高风险"
    CRITICAL = "极高风险"


class RiskCategory(Enum):
    SLOPE = "坡度风险"
    WATER_CROSSING = "涉水风险"
    WEIGHT = "负重风险"
    SUPPLY = "补给风险"
    WEATHER = "天气风险"


@dataclass
class RiskPoint:
    risk_id: str
    category: RiskCategory
    level: RiskLevel
    location: Dict[str, float]
    description: str
    recommendations: List[str]
    details: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'risk_id': self.risk_id,
            'category': self.category.value,
            'level': self.level.value,
            'location': self.location,
            'description': self.description,
            'recommendations': self.recommendations,
            'details': self.details,
            'timestamp': self.timestamp.isoformat()
        }


@dataclass
class RetreatPoint:
    point_id: str
    location: Dict[str, float]
    name: Optional[str]
    distance_from_start: float
    reason: str
    risk_level: RiskLevel
    backtrack_distance: float
    safety_assessment: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            'point_id': self.point_id,
            'location': self.location,
            'name': self.name,
            'distance_from_start': self.distance_from_start,
            'reason': self.reason,
            'risk_level': self.risk_level.value,
            'backtrack_distance': self.backtrack_distance,
            'safety_assessment': self.safety_assessment
        }


@dataclass
class SupplyPoint:
    point_id: str
    location: Dict[str, float]
    name: Optional[str]
    water_available: float
    food_available: float
    is_emergency: bool
    distance_from_last: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            'point_id': self.point_id,
            'location': self.location,
            'name': self.name,
            'water_available': self.water_available,
            'food_available': self.food_available,
            'is_emergency': self.is_emergency,
            'distance_from_last': self.distance_from_last
        }


@dataclass
class RiskAssessment:
    assessment_id: str
    overall_risk_level: RiskLevel
    risk_points: List[RiskPoint]
    retreat_points: List[RetreatPoint]
    supply_points: List[SupplyPoint]
    statistics: Dict[str, Any]
    recommendations: List[str]
    timestamp: datetime = field(default_factory=datetime.now)

    @property
    def risk_count_by_level(self) -> Dict[RiskLevel, int]:
        counts = {level: 0 for level in RiskLevel}
        for rp in self.risk_points:
            counts[rp.level] += 1
        return counts

    @property
    def risk_count_by_category(self) -> Dict[RiskCategory, int]:
        counts = {category: 0 for category in RiskCategory}
        for rp in self.risk_points:
            counts[rp.category] += 1
        return counts

    def to_dict(self) -> Dict[str, Any]:
        return {
            'assessment_id': self.assessment_id,
            'overall_risk_level': self.overall_risk_level.value,
            'risk_points': [rp.to_dict() for rp in self.risk_points],
            'retreat_points': [rp.to_dict() for rp in self.retreat_points],
            'supply_points': [sp.to_dict() for sp in self.supply_points],
            'statistics': self.statistics,
            'recommendations': self.recommendations,
            'risk_count_by_level': {k.value: v for k, v in self.risk_count_by_level.items()},
            'risk_count_by_category': {k.value: v for k, v in self.risk_count_by_category.items()},
            'timestamp': self.timestamp.isoformat()
        }
