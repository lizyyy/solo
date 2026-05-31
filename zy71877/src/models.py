from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from datetime import datetime
import hashlib
import json


@dataclass
class EnergyDataPoint:
    timestamp: float
    power: float
    label: Optional[str] = None


@dataclass
class PeakValleyPoint:
    index: int
    timestamp: float
    power: float
    point_type: str
    prominence: float


@dataclass
class FittingResult:
    peaks: List[PeakValleyPoint]
    valleys: List[PeakValleyPoint]
    fitting_error: float
    polynomial_coeffs: List[float]
    smoothed_data: List[float]


@dataclass
class ConstraintViolation:
    constraint_name: str
    constraint_value: float
    actual_value: float
    severity: str
    explanation: str


@dataclass
class FittingRecord:
    record_id: str
    batch_id: str
    material_id: str
    timestamp: str
    operator: str
    notes: str
    input_data_hash: str
    fitting_result: FittingResult
    constraint_violations: List[ConstraintViolation]
    status: str
    version: int = 1
    parent_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "batch_id": self.batch_id,
            "material_id": self.material_id,
            "timestamp": self.timestamp,
            "operator": self.operator,
            "notes": self.notes,
            "input_data_hash": self.input_data_hash,
            "fitting_result": {
                "peaks": [(p.index, p.timestamp, p.power, p.point_type, p.prominence) 
                          for p in self.fitting_result.peaks],
                "valleys": [(v.index, v.timestamp, v.power, v.point_type, v.prominence) 
                            for v in self.fitting_result.valleys],
                "fitting_error": self.fitting_result.fitting_error,
                "polynomial_coeffs": self.fitting_result.polynomial_coeffs,
                "smoothed_data": self.fitting_result.smoothed_data,
            },
            "constraint_violations": [
                {
                    "constraint_name": v.constraint_name,
                    "constraint_value": v.constraint_value,
                    "actual_value": v.actual_value,
                    "severity": v.severity,
                    "explanation": v.explanation,
                }
                for v in self.constraint_violations
            ],
            "status": self.status,
            "version": self.version,
            "parent_id": self.parent_id,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "FittingRecord":
        fr = FittingResult(
            peaks=[PeakValleyPoint(*p) for p in data["fitting_result"]["peaks"]],
            valleys=[PeakValleyPoint(*v) for v in data["fitting_result"]["valleys"]],
            fitting_error=data["fitting_result"]["fitting_error"],
            polynomial_coeffs=data["fitting_result"]["polynomial_coeffs"],
            smoothed_data=data["fitting_result"]["smoothed_data"],
        )
        return cls(
            record_id=data["record_id"],
            batch_id=data["batch_id"],
            material_id=data["material_id"],
            timestamp=data["timestamp"],
            operator=data["operator"],
            notes=data["notes"],
            input_data_hash=data["input_data_hash"],
            fitting_result=fr,
            constraint_violations=[
                ConstraintViolation(**v) for v in data["constraint_violations"]
            ],
            status=data["status"],
            version=data.get("version", 1),
            parent_id=data.get("parent_id"),
        )


def generate_data_hash(data_points: List[EnergyDataPoint]) -> str:
    data_str = json.dumps([(dp.timestamp, dp.power) for dp in data_points], sort_keys=True)
    return hashlib.sha256(data_str.encode()).hexdigest()[:16]


def generate_record_id() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")
