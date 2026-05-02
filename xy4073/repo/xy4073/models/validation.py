from dataclasses import dataclass, field
from typing import List, Optional
from enum import Enum


class ValidationSeverity(Enum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class ValidationType(Enum):
    OVERLAP = "overlap"
    OUT_OF_BOUNDS = "out_of_bounds"
    GRAIN_DIRECTION = "grain_direction"
    PLAID_MISMATCH = "plaid_mismatch"
    DUPLICATE_PIECE = "duplicate_piece"
    NO_PLACE_ZONE = "no_place_zone"


@dataclass
class ValidationError:
    type: ValidationType
    severity: ValidationSeverity
    message: str
    piece_ids: List[str] = field(default_factory=list)
    details: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "type": self.type.value,
            "severity": self.severity.value,
            "message": self.message,
            "piece_ids": self.piece_ids,
            "details": self.details
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ValidationError":
        return cls(
            type=ValidationType(data.get("type", "overlap")),
            severity=ValidationSeverity(data.get("severity", "error")),
            message=data.get("message", ""),
            piece_ids=data.get("piece_ids", []),
            details=data.get("details", {})
        )


@dataclass
class ValidationResult:
    is_valid: bool = True
    errors: List[ValidationError] = field(default_factory=list)
    warnings: List[ValidationError] = field(default_factory=list)

    def add_error(self, error: ValidationError):
        if error.severity == ValidationSeverity.ERROR:
            self.errors.append(error)
            self.is_valid = False
        elif error.severity == ValidationSeverity.WARNING:
            self.warnings.append(error)

    def get_all_issues(self) -> List[ValidationError]:
        return self.errors + self.warnings

    def has_errors(self) -> bool:
        return len(self.errors) > 0

    def has_warnings(self) -> bool:
        return len(self.warnings) > 0

    def error_count(self) -> int:
        return len(self.errors)

    def warning_count(self) -> int:
        return len(self.warnings)

    def to_dict(self) -> dict:
        return {
            "is_valid": self.is_valid,
            "errors": [e.to_dict() for e in self.errors],
            "warnings": [w.to_dict() for w in self.warnings]
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ValidationResult":
        result = cls(
            is_valid=data.get("is_valid", True)
        )
        errors_data = data.get("errors", [])
        warnings_data = data.get("warnings", [])
        result.errors = [ValidationError.from_dict(e) for e in errors_data]
        result.warnings = [ValidationError.from_dict(w) for w in warnings_data]
        return result
