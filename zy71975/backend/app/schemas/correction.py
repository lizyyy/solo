from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime


class CorrectionBase(BaseModel):
    meeting_id: int = Field(..., description="会议ID")
    compare_result_id: Optional[int] = Field(None, description="比对结果ID")


class CorrectionCreate(CorrectionBase):
    corrected_status: str = Field(..., max_length=50, description="修正后状态")
    corrected_answer: Optional[str] = Field(None, description="修正后回答")
    correction_reason: Optional[str] = Field(None, description="修正原因")
    operator: Optional[str] = Field(None, max_length=100, description="操作人")


class CorrectionUpdate(BaseModel):
    corrected_status: Optional[str] = Field(None, max_length=50, description="修正后状态")
    corrected_answer: Optional[str] = Field(None, description="修正后回答")
    correction_reason: Optional[str] = Field(None, description="修正原因")


class CorrectionResponse(CorrectionBase):
    id: int
    original_status: Optional[str]
    corrected_status: str
    original_answer: Optional[str]
    corrected_answer: Optional[str]
    correction_reason: Optional[str]
    operator: Optional[str]
    created_at: datetime
    user_friendly_message: str = "获取修正记录成功～"

    class Config:
        from_attributes = True


class CorrectionListItem(BaseModel):
    id: int
    meeting_id: int
    compare_result_id: Optional[int]
    original_status: Optional[str]
    corrected_status: str
    operator: Optional[str]
    created_at: datetime
    user_friendly_message: str = "获取修正记录列表成功～"

    class Config:
        from_attributes = True


class CorrectionBatchRequest(BaseModel):
    meeting_id: int
    corrections: List[CorrectionCreate] = Field(..., description="批量修正数据")
    operator: Optional[str] = Field(None, description="操作人")


class CorrectionBatchResponse(BaseModel):
    meeting_id: int
    total_count: int
    success_count: int
    fail_count: int
    user_friendly_message: str = "批量修正完成～"
