from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Optional, Any
from datetime import datetime


class SeverityLevel(Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class MissingType(Enum):
    ACCESSORY = "ACCESSORY"
    DEPENDENCY = "DEPENDENCY"
    QUANTITY = "QUANTITY"


@dataclass(order=True)
class MaterialItem:
    sort_index: str = field(init=False, repr=False)
    city: str
    material_name: str
    quantity: int
    box_number: str = ""
    category: str = ""
    line_number: int = 0
    is_valid: bool = True
    error_message: str = ""
    raw_data: str = ""

    def __post_init__(self):
        self.sort_index = f"{self.city}_{self.category}_{self.material_name}"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "city": self.city,
            "material_name": self.material_name,
            "quantity": self.quantity,
            "box_number": self.box_number,
            "category": self.category,
            "line_number": self.line_number,
            "is_valid": self.is_valid,
            "error_message": self.error_message,
        }


@dataclass
class AccessoryDependency:
    main_item: str
    required_accessory: str
    ratio: int = 1
    severity: SeverityLevel = SeverityLevel.CRITICAL


@dataclass
class MissingItem:
    city: str
    material_name: str
    missing_type: MissingType
    severity: SeverityLevel
    required_quantity: int
    actual_quantity: int
    source_line: int
    source_box: str = ""
    depends_on: str = ""
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "city": self.city,
            "material_name": self.material_name,
            "missing_type": self.missing_type.value,
            "severity": self.severity.value,
            "required_quantity": self.required_quantity,
            "actual_quantity": self.actual_quantity,
            "source_line": self.source_line,
            "source_box": self.source_box,
            "depends_on": self.depends_on,
            "notes": self.notes,
        }


@dataclass
class BoxAssignment:
    box_number: str
    city: str
    materials: List[MaterialItem] = field(default_factory=list)
    total_items: int = 0

    def add_material(self, item: MaterialItem):
        self.materials.append(item)
        self.total_items += item.quantity

    def to_dict(self) -> Dict[str, Any]:
        return {
            "box_number": self.box_number,
            "city": self.city,
            "material_count": len(self.materials),
            "total_quantity": self.total_items,
            "materials": [m.material_name for m in self.materials],
        }


@dataclass
class CheckResult:
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    materials: List[MaterialItem] = field(default_factory=list)
    invalid_rows: List[MaterialItem] = field(default_factory=list)
    box_assignments: Dict[str, BoxAssignment] = field(default_factory=dict)
    missing_items: List[MissingItem] = field(default_factory=list)
    city_summary: Dict[str, Any] = field(default_factory=dict)

    def get_missing_by_severity(self) -> Dict[SeverityLevel, List[MissingItem]]:
        result = {}
        for item in self.missing_items:
            if item.severity not in result:
                result[item.severity] = []
            result[item.severity].append(item)
        return result
