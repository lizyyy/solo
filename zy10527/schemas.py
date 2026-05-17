from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional, List

class AnnouncementCreate(BaseModel):
    announcement_no: str = Field(..., description="公告编号")
    title: str = Field(..., description="公告标题")
    content: str = Field(..., description="公告内容")
    created_by: str = Field(..., description="创建人")
    
    @field_validator('announcement_no', 'title', 'content', 'created_by')
    def not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('该字段不能为空')
        return v

class AnnouncementResponse(BaseModel):
    id: int
    announcement_no: str
    title: str
    created_at: datetime
    created_by: str
    is_active: bool
    latest_version: int
    
    class Config:
        from_attributes = True

class AnnouncementVersionResponse(BaseModel):
    id: int
    version: int
    content: str
    created_at: datetime
    created_by: str
    supplement: str
    supplement_by: str
    supplement_at: Optional[datetime]
    
    class Config:
        from_attributes = True

class ConfirmationCreate(BaseModel):
    announcement_no: str = Field(..., description="公告编号")
    version: int = Field(..., description="确认版本号")
    confirmer_id: str = Field(..., description="确认人ID")
    confirmer_name: str = Field(..., description="确认人姓名")
    remark: Optional[str] = Field(default="", description="确认备注")
    
    @field_validator('announcement_no', 'confirmer_id', 'confirmer_name')
    def not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('该字段不能为空')
        return v

class ConfirmationResponse(BaseModel):
    id: int
    announcement_no: str
    version: int
    confirmer_id: str
    confirmer_name: str
    confirmed_at: datetime
    remark: str
    
    class Config:
        from_attributes = True

class SupplementCreate(BaseModel):
    announcement_no: str = Field(..., description="公告编号")
    version: int = Field(..., description="版本号")
    supplement: str = Field(..., description="补充说明内容")
    supplement_by: str = Field(..., description="补充人")
    
    @field_validator('announcement_no', 'supplement', 'supplement_by')
    def not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('该字段不能为空')
        return v

class WithdrawalCreate(BaseModel):
    announcement_no: str = Field(..., description="公告编号")
    version: Optional[int] = Field(None, description="撤回版本号，不传则撤回全部")
    withdrawn_by: str = Field(..., description="撤回人")
    reason: str = Field(..., description="撤回原因")
    
    @field_validator('announcement_no', 'withdrawn_by', 'reason')
    def not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('该字段不能为空')
        return v

class ManualCorrection(BaseModel):
    announcement_no: str = Field(..., description="公告编号")
    version: int = Field(..., description="要修正的版本号")
    new_content: Optional[str] = Field(None, description="新内容")
    new_supplement: Optional[str] = Field(None, description="新补充说明")
    correction_by: str = Field(..., description="修正人")
    correction_reason: str = Field(..., description="修正原因")
    
    @field_validator('announcement_no', 'correction_by', 'correction_reason')
    def not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('该字段不能为空')
        return v

class ConfirmationReportItem(BaseModel):
    announcement_no: str
    title: str
    version: int
    confirmer_id: str
    confirmer_name: str
    confirmed_at: datetime
    remark: str
    is_withdrawn: bool

class ErrorLogResponse(BaseModel):
    id: int
    operation_type: str
    original_input: str
    error_message: str
    operator: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True
