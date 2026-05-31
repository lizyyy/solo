from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional


class HitType(Enum):
    EXACT = "exact"
    PARTIAL = "partial"
    MISS = "miss"
    DUPLICATE = "duplicate"
    BOUNDARY = "boundary"


class ReviewStatus(Enum):
    AUTO = "auto"
    CONFIRMED = "confirmed"
    OVERRIDDEN = "overridden"
    PENDING_REVIEW = "pending_review"


class ConversationSource(Enum):
    NORMAL = "normal"
    MISSING_KB = "missing_kb"
    DUPLICATE_OVERRIDE = "duplicate_override"
    BOUNDARY = "boundary"


@dataclass
class Message:
    role: str
    content: str
    timestamp: Optional[datetime] = None


@dataclass
class Conversation:
    id: str
    timestamp: datetime
    customer_id: str
    agent_id: str
    messages: list = field(default_factory=list)
    source: ConversationSource = ConversationSource.NORMAL
    manual_label: Optional[str] = None
    raw_data: Optional[dict] = None


@dataclass
class KnowledgeItem:
    id: str
    title: str
    content: str
    keywords: list = field(default_factory=list)
    category: str = ""
    active: bool = True


@dataclass
class HitResult:
    conversation_id: str
    knowledge_id: Optional[str]
    hit_type: HitType
    confidence: float
    status: ReviewStatus = ReviewStatus.PENDING_REVIEW
    reviewer_note: str = ""
    reviewed_by: str = ""
    reviewed_at: Optional[datetime] = None
    override_history: list = field(default_factory=list)
    matched_keywords: list = field(default_factory=list)
    detail: str = ""


@dataclass
class ReviewSession:
    id: str
    created_at: datetime
    operator: str
    total_count: int = 0
    reviewed_count: int = 0
    pending_count: int = 0
    notes: str = ""
