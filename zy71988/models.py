from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum


class ChangeType(Enum):
    MATERIAL_ONLY = "补材料"
    CONCLUSION_CHANGED = "改结论"
    INFO_SUPPLEMENT = "信息补充"
    UNKNOWN = "待确认"


class RecordStatus(Enum):
    PENDING = "待审核"
    VERIFIED = "已确认"
    DISPUTED = "有争议"
    RESOLVED = "已解决"


class DisputeType(Enum):
    IDEMPOTENCY_KEY_FAILURE = "幂等键失效"
    TIMESTAMP_MISMATCH = "时间戳不一致"
    DUPLICATE_RECORD = "重复记录"
    DATA_INCOMPLETE = "数据不完整"
    OTHER = "其他"


@dataclass
class MigrationItem:
    id: str
    interface_name: str
    old_endpoint: str
    new_endpoint: str
    migration_date: datetime
    status: str
    owner: str
    remarks: str = ""
    source_file: str = ""
    line_number: int = 0


@dataclass
class AlarmRecord:
    id: str
    timestamp: datetime
    interface_name: str
    error_type: str
    error_message: str
    request_id: str
    idempotency_key: Optional[str] = None
    source_file: str = ""
    line_number: int = 0
    raw_content: str = ""


@dataclass
class InterfaceDoc:
    interface_name: str
    endpoint: str
    version: str
    last_modified: datetime
    modified_by: str
    change_description: str
    source_file: str = ""
    is_manual_change: bool = False


@dataclass
class AuditLog:
    id: str
    timestamp: datetime
    operation: str
    operator: str
    file_name: str
    file_size: int
    status: str
    request_id: str = ""
    idempotency_key: Optional[str] = None
    source_file: str = ""


@dataclass
class DisputeRecord:
    dispute_type: DisputeType
    description: str
    verifiable_reason: str
    evidence_refs: List[str] = field(default_factory=list)
    resolution: str = ""


@dataclass
class AuditConclusion:
    id: str
    interface_name: str
    summary: str
    change_type: ChangeType
    status: RecordStatus
    migration_refs: List[str] = field(default_factory=list)
    alarm_refs: List[str] = field(default_factory=list)
    doc_refs: List[str] = field(default_factory=list)
    audit_log_refs: List[str] = field(default_factory=list)
    dispute: Optional[DisputeRecord] = None
    notes: str = ""
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class AuditReport:
    report_id: str
    generated_at: datetime
    audit_period: str
    total_records: int
    material_only_count: int
    conclusion_changed_count: int
    disputed_count: int
    conclusions: List[AuditConclusion]
    data_sources: List[str]
