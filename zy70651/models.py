from dataclasses import dataclass
from datetime import date
from enum import Enum
from typing import Optional, List


class ExpiryLevel(Enum):
    NORMAL = "正常"
    NEAR_EXPIRY = "近效期"
    EXPIRED = "已过期"
    CRITICAL = "危急"


class FreezeStatus(Enum):
    NOT_FROZEN = "未冻结"
    FROZEN = "已冻结"
    PENDING = "待审核"


@dataclass
class MedicineBatch:
    batch_no: str
    medicine_name: str
    store_name: str
    quantity: int
    expiry_date: date
    freeze_status: FreezeStatus
    manufacturer: Optional[str] = None
    specification: Optional[str] = None
    
    expiry_days: Optional[int] = None
    expiry_level: Optional[ExpiryLevel] = None
    transfer_suggestion: Optional[str] = None
    issues: Optional[List[str]] = None


@dataclass
class TransferSuggestion:
    source_store: str
    target_store: str
    medicine_name: str
    batch_no: str
    quantity: int
    expiry_date: date
    expiry_days: int
    reason: str


@dataclass
class AnalysisResult:
    total_batches: int
    valid_batches: int
    invalid_batches: int
    
    normal_count: int
    near_expiry_count: int
    expired_count: int
    critical_count: int
    
    frozen_count: int
    pending_freeze_count: int
    
    transfer_suggestions: List[TransferSuggestion]
    problem_batches: List[MedicineBatch]
    all_batches: List[MedicineBatch]
    
    report_generated_at: date
    input_file: str
