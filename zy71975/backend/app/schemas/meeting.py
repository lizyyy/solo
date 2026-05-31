from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime


class MeetingBase(BaseModel):
    title: str = Field(..., max_length=255, description="会议名称")
    meeting_no: str = Field(..., max_length=100, description="会议编号")
    content: str = Field(..., description="会议内容")


class MeetingCreate(MeetingBase):
    file_name: Optional[str] = Field(None, max_length=255, description="上传文件名")
    file_path: Optional[str] = Field(None, max_length=500, description="文件存储路径")


class MeetingUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255, description="会议名称")
    content: Optional[str] = Field(None, description="会议内容")
    status: Optional[str] = Field(None, max_length=50, description="处理状态")


class MeetingResponse(MeetingBase):
    id: int
    file_name: Optional[str]
    file_path: Optional[str]
    status: str
    total_questions: int
    correct_count: int
    error_count: int
    accuracy: str
    created_at: datetime
    updated_at: datetime
    user_friendly_message: str = "获取会议信息成功～"

    class Config:
        from_attributes = True


class MeetingListItem(BaseModel):
    id: int
    title: str
    meeting_no: str
    status: str
    total_questions: int
    correct_count: int
    error_count: int
    accuracy: str
    created_at: datetime
    user_friendly_message: str = "获取会议列表成功～"

    class Config:
        from_attributes = True


class MeetingUploadResponse(BaseModel):
    id: int
    title: str
    meeting_no: str
    file_name: str
    status: str
    user_friendly_message: str = "文件上传成功，正在处理中～"

    class Config:
        from_attributes = True


class MeetingAnalyzeResponse(BaseModel):
    meeting_id: int
    total_questions: int
    correct_count: int
    error_count: int
    accuracy: str
    status: str
    user_friendly_message: str = "质检分析完成～"
