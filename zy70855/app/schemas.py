from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any


class LostItemSubmit(BaseModel):
    item_type: str = Field(..., description="物品类型，如：钱包、手机、身份证等")
    description: str = Field(..., description="物品详细描述")
    lost_location: str = Field(..., description="遗失地点")
    lost_time: datetime = Field(..., description="遗失时间")
    bus_route: Optional[str] = Field(None, description="公交线路")
    bus_number: Optional[str] = Field(None, description="车牌号")
    contact_name: str = Field(..., description="联系人姓名")
    contact_phone: str = Field(..., description="联系电话")
    submitted_by: str = Field(..., description="提交人")


class LostItemResponse(BaseModel):
    id: int
    item_type: str
    description: str
    lost_location: str
    lost_time: datetime
    bus_route: Optional[str]
    bus_number: Optional[str]
    contact_name: str
    contact_phone: str
    status: str
    match_result: Optional[Dict[str, Any]]
    final_report: Optional[Dict[str, Any]]
    created_at: datetime
    updated_at: Optional[datetime]
    created_by: str
    is_duplicate: bool = False

    class Config:
        from_attributes = True


class UpdateConclusionRequest(BaseModel):
    status: str = Field(..., description="新的状态")
    match_result: Optional[Dict[str, Any]] = Field(None, description="匹配结果")
    final_report: Optional[Dict[str, Any]] = Field(None, description="最终报告")
    change_reason: str = Field(..., description="修改原因")
    changed_by: str = Field(..., description="修改人")


class AuditLogResponse(BaseModel):
    id: int
    lost_item_id: int
    field_changed: str
    old_value: Optional[Any]
    new_value: Optional[Any]
    change_reason: str
    changed_by: str
    changed_at: datetime

    class Config:
        from_attributes = True


class TraceabilityResponse(BaseModel):
    lost_item_id: int
    original_input: Dict[str, Any]
    processing_history: List[Dict[str, Any]]
    final_report: Optional[Dict[str, Any]]
    audit_trail: List[AuditLogResponse]


class BatchSubmitRequest(BaseModel):
    items: List[LostItemSubmit]
    submitted_by: str


class BatchSubmitResponse(BaseModel):
    success_count: int
    duplicate_count: int
    results: List[LostItemResponse]
