from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict
from enum import Enum


class RecordStatus(str, Enum):
    PENDING_REVIEW = "待票务复核"
    NORMAL = "正常"
    NEEDS_MANUAL_FIX = "需人工修正"
    FIXED = "已修正"
    CONTRACT_SUPPLEMENTED = "合同补录"


class MusicUseType(str, Enum):
    OFFICIAL = "正选曲目"
    SUBSTITUTE = "替补曲目"
    REVISED = "修正后曲目"


@dataclass
class GroupChatMessage:
    msg_id: str
    sender: str
    content: str
    timestamp: datetime
    screenshot_ref: Optional[str] = None


@dataclass
class ContractScreenshot:
    screenshot_id: str
    contract_no: str
    music_name: str
    artist: str
    use_scope: str
    fee_rate: float
    upload_time: datetime
    uploaded_by: str


@dataclass
class EvidenceSummary:
    group_chat_count: int
    has_contract_screenshot: bool
    contract_no: Optional[str]
    last_update_source: str


@dataclass
class RoyaltyDetail:
    music_name: str
    artist: str
    use_count: int
    unit_price: float
    total_amount: float
    fee_rate: float
    settlement_status: str


@dataclass
class ProcessingStep:
    step_name: str
    operator: str
    timestamp: datetime
    action: str
    remark: str = ""


@dataclass
class MusicUseRecord:
    record_id: str
    video_id: str
    video_title: str
    publish_time: datetime
    music_name: str
    artist: str
    use_type: MusicUseType
    status: RecordStatus
    source_messages: List[GroupChatMessage] = field(default_factory=list)
    contract_screenshot: Optional[ContractScreenshot] = None
    processing_history: List[ProcessingStep] = field(default_factory=list)
    royalty: Optional[RoyaltyDetail] = None
    current_caliber: str = ""
    notes: str = ""

    def get_evidence_summary(self) -> EvidenceSummary:
        return EvidenceSummary(
            group_chat_count=len(self.source_messages),
            has_contract_screenshot=self.contract_screenshot is not None,
            contract_no=self.contract_screenshot.contract_no if self.contract_screenshot else None,
            last_update_source=self.processing_history[-1].operator if self.processing_history else "未知"
        )


@dataclass
class RunResult:
    run_id: str
    run_time: datetime
    total_records: int
    normal_count: int
    pending_count: int
    fixed_count: int
    contract_supplemented_count: int
    records: List[MusicUseRecord]
