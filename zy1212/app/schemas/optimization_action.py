from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator
from app.schemas.common import (
    PriorityEnum, 
    OptimizationActionTypeEnum, 
    OptimizationStatusEnum
)


class OptimizationActionBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=500, description="标题")
    description: Optional[str] = Field(None, description="描述")
    action_type: OptimizationActionTypeEnum = Field(..., description="动作类型")
    priority: PriorityEnum = Field(default=PriorityEnum.medium, description="优先级")
    status: OptimizationStatusEnum = Field(default=OptimizationStatusEnum.pending, description="状态")
    assigned_to: Optional[str] = Field(None, max_length=255, description="负责人")
    proposed_solution: Optional[str] = Field(None, description="建议方案")
    expected_improvement: Optional[str] = Field(None, description="预期改进")
    root_cause_analysis: Optional[str] = Field(None, description="根因分析")
    implemented_at: Optional[datetime] = Field(None, description="实施时间")
    verified_at: Optional[datetime] = Field(None, description="验证时间")
    verification_batch_id: Optional[int] = Field(None, ge=1, description="验证批次ID")
    actual_improvement: Optional[Dict[str, Any]] = Field(None, description="实际改进")
    notes: Optional[str] = Field(None, description="备注")
    attachments: Optional[List[Dict[str, Any]]] = Field(None, description="附件")


class OptimizationActionCreate(OptimizationActionBase):
    project_id: int = Field(..., ge=1, description="项目ID")
    related_batch_id: Optional[int] = Field(None, ge=1, description="关联批次ID")


class OptimizationActionUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = None
    action_type: Optional[OptimizationActionTypeEnum] = None
    priority: Optional[PriorityEnum] = None
    status: Optional[OptimizationStatusEnum] = None
    assigned_to: Optional[str] = Field(None, max_length=255)
    proposed_solution: Optional[str] = None
    expected_improvement: Optional[str] = None
    root_cause_analysis: Optional[str] = None
    implemented_at: Optional[datetime] = None
    verified_at: Optional[datetime] = None
    verification_batch_id: Optional[int] = Field(None, ge=1)
    actual_improvement: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    attachments: Optional[List[Dict[str, Any]]] = None


class StatusTransitionRequest(BaseModel):
    new_status: OptimizationStatusEnum
    notes: Optional[str] = None
    implemented_at: Optional[datetime] = None
    verified_at: Optional[datetime] = None
    verification_batch_id: Optional[int] = Field(None, ge=1)
    actual_improvement: Optional[Dict[str, Any]] = None


class OptimizationActionInDBBase(OptimizationActionBase):
    id: int
    project_id: int
    related_batch_id: Optional[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OptimizationAction(OptimizationActionInDBBase):
    pass


class OptimizationActionDetail(OptimizationActionInDBBase):
    related_batch_info: Optional[Dict[str, Any]] = None
    verification_batch_info: Optional[Dict[str, Any]] = None


class OptimizationActionList(BaseModel):
    total: int
    items: List[OptimizationAction]
    page: int
    page_size: int


class ActionStatistics(BaseModel):
    project_id: int
    total_actions: int
    by_status: Dict[str, int]
    by_type: Dict[str, int]
    by_priority: Dict[str, int]
    overdue_count: int
    avg_resolution_days: Optional[float]
