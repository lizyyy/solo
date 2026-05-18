from dataclasses import dataclass, field
from typing import List, Optional, Dict
from enum import Enum


class ExitCode(Enum):
    SUCCESS = 0
    GENERAL_ERROR = 1
    INPUT_NOT_FOUND = 2
    DATA_FORMAT_ERROR = 3
    CONFIG_ERROR = 4
    OUTPUT_ERROR = 5
    VALIDATION_ERROR = 6


@dataclass
class PartIssue:
    issue_type: str
    description: str
    severity: str = "warning"


@dataclass
class SparePart:
    part_code: str
    part_name: str
    quantity: int
    unit: str
    min_stock: int
    current_stock: int
    supplier: str = ""
    price: float = 0.0
    min_package: int = 1
    alternative_parts: List[str] = field(default_factory=list)
    issues: List[PartIssue] = field(default_factory=list)

    @property
    def suggested_purchase(self) -> int:
        need = max(0, self.min_stock - self.current_stock)
        if need <= 0:
            return 0
        if self.min_package > 1:
            packages = (need + self.min_package - 1) // self.min_package
            return packages * self.min_package
        return need

    def add_issue(self, issue_type: str, description: str, severity: str = "warning"):
        self.issues.append(PartIssue(issue_type, description, severity))


@dataclass
class PurchaseSuggestion:
    part_code: str
    part_name: str
    suggested_quantity: int
    unit: str
    min_package: int
    actual_packages: int
    alternative_parts: List[str]
    issues: List[PartIssue]


@dataclass
class ProcessingResult:
    total_parts: int = 0
    parts_needing_purchase: int = 0
    parts_with_alternatives: int = 0
    parts_with_min_package: int = 0
    suggestions: List[PurchaseSuggestion] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
