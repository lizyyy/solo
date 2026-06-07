from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict


class RecordSource(str, Enum):
    GROUP_JIELONG = "排练群接龙"
    CONTRACT_SCREENSHOT = "合同页截图补录"
    MANUAL_CONFIRM = "人工确认"
    TEMP_SUBSTITUTE = "临时替补群内通知"


class ProcessingStatus(str, Enum):
    PENDING = "待处理"
    NORMAL = "正常流程"
    NEED_REVIEW = "待票务复核"
    CONFLICT = "信息冲突待确认"
    CONFIRMED = "已确认"
    REJECTED = "已驳回"
    OLD_RULE = "旧口径补录"
    COMPLETED = "已完成分账"


class ConfirmAction(str, Enum):
    CONFIRM = "确认"
    REJECT = "驳回"


@dataclass
class JielongRecord:
    record_id: str
    performer_name: str
    performance_date: str
    program_name: str
    copyright_status: str
    remark: str = ""
    import_time: datetime = field(default_factory=datetime.now)
    raw_content: str = ""


@dataclass
class ContractScreenshot:
    screenshot_id: str
    record_id: str
    contract_no: str
    valid_until: str
    copyright_owner: str
    old_caliber: bool = False
    upload_time: datetime = field(default_factory=datetime.now)
    uploader: str = "版权运营小鹿"
    raw_screenshot_ref: str = ""


@dataclass
class ConflictEvidence:
    field_name: str
    jielong_value: str
    screenshot_value: str
    description: str


@dataclass
class SplitDetail:
    detail_id: str
    record_id: str
    amount: float
    split_ratio: str
    payee: str
    calculate_time: datetime = field(default_factory=datetime.now)
    version: int = 1


@dataclass
class HistoryEntry:
    entry_id: str
    record_id: str
    source: RecordSource
    action: str
    operator: str
    timestamp: datetime = field(default_factory=datetime.now)
    detail: str = ""


@dataclass
class CopyrightReminder:
    record_id: str
    performer_name: str
    performance_date: str
    program_name: str
    status: ProcessingStatus = ProcessingStatus.PENDING
    jielong: Optional[JielongRecord] = None
    contract: Optional[ContractScreenshot] = None
    conflicts: List[ConflictEvidence] = field(default_factory=list)
    split_details: List[SplitDetail] = field(default_factory=list)
    history: List[HistoryEntry] = field(default_factory=list)
    review_note: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
