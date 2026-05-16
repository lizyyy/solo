from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from uuid import uuid4


class RecordStatus(Enum):
    NORMAL = "normal"
    ABNORMAL = "abnormal"
    PENDING = "pending"


class AttachmentStatus(Enum):
    VALID = "valid"
    EXPIRED = "expired"
    MISSING = "missing"


@dataclass
class Attachment:
    id: str
    name: str
    file_path: str
    upload_time: datetime
    expire_time: Optional[datetime] = None
    status: AttachmentStatus = AttachmentStatus.VALID

    def is_expired(self) -> bool:
        if self.expire_time is None:
            return False
        return datetime.now() > self.expire_time


@dataclass
class Remark:
    id: str
    content: str
    operator: str
    created_at: datetime
    reason: Optional[str] = None


@dataclass
class SystemJudgment:
    is_abnormal: bool
    reason: str
    detected_at: datetime
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ManualCorrection:
    id: str
    operator: str
    correction_type: str
    old_value: Any
    new_value: Any
    reason: str
    created_at: datetime
    resource_scope: str


@dataclass
class Material:
    id: str
    name: str
    type: str
    content: Dict[str, Any]
    attachments: List[Attachment] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class HandoverRecord:
    id: str
    title: str
    description: str
    operator: str
    materials: List[Material]
    status: RecordStatus = RecordStatus.PENDING
    system_judgment: Optional[SystemJudgment] = None
    remarks: List[Remark] = field(default_factory=list)
    manual_corrections: List[ManualCorrection] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def add_remark(self, content: str, operator: str, reason: Optional[str] = None) -> None:
        remark = Remark(
            id=str(uuid4()),
            content=content,
            operator=operator,
            created_at=datetime.now(),
            reason=reason
        )
        self.remarks.append(remark)
        self.updated_at = datetime.now()

    def add_manual_correction(
        self,
        operator: str,
        correction_type: str,
        old_value: Any,
        new_value: Any,
        reason: str,
        resource_scope: str
    ) -> None:
        correction = ManualCorrection(
            id=str(uuid4()),
            operator=operator,
            correction_type=correction_type,
            old_value=old_value,
            new_value=new_value,
            reason=reason,
            created_at=datetime.now(),
            resource_scope=resource_scope
        )
        self.manual_corrections.append(correction)
        self.updated_at = datetime.now()

    def set_system_judgment(self, is_abnormal: bool, reason: str, details: Dict[str, Any] = None) -> None:
        self.system_judgment = SystemJudgment(
            is_abnormal=is_abnormal,
            reason=reason,
            detected_at=datetime.now(),
            details=details or {}
        )
        self.status = RecordStatus.ABNORMAL if is_abnormal else RecordStatus.NORMAL
        self.updated_at = datetime.now()