from dataclasses import dataclass, field
from datetime import date
from enum import Enum
from typing import Optional, List


class CaseStatus(Enum):
    ACTIVE = "active"
    ABANDONED = "abandoned"
    REGISTERED = "registered"
    EXPIRED = "expired"


@dataclass
class Case:
    case_id: str
    trademark: str
    jurisdiction: str
    application_number: Optional[str] = None
    registration_number: Optional[str] = None
    application_date: Optional[date] = None
    registration_date: Optional[date] = None
    status: CaseStatus = CaseStatus.ACTIVE
    classes: List[str] = field(default_factory=list)
    applicant: str = ""
    filing_timezone: str = "UTC"
    
    def has_valid_application_date(self) -> bool:
        return self.application_date is not None
    
    def is_abandoned(self) -> bool:
        return self.status == CaseStatus.ABANDONED
    
    def get_primary_date(self) -> Optional[date]:
        if self.registration_date:
            return self.registration_date
        if self.application_date:
            return self.application_date
        return None
