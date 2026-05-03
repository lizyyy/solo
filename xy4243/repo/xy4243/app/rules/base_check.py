from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Any, Optional, Generic, TypeVar

from app.models import Violation, CheckStatus


T = TypeVar('T')


@dataclass
class CheckResult:
    check_name: str
    check_status: CheckStatus = CheckStatus.OK
    violations: List[Violation] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    checked_at: datetime = field(default_factory=datetime.now)

    @property
    def has_errors(self) -> bool:
        return self.check_status in (CheckStatus.ERROR, CheckStatus.WARNING) or len(self.violations) > 0

    @property
    def error_count(self) -> int:
        return len([v for v in self.violations if not v.resolved])


class BaseCheck(ABC, Generic[T]):

    @property
    @abstractmethod
    def check_name(self) -> str:
        pass

    @property
    @abstractmethod
    def check_description(self) -> str:
        pass

    @abstractmethod
    def execute(self, data: T) -> CheckResult:
        pass

    def _create_violation(
        self,
        violation_type: str,
        description: str,
        severity: str = "high",
        prop_id: Optional[str] = None,
        prop_name: Optional[str] = None,
        scene_id: Optional[str] = None,
        scene_title: Optional[str] = None,
        handover_id: Optional[str] = None,
        actor_id: Optional[str] = None,
        actor_name: Optional[str] = None,
        related_entities: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Violation:
        return Violation(
            violation_type=violation_type,
            check_status=CheckStatus.ERROR if severity in ("high", "critical") else CheckStatus.WARNING,
            severity=severity,
            description=description,
            prop_id=prop_id,
            prop_name=prop_name,
            scene_id=scene_id,
            scene_title=scene_title,
            handover_id=handover_id,
            actor_id=actor_id,
            actor_name=actor_name,
            related_entities=related_entities or [],
            metadata=metadata or {},
        )
