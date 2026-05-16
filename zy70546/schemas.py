from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from models import NotificationStatus, SubscriptionStatus
import uuid

def generate_id():
    return str(uuid.uuid4())[:12]

class SubscriptionCreate(BaseModel):
    team_name: str = Field(..., max_length=100, description="订阅团队名称")
    contact_person: str = Field(..., max_length=100, description="联系人")
    contact_email: str = Field(..., max_length=200, description="联系邮箱")
    field_name_pattern: str = Field(..., max_length=500, description="字段名称匹配模式，支持*通配符")
    upstream_table_pattern: str = Field(..., max_length=500, description="上游表匹配模式，支持*通配符")
    downstream_report_pattern: str = Field(..., max_length=500, description="下游报表匹配模式，支持*通配符")
    notify_channels: Optional[Dict[str, Any]] = Field(None, description="通知渠道配置")

class SubscriptionUpdate(BaseModel):
    contact_person: Optional[str] = None
    contact_email: Optional[str] = None
    field_name_pattern: Optional[str] = None
    upstream_table_pattern: Optional[str] = None
    downstream_report_pattern: Optional[str] = None
    status: Optional[SubscriptionStatus] = None
    notify_channels: Optional[Dict[str, Any]] = None

class SubscriptionResponse(BaseModel):
    id: int
    team_name: str
    contact_person: str
    contact_email: str
    field_name_pattern: str
    upstream_table_pattern: str
    downstream_report_pattern: str
    status: SubscriptionStatus
    notify_channels: Optional[Dict[str, Any]]
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True

class BloodlineRelationCreate(BaseModel):
    field_name: str = Field(..., max_length=200, description="变更字段名称")
    upstream_table: str = Field(..., max_length=200, description="上游表名")
    downstream_report: str = Field(..., max_length=200, description="下游报表名")
    bloodline_path: Optional[Dict[str, Any]] = Field(None, description="完整血缘路径")
    change_type: str = Field(..., max_length=50, description="变更类型：新增、修改、删除")
    change_description: Optional[str] = Field(None, description="变更描述")
    batch_id: Optional[str] = Field(None, description="批次ID，不传则自动生成")

class NotificationResponse(BaseModel):
    id: int
    subscription_id: Optional[int]
    bloodline_relation_id: Optional[int]
    batch_id: Optional[str]
    team_name: Optional[str]
    status: NotificationStatus
    match_reason: Optional[str]
    filter_reason: Optional[str]
    deduplication_key: Optional[str]
    notified_at: Optional[datetime]
    confirmed_at: Optional[datetime]
    confirmed_by: Optional[str]
    confirm_note: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True

class NotificationConfirm(BaseModel):
    confirmed_by: str = Field(..., description="确认人")
    confirm_note: Optional[str] = Field(None, description="确认备注")

class ManualFixRequest(BaseModel):
    target_status: NotificationStatus = Field(..., description="目标状态")
    fixed_by: str = Field(..., description="修正人")
    fix_note: str = Field(..., description="修正说明")
    final_conclusion: Optional[str] = Field(None, description="最终结论")

class FailureRecordResponse(BaseModel):
    id: int
    notification_id: int
    original_input: Dict[str, Any]
    processing_rules: Optional[Dict[str, Any]]
    error_message: str
    error_stack: Optional[str]
    final_conclusion: Optional[str]
    retry_count: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class ImpactReportResponse(BaseModel):
    id: int
    report_id: str
    batch_id: Optional[str]
    team_name: Optional[str]
    report_type: str
    report_content: Dict[str, Any]
    generated_by: Optional[str]
    generated_at: datetime
    exported_count: int
    
    class Config:
        from_attributes = True

class BatchProcessRequest(BaseModel):
    bloodline_relations: List[BloodlineRelationCreate] = Field(..., description="批量血缘关系数据")
    batch_id: Optional[str] = Field(None, description="批次ID，不传则自动生成")

class BatchProcessResponse(BaseModel):
    batch_id: str
    total_count: int
    matched_count: int
    filtered_count: int
    failed_count: int
    notification_ids: List[int]

class ErrorResponse(BaseModel):
    error_code: str
    error_message: str
    error_details: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.now)
    
    class Config:
        json_schema_extra = {
            "example": {
                "error_code": "VALIDATION_ERROR",
                "error_message": "字段名不能为空",
                "error_details": {"field": "field_name"},
                "timestamp": "2024-01-01T12:00:00"
            }
        }
