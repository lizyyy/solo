from dataclasses import dataclass, field
from datetime import timedelta
from enum import Enum
from typing import Dict, List, Optional


class DeadlineType(Enum):
    OPPOSITION = "opposition"
    OPPOSITION_RESPONSE = "opposition_response"
    EXAMINATION_AMENDMENT = "examination_amendment"
    RENEWAL = "renewal"
    WIDENING = "widening"
    USE_EVIDENCE = "use_evidence"
    OFFICE_ACTION_RESPONSE = "office_action_response"


class CalculationMethod(Enum):
    CALENDAR_DAYS = "calendar_days"
    BUSINESS_DAYS = "business_days"
    MONTHS = "months"
    YEARS = "years"


@dataclass
class DeadlineRule:
    deadline_type: DeadlineType
    method: CalculationMethod
    duration: int
    description: str = ""
    requires_documents: List[str] = field(default_factory=list)
    timezone: str = "UTC"
    
    def get_duration_timedelta(self) -> timedelta:
        if self.method == CalculationMethod.CALENDAR_DAYS:
            return timedelta(days=self.duration)
        elif self.method == CalculationMethod.BUSINESS_DAYS:
            return timedelta(days=self.duration)
        elif self.method == CalculationMethod.MONTHS:
            return timedelta(days=self.duration * 30)
        elif self.method == CalculationMethod.YEARS:
            return timedelta(days=self.duration * 365)
        return timedelta(days=0)


@dataclass
class JurisdictionRule:
    jurisdiction: str
    name: str
    default_timezone: str = "UTC"
    deadline_rules: Dict[DeadlineType, DeadlineRule] = field(default_factory=dict)
    holiday_calendar_key: str = ""
    
    def get_deadline_rule(self, deadline_type: DeadlineType) -> Optional[DeadlineRule]:
        return self.deadline_rules.get(deadline_type)
    
    def get_timezone(self) -> str:
        return self.default_timezone
