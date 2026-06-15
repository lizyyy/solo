from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class RecordStatus(str, Enum):
    NORMAL = "normal"
    MANUAL_MODIFIED = "manual_modified"
    OVERRIDDEN_BY_BATCH = "overridden_by_batch"
    SUPPLEMENTED = "supplemented"
    PENDING_REVIEW = "pending_review"
    CONFLICT = "conflict"


class OperationType(str, Enum):
    IMPORT = "import"
    BATCH_RUN = "batch_run"
    MANUAL_EDIT = "manual_edit"
    SUPPLEMENT = "supplement"
    EXPORT = "export"
    REVIEW = "review"


class SynonymRecord(BaseModel):
    id: str
    keyword: str
    synonyms: List[str]
    prompt_version: str
    knowledge_base_link: Optional[str] = None
    status: RecordStatus = RecordStatus.NORMAL
    source: str = "batch"
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    created_by: str = "system"
    updated_by: str = "system"
    remarks: Optional[str] = None
    batch_run_id: Optional[str] = None
    is_overridden: bool = False
    override_batch_id: Optional[str] = None


class HistoryRecord(BaseModel):
    id: str
    record_id: str
    operation_type: OperationType
    operator: str
    operation_time: datetime = Field(default_factory=datetime.now)
    before_value: Optional[Dict[str, Any]] = None
    after_value: Optional[Dict[str, Any]] = None
    remarks: Optional[str] = None
    batch_run_id: Optional[str] = None


class ConflictItem(BaseModel):
    record_id: str
    keyword: str
    conflict_type: str
    prompt_version: str
    knowledge_base_link: Optional[str] = None
    expected_link: Optional[str] = None
    description: str


class EvaluationReport(BaseModel):
    id: str
    batch_run_id: str
    generated_at: datetime = Field(default_factory=datetime.now)
    generated_by: str
    total_records: int = 0
    new_records: int = 0
    updated_records: int = 0
    manual_modified_count: int = 0
    overridden_count: int = 0
    overridden_keywords: List[str] = Field(default_factory=list)
    conflict_count: int = 0
    conflict_items: List[ConflictItem] = Field(default_factory=list)
    duplicate_count: int = 0
    supplemented_count: int = 0
    supplemented_keywords: List[str] = Field(default_factory=list)
    remarks: Optional[str] = None


class SelfCheckResult(BaseModel):
    check_name: str
    passed: bool
    message: str
    details: Optional[Dict[str, Any]] = None


class ImportResult(BaseModel):
    success: bool
    message: str
    total_count: int = 0
    imported_count: int = 0
    duplicate_count: int = 0
    conflict_count: int = 0
    conflict_items: List[ConflictItem] = Field(default_factory=list)
    records: List[SynonymRecord] = Field(default_factory=list)
