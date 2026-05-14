from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from .models import SyncStatusEnum, ConflictStatusEnum


class NodeGroupBase(BaseModel):
    name: str
    description: Optional[str] = None
    node_count: Optional[int] = 0


class NodeGroupCreate(NodeGroupBase):
    pass


class NodeGroupResponse(NodeGroupBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConfigVersionBase(BaseModel):
    version: str
    node_group_id: int
    config_content: str
    description: Optional[str] = None
    created_by: str


class ConfigVersionCreate(ConfigVersionBase):
    pass


class ConfigVersionResponse(ConfigVersionBase):
    id: int
    created_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class OfflineNodeBase(BaseModel):
    node_name: str
    node_ip: str
    last_seen: Optional[datetime] = None
    retry_count: Optional[int] = 0


class OfflineNodeResponse(OfflineNodeBase):
    id: int
    is_resolved: bool
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ConflictResolutionBase(BaseModel):
    node_name: str
    current_version: str
    target_version: str
    conflict_detail: str


class ConflictResolutionResponse(ConflictResolutionBase):
    id: int
    status: ConflictStatusEnum
    resolution: Optional[str] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ConflictResolveRequest(BaseModel):
    resolution: str
    resolved_by: str


class SyncAuditBase(BaseModel):
    action: str
    operator: str
    detail: Optional[str] = None


class SyncAuditResponse(SyncAuditBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class SyncStatusBase(BaseModel):
    node_group_id: int
    config_version_id: int
    created_by: str


class SyncStatusCreate(SyncStatusBase):
    request_id: str


class SyncStatusResponse(SyncStatusBase):
    id: int
    request_id: str
    status: SyncStatusEnum
    total_nodes: int
    success_nodes: int
    failed_nodes: int
    offline_nodes: int
    started_at: datetime
    completed_at: Optional[datetime] = None
    offline_node_list: List[OfflineNodeResponse] = []
    conflicts: List[ConflictResolutionResponse] = []
    audits: List[SyncAuditResponse] = []

    class Config:
        from_attributes = True


class SyncStatusDetailResponse(SyncStatusResponse):
    node_group: Optional[NodeGroupResponse] = None
    config_version: Optional[ConfigVersionResponse] = None


class SyncCreateRequest(BaseModel):
    node_group_id: int
    config_version_id: int
    created_by: str
    request_id: str


class SyncInterceptRequest(BaseModel):
    reason: str
    operator: str


class SyncCorrectRequest(BaseModel):
    operator: str
    correct_detail: Optional[str] = None


class RollbackRequest(BaseModel):
    target_version_id: int
    operator: str
    request_id: str
