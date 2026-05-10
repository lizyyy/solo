from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class VerificationResultEnum(str, Enum):
    CONFIRMED = "确认为病斑"
    FALSE_POSITIVE = "误报"
    NEED_RECHECK = "需复核"


class VerificationBase(BaseModel):
    lesion_code: str = Field(..., description="病斑编号")
    result: VerificationResultEnum = Field(..., description="核验结论")
    actual_lesion_type: Optional[str] = Field(default=None, description="实际病斑类型")
    actual_area_m2: Optional[float] = Field(default=None, description="实际面积(平方米)")
    actual_severity: Optional[str] = Field(default=None, description="实际严重程度")
    false_positive_type: Optional[str] = Field(default=None, description="误报类型")
    false_positive_reason: Optional[str] = Field(default=None, description="误报原因")
    verification_method: Optional[str] = Field(default=None, description="核验方式")
    verification_location: Optional[str] = Field(default=None, description="核验地点")
    photo_evidence: Optional[str] = Field(default=None, description="核验照片路径")
    video_evidence: Optional[str] = Field(default=None, description="核验视频路径")
    verified_by: str = Field(..., description="核验人")
    remark: Optional[str] = Field(default=None, description="备注")


class VerificationCreate(VerificationBase):
    pass


class VerificationUpdate(BaseModel):
    actual_lesion_type: Optional[str] = Field(default=None, description="实际病斑类型")
    actual_area_m2: Optional[float] = Field(default=None, description="实际面积(平方米)")
    actual_severity: Optional[str] = Field(default=None, description="实际严重程度")
    remark: Optional[str] = Field(default=None, description="备注")


class VerificationResponse(VerificationBase):
    id: int = Field(..., description="主键ID")
    verification_code: str = Field(..., description="核验编号")
    grid_code: Optional[str] = Field(default=None, description="地块编号")
    grid_name: Optional[str] = Field(default=None, description="地块名称")
    verification_round: int = Field(default=1, description="核验轮次")
    verified_at: datetime = Field(..., description="核验时间")
    is_active: bool = Field(default=True, description="是否有效")
    is_reverted: bool = Field(default=False, description="是否已回滚")
    revert_reason: Optional[str] = Field(default=None, description="回滚原因")
    reverted_by: Optional[str] = Field(default=None, description="回滚人")
    reverted_at: Optional[datetime] = Field(default=None, description="回滚时间")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    class Config:
        from_attributes = True


class VerificationListResponse(BaseModel):
    total: int = Field(..., description="总记录数")
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页数量")
    total_pages: int = Field(..., description="总页数")
    items: list[VerificationResponse] = Field(..., description="核验记录列表")


class RollbackRequest(BaseModel):
    verification_code: Optional[str] = Field(default=None, description="核验编号")
    lesion_code: Optional[str] = Field(default=None, description="病斑编号")
    rollback_reason: str = Field(..., description="回滚原因")
    rolled_by: str = Field(..., description="回滚人")
