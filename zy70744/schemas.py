from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class FeatureFlagBase(BaseModel):
    name: str
    description: Optional[str] = None
    conditions: Dict[str, Any]
    priority: int = 0
    user_group: Optional[str] = None
    is_active: bool = True


class FeatureFlagCreate(FeatureFlagBase):
    pass


class FeatureFlagUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    conditions: Optional[Dict[str, Any]] = None
    priority: Optional[int] = None
    user_group: Optional[str] = None
    is_active: Optional[bool] = None


class FeatureFlag(FeatureFlagBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class ConflictRecordBase(BaseModel):
    user_id: str
    conflicting_flags: List[int]
    matched_conditions: Dict[str, Any]
    original_input: Dict[str, Any]


class ConflictRecordCreate(ConflictRecordBase):
    pass


class ConflictRecordUpdate(BaseModel):
    status: Optional[str] = None
    resolution: Optional[str] = None
    resolved_by: Optional[str] = None
    final_result: Optional[Dict[str, Any]] = None


class ConflictRecord(ConflictRecordBase):
    id: int
    feature_flag_id: Optional[int] = None
    final_result: Optional[Dict[str, Any]] = None
    status: str
    resolution: Optional[str] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        orm_mode = True


class ResolutionLogBase(BaseModel):
    conflict_id: int
    action: str
    operator: str
    conclusion: str
    previous_status: Optional[str] = None
    new_status: Optional[str] = None


class ResolutionLogCreate(ResolutionLogBase):
    pass


class ResolutionLog(ResolutionLogBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True


class ConflictEvaluationRequest(BaseModel):
    user_id: str
    user_context: Dict[str, Any]


class ConflictResolutionRequest(BaseModel):
    conflict_id: int
    resolution: str
    operator: str
    final_result: Optional[Dict[str, Any]] = None
    selected_flag_id: Optional[int] = None
