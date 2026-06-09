from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional


class SourceType(str, Enum):
    WECHAT_NOTE = "wechat_note"
    ATTACHMENT = "attachment"
    VERBAL_NOTE = "verbal_note"
    MANUAL_EDIT = "manual_edit"
    SYSTEM_DERIVED = "system_derived"


class FieldName(str, Enum):
    ANIMAL_NAME = "animal_name"
    VACCINE_DATE = "vaccine_date"
    DEWORMING_DATE = "deworming_date"
    HEALTH_STATUS = "health_status"
    OWNER_CONTACT = "owner_contact"
    APPOINTMENT_TIME = "appointment_time"
    REMARKS = "remarks"


class ExceptionStatus(str, Enum):
    PENDING = "待处理"
    SUPPLEMENTED = "已补录"
    OVERRULED = "已改判"
    CONFIRMED = "已确认"
    RESOLVED = "已解决"


class ValueOrigin(str, Enum):
    WON = "胜出"
    OVERRIDDEN = "被覆盖"
    SUPPLEMENT = "补充"


@dataclass
class SourceInfo:
    source_type: SourceType
    source_id: str
    submitted_at: datetime
    submitter: str
    version: int = 1
    raw_ref: Optional[str] = None


@dataclass
class FieldRecord:
    field_name: FieldName
    value: Any
    source_info: SourceInfo
    captured_at: datetime
    origin: ValueOrigin = ValueOrigin.WON
    overridden_by: Optional[str] = None
    overrides: Optional[str] = None


@dataclass
class AuditEntry:
    action: str
    field_name: Optional[FieldName]
    old_value: Any
    new_value: Any
    source: SourceType
    actor: str
    timestamp: datetime
    note: str = ""


@dataclass
class ExceptionItem:
    exception_id: str
    animal_case_id: str
    title: str
    description: str
    status: ExceptionStatus
    missing_field: Optional[FieldName]
    confirm_person: str
    priority_source: SourceInfo
    history: list[AuditEntry] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def is_supplemented(self) -> bool:
        return any(e.action == "SUPPLEMENT" for e in self.history)

    def is_overruled(self) -> bool:
        return any(e.action == "OVERRULE" for e in self.history)


@dataclass
class RescueRecord:
    case_id: str
    animal_id: str
    fields: dict[FieldName, FieldRecord] = field(default_factory=dict)
    field_history: dict[FieldName, list[FieldRecord]] = field(default_factory=dict)
    submissions_seen: set[str] = field(default_factory=set)
    attachment_digests: set[str] = field(default_factory=set)
    audit_log: list[AuditEntry] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def add_submission_idempotency_key(self, key: str) -> bool:
        if key in self.submissions_seen:
            return False
        self.submissions_seen.add(key)
        return True

    def has_attachment(self, content_digest: str) -> bool:
        return content_digest in self.attachment_digests

    def register_attachment(self, content_digest: str) -> None:
        self.attachment_digests.add(content_digest)


def compute_idempotency_key(
    case_id: str, payload_fingerprint: str, submitter: str
) -> str:
    raw = f"{case_id}|{payload_fingerprint}|{submitter}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]


def compute_attachment_digest(file_name: str, file_size: int, content_hash: str) -> str:
    raw = f"{file_name}|{file_size}|{content_hash}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]
