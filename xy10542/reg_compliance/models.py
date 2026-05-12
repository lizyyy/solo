from datetime import datetime
from enum import Enum
from typing import List, Optional
from dataclasses import dataclass, field, asdict


class ChangeType(Enum):
    ADDED = "added"
    REMOVED = "removed"
    MODIFIED = "modified"
    RENUMBERED = "renumbered"
    UNCHANGED = "unchanged"


class RiskLevel(Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class TaskStatus(Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


@dataclass
class Article:
    id: str
    number: str
    title: str
    content: str
    version: str
    tags: List[str] = field(default_factory=list)


@dataclass
class BusinessItem:
    id: str
    name: str
    code: str
    department: str
    risk_level: RiskLevel
    tags: List[str] = field(default_factory=list)


@dataclass
class Mapping:
    article_number: str
    business_code: str
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class Responsible:
    code: str
    name: str
    role: str
    department: str
    email: str


@dataclass
class ArticleChange:
    old_article: Optional[Article]
    new_article: Optional[Article]
    change_type: ChangeType
    similarity: float
    matched_articles: List[str] = field(default_factory=list)


@dataclass
class BusinessImpact:
    business_code: str
    business_name: str
    department: str
    affected_articles: List[str]
    risk_level: RiskLevel
    description: str


@dataclass
class RemediationTask:
    id: str
    business_code: str
    business_name: str
    article_number: str
    responsible_code: Optional[str]
    responsible_name: Optional[str]
    deadline: Optional[datetime]
    status: TaskStatus = TaskStatus.PENDING
    created_at: datetime = field(default_factory=datetime.now)
    closed_at: Optional[datetime] = None
    notes: str = ""


@dataclass
class ConfirmationHistory:
    id: str
    article_number: str
    business_code: str
    operator: str
    action: str
    timestamp: datetime
    before_state: dict
    after_state: dict
    comment: str = ""


@dataclass
class CorrectionHistory:
    id: str
    entity_type: str
    entity_id: str
    operator: str
    before_value: dict
    after_value: dict
    timestamp: datetime
    comment: str = ""
