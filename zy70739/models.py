from dataclasses import dataclass, field
from datetime import datetime, date
from enum import Enum
from typing import Optional, List
from uuid import uuid4


class SecretLevel(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ProcessingStatus(str, Enum):
    PENDING = "pending"
    REMINDED = "reminded"
    TRANSFERRED = "transferred"
    RESOLVED = "resolved"
    CLOSED = "closed"


class ConclusionType(str, Enum):
    RENEWED = "renewed"
    DEPRECATED = "deprecated"
    TRANSFERRED_PERMANENTLY = "transferred_permanently"
    OTHER = "other"


@dataclass
class Owner:
    name: str
    email: str
    department: str
    is_on_vacation: bool = False
    backup_owner: Optional[str] = None


@dataclass
class SystemAccount:
    account_id: str
    system_name: str
    environment: str


@dataclass
class ReminderRecord:
    reminder_id: str = field(default_factory=lambda: str(uuid4()))
    reminder_time: datetime = field(default_factory=datetime.now)
    reminder_channel: str = "email"
    reminder_content: str = ""
    is_duplicate: bool = False


@dataclass
class ProcessingConclusion:
    conclusion_id: str = field(default_factory=lambda: str(uuid4()))
    conclusion_type: ConclusionType = ConclusionType.OTHER
    conclusion_time: datetime = field(default_factory=datetime.now)
    operator: str = ""
    remarks: str = ""


@dataclass
class Secret:
    secret_id: str
    secret_name: str
    usage: str
    system_account: SystemAccount
    expire_date: date
    owner: Owner
    level: SecretLevel
    status: ProcessingStatus = ProcessingStatus.PENDING
    reminder_records: List[ReminderRecord] = field(default_factory=list)
    transfer_history: List[dict] = field(default_factory=list)
    conclusion: Optional[ProcessingConclusion] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def get_days_until_expiry(self) -> int:
        return (self.expire_date - date.today()).days

    def add_reminder(self, channel: str = "email", content: str = "") -> ReminderRecord:
        from rules import is_duplicate_reminder
        reminder = ReminderRecord(
            reminder_channel=channel,
            reminder_content=content
        )
        reminder.is_duplicate = is_duplicate_reminder(self, reminder)
        self.reminder_records.append(reminder)
        self.updated_at = datetime.now()
        if not reminder.is_duplicate:
            self.status = ProcessingStatus.REMINDED
        return reminder

    def transfer_owner(self, new_owner: Owner, operator: str, reason: str) -> None:
        self.transfer_history.append({
            "from_owner": self.owner.name,
            "to_owner": new_owner.name,
            "transfer_time": datetime.now(),
            "operator": operator,
            "reason": reason
        })
        self.owner = new_owner
        self.status = ProcessingStatus.TRANSFERRED
        self.updated_at = datetime.now()

    def resolve(self, conclusion_type: ConclusionType, operator: str, remarks: str = "") -> None:
        self.conclusion = ProcessingConclusion(
            conclusion_type=conclusion_type,
            operator=operator,
            remarks=remarks
        )
        self.status = ProcessingStatus.RESOLVED
        self.updated_at = datetime.now()

    def close(self) -> None:
        self.status = ProcessingStatus.CLOSED
        self.updated_at = datetime.now()
