from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
import hashlib
import json


class RecordStatus(str, Enum):
    PENDING = "待处理"
    NORMAL = "正常"
    LATE = "晚到"
    DUPLICATE = "重复"
    MANUAL_CORRECTED = "人工更正"
    REWARD_READY = "待发奖"
    REWARD_SENT = "已发奖"
    REWARD_MISSED = "漏发"
    EXPORTED = "已导出"
    ARCHIVED = "已归档"


class AnomalyType(str, Enum):
    DUPLICATE_RECORD = "重复记录"
    LATE_ARRIVAL = "晚到附件"
    DATA_INCONSISTENCY = "数据不一致"
    MISSING_REQUIRED_FIELD = "必填字段缺失"
    MANUAL_OVERRIDE = "人工覆盖"
    REWARD_DISCREPANCY = "奖励金额不符"


@dataclass
class PlayerRecord:
    player_id: str
    activity_id: str
    task_id: str
    completion_time: datetime
    reward_amount: float
    source: str
    raw_data: Dict[str, Any]
    attachment_path: Optional[str] = None
    record_id: str = field(init=False)
    fingerprint: str = field(init=False)
    input_hash: str = field(init=False)

    def __post_init__(self):
        self.fingerprint = self._calc_fingerprint()
        self.input_hash = self._calc_input_hash()
        self.record_id = f"{self.activity_id}_{self.task_id}_{self.player_id}_{self.fingerprint[:8]}"

    def _calc_fingerprint(self) -> str:
        core = f"{self.player_id}|{self.activity_id}|{self.task_id}|{self.completion_time.isoformat()}|{self.reward_amount}"
        return hashlib.md5(core.encode('utf-8')).hexdigest()

    def _calc_input_hash(self) -> str:
        raw_str = json.dumps(self.raw_data, sort_keys=True, ensure_ascii=False)
        full = f"{self.fingerprint}|{self.source}|{self.attachment_path or ''}|{raw_str}"
        return hashlib.md5(full.encode('utf-8')).hexdigest()


@dataclass
class StatusTransition:
    from_status: Optional[RecordStatus]
    to_status: RecordStatus
    timestamp: datetime
    operator: str
    reason: str
    details: Optional[Dict[str, Any]] = None


@dataclass
class Anomaly:
    anomaly_id: str
    anomaly_type: AnomalyType
    severity: str
    description: str
    record_id: str
    detected_at: datetime
    resolved: bool = False
    resolved_at: Optional[datetime] = None
    resolution: Optional[str] = None
    related_record_ids: List[str] = field(default_factory=list)


@dataclass
class ManualCorrection:
    correction_id: str
    record_id: str
    operator: str
    corrected_fields: Dict[str, Any]
    original_values: Dict[str, Any]
    reason: str
    timestamp: datetime


@dataclass
class DispatchRecord:
    record_id: str
    player_record: PlayerRecord
    current_status: RecordStatus = RecordStatus.PENDING
    status_history: List[StatusTransition] = field(default_factory=list)
    anomalies: List[Anomaly] = field(default_factory=list)
    manual_corrections: List[ManualCorrection] = field(default_factory=list)
    batch_id: Optional[str] = None
    processed_at: Optional[datetime] = None
    exported: bool = False
    exported_at: Optional[datetime] = None
    export_batch_id: Optional[str] = None

    def transition_status(self, to_status: RecordStatus, operator: str, reason: str,
                          details: Optional[Dict[str, Any]] = None):
        transition = StatusTransition(
            from_status=self.current_status,
            to_status=to_status,
            timestamp=datetime.now(),
            operator=operator,
            reason=reason,
            details=details
        )
        self.status_history.append(transition)
        self.current_status = to_status

    def add_anomaly(self, anomaly: Anomaly):
        self.anomalies.append(anomaly)

    def add_manual_correction(self, correction: ManualCorrection):
        self.manual_corrections.append(correction)


@dataclass
class BatchProcessResult:
    batch_id: str
    total_records: int
    new_records: int
    duplicate_records: int
    late_records: int
    anomaly_count: int
    processed_at: datetime
    duration_seconds: float
