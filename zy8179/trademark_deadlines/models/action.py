from dataclasses import dataclass
from datetime import date, datetime
from enum import Enum
from typing import Optional


class ActionType(Enum):
    OPPOSITION_NOTICE = "opposition_notice"
    OPPOSITION_RESPONSE = "opposition_response"
    EXAMINATION_REPORT = "examination_report"
    AMENDMENT = "amendment"
    USE_EVIDENCE = "use_evidence"
    RENEWAL = "renewal"
    WIDENING = "widening"
    OFFICE_ACTION = "office_action"


@dataclass
class Action:
    action_id: str
    case_id: str
    action_type: ActionType
    action_date: date
    description: str = ""
    deadline_days: Optional[int] = None
    is_completed: bool = False
    completed_date: Optional[date] = None
    timezone: str = "UTC"
    submission_time: Optional[datetime] = None
    
    def requires_response(self) -> bool:
        response_types = [
            ActionType.OPPOSITION_NOTICE,
            ActionType.EXAMINATION_REPORT,
            ActionType.OFFICE_ACTION,
        ]
        return self.action_type in response_types and not self.is_completed
    
    def get_response_deadline(self, base_days: int = 30) -> Optional[date]:
        if not self.requires_response():
            return None
        days = self.deadline_days if self.deadline_days else base_days
        from dateutil.relativedelta import relativedelta
        return self.action_date + relativedelta(days=days)
