from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import uuid
import json
import os

STANDARD_FREQUENCIES = [125, 250, 500, 1000, 2000, 4000]
FREQUENCY_LABELS = {
    125: "125Hz",
    250: "250Hz",
    500: "500Hz",
    1000: "1kHz",
    2000: "2kHz",
    4000: "4kHz"
}
VALID_UNITS = ["m2", "m²", "sqm", "square meter"]


@dataclass
class Material:
    id: str
    name: str
    area: float
    unit: str
    absorption_coefficients: Dict[int, float]
    created_at: datetime
    updated_at: datetime

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "name": self.name,
            "area": self.area,
            "unit": self.unit,
            "absorption_coefficients": {str(k): v for k, v in self.absorption_coefficients.items()},
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "Material":
        return cls(
            id=data["id"],
            name=data["name"],
            area=data["area"],
            unit=data["unit"],
            absorption_coefficients={int(k): v for k, v in data["absorption_coefficients"].items()},
            created_at=datetime.fromisoformat(data["created_at"]),
            updated_at=datetime.fromisoformat(data["updated_at"])
        )


@dataclass
class Room:
    id: str
    name: str
    length: float
    width: float
    height: float
    volume: float
    surface_area: float
    materials: List[Material]
    status: str
    created_at: datetime
    updated_at: datetime
    notes: str = ""

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "name": self.name,
            "length": self.length,
            "width": self.width,
            "height": self.height,
            "volume": self.volume,
            "surface_area": self.surface_area,
            "materials": [m.to_dict() for m in self.materials],
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "notes": self.notes
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "Room":
        return cls(
            id=data["id"],
            name=data["name"],
            length=data["length"],
            width=data["width"],
            height=data["height"],
            volume=data["volume"],
            surface_area=data["surface_area"],
            materials=[Material.from_dict(m) for m in data["materials"]],
            status=data["status"],
            created_at=datetime.fromisoformat(data["created_at"]),
            updated_at=datetime.fromisoformat(data["updated_at"]),
            notes=data.get("notes", "")
        )


@dataclass
class ValidationIssue:
    type: str
    severity: str
    message: str
    related_object: str
    details: Dict = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return {
            "type": self.type,
            "severity": self.severity,
            "message": self.message,
            "related_object": self.related_object,
            "details": self.details
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "ValidationIssue":
        return cls(
            type=data["type"],
            severity=data["severity"],
            message=data["message"],
            related_object=data["related_object"],
            details=data.get("details", {})
        )


@dataclass
class CalculationResult:
    room_id: str
    room_name: str
    t60_by_frequency: Dict[int, float]
    average_t60: float
    total_absorption_by_frequency: Dict[int, float]
    sabine_formula_applied: bool
    calculation_timestamp: datetime
    issues: List[ValidationIssue]
    material_contributions: Dict[str, Dict[int, float]]

    def to_dict(self) -> Dict:
        return {
            "room_id": self.room_id,
            "room_name": self.room_name,
            "t60_by_frequency": {str(k): v for k, v in self.t60_by_frequency.items()},
            "average_t60": self.average_t60,
            "total_absorption_by_frequency": {str(k): v for k, v in self.total_absorption_by_frequency.items()},
            "sabine_formula_applied": self.sabine_formula_applied,
            "calculation_timestamp": self.calculation_timestamp.isoformat(),
            "issues": [i.to_dict() for i in self.issues],
            "material_contributions": {k: {str(f): v for f, v in contrib.items()} for k, contrib in self.material_contributions.items()}
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "CalculationResult":
        return cls(
            room_id=data["room_id"],
            room_name=data["room_name"],
            t60_by_frequency={int(k): v for k, v in data["t60_by_frequency"].items()},
            average_t60=data["average_t60"],
            total_absorption_by_frequency={int(k): v for k, v in data["total_absorption_by_frequency"].items()},
            sabine_formula_applied=data["sabine_formula_applied"],
            calculation_timestamp=datetime.fromisoformat(data["calculation_timestamp"]),
            issues=[ValidationIssue.from_dict(i) for i in data["issues"]],
            material_contributions={k: {int(f): v for f, v in contrib.items()} for k, contrib in data["material_contributions"].items()}
        )


@dataclass
class HistoryEntry:
    id: str
    room_id: str
    operation_type: str
    field_name: Optional[str]
    old_value: Optional[str]
    new_value: Optional[str]
    operator: str
    timestamp: datetime
    reason: str = ""

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "room_id": self.room_id,
            "operation_type": self.operation_type,
            "field_name": self.field_name,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "operator": self.operator,
            "timestamp": self.timestamp.isoformat(),
            "reason": self.reason
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "HistoryEntry":
        return cls(
            id=data["id"],
            room_id=data["room_id"],
            operation_type=data["operation_type"],
            field_name=data.get("field_name"),
            old_value=data.get("old_value"),
            new_value=data.get("new_value"),
            operator=data["operator"],
            timestamp=datetime.fromisoformat(data["timestamp"]),
            reason=data.get("reason", "")
        )
