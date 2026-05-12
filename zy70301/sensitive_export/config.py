from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Set

from pydantic import BaseModel, Field, field_validator


class MaskType(str, Enum):
    FULL = "full"
    PARTIAL = "partial"
    NONE = "none"
    REQUIRE_APPROVAL = "require_approval"


class DataCategory(str, Enum):
    PHONE = "phone"
    EMAIL = "email"
    ID_CARD = "id_card"
    BANK_CARD = "bank_card"
    SENSITIVE_TEXT = "sensitive_text"


class FieldConfig(BaseModel):
    name: str
    mask_type: MaskType
    data_category: Optional[DataCategory] = None
    allow_approval: bool = False
    approval_required: bool = False
    description: Optional[str] = None


class StrategyConfig(BaseModel):
    version: str
    tenant_id: str
    data_type: str
    fields: List[FieldConfig]
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    @field_validator("fields")
    @classmethod
    def check_duplicate_fields(cls, v: List[FieldConfig]) -> List[FieldConfig]:
        field_names: Set[str] = set()
        for field in v:
            if field.name in field_names:
                raise ValueError(f"Duplicate field name: {field.name}")
            field_names.add(field.name)
        return v

    def get_field(self, name: str) -> Optional[FieldConfig]:
        for field in self.fields:
            if field.name == name:
                return field
        return None


class ApprovalConfig(BaseModel):
    approval_id: str
    tenant_id: str
    data_type: str
    approved_fields: List[str]
    approved_by: str
    approved_at: datetime
    expires_at: datetime
    reason: str

    def is_valid(self, current_time: Optional[datetime] = None) -> bool:
        now = current_time or datetime.now()
        return now < self.expires_at

    def has_access(self, field_name: str) -> bool:
        return field_name in self.approved_fields


class ExportTask(BaseModel):
    task_id: str
    tenant_id: str
    data_type: str
    start_date: datetime
    end_date: datetime
    strategy_version: str
    approval_id: Optional[str] = None
    status: str = "pending"
    created_at: datetime = Field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    output_path: Optional[str] = None
    total_records: int = 0
    masked_records: int = 0
    rejected_records: int = 0
    error_message: Optional[str] = None


class ExportResult(BaseModel):
    task: ExportTask
    masked_fields: Dict[str, int] = Field(default_factory=dict)
    rejected_rows: List[Dict[str, Any]] = Field(default_factory=list)
    approval_exceptions: List[Dict[str, Any]] = Field(default_factory=list)
    strategy_comparison: Optional[Dict[str, Any]] = None
