from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any


class AnomalySeverity(Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class AnomalyAction(Enum):
    REMOVE = "remove"
    SPLIT = "split"
    FIX = "fix"
    WARN = "warn"


@dataclass
class RuleResult:
    rule_name: str
    rule_description: str
    point_index: Optional[int] = None
    segment_index: Optional[int] = None
    severity: AnomalySeverity = AnomalySeverity.WARNING
    action: AnomalyAction = AnomalyAction.WARN
    message: str = ""
    details: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> dict:
        return {
            "rule_name": self.rule_name,
            "rule_description": self.rule_description,
            "point_index": self.point_index,
            "segment_index": self.segment_index,
            "severity": self.severity.value,
            "action": self.action.value,
            "message": self.message,
            "details": self.details,
            "timestamp": self.timestamp.isoformat(),
        }


class AnomalyRule(ABC):
    
    @property
    @abstractmethod
    def name(self) -> str:
        pass
    
    @property
    @abstractmethod
    def description(self) -> str:
        pass
    
    @abstractmethod
    def apply(self, track, config) -> List[RuleResult]:
        pass
