from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional


class DataQuality(str, Enum):
    MEASURED = "measured"
    IMPUTED = "imputed"
    ALIGNED = "aligned"
    INTERPOLATED = "interpolated"
    MISSING = "missing"
    SPIKE_FLAGGED = "spike_flagged"
    OUTLIER_REMOVED = "outlier_removed"


class ConditionGrade(str, Enum):
    NORMAL = "normal"
    WARNING = "warning"
    ABNORMAL = "abnormal"
    CRITICAL = "critical"


class AnomalyType(str, Enum):
    MISSING_PRODUCTION = "missing_production"
    TEMPERATURE_MISALIGNMENT = "temperature_misalignment"
    ENERGY_SPIKE = "energy_spike"
    SUSTAINED_HIGH_SEC = "sustained_high_sec"
    DOOR_EXCESSIVE = "door_excessive"
    RATED_POWER_EXCEEDED = "rated_power_exceeded"


@dataclass
class PowerRecord:
    timestamp: datetime
    power_kw: float
    cumulative_kwh: Optional[float] = None
    quality: DataQuality = DataQuality.MEASURED
    original_value: Optional[float] = None

    def validate(self) -> List[str]:
        errors = []
        if self.power_kw < 0:
            errors.append(f"负功率值 {self.power_kw} kW @ {self.timestamp}")
        if self.cumulative_kwh is not None and self.cumulative_kwh < 0:
            errors.append(f"负累计电量 {self.cumulative_kwh} kWh @ {self.timestamp}")
        return errors


@dataclass
class TemperatureRecord:
    timestamp: datetime
    temperature_c: float
    quality: DataQuality = DataQuality.MEASURED
    original_timestamp: Optional[datetime] = None
    original_value: Optional[float] = None

    def validate(self) -> List[str]:
        errors = []
        if self.temperature_c < -40 or self.temperature_c > 60:
            errors.append(
                f"环境温度超出物理范围 {self.temperature_c} °C @ {self.timestamp}"
            )
        return errors


@dataclass
class DoorEvent:
    timestamp: datetime
    is_open: bool
    duration_s: Optional[float] = None
    quality: DataQuality = DataQuality.MEASURED

    def validate(self) -> List[str]:
        errors = []
        if self.duration_s is not None and self.duration_s < 0:
            errors.append(f"开门时长为负 {self.duration_s} s @ {self.timestamp}")
        return errors


@dataclass
class IceProductionRecord:
    timestamp: datetime
    production_kg: Optional[float]
    quality: DataQuality = DataQuality.MEASURED
    imputed_method: Optional[str] = None

    def validate(self) -> List[str]:
        errors = []
        if self.production_kg is not None and self.production_kg < 0:
            errors.append(f"产冰量为负 {self.production_kg} kg @ {self.timestamp}")
        if self.quality == DataQuality.MISSING and self.production_kg is not None:
            errors.append(
                f"数据质量标记为MISSING但产冰量非空 {self.production_kg} kg @ {self.timestamp}"
            )
        return errors


@dataclass
class EquipmentInfo:
    equipment_id: str
    model: str
    rated_power_kw: float
    rated_production_kg_h: float
    install_date: Optional[datetime] = None
    baseline_sec_kwh_per_kg: Optional[float] = None

    @property
    def theoretical_sec(self) -> float:
        if self.baseline_sec_kwh_per_kg is not None:
            return self.baseline_sec_kwh_per_kg
        return self.rated_power_kw / self.rated_production_kg_h

    def validate(self) -> List[str]:
        errors = []
        if self.rated_power_kw <= 0:
            errors.append(f"额定功率非正 {self.rated_power_kw} kW")
        if self.rated_production_kg_h <= 0:
            errors.append(f"额定产冰量非正 {self.rated_production_kg_h} kg/h")
        return errors


@dataclass
class AuditEntry:
    timestamp: datetime
    field: str
    original_value: Optional[str]
    adjusted_value: Optional[str]
    reason: str
    method: str
    operator: str = "system"
    can_override: bool = False

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp.isoformat(),
            "field": self.field,
            "original_value": self.original_value,
            "adjusted_value": self.adjusted_value,
            "reason": self.reason,
            "method": self.method,
            "operator": self.operator,
            "can_override": self.can_override,
        }


@dataclass
class AnomalyAnnotation:
    anomaly_type: AnomalyType
    start_time: datetime
    end_time: Optional[datetime]
    severity: ConditionGrade
    detail: str
    affected_records: int = 1
    audit_ref: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "anomaly_type": self.anomaly_type.value,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "severity": self.severity.value,
            "detail": self.detail,
            "affected_records": self.affected_records,
            "audit_ref": self.audit_ref,
        }


@dataclass
class ConditionSegment:
    start_time: datetime
    end_time: datetime
    grade: ConditionGrade
    avg_sec_kwh_per_kg: float
    avg_temperature_c: float
    door_open_count: int
    total_production_kg: float
    total_energy_kwh: float
    sec_ratio_vs_baseline: float
    anomalies: List[AnomalyAnnotation] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat(),
            "grade": self.grade.value,
            "avg_sec_kwh_per_kg": round(self.avg_sec_kwh_per_kg, 4),
            "avg_temperature_c": round(self.avg_temperature_c, 2),
            "door_open_count": self.door_open_count,
            "total_production_kg": round(self.total_production_kg, 2),
            "total_energy_kwh": round(self.total_energy_kwh, 2),
            "sec_ratio_vs_baseline": round(self.sec_ratio_vs_baseline, 4),
            "anomalies": [a.to_dict() for a in self.anomalies],
        }


@dataclass
class EnergyAttribution:
    total_energy_kwh: float
    base_energy_kwh: float
    temperature_surcharge_kwh: float
    door_surcharge_kwh: float
    anomaly_surcharge_kwh: float
    unexplained_kwh: float
    methodology: str = ""

    @property
    def attribution_pct(self) -> dict:
        if self.total_energy_kwh == 0:
            return {}
        return {
            "base_pct": round(self.base_energy_kwh / self.total_energy_kwh * 100, 2),
            "temperature_pct": round(
                self.temperature_surcharge_kwh / self.total_energy_kwh * 100, 2
            ),
            "door_pct": round(self.door_surcharge_kwh / self.total_energy_kwh * 100, 2),
            "anomaly_pct": round(
                self.anomaly_surcharge_kwh / self.total_energy_kwh * 100, 2
            ),
            "unexplained_pct": round(
                self.unexplained_kwh / self.total_energy_kwh * 100, 2
            ),
        }

    def to_dict(self) -> dict:
        pct = self.attribution_pct
        return {
            "total_energy_kwh": round(self.total_energy_kwh, 2),
            "base_energy_kwh": round(self.base_energy_kwh, 2),
            "temperature_surcharge_kwh": round(self.temperature_surcharge_kwh, 2),
            "door_surcharge_kwh": round(self.door_surcharge_kwh, 2),
            "anomaly_surcharge_kwh": round(self.anomaly_surcharge_kwh, 2),
            "unexplained_kwh": round(self.unexplained_kwh, 2),
            "attribution_pct": pct,
            "methodology": self.methodology,
        }


@dataclass
class MaintenanceSuggestion:
    priority: ConditionGrade
    category: str
    action: str
    rationale: str
    related_anomaly_types: List[AnomalyType] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "priority": self.priority.value,
            "category": self.category,
            "action": self.action,
            "rationale": self.rationale,
            "related_anomaly_types": [a.value for a in self.related_anomaly_types],
        }


@dataclass
class DiagnosisResult:
    equipment_id: str
    diagnosis_time: datetime
    overall_grade: ConditionGrade
    energy_attribution: EnergyAttribution
    condition_segments: List[ConditionSegment]
    anomalies: List[AnomalyAnnotation]
    maintenance_suggestions: List[MaintenanceSuggestion]
    audit_trail: List[AuditEntry]
    processing_methodology: str = ""

    def to_dict(self) -> dict:
        return {
            "equipment_id": self.equipment_id,
            "diagnosis_time": self.diagnosis_time.isoformat(),
            "overall_grade": self.overall_grade.value,
            "energy_attribution": self.energy_attribution.to_dict(),
            "condition_segments": [s.to_dict() for s in self.condition_segments],
            "anomalies": [a.to_dict() for a in self.anomalies],
            "maintenance_suggestions": [s.to_dict() for s in self.maintenance_suggestions],
            "audit_trail": [a.to_dict() for a in self.audit_trail],
            "processing_methodology": self.processing_methodology,
        }


@dataclass
class DiagnosisInput:
    equipment: EquipmentInfo
    power_records: List[PowerRecord]
    temperature_records: List[TemperatureRecord]
    door_events: List[DoorEvent]
    ice_production: List[IceProductionRecord]

    def validate_all(self) -> List[str]:
        errors = []
        errors.extend(self.equipment.validate())
        for r in self.power_records:
            errors.extend(r.validate())
        for r in self.temperature_records:
            errors.extend(r.validate())
        for r in self.door_events:
            errors.extend(r.validate())
        for r in self.ice_production:
            errors.extend(r.validate())
        return errors
