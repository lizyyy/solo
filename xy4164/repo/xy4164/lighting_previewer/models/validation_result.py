"""校验结果数据模型"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional
from enum import Enum


class IssueSeverity(str, Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class IssueCategory(str, Enum):
    SENSOR_MISSING = "sensor_missing"
    SENSOR_ANOMALY = "sensor_anomaly"
    POWER_CONFLICT = "power_conflict"
    THRESHOLD_VIOLATION = "threshold_violation"
    BUDGET_EXCEEDED = "budget_exceeded"
    DATA_INCONSISTENCY = "data_inconsistency"
    SPECTRUM_MISMATCH = "spectrum_mismatch"


@dataclass
class ValidationIssue:
    issue_id: str
    category: IssueCategory
    severity: IssueSeverity
    message: str
    affected_zone: Optional[str] = None
    affected_sensor: Optional[str] = None
    affected_spectrum: Optional[str] = None
    affected_hour: Optional[int] = None
    suggested_action: str = ""
    metadata: Dict = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return {
            "issue_id": self.issue_id,
            "category": self.category.value,
            "severity": self.severity.value,
            "message": self.message,
            "affected_zone": self.affected_zone,
            "affected_sensor": self.affected_sensor,
            "affected_spectrum": self.affected_spectrum,
            "affected_hour": self.affected_hour,
            "suggested_action": self.suggested_action,
            "metadata": self.metadata
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> "ValidationIssue":
        return cls(
            issue_id=data["issue_id"],
            category=IssueCategory(data["category"]),
            severity=IssueSeverity(data["severity"]),
            message=data["message"],
            affected_zone=data.get("affected_zone"),
            affected_sensor=data.get("affected_sensor"),
            affected_spectrum=data.get("affected_spectrum"),
            affected_hour=data.get("affected_hour"),
            suggested_action=data.get("suggested_action", ""),
            metadata=data.get("metadata", {})
        )
    
    @property
    def is_critical(self) -> bool:
        return self.severity == IssueSeverity.CRITICAL
    
    @property
    def is_warning(self) -> bool:
        return self.severity == IssueSeverity.WARNING


@dataclass
class ValidationResult:
    validation_id: str
    validated_at: str
    base_date: str
    
    issues: List[ValidationIssue] = field(default_factory=list)
    
    is_valid: bool = True
    has_critical: bool = False
    has_warnings: bool = False
    
    sensor_validations: Dict[str, Dict] = field(default_factory=dict)
    power_validations: Dict[str, Dict] = field(default_factory=dict)
    threshold_validations: Dict[str, Dict] = field(default_factory=dict)
    budget_validations: Dict = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return {
            "validation_id": self.validation_id,
            "validated_at": self.validated_at,
            "base_date": self.base_date,
            "issues": [i.to_dict() for i in self.issues],
            "is_valid": self.is_valid,
            "has_critical": self.has_critical,
            "has_warnings": self.has_warnings,
            "sensor_validations": self.sensor_validations,
            "power_validations": self.power_validations,
            "threshold_validations": self.threshold_validations,
            "budget_validations": self.budget_validations
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> "ValidationResult":
        return cls(
            validation_id=data["validation_id"],
            validated_at=data["validated_at"],
            base_date=data.get("base_date", ""),
            issues=[ValidationIssue.from_dict(i) for i in data.get("issues", [])],
            is_valid=data.get("is_valid", True),
            has_critical=data.get("has_critical", False),
            has_warnings=data.get("has_warnings", False),
            sensor_validations=data.get("sensor_validations", {}),
            power_validations=data.get("power_validations", {}),
            threshold_validations=data.get("threshold_validations", {}),
            budget_validations=data.get("budget_validations", {})
        )
    
    def add_issue(self, issue: ValidationIssue) -> None:
        self.issues.append(issue)
        self._update_flags()
    
    def _update_flags(self) -> None:
        self.has_critical = any(i.is_critical for i in self.issues)
        self.has_warnings = any(i.is_warning for i in self.issues)
        self.is_valid = not self.has_critical
    
    @property
    def critical_issues(self) -> List[ValidationIssue]:
        return [i for i in self.issues if i.is_critical]
    
    @property
    def warning_issues(self) -> List[ValidationIssue]:
        return [i for i in self.issues if i.is_warning]
    
    @property
    def info_issues(self) -> List[ValidationIssue]:
        return [i for i in self.issues if not i.is_critical and not i.is_warning]
    
    def get_issues_by_zone(self, zone_id: str) -> List[ValidationIssue]:
        return [i for i in self.issues if i.affected_zone == zone_id]
    
    def get_issues_by_category(self, category: IssueCategory) -> List[ValidationIssue]:
        return [i for i in self.issues if i.category == category]
    
    @property
    def issue_summary(self) -> Dict[str, int]:
        summary = {
            "total": len(self.issues),
            "critical": len(self.critical_issues),
            "warning": len(self.warning_issues),
            "info": len(self.info_issues)
        }
        
        category_summary = {}
        for issue in self.issues:
            cat = issue.category.value
            category_summary[cat] = category_summary.get(cat, 0) + 1
        
        summary["by_category"] = category_summary
        return summary
