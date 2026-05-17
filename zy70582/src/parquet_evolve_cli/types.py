from enum import Enum
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field


class CompatibilityLevel(str, Enum):
    FULLY_COMPATIBLE = "fully_compatible"
    BACKWARD_COMPATIBLE = "backward_compatible"
    FORWARD_COMPATIBLE = "forward_compatible"
    INCOMPATIBLE = "incompatible"


class ChangeType(str, Enum):
    FIELD_ADDED = "field_added"
    FIELD_REMOVED = "field_removed"
    TYPE_CHANGED = "type_changed"
    NULLABILITY_CHANGED = "nullability_changed"
    FIELD_RENAMED = "field_renamed"


class FieldChange(BaseModel):
    field_name: str
    change_type: ChangeType
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    compatibility_impact: str
    description: str


class BadRow(BaseModel):
    row_index: int
    file_path: str
    reason: str
    column_name: Optional[str] = None
    raw_value: Optional[str] = None


class SchemaSnapshot(BaseModel):
    file_path: str
    snapshot_time: str
    fields: List[Dict[str, Any]]
    row_count: int


class CompatibilityResult(BaseModel):
    overall_level: CompatibilityLevel
    changes: List[FieldChange] = Field(default_factory=list)
    bad_rows: List[BadRow] = Field(default_factory=list)
    summary: Dict[str, Any] = Field(default_factory=dict)


class EvolutionReport(BaseModel):
    run_id: str
    run_time: str
    input_files: List[str]
    reference_schema: Optional[SchemaSnapshot] = None
    target_schemas: List[SchemaSnapshot] = Field(default_factory=list)
    compatibility: CompatibilityResult
    output_paths: Dict[str, str] = Field(default_factory=dict)
