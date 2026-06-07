from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any


class TicketStatus(str, Enum):
    IMPORTED = "imported"
    DETECTED_LEAK = "detected_leak"
    REVIEW_PENDING = "review_pending"
    REVIEWED_BY_OPERATION = "reviewed_by_operation"
    REVIEWED_BY_ALGORITHM = "reviewed_by_algorithm"
    RESOLVED = "resolved"
    CLOSED = "closed"


@dataclass
class TicketField:
    field_name: str
    field_value: str
    is_masked: bool = False
    mask_pattern: Optional[str] = None
    ocr_confidence: Optional[float] = None
    leak_detected: bool = False
    leak_note: Optional[str] = None


@dataclass
class Ticket:
    ticket_id: str
    source: str
    created_at: datetime
    title: str
    description: str
    fields: List[TicketField]
    status: TicketStatus = TicketStatus.IMPORTED
    assignee: Optional[str] = None
    rule_notes: List[Dict[str, Any]] = field(default_factory=list)
    algorithm_notes: List[Dict[str, Any]] = field(default_factory=list)
    export_history: List[str] = field(default_factory=list)
    ocr_confidence_score: Optional[float] = None
    updated_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def get_leaking_fields(self) -> List[TicketField]:
        return [f for f in self.fields if f.leak_detected]

    def has_leaks(self) -> bool:
        return any(f.leak_detected for f in self.fields)

    def add_rule_note(self, note: str, author: str, field_name: Optional[str] = None):
        self.rule_notes.append({
            "note": note,
            "author": author,
            "field_name": field_name,
            "timestamp": datetime.now().isoformat()
        })
        self.updated_at = datetime.now()

    def add_algorithm_note(self, note: str, author: str, field_name: Optional[str] = None):
        self.algorithm_notes.append({
            "note": note,
            "author": author,
            "field_name": field_name,
            "timestamp": datetime.now().isoformat()
        })
        self.updated_at = datetime.now()

    def set_status(self, status: TicketStatus, assignee: Optional[str] = None):
        self.status = status
        if assignee:
            self.assignee = assignee
        self.updated_at = datetime.now()
