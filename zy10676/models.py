from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Optional, List


class ReleaseStatus(Enum):
    BLOCKING = "拦截中"
    APPLYING = "放行申请"
    RELEASED = "已放行"
    EXPIRED = "已失效"


@dataclass
class RiskControlRelease:
    id: int
    mobile: str
    scene: str
    business_object: str
    risk_reason: str
    status: ReleaseStatus
    release_start_time: Optional[datetime]
    release_end_time: Optional[datetime]
    applicant: str
    approver: Optional[str]
    apply_time: datetime
    approve_time: Optional[datetime]
    remark: str
    created_at: datetime
    updated_at: datetime
    version: int = 1


@dataclass
class OperationHistory:
    id: int
    release_id: int
    operation_type: str
    old_status: Optional[str]
    new_status: Optional[str]
    operator: str
    operation_time: datetime
    remark: str
    old_data: Optional[str]
    new_data: Optional[str]


@dataclass
class ImportBadRecord:
    id: int
    batch_no: str
    row_number: int
    original_data: str
    error_message: str
    import_time: datetime
    processed: bool = False
