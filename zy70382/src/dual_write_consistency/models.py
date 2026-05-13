from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class DifferenceType(str, Enum):
    NEW_MISSING = "new_missing"
    OLD_MISSING = "old_missing"
    FIELD_DIFF = "field_diff"
    MAPPING_DIFF = "mapping_diff"
    DUPLICATE_PK = "duplicate_pk"
    STATUS_DIFF = "status_diff"
    AMOUNT_DIFF = "amount_diff"


class DifferenceStatus(str, Enum):
    OPEN = "open"
    CONFIRMED = "confirmed"
    FIXED = "fixed"
    RECURRING = "recurring"


class FieldMapping(BaseModel):
    old_field: str
    new_field: str
    transform: Optional[str] = None


class EntityConfig(BaseModel):
    name: str
    old_table: str
    new_table: str
    primary_key: str = "id"
    status_field: Optional[str] = None
    amount_fields: List[str] = Field(default_factory=list)
    field_mappings: List[FieldMapping] = Field(default_factory=list)
    ignored_fields: List[str] = Field(default_factory=list)
    dynamic_field_patterns: List[str] = Field(default_factory=list)
    frozen_data_criteria: Optional[Dict[str, Any]] = None


class TenantFilter(BaseModel):
    tenant_ids: List[str] = Field(default_factory=list)
    tenant_field: str = "tenant_id"


class TimeRange(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    time_field: str = "created_at"


class CheckConfig(BaseModel):
    entities: List[EntityConfig]
    tenant_filter: Optional[TenantFilter] = None
    time_range: Optional[TimeRange] = None
    batch_size: int = 1000


class SnapshotRecord(BaseModel):
    entity: str
    primary_key: str
    pk_value: Any
    data: Dict[str, Any]
    source: str


class FieldDifference(BaseModel):
    field: str
    old_value: Any
    new_value: Any
    mapping_issue: bool = False


class Difference(BaseModel):
    id: str
    entity: str
    primary_key: str
    pk_value: Any
    diff_type: DifferenceType
    status: DifferenceStatus = DifferenceStatus.OPEN
    field_diffs: List[FieldDifference] = Field(default_factory=list)
    old_record: Optional[Dict[str, Any]] = None
    new_record: Optional[Dict[str, Any]] = None
    tenant_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    confirmed_at: Optional[datetime] = None
    fixed_at: Optional[datetime] = None
    first_seen_at: datetime = Field(default_factory=datetime.now)
    recurrence_count: int = 0
    notes: Optional[str] = None


class CompensateAction(str, Enum):
    COPY_TO_NEW = "copy_to_new"
    COPY_TO_OLD = "copy_to_old"
    SYNC_BOTH = "sync_both"
    DELETE_FROM_NEW = "delete_from_new"
    DELETE_FROM_OLD = "delete_from_old"
    MANUAL = "manual"


class CompensateSuggestion(BaseModel):
    difference_id: str
    entity: str
    primary_key: str
    pk_value: Any
    action: CompensateAction
    reason: str
    is_frozen: bool = False


class EntityReport(BaseModel):
    entity: str
    total_checked: int
    new_missing: int
    old_missing: int
    field_diffs: int
    mapping_diffs: int
    status_diffs: int
    amount_diffs: int
    duplicate_pks: int
    sample_differences: List[Difference] = Field(default_factory=list)
    suggestions: List[CompensateSuggestion] = Field(default_factory=list)


class CheckReport(BaseModel):
    check_time: datetime
    entities: List[EntityReport]
    total_differences: int
    affected_tenants: List[str] = Field(default_factory=list)
    summary: Dict[str, int] = Field(default_factory=dict)
