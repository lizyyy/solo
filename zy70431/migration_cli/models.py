from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum
import uuid

class Status(Enum):
    NORMAL = "normal"
    ABNORMAL = "abnormal"
    PENDING = "pending"

@dataclass
class Attachment:
    id: str
    name: str
    upload_date: datetime
    expire_date: Optional[datetime] = None
    is_expired: bool = False

@dataclass
class IoTDeviceReceipt:
    receipt_id: str
    device_id: str
    device_name: str
    receipt_type: str
    received_date: datetime
    operator: str
    original_input: Dict[str, Any]
    attachments: List[Attachment] = field(default_factory=list)
    remark: Optional[str] = None

@dataclass
class SystemJudgment:
    judgment_id: str
    receipt_id: str
    status: Status
    issues: List[str] = field(default_factory=list)
    judgment_time: datetime = field(default_factory=datetime.now)

@dataclass
class ManualCorrection:
    correction_id: str
    receipt_id: str
    operator: str
    correction_note: str
    corrected_status: Optional[Status] = None
    correction_time: datetime = field(default_factory=datetime.now)

@dataclass
class ChangeHistory:
    change_id: str
    receipt_id: str
    resource_scope: str
    change_type: str
    change_reason: str
    operator: str
    change_time: datetime = field(default_factory=datetime.now)
    previous_value: Optional[Any] = None
    new_value: Optional[Any] = None

@dataclass
class MaterialSummary:
    summary_id: str
    receipt_id: str
    summary_text: str
    created_time: datetime = field(default_factory=datetime.now)

@dataclass
class MigrationRecord:
    receipt: IoTDeviceReceipt
    system_judgment: Optional[SystemJudgment] = None
    manual_correction: Optional[ManualCorrection] = None
    material_summary: Optional[MaterialSummary] = None
    change_histories: List[ChangeHistory] = field(default_factory=list)
