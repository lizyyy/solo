from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class MaskingStrategy(str, Enum):
    MASK = "mask"
    REPLACE = "replace"
    HASH = "hash"
    TRUNCATE = "truncate"
    ENCRYPT = "encrypt"
    NONE = "none"

class SampleStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
    NEEDS_APPROVAL = "needs_approval"
    APPROVED = "approved"
    REJECTED = "rejected"

class FieldType(str, Enum):
    PHONE = "phone"
    EMAIL = "email"
    ID_CARD = "id_card"
    NAME = "name"
    ADDRESS = "address"
    BANK_CARD = "bank_card"
    GENERAL = "general"

class ApprovalAction(str, Enum):
    APPROVE = "approve"
    REJECT = "reject"

class SampleData(BaseModel):
    id: Optional[str] = None
    field_name: str
    field_type: FieldType
    original_value: str
    masked_value: Optional[str] = None
    strategy: MaskingStrategy = MaskingStrategy.MASK
    status: SampleStatus = SampleStatus.PENDING
    error_message: Optional[str] = None
    is_dirty: bool = False
    created_at: datetime = Field(default_factory=datetime.now)
    processed_at: Optional[datetime] = None
    processed_by: Optional[str] = None

class ApprovalRecord(BaseModel):
    id: Optional[str] = None
    sample_id: str
    action: ApprovalAction
    reason: str
    approver: str
    approved_at: datetime = Field(default_factory=datetime.now)
    comments: Optional[str] = None

class ComplianceRecord(BaseModel):
    id: Optional[str] = None
    sample_id: str
    field_name: str
    original_value: str
    masked_value: str
    strategy: MaskingStrategy
    status: SampleStatus
    has_watermark: bool = False
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.now)

class MaskingConfig(BaseModel):
    strategy: MaskingStrategy
    mask_char: str = "*"
    preserve_length: bool = True
    left_visible: int = 3
    right_visible: int = 4
    replacement: str = "[REDACTED]"
