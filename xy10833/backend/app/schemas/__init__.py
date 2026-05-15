from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class GrayRuleBase(BaseModel):
    rule_type: str
    percentage: float = 0
    user_ids: List[str] = Field(default_factory=list)
    user_groups: List[str] = Field(default_factory=list)
    regions: List[str] = Field(default_factory=list)
    conditions: Dict[str, Any] = Field(default_factory=dict)


class GrayRuleCreate(GrayRuleBase):
    pass


class GrayRule(GrayRuleBase):
    id: int
    feature_flag_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class FeatureFlagBase(BaseModel):
    name: str
    key: str
    description: Optional[str] = None
    enabled: bool = False
    status: str = "draft"


class FeatureFlagCreate(FeatureFlagBase):
    gray_rules: List[GrayRuleCreate] = Field(default_factory=list)


class FeatureFlagUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    enabled: Optional[bool] = None
    status: Optional[str] = None
    gray_rules: Optional[List[GrayRuleCreate]] = None


class FeatureFlag(FeatureFlagBase):
    id: int
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None
    current_version: int
    gray_rules: List[GrayRule] = Field(default_factory=list)

    class Config:
        from_attributes = True


class FeatureFlagDetail(FeatureFlag):
    hit_count: int = 0
    read_count: int = 0
    change_order_count: int = 0


class ChangeOrderBase(BaseModel):
    order_type: str
    title: str
    description: Optional[str] = None
    after_data: Dict[str, Any]


class ChangeOrderCreate(ChangeOrderBase):
    feature_flag_id: int


class ChangeOrder(ChangeOrderBase):
    id: int
    feature_flag_id: int
    before_data: Optional[Dict[str, Any]] = None
    status: str
    created_by: Optional[str] = None
    approved_by: Optional[str] = None
    created_at: datetime
    approved_at: Optional[datetime] = None
    executed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class HitRecordBase(BaseModel):
    user_id: Optional[str] = None
    user_group: Optional[str] = None
    region: Optional[str] = None
    hit_result: bool
    source: Optional[str] = None
    request_id: Optional[str] = None


class HitRecordCreate(HitRecordBase):
    feature_flag_id: int


class HitRecord(HitRecordBase):
    id: int
    feature_flag_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class RollbackVersionBase(BaseModel):
    version: int
    snapshot: Dict[str, Any]
    description: Optional[str] = None


class RollbackVersionCreate(RollbackVersionBase):
    feature_flag_id: int


class RollbackVersion(RollbackVersionBase):
    id: int
    feature_flag_id: int
    created_by: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ReadAuditBase(BaseModel):
    source_id: Optional[int] = None
    source_name: Optional[str] = None
    source_type: Optional[str] = None
    user_identifier: Optional[str] = None
    result: bool
    request_ip: Optional[str] = None
    user_agent: Optional[str] = None


class ReadAuditCreate(ReadAuditBase):
    feature_flag_id: int


class ReadAudit(ReadAuditBase):
    id: int
    feature_flag_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ReadSourceBase(BaseModel):
    name: str
    source_type: str
    description: Optional[str] = None


class ReadSourceCreate(ReadSourceBase):
    pass


class ReadSource(ReadSourceBase):
    id: int
    api_key: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class FeatureFlagEvaluateRequest(BaseModel):
    user_id: Optional[str] = None
    user_group: Optional[str] = None
    region: Optional[str] = None
    properties: Dict[str, Any] = Field(default_factory=dict)


class FeatureFlagEvaluateResponse(BaseModel):
    key: str
    enabled: bool
    hit: bool
    reason: str


class ApprovalAction(BaseModel):
    approved: bool
    comment: Optional[str] = None


class RollbackRequest(BaseModel):
    version_id: int
    reason: Optional[str] = None


class StatisticsResponse(BaseModel):
    total_flags: int
    enabled_flags: int
    total_hits: int
    total_reads: int
    pending_changes: int


class ExportRequest(BaseModel):
    export_type: str
    filters: Optional[Dict[str, Any]] = None
