from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Set
from decimal import Decimal


STANDARD_ELEMENTS: Set[str] = {
    "N", "P", "K", "CA", "MG", "S", "FE", "MN", "ZN", "CU", "B", "MO", "CL"
}


class ValidationErrorType(Enum):
    MISSING_FIELD = "missing_field"
    INVALID_UNIT = "invalid_unit"
    DUPLICATE_MATERIAL = "duplicate_material"
    UNKNOWN_ELEMENT = "unknown_element"
    CONFLICTING_LIMITS = "conflicting_limits"
    NEGATIVE_VALUE = "negative_value"
    INVALID_PURITY = "invalid_purity"


@dataclass
class ValidationError:
    error_type: ValidationErrorType
    message: str
    field: Optional[str] = None
    row_number: Optional[int] = None

    def __str__(self) -> str:
        parts = []
        if self.row_number is not None:
            parts.append(f"第{self.row_number}行")
        if self.field:
            parts.append(f"[{self.field}]")
        parts.append(self.message)
        return "".join(parts)


@dataclass
class Material:
    name: str
    purity: Decimal
    element_composition: Dict[str, Decimal]
    remaining_grams: Decimal
    price_per_gram: Decimal

    def __post_init__(self):
        if self.purity <= 0 or self.purity > 1:
            raise ValueError(f"纯度必须在(0, 1]范围内: {self.purity}")
        if self.remaining_grams < 0:
            raise ValueError(f"剩余克数不能为负数: {self.remaining_grams}")
        if self.price_per_gram < 0:
            raise ValueError(f"单价不能为负数: {self.price_per_gram}")

    def get_element_content(self, element: str) -> Decimal:
        base_content = self.element_composition.get(element, Decimal("0"))
        return base_content * self.purity


@dataclass
class RecipeTarget:
    target_volume_liters: Decimal
    element_limits: Dict[str, "ElementLimit"]
    forbidden_materials: List[str]
    notes: str

    @property
    def elements(self) -> List[str]:
        return list(self.element_limits.keys())


@dataclass
class ElementLimit:
    element: str
    min_ppm: Decimal
    max_ppm: Decimal

    def __post_init__(self):
        if self.min_ppm < 0:
            raise ValueError(f"ppm下限不能为负数: {self.min_ppm}")
        if self.max_ppm < 0:
            raise ValueError(f"ppm上限不能为负数: {self.max_ppm}")
        if self.min_ppm > self.max_ppm:
            raise ValueError(f"ppm下限({self.min_ppm})不能大于上限({self.max_ppm})")


@dataclass
class WeighingPlan:
    material_name: str
    grams_needed: Decimal
    cost: Decimal
    element_contributions: Dict[str, Decimal]


@dataclass
class CalculationResult:
    volume_liters: Decimal
    plans: List[WeighingPlan]
    total_cost: Decimal
    element_results: Dict[str, "ElementResult"]
    warnings: List[str]
    is_feasible: bool


@dataclass
class ElementResult:
    element: str
    target_min_ppm: Decimal
    target_max_ppm: Decimal
    actual_ppm: Decimal
    deviation: Decimal
    deviation_percent: Decimal
    status: str

    @property
    def is_within_range(self) -> bool:
        return self.status == "ok"


@dataclass
class LedgerEntry:
    batch_id: str
    timestamp: str
    volume_liters: Decimal
    material_usages: List["MaterialUsage"]
    total_cost: Decimal
    element_actuals: Dict[str, Decimal]
    element_targets: Dict[str, ElementLimit]
    notes: str
    inventory_snapshot: Dict[str, Decimal]


@dataclass
class MaterialUsage:
    material_name: str
    grams_used: Decimal
    cost: Decimal
    remaining_before: Decimal
    remaining_after: Decimal


@dataclass
class Inventory:
    materials: Dict[str, Material] = field(default_factory=dict)

    def add_material(self, material: Material) -> None:
        if material.name in self.materials:
            raise ValueError(f"原料已存在: {material.name}")
        self.materials[material.name] = material

    def get_material(self, name: str) -> Optional[Material]:
        return self.materials.get(name)

    def list_materials(self) -> List[Material]:
        return list(self.materials.values())

    def deduct(self, name: str, grams: Decimal) -> None:
        material = self.get_material(name)
        if not material:
            raise ValueError(f"原料不存在: {name}")
        if material.remaining_grams < grams:
            raise ValueError(
                f"库存不足: {name} (剩余{material.remaining_grams}g, 需要{grams}g)"
            )
        material.remaining_grams -= grams
