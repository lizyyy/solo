from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
import uuid


class OfflineDeviceBase(BaseModel):
    device_name: str
    device_type: str = "tablet"


class OfflineDeviceCreate(OfflineDeviceBase):
    pass


class OfflineDeviceResponse(OfflineDeviceBase):
    id: str
    status: str
    last_sync_time: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class FormDraftBase(BaseModel):
    form_type: str
    form_data: Dict[str, Any]
    created_by: Optional[str] = None


class FormDraftCreate(FormDraftBase):
    device_id: str
    version: int = 1


class FormDraftUpdate(BaseModel):
    form_data: Optional[Dict[str, Any]] = None
    status: Optional[str] = None


class FormDraftResponse(BaseModel):
    id: str
    form_type: str
    form_data: Dict[str, Any]
    version: int
    device_id: str
    status: str
    created_by: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    sync_batch_id: Optional[str]

    class Config:
        from_attributes = True


class SyncBatchBase(BaseModel):
    device_id: str


class SyncBatchCreate(SyncBatchBase):
    draft_ids: List[str]


class SyncBatchResponse(BaseModel):
    id: str
    device_id: str
    batch_number: str
    status: str
    total_items: int
    success_count: int
    conflict_count: int
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    error_message: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class FieldConflictResponse(BaseModel):
    id: str
    draft_id: str
    batch_id: str
    field_name: str
    server_value: Optional[Dict[str, Any]]
    client_value: Optional[Dict[str, Any]]
    base_version: Optional[int]
    server_version: Optional[int]
    client_version: Optional[int]
    resolution_strategy: str
    resolved: bool
    resolved_value: Optional[Dict[str, Any]]
    resolved_by: Optional[str]
    resolved_at: Optional[datetime]
    conflict_description: Optional[str]

    class Config:
        from_attributes = True


class MergeDecisionCreate(BaseModel):
    conflict_id: str
    decision_type: str
    final_value: Optional[Dict[str, Any]] = None
    reason: Optional[str] = None
    decided_by: Optional[str] = None


class MergeDecisionResponse(BaseModel):
    id: str
    conflict_id: str
    decision_type: str
    final_value: Optional[Dict[str, Any]]
    decided_by: Optional[str]
    decided_at: datetime
    reason: Optional[str]

    class Config:
        from_attributes = True


class RollbackVersionResponse(BaseModel):
    id: str
    draft_id: str
    version_number: int
    rollback_reason: Optional[str]
    rolled_back_by: Optional[str]
    rolled_back_at: datetime

    class Config:
        from_attributes = True


class SyncRequest(BaseModel):
    device_id: str
    drafts: List[FormDraftCreate]


class ConflictResolution(BaseModel):
    conflict_id: str
    resolution: str
    resolved_value: Optional[Dict[str, Any]] = None
    resolved_by: Optional[str] = None


class ExportRequest(BaseModel):
    batch_id: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
