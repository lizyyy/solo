from dataclasses import dataclass, field
from typing import Optional, List
from datetime import datetime
import uuid


@dataclass
class FeedbackTicket:
    ticket_id: str = field(default_factory=lambda: f"T{uuid.uuid4().hex[:8].upper()}")
    sample_id: str = ""
    title: str = ""
    description: str = ""
    reporter: str = ""
    status: str = "open"
    priority: str = "normal"
    feedback_type: str = "extraction_error"
    related_clause_ids: List[str] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self):
        return {
            "ticket_id": self.ticket_id,
            "sample_id": self.sample_id,
            "title": self.title,
            "description": self.description,
            "reporter": self.reporter,
            "status": self.status,
            "priority": self.priority,
            "feedback_type": self.feedback_type,
            "related_clause_ids": self.related_clause_ids,
            "created_at": self.created_at,
            "updated_at": self.updated_at
        }


@dataclass
class DesensitizationRule:
    rule_id: str = field(default_factory=lambda: f"R{uuid.uuid4().hex[:8].upper()}")
    sample_id: str = ""
    clause_id: Optional[str] = None
    rule_type: str = ""
    pattern: str = ""
    replacement: str = ""
    note: str = ""
    previous_note: str = ""
    change_reason: str = ""
    added_by: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self):
        return {
            "rule_id": self.rule_id,
            "sample_id": self.sample_id,
            "clause_id": self.clause_id,
            "rule_type": self.rule_type,
            "pattern": self.pattern,
            "replacement": self.replacement,
            "note": self.note,
            "previous_note": self.previous_note,
            "change_reason": self.change_reason,
            "added_by": self.added_by,
            "created_at": self.created_at
        }


@dataclass
class AuditLog:
    log_id: str = field(default_factory=lambda: f"L{uuid.uuid4().hex[:8].upper()}")
    sample_id: str = ""
    field_name: str = ""
    old_value: str = ""
    new_value: str = ""
    change_reason: str = ""
    changed_by: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self):
        return {
            "log_id": self.log_id,
            "sample_id": self.sample_id,
            "field_name": self.field_name,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "change_reason": self.change_reason,
            "changed_by": self.changed_by,
            "created_at": self.created_at
        }
