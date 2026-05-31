from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional, Dict, Any, List
from enum import Enum
import hashlib


class CallResult(str, Enum):
    CONNECTED = "已接通"
    NO_ANSWER = "未接通"
    BUSY = "占线"
    WRONG_NUMBER = "错号"
    REJECTED = "拒接"
    SHUTDOWN = "关机"


class ManualJudgment(str, Enum):
    INTENTION_A = "A类意向"
    INTENTION_B = "B类意向"
    INTENTION_C = "C类意向"
    NO_INTENTION = "无意向"
    INVALID = "无效号码"
    FOLLOW_UP = "待跟进"


class DiscrepancySource(str, Enum):
    MANUAL_CHANGE = "人工改判"
    GRAYSCALE_RECORD = "灰度记录"
    BOTH = "两者均有差异"


@dataclass
class CallRecord:
    call_id: str
    task_id: str
    task_name: str
    phone_number: str
    customer_name: str
    call_time: datetime
    call_duration: int
    ai_result: str
    ai_confidence: float
    manual_result: Optional[str] = None
    manual_operator: Optional[str] = None
    manual_judge_time: Optional[datetime] = None
    is_grayscale: bool = False
    grayscale_version: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def get_record_hash(self) -> str:
        content = f"{self.task_id}_{self.call_id}_{self.call_time.strftime('%Y%m%d%H%M%S')}"
        return hashlib.md5(content.encode()).hexdigest()

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'CallRecord':
        for key in ['call_time', 'manual_judge_time', 'created_at', 'updated_at']:
            if key in data and data[key]:
                data[key] = datetime.fromisoformat(data[key])
        return cls(**data)


@dataclass
class AuditLog:
    log_id: str
    call_id: str
    field_name: str
    old_value: Optional[str]
    new_value: Optional[str]
    operator: str
    operate_time: datetime
    reason: Optional[str] = None
    ip_address: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data['operate_time'] = self.operate_time.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'AuditLog':
        data['operate_time'] = datetime.fromisoformat(data['operate_time'])
        return cls(**data)


@dataclass
class QualityCheckRecord:
    check_id: str
    call_id: str
    task_id: str
    checker: str
    check_time: datetime
    original_result: str
    checked_result: str
    check_comments: Optional[str] = None
    is_modified: bool = False

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data['check_time'] = self.check_time.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'QualityCheckRecord':
        data['check_time'] = datetime.fromisoformat(data['check_time'])
        return cls(**data)


@dataclass
class Discrepancy:
    discrepancy_id: str
    call_id: str
    task_id: str
    field_name: str
    grayscale_value: str
    report_value: str
    source: DiscrepancySource
    responsible_person: str
    description: str
    created_at: datetime = field(default_factory=datetime.now)
    resolved: bool = False
    resolved_at: Optional[datetime] = None
    resolver: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data['created_at'] = self.created_at.isoformat()
        if data.get('resolved_at'):
            data['resolved_at'] = self.resolved_at.isoformat()
        data['source'] = self.source.value
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Discrepancy':
        data['created_at'] = datetime.fromisoformat(data['created_at'])
        if data.get('resolved_at'):
            data['resolved_at'] = datetime.fromisoformat(data['resolved_at'])
        data['source'] = DiscrepancySource(data['source'])
        return cls(**data)


@dataclass
class ReviewTask:
    task_id: str
    task_name: str
    batch_id: str
    created_at: datetime
    status: str = "pending"
    total_calls: int = 0
    manual_judged_count: int = 0
    quality_checked_count: int = 0
    discrepancy_count: int = 0
    completed_at: Optional[datetime] = None
    operators: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data['created_at'] = self.created_at.isoformat()
        if data.get('completed_at'):
            data['completed_at'] = self.completed_at.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ReviewTask':
        data['created_at'] = datetime.fromisoformat(data['created_at'])
        if data.get('completed_at'):
            data['completed_at'] = datetime.fromisoformat(data['completed_at'])
        return cls(**data)
