from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict
from enum import Enum


class RecordStatus(str, Enum):
    NORMAL = "正常"
    PENDING_REVIEW = "待财务复核"
    SUPPLEMENTED = "已补录"
    MANUALLY_FIXED = "人工修正"
    RERUN = "重跑完成"
    ARCHIVED = "已归档"


class DiscrepancyType(str, Enum):
    NONE = "无差异"
    INSTITUTION_NAME_MISMATCH = "机构简称前后不一致"
    MISSING_HISTORICAL_DATA = "缺少历史口径数据"


@dataclass
class CounterRecord:
    tail_number: str
    institution_name: str
    trade_date: str
    amount: float
    slippage: float
    source: str = "柜台流水导入"


@dataclass
class InstitutionMapping:
    tail_number: str
    official_name: str
    historical_aliases: List[str] = field(default_factory=list)
    is_active: bool = True


@dataclass
class ManagerEmail:
    email_id: str
    tail_number: str
    institution_name_old: str
    supplement_date: str
    operator: str
    remark: str
    source: str = "客户经理补充邮件"


@dataclass
class SlippageRecord:
    record_id: str
    tail_number: str
    trade_date: str
    amount: float
    slippage: float
    institution_name_imported: str
    institution_name_verified: Optional[str] = None
    institution_name_supplemented: Optional[str] = None
    status: RecordStatus = RecordStatus.NORMAL
    discrepancy_type: DiscrepancyType = DiscrepancyType.NONE
    discrepancy_detail: str = ""
    email_reference: Optional[str] = None
    manual_fix_note: Optional[str] = None
    rerun_count: int = 0
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    archived: bool = False
    archived_at: Optional[datetime] = None


@dataclass
class ProcessingResult:
    total_count: int = 0
    normal_count: int = 0
    pending_review_count: int = 0
    supplemented_count: int = 0
    manually_fixed_count: int = 0
    rerun_count: int = 0
    error_messages: List[str] = field(default_factory=list)
    records: List[SlippageRecord] = field(default_factory=list)
