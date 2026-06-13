from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
import uuid


class TicketStatus(str, Enum):
    IMPORTED = "imported"
    DETECTED_LEAK = "detected_leak"
    REVIEW_PENDING = "review_pending"
    REVIEWED_BY_OPERATION = "reviewed_by_operation"
    REVIEWED_BY_ALGORITHM = "reviewed_by_algorithm"
    RESOLVED = "resolved"
    CLOSED = "closed"


@dataclass
class ChangeLog:
    change_id: str
    change_type: str
    author: str
    field_name: Optional[str]
    old_value_summary: str
    new_value_summary: str
    timestamp: str
    affected_exports: List[str] = field(default_factory=list)
    note: Optional[str] = None


@dataclass
class TicketField:
    field_name: str
    field_value: str
    is_masked: bool = False
    mask_pattern: Optional[str] = None
    ocr_confidence: Optional[float] = None
    leak_detected: bool = False
    leak_note: Optional[str] = None
    last_reviewed_by: Optional[str] = None
    last_reviewed_at: Optional[str] = None
    missing_materials: List[str] = field(default_factory=list)

    def get_display_value(self) -> str:
        if self.is_masked and self.mask_pattern:
            return self.mask_pattern
        return self.field_value


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
    change_logs: List[ChangeLog] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def get_leaking_fields(self) -> List[TicketField]:
        return [f for f in self.fields if f.leak_detected]

    def has_leaks(self) -> bool:
        return any(f.leak_detected for f in self.fields)

    def _log_change(
        self,
        change_type: str,
        author: str,
        field_name: Optional[str],
        old_summary: str,
        new_summary: str,
        note: Optional[str] = None,
    ):
        changelog = ChangeLog(
            change_id=f"CHG-{uuid.uuid4().hex[:8].upper()}",
            change_type=change_type,
            author=author,
            field_name=field_name,
            old_value_summary=old_summary,
            new_value_summary=new_summary,
            timestamp=datetime.now().isoformat(),
            affected_exports=list(self.export_history),
            note=note,
        )
        self.change_logs.append(changelog)
        return changelog.change_id

    def add_rule_note(self, note: str, author: str, field_name: Optional[str] = None):
        old_status = self.status.value
        self.rule_notes.append({
            "note": note,
            "author": author,
            "field_name": field_name,
            "timestamp": datetime.now().isoformat()
        })
        if field_name:
            field = next((f for f in self.fields if f.field_name == field_name), None)
            if field:
                old_masked = field.is_masked
                old_note = field.leak_note or ""
                field.last_reviewed_by = author
                field.last_reviewed_at = datetime.now().isoformat()
                if "已补充脱敏规则" in note or "已配置" in note:
                    from ..utils.mask import mask_text
                    if not field.is_masked:
                        field.mask_pattern = mask_text(field.field_value)
                        field.is_masked = True
                        field.leak_note = (field.leak_note or "") + f" | 运营备注: {note}"
                self._log_change(
                    change_type="rule_note_added",
                    author=author,
                    field_name=field_name,
                    old_summary=f"masked={old_masked}",
                    new_summary=f"masked={field.is_masked}",
                    note=note,
                )
        else:
            self._log_change(
                change_type="rule_note_added",
                author=author,
                field_name=None,
                old_summary="ticket level",
                new_summary="ticket level note added",
                note=note,
            )
        self.updated_at = datetime.now()

    def add_algorithm_note(self, note: str, author: str, field_name: Optional[str] = None):
        self.algorithm_notes.append({
            "note": note,
            "author": author,
            "field_name": field_name,
            "timestamp": datetime.now().isoformat()
        })
        if field_name:
            field = next((f for f in self.fields if f.field_name == field_name), None)
            if field:
                old_masked = field.is_masked
                field.last_reviewed_by = author
                field.last_reviewed_at = datetime.now().isoformat()
                if "算法已修复" in note or "已调整OCR" in note:
                    from ..utils.mask import mask_text
                    if not field.is_masked:
                        field.mask_pattern = mask_text(field.field_value)
                        field.is_masked = True
                        field.leak_note = (field.leak_note or "") + f" | 算法备注: {note}"
                self._log_change(
                    change_type="algorithm_note_added",
                    author=author,
                    field_name=field_name,
                    old_summary=f"masked={old_masked}",
                    new_summary=f"masked={field.is_masked}",
                    note=note,
                )
        else:
            self._log_change(
                change_type="algorithm_note_added",
                author=author,
                field_name=None,
                old_summary="ticket level",
                new_summary="ticket level note added",
                note=note,
            )
        self.updated_at = datetime.now()

    def set_status(self, status: TicketStatus, assignee: Optional[str] = None):
        old_status = self.status.value
        self.status = status
        if assignee:
            self.assignee = assignee
        self._log_change(
            change_type="status_changed",
            author="system",
            field_name=None,
            old_summary=old_status,
            new_summary=status.value,
            note=f"assignee={assignee}" if assignee else None,
        )
        self.updated_at = datetime.now()

    def set_missing_materials(self, field_name: str, materials: List[str], author: str):
        field = next((f for f in self.fields if f.field_name == field_name), None)
        if field:
            old = list(field.missing_materials)
            field.missing_materials = list(materials)
            self._log_change(
                change_type="missing_materials_updated",
                author=author,
                field_name=field_name,
                old_summary=str(old),
                new_summary=str(materials),
            )
            self.updated_at = datetime.now()
