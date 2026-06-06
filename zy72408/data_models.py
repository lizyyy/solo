from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Any
from datetime import datetime
from enum import Enum
import uuid
import copy


class RecordStatus(str, Enum):
    IMPORTED = "已导入"
    CONTRACT_PENDING = "待合同复核"
    CONTRACT_REVIEWED = "合同已复核"
    AREA_MISSING = "授权地区缺失"
    AREA_FIXED = "授权地区已补录"
    VERIFICATION_PENDING = "待核销更新"
    VERIFIED = "已核销"
    ABNORMAL = "异常"
    NORMAL = "正常"


class ChangeType(str, Enum):
    IMPORT = "导入"
    CONTRACT_NOTE_UPDATE = "合同备注修改"
    AREA_FIX = "授权地区补录"
    VERIFICATION_UPDATE = "核销更新"
    MANUAL_EDIT = "人工修改"


@dataclass
class AuditLog:
    log_id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    record_id: str = ""
    timestamp: datetime = field(default_factory=datetime.now)
    operator: str = ""
    change_type: ChangeType = ChangeType.MANUAL_EDIT
    field_name: str = ""
    old_value: Any = None
    new_value: Any = None
    note: str = ""

    def to_dict(self):
        d = asdict(self)
        d["timestamp"] = self.timestamp.isoformat()
        d["change_type"] = self.change_type.value
        return d


@dataclass
class RoyaltyRecord:
    record_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    source_row: int = 0
    musician_name: str = ""
    song_title: str = ""
    authorized_cities: List[str] = field(default_factory=list)
    expected_cities: List[str] = field(default_factory=list)
    play_count: int = 0
    verified_count: int = 0
    royalty_amount: float = 0.0
    contract_note: str = ""
    status: RecordStatus = RecordStatus.IMPORTED
    is_duplicate: bool = False
    duplicate_of: str = ""
    import_batch: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    audit_logs: List[AuditLog] = field(default_factory=list)
    raw_data: Dict[str, Any] = field(default_factory=dict)
    affected_by_note_update: bool = False

    def to_dict(self, include_audit: bool = True) -> Dict[str, Any]:
        d = {
            "record_id": self.record_id,
            "source_row": self.source_row,
            "musician_name": self.musician_name,
            "song_title": self.song_title,
            "authorized_cities": self.authorized_cities,
            "expected_cities": self.expected_cities,
            "play_count": self.play_count,
            "verified_count": self.verified_count,
            "royalty_amount": self.royalty_amount,
            "contract_note": self.contract_note,
            "status": self.status.value,
            "is_duplicate": self.is_duplicate,
            "duplicate_of": self.duplicate_of,
            "import_batch": self.import_batch,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "affected_by_note_update": self.affected_by_note_update,
        }
        if include_audit:
            d["audit_logs"] = [log.to_dict() for log in self.audit_logs]
        return d

    def add_audit_log(self, log: AuditLog):
        log.record_id = self.record_id
        self.audit_logs.append(log)
        self.updated_at = datetime.now()

    def snapshot(self) -> "RoyaltyRecord":
        new_record = copy.deepcopy(self)
        new_record.record_id = uuid.uuid4().hex[:12]
        new_record.audit_logs = []
        return new_record


@dataclass
class ImportBatch:
    batch_id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    batch_name: str = ""
    source_type: str = "rehearsal_group"
    imported_at: datetime = field(default_factory=datetime.now)
    operator: str = ""
    record_count: int = 0
    duplicate_count: int = 0
    abnormal_count: int = 0
    raw_file_name: str = ""

    def to_dict(self):
        d = asdict(self)
        d["imported_at"] = self.imported_at.isoformat()
        return d


@dataclass
class SelfCheckResult:
    check_name: str = ""
    passed: bool = False
    details: str = ""
    affected_records: List[str] = field(default_factory=list)
    checked_at: datetime = field(default_factory=datetime.now)

    def to_dict(self):
        d = asdict(self)
        d["checked_at"] = self.checked_at.isoformat()
        return d


@dataclass
class ReplayCommand:
    command: str = ""
    description: str = ""
    timestamp: datetime = field(default_factory=datetime.now)

    def to_dict(self):
        d = asdict(self)
        d["timestamp"] = self.timestamp.isoformat()
        return d
