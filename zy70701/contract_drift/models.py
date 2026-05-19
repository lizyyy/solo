from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Set
from pydantic import BaseModel, Field, ConfigDict


class FieldType(str, Enum):
    STRING = "string"
    NUMBER = "number"
    INTEGER = "integer"
    BOOLEAN = "boolean"
    OBJECT = "object"
    ARRAY = "array"
    NULL = "null"


class DiffType(str, Enum):
    FIELD_MISSING = "field_missing"
    FIELD_ADDED = "field_added"
    TYPE_MISMATCH = "type_mismatch"
    VALUE_CHANGED = "value_changed"
    FORMAT_MISMATCH = "format_mismatch"
    REQUIRED_VIOLATION = "required_violation"


class ConfirmationStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    IGNORED = "ignored"


class SourceLocation(BaseModel):
    file_path: str
    line_start: int
    line_end: int
    column_start: Optional[int] = None
    column_end: Optional[int] = None
    raw_content: Optional[str] = None

    model_config = ConfigDict(frozen=True)


class FieldDefinition(BaseModel):
    path: str
    type: FieldType
    required: bool = False
    description: Optional[str] = None
    format: Optional[str] = None
    enum_values: Optional[List[Any]] = None
    nullable: bool = False
    default_value: Optional[Any] = None
    source: Optional[SourceLocation] = None


class Contract(BaseModel):
    id: str
    name: str
    version: str
    api_path: str
    method: str
    fields: List[FieldDefinition] = Field(default_factory=list)
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    source_file: Optional[str] = None
    source_version: Optional[str] = None

    def get_field_paths(self) -> Set[str]:
        return {f.path for f in self.fields}

    def get_field(self, path: str) -> Optional[FieldDefinition]:
        for f in self.fields:
            if f.path == path:
                return f
        return None


class SampleField(BaseModel):
    path: str
    value: Any
    inferred_type: FieldType
    source: SourceLocation


class Sample(BaseModel):
    id: str
    name: str
    contract_id: str
    fields: List[SampleField] = Field(default_factory=list)
    raw_content: str
    file_format: str
    source_file: str
    imported_at: datetime = Field(default_factory=datetime.now)
    import_hash: str

    def get_field_paths(self) -> Set[str]:
        return {f.path for f in self.fields}

    def get_field(self, path: str) -> Optional[SampleField]:
        for f in self.fields:
            if f.path == path:
                return f
        return None


class Consumer(BaseModel):
    id: str
    name: str
    version: str
    description: Optional[str] = None
    contact_info: Optional[str] = None
    registered_at: datetime = Field(default_factory=datetime.now)


class FieldDrift(BaseModel):
    drift_id: str
    contract_id: str
    sample_id: str
    field_path: str
    diff_type: DiffType
    expected: Optional[Any] = None
    actual: Optional[Any] = None
    expected_type: Optional[FieldType] = None
    actual_type: Optional[FieldType] = None
    sample_source: Optional[SourceLocation] = None
    contract_source: Optional[SourceLocation] = None
    message: str


class ConfirmationRecord(BaseModel):
    id: str
    consumer_id: str
    drift_id: str
    contract_id: str
    sample_id: str
    field_path: str
    status: ConfirmationStatus
    comment: Optional[str] = None
    confirmed_at: Optional[datetime] = None
    confirmed_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)


class DriftReport(BaseModel):
    report_id: str
    generated_at: datetime = Field(default_factory=datetime.now)
    contract_id: str
    contract_version: str
    sample_ids: List[str]
    consumer_ids: List[str]
    total_drifts: int
    pending_confirmations: int
    confirmed_drifts: int
    rejected_drifts: int
    drifts: List[FieldDrift]
    confirmations: List[ConfirmationRecord]
    summary: Dict[str, Any]


class ImportResult(BaseModel):
    success: bool
    imported_count: int
    skipped_count: int
    errors: List[str] = Field(default_factory=list)
    imported_ids: List[str] = Field(default_factory=list)
    skipped_ids: List[str] = Field(default_factory=list)
