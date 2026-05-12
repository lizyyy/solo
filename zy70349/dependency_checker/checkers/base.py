from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Any, Optional
from datetime import datetime


class CheckStatus(Enum):
    PASS = "PASS"
    WARN = "WARN"
    FAIL = "FAIL"
    SKIP = "SKIP"


@dataclass
class CheckResult:
    name: str
    status: CheckStatus
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    fix_hint: Optional[str] = None
    severity: int = 0
    check_time: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "status": self.status.value,
            "message": self.message,
            "details": self.details,
            "fix_hint": self.fix_hint,
            "severity": self.severity,
            "check_time": self.check_time.isoformat()
        }


class Checker(ABC):
    name: str = "base"
    description: str = "Base checker"

    @abstractmethod
    def check(self, config: Dict[str, Any]) -> CheckResult:
        pass

    def _pass(self, message: str, details: Dict[str, Any] = None) -> CheckResult:
        return CheckResult(
            name=self.name,
            status=CheckStatus.PASS,
            message=message,
            details=details or {},
            severity=0
        )

    def _warn(self, message: str, details: Dict[str, Any] = None,
              fix_hint: str = None, severity: int = 1) -> CheckResult:
        return CheckResult(
            name=self.name,
            status=CheckStatus.WARN,
            message=message,
            details=details or {},
            fix_hint=fix_hint,
            severity=severity
        )

    def _fail(self, message: str, details: Dict[str, Any] = None,
              fix_hint: str = None, severity: int = 5) -> CheckResult:
        return CheckResult(
            name=self.name,
            status=CheckStatus.FAIL,
            message=message,
            details=details or {},
            fix_hint=fix_hint,
            severity=severity
        )

    def _skip(self, message: str = "未配置，跳过检查") -> CheckResult:
        return CheckResult(
            name=self.name,
            status=CheckStatus.SKIP,
            message=message,
            severity=0
        )
