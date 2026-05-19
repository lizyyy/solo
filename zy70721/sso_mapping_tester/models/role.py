from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List
from enum import Enum


class ConflictType(Enum):
    MISSING_ROLE = "missing_role"
    EXTRA_ROLE = "extra_role"
    ROLE_MISMATCH = "role_mismatch"
    DUPLICATE_ROLE = "duplicate_role"
    PERMISSION_CONFLICT = "permission_conflict"


@dataclass
class RoleResult:
    user_id: str
    actual_roles: List[str]
    mapped_attributes: Dict[str, Any]
    source_file: str
    line_number: int
    timestamp: Optional[str] = None
    success: bool = True
    error_message: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "actual_roles": self.actual_roles,
            "mapped_attributes": self.mapped_attributes,
            "source_file": self.source_file,
            "line_number": self.line_number,
            "timestamp": self.timestamp,
            "success": self.success,
            "error_message": self.error_message,
        }


@dataclass
class RoleConflict:
    user_id: str
    conflict_type: ConflictType
    expected: Any
    actual: Any
    role_name: Optional[str] = None
    description: Optional[str] = None
    severity: str = "error"
    source_trace: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "conflict_type": self.conflict_type.value,
            "expected": self.expected,
            "actual": self.actual,
            "role_name": self.role_name,
            "description": self.description,
            "severity": self.severity,
            "source_trace": self.source_trace,
        }
