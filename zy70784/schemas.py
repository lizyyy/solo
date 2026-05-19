from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from datetime import datetime


class TaskCreate(BaseModel):
    sql_content: str = Field(..., description="原始SQL内容")
    params: Optional[Dict] = Field(None, description="SQL参数字典")
    created_by: str = Field(..., description="创建人")


class TaskResponse(BaseModel):
    id: int
    sql_content: str
    params: Optional[Dict]
    processed_sql: Optional[str]
    status: str
    created_by: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class TaskDetailResponse(TaskResponse):
    risk_fragments: List[Dict]
    operation_logs: List[Dict]


class TaskListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[TaskResponse]


class AutoProcessRequest(BaseModel):
    processor: str = Field(..., description="处理人")


class ManualReviewRequest(BaseModel):
    processed_sql: str = Field(..., description="人工修正后的SQL")
    reviewer: str = Field(..., description="复核人")
    conclusion: str = Field(..., description="处理结论: approved/rejected")
    comments: Optional[str] = Field(None, description="复核意见")


class WithdrawRequest(BaseModel):
    operator: str = Field(..., description="操作人")
    reason: str = Field(..., description="撤回原因")


class RiskFragmentResponse(BaseModel):
    id: int
    task_id: int
    original_value: str
    replaced_value: Optional[str]
    rule_id: Optional[int]
    rule_name: Optional[str]
    position_start: Optional[int]
    position_end: Optional[int]
    risk_level: str
    is_verified: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class EraseRuleCreate(BaseModel):
    rule_name: str
    pattern: str
    replacement: str
    rule_type: str = "regex"
    risk_level: str = "medium"


class EraseRuleResponse(BaseModel):
    id: int
    rule_name: str
    pattern: str
    replacement: str
    rule_type: str
    risk_level: str
    is_enabled: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class OperationLogResponse(BaseModel):
    id: int
    task_id: int
    operation_type: str
    operator: str
    from_status: Optional[str]
    to_status: Optional[str]
    comments: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True
