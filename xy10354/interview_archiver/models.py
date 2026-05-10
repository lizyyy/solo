from dataclasses import dataclass, field
from datetime import datetime, date
from enum import Enum
from typing import List, Optional
import hashlib


class SecurityLevel(Enum):
    PUBLIC = "公开"
    INTERNAL = "内部"
    CONFIDENTIAL = "机密"
    TOP_SECRET = "绝密"


@dataclass
class ActionItem:
    id: Optional[int] = None
    interview_id: Optional[int] = None
    description: str = ""
    owner: Optional[str] = None
    due_date: Optional[date] = None
    is_completed: bool = False
    completed_date: Optional[date] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def is_valid(self) -> bool:
        return self.owner is not None and self.due_date is not None


@dataclass
class InterviewNote:
    id: Optional[int] = None
    file_path: str = ""
    file_hash: str = ""
    customer_name: Optional[str] = None
    interviewee: Optional[str] = None
    interview_date: Optional[date] = None
    key_questions: List[str] = field(default_factory=list)
    security_level: SecurityLevel = SecurityLevel.INTERNAL
    action_items: List[ActionItem] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    @staticmethod
    def calculate_hash(content: str) -> str:
        return hashlib.sha256(content.encode('utf-8')).hexdigest()
