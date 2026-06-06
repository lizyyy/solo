from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum


class RefundStatus(str, Enum):
    PENDING_REVIEW = "待店长复核"
    AREA_MISMATCH = "授权地区待确认"
    CALIBER_CONFLICT = "口径冲突待确认"
    NORMAL = "正常通过"
    SUPPLEMENTED = "补录完成"
    CONFIRMED = "店长已确认"
    REJECTED = "店长已驳回"


class DataSource(str, Enum):
    SIGN_IN_PHOTO = "课时签到照片"
    TICKET_EXPORT = "票务导出表"
    MANUAL_SUPPLEMENT = "人工补录"


@dataclass
class SignInPhoto:
    photo_id: str
    lesson_id: str
    student_name: str
    sign_time: datetime
    authorized_city: str
    check_in_status: str
    upload_time: datetime


@dataclass
class TicketExportRecord:
    ticket_id: str
    lesson_id: str
    student_name: str
    class_date: datetime
    city: str
    ticket_status: str
    export_version: str
    export_time: datetime
    is_old_caliber: bool = False


@dataclass
class CalculationParam:
    param_name: str
    param_version: str
    param_value: Any
    trade_off_reason: str


@dataclass
class HistoryRecord:
    record_id: str
    timestamp: datetime
    operator: str
    action: str
    detail: str
    data_source: Optional[DataSource] = None


@dataclass
class LessonVerification:
    verification_id: str
    lesson_id: str
    student_name: str
    verified_count: int
    total_fee: float
    deposit_refund_amount: float
    verification_time: Optional[datetime] = None
    status: str = "待核销"
    params: List[CalculationParam] = field(default_factory=list)


@dataclass
class ConflictEvidence:
    conflict_id: str
    field_name: str
    photo_value: Any
    ticket_value: Any
    photo_source: str
    ticket_source: str
    description: str


@dataclass
class DepositRefundOrder:
    refund_id: str
    student_name: str
    instrument_type: str
    deposit_amount: float
    authorized_cities: List[str]
    sign_in_photos: List[SignInPhoto] = field(default_factory=list)
    ticket_records: List[TicketExportRecord] = field(default_factory=list)
    lesson_verifications: List[LessonVerification] = field(default_factory=list)
    history_records: List[HistoryRecord] = field(default_factory=list)
    conflicts: List[ConflictEvidence] = field(default_factory=list)
    status: RefundStatus = RefundStatus.PENDING_REVIEW
    current_step: int = 0
    store_manager_note: Optional[str] = None

    def add_history(self, operator: str, action: str, detail: str,
                    data_source: Optional[DataSource] = None):
        record = HistoryRecord(
            record_id=f"HIS-{len(self.history_records)+1:03d}",
            timestamp=datetime.now(),
            operator=operator,
            action=action,
            detail=detail,
            data_source=data_source
        )
        self.history_records.append(record)
