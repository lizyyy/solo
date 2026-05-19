from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Any, Optional
from ..models import (
    ParseResult,
    Repository,
    BranchRule,
    ExceptionApplication,
    ProtectionWindow,
    RecoveryAction,
    ValidationResult,
    AuditLevel,
    ValidationStatus,
)


@dataclass
class RuleContext:
    parse_result: ParseResult
    audit_time: datetime = field(default_factory=datetime.now)
    repositories_by_id: Dict[str, Repository] = field(default_factory=dict)
    exceptions_by_id: Dict[str, ExceptionApplication] = field(default_factory=dict)
    windows_by_id: Dict[str, ProtectionWindow] = field(default_factory=dict)
    recoveries_by_window_id: Dict[str, List[RecoveryAction]] = field(default_factory=dict)
    windows_by_exception_id: Dict[str, List[ProtectionWindow]] = field(default_factory=dict)

    def __post_init__(self):
        for repo in self.parse_result.repositories:
            self.repositories_by_id[repo.id] = repo

        for exc in self.parse_result.exceptions:
            self.exceptions_by_id[exc.id] = exc

        for window in self.parse_result.windows:
            self.windows_by_id[window.id] = window
            if window.exception_id not in self.windows_by_exception_id:
                self.windows_by_exception_id[window.exception_id] = []
            self.windows_by_exception_id[window.exception_id].append(window)

        for recovery in self.parse_result.recoveries:
            if recovery.window_id not in self.recoveries_by_window_id:
                self.recoveries_by_window_id[recovery.window_id] = []
            self.recoveries_by_window_id[recovery.window_id].append(recovery)


class BaseRule(ABC):
    rule_id: str = ""
    rule_name: str = ""
    description: str = ""

    @abstractmethod
    def validate(self, context: RuleContext) -> List[ValidationResult]:
        pass

    def _create_validation(
        self,
        status: ValidationStatus,
        level: AuditLevel,
        message: str,
        details: Optional[Dict[str, Any]] = None,
        related_records: Optional[List[str]] = None,
    ) -> ValidationResult:
        return ValidationResult(
            rule_id=self.rule_id,
            rule_name=self.rule_name,
            status=status,
            level=level,
            message=message,
            details=details or {},
            related_records=related_records or [],
        )

    def _pass(self, message: str = "验证通过", **kwargs) -> ValidationResult:
        return self._create_validation(
            ValidationStatus.PASS, AuditLevel.INFO, message, **kwargs
        )

    def _warn(self, message: str, **kwargs) -> ValidationResult:
        return self._create_validation(
            ValidationStatus.WARN, AuditLevel.WARNING, message, **kwargs
        )

    def _fail(self, message: str, **kwargs) -> ValidationResult:
        return self._create_validation(
            ValidationStatus.FAIL, AuditLevel.ERROR, message, **kwargs
        )

    def _skip(self, message: str = "跳过验证", **kwargs) -> ValidationResult:
        return self._create_validation(
            ValidationStatus.SKIP, AuditLevel.INFO, message, **kwargs
        )
