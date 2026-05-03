from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import List, Dict, Optional, Any
import json


class Species(Enum):
    DOG = "dog"
    CAT = "cat"


class WeightUnit(Enum):
    KG = "kg"
    LB = "lb"
    
    @classmethod
    def convert_to_kg(cls, weight: float, unit: 'WeightUnit') -> float:
        if unit == cls.LB:
            return weight * 0.453592
        return weight
    
    @classmethod
    def convert_from_kg(cls, weight_kg: float, target_unit: 'WeightUnit') -> float:
        if target_unit == cls.LB:
            return weight_kg / 0.453592
        return weight_kg


class RiskType(Enum):
    HYPOTENSION = "hypotension"
    HYPOTHERMIA = "hypothermia"
    DOSAGE_VIOLATION = "dosage_violation"
    MONITORING_GAP = "monitoring_gap"
    OTHER = "other"


class RiskSeverity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


@dataclass
class Case:
    case_id: str
    patient_name: str
    species: Species
    weight: float
    weight_unit: WeightUnit
    surgery_type: str
    start_time: datetime
    end_time: Optional[datetime] = None
    anesthesiologist: str = ""
    notes: str = ""
    
    @property
    def weight_kg(self) -> float:
        return WeightUnit.convert_to_kg(self.weight, self.weight_unit)


@dataclass
class VitalSign:
    timestamp: datetime
    heart_rate: Optional[float] = None
    respiratory_rate: Optional[float] = None
    systolic_bp: Optional[float] = None
    diastolic_bp: Optional[float] = None
    mean_bp: Optional[float] = None
    temperature: Optional[float] = None
    spo2: Optional[float] = None
    etco2: Optional[float] = None
    source: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "heart_rate": self.heart_rate,
            "respiratory_rate": self.respiratory_rate,
            "systolic_bp": self.systolic_bp,
            "diastolic_bp": self.diastolic_bp,
            "mean_bp": self.mean_bp,
            "temperature": self.temperature,
            "spo2": self.spo2,
            "etco2": self.etco2,
            "source": self.source
        }


@dataclass
class DrugAdministration:
    timestamp: datetime
    drug_name: str
    dose: float
    dose_unit: str
    route: str = ""
    notes: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "drug_name": self.drug_name,
            "dose": self.dose,
            "dose_unit": self.dose_unit,
            "route": self.route,
            "notes": self.notes
        }


@dataclass
class DrugRule:
    drug_name: str
    species: Species
    min_dose_per_kg: float
    max_dose_per_kg: float
    dose_unit: str
    route: str = ""
    notes: str = ""


@dataclass
class RiskEvent:
    risk_id: str
    case_id: str
    risk_type: RiskType
    severity: RiskSeverity
    start_time: datetime
    end_time: Optional[datetime] = None
    description: str = ""
    confirmed: bool = False
    confirmed_by: str = ""
    confirmed_time: Optional[datetime] = None
    data_points: List[Dict[str, Any]] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "risk_id": self.risk_id,
            "case_id": self.case_id,
            "risk_type": self.risk_type.value,
            "severity": self.severity.value,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "description": self.description,
            "confirmed": self.confirmed,
            "confirmed_by": self.confirmed_by,
            "confirmed_time": self.confirmed_time.isoformat() if self.confirmed_time else None,
            "data_points": self.data_points
        }


@dataclass
class TimelineEvent:
    timestamp: datetime
    event_type: str
    description: str
    details: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "event_type": self.event_type,
            "description": self.description,
            "details": self.details
        }


@dataclass
class CaseData:
    case: Case
    vital_signs: List[VitalSign] = field(default_factory=list)
    drug_administrations: List[DrugAdministration] = field(default_factory=list)
    risks: List[RiskEvent] = field(default_factory=list)
    timeline: List[TimelineEvent] = field(default_factory=list)
    post_op_notes: str = ""
    
    def sort_all(self):
        self.vital_signs.sort(key=lambda x: x.timestamp)
        self.drug_administrations.sort(key=lambda x: x.timestamp)
        self.risks.sort(key=lambda x: x.start_time)
        self.timeline.sort(key=lambda x: x.timestamp)
