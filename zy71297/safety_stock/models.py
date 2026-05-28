from dataclasses import dataclass, field
from datetime import date, datetime
from typing import List, Optional, Dict, Any
from enum import Enum


class DataQualityStatus(Enum):
    CLEAN = "clean"
    WARNING = "warning"
    ERROR = "error"


class AnomalyType(Enum):
    PROMOTION = "promotion"
    OUTLIER = "outlier"
    MISSING_DATA = "missing_data"
    INVALID_SERVICE_LEVEL = "invalid_service_level"


@dataclass
class SalesRecord:
    sku: str
    date: date
    quantity: int
    is_promotion: bool = False
    promotion_flag: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "sku": self.sku,
            "date": self.date.isoformat(),
            "quantity": self.quantity,
            "is_promotion": self.is_promotion,
            "promotion_flag": self.promotion_flag
        }


@dataclass
class LeadTimeRecord:
    sku: str
    supplier: str
    order_date: date
    receive_date: date
    lead_time_days: int = 0
    
    def __post_init__(self):
        if self.lead_time_days == 0:
            self.lead_time_days = (self.receive_date - self.order_date).days
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "sku": self.sku,
            "supplier": self.supplier,
            "order_date": self.order_date.isoformat(),
            "receive_date": self.receive_date.isoformat(),
            "lead_time_days": self.lead_time_days
        }


@dataclass
class AnomalyRecord:
    sku: str
    anomaly_type: AnomalyType
    description: str
    severity: str
    affected_data: Dict[str, Any]
    date_detected: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "sku": self.sku,
            "anomaly_type": self.anomaly_type.value,
            "description": self.description,
            "severity": self.severity,
            "affected_data": self.affected_data,
            "date_detected": self.date_detected.isoformat()
        }


@dataclass
class DemandStatistics:
    sku: str
    mean_daily_demand: float
    std_daily_demand: float
    variance_daily_demand: float
    max_demand: int
    min_demand: int
    data_points: int
    cv: float
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "sku": self.sku,
            "mean_daily_demand": round(self.mean_daily_demand, 4),
            "std_daily_demand": round(self.std_daily_demand, 4),
            "variance_daily_demand": round(self.variance_daily_demand, 4),
            "max_demand": self.max_demand,
            "min_demand": self.min_demand,
            "data_points": self.data_points,
            "cv": round(self.cv, 4)
        }


@dataclass
class LeadTimeStatistics:
    sku: str
    supplier: str
    mean_lead_time_days: float
    std_lead_time_days: float
    min_lead_time_days: int
    max_lead_time_days: int
    data_points: int
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "sku": self.sku,
            "supplier": self.supplier,
            "mean_lead_time_days": round(self.mean_lead_time_days, 2),
            "std_lead_time_days": round(self.std_lead_time_days, 4),
            "min_lead_time_days": self.min_lead_time_days,
            "max_lead_time_days": self.max_lead_time_days,
            "data_points": self.data_points
        }


@dataclass
class SafetyStockResult:
    sku: str
    supplier: str
    service_level: float
    z_score: float
    safety_stock_units: int
    reorder_point: int
    average_demand_during_lead_time: float
    stockout_risk_percentage: float
    fill_rate_percentage: float
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "sku": self.sku,
            "supplier": self.supplier,
            "service_level": self.service_level,
            "z_score": round(self.z_score, 4),
            "safety_stock_units": self.safety_stock_units,
            "reorder_point": self.reorder_point,
            "average_demand_during_lead_time": round(self.average_demand_during_lead_time, 2),
            "stockout_risk_percentage": round(self.stockout_risk_percentage, 2),
            "fill_rate_percentage": round(self.fill_rate_percentage, 2)
        }


@dataclass
class SensitivityPoint:
    service_level: float
    safety_stock_units: int
    marginal_increase: int
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "service_level": self.service_level,
            "safety_stock_units": self.safety_stock_units,
            "marginal_increase": self.marginal_increase
        }


@dataclass
class SensitivityAnalysis:
    sku: str
    points: List[SensitivityPoint]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "sku": self.sku,
            "points": [p.to_dict() for p in self.points]
        }


@dataclass
class SKUResult:
    sku: str
    supplier: str
    demand_stats: DemandStatistics
    lead_time_stats: LeadTimeStatistics
    safety_stock: SafetyStockResult
    sensitivity: SensitivityAnalysis
    current_inventory: int
    recommended_action: str
    anomalies: List[AnomalyRecord]
    data_quality: DataQualityStatus
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "sku": self.sku,
            "supplier": self.supplier,
            "demand_stats": self.demand_stats.to_dict(),
            "lead_time_stats": self.lead_time_stats.to_dict(),
            "safety_stock": self.safety_stock.to_dict(),
            "sensitivity": self.sensitivity.to_dict(),
            "current_inventory": self.current_inventory,
            "recommended_action": self.recommended_action,
            "anomalies": [a.to_dict() for a in self.anomalies],
            "data_quality": self.data_quality.value
        }


@dataclass
class TrialRunReport:
    run_id: str
    run_date: datetime
    overall_status: DataQualityStatus
    sku_results: List[SKUResult]
    total_anomalies: int
    critical_anomalies: int
    manual_review_required: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "run_id": self.run_id,
            "run_date": self.run_date.isoformat(),
            "overall_status": self.overall_status.value,
            "sku_results": [r.to_dict() for r in self.sku_results],
            "total_anomalies": self.total_anomalies,
            "critical_anomalies": self.critical_anomalies,
            "manual_review_required": self.manual_review_required
        }
