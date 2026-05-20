from pydantic import BaseModel, Field, validator
from datetime import datetime, date
from typing import Optional, List
from models import MaterialStatus, DepositStatus


class BoothCertificateCreate(BaseModel):
    batch_number: str = Field(..., description="材料批次号")
    booth_number: str = Field(..., description="摊位编号")
    mall_name: str = Field(..., description="商场名称")
    certificate_version: str = Field(..., description="证照版本")
    
    schedule_start_date: Optional[date] = Field(None, description="场地档期开始日期")
    schedule_end_date: Optional[date] = Field(None, description="场地档期结束日期")
    entry_time: Optional[datetime] = Field(None, description="进场时间")
    
    business_license: Optional[str] = Field(None, description="营业执照路径/编号")
    fire_safety_material: Optional[str] = Field(None, description="消防材料路径/编号")
    
    certificate_expiry_date: Optional[date] = Field(None, description="证照过期日期")
    deposit_status: DepositStatus = Field(DepositStatus.UNPAID, description="押金状态")
    
    processor: str = Field(..., description="处理人")
    
    @validator('schedule_end_date')
    def validate_schedule_dates(cls, v, values):
        if v and values.get('schedule_start_date') and v < values.get('schedule_start_date'):
            raise ValueError("场地档期结束日期不能早于开始日期")
        return v
    
    @validator('entry_time')
    def validate_entry_time(cls, v, values):
        if v and values.get('schedule_start_date'):
            if v.date() < values.get('schedule_start_date'):
                raise ValueError("进场时间不能早于场地档期开始日期")
        return v


class BoothCertificateResponse(BaseModel):
    id: int
    batch_number: str
    booth_number: str
    mall_name: str
    certificate_version: str
    
    schedule_start_date: Optional[date]
    schedule_end_date: Optional[date]
    entry_time: Optional[datetime]
    
    business_license: Optional[str]
    fire_safety_material: Optional[str]
    
    certificate_expiry_date: Optional[date]
    deposit_status: DepositStatus
    
    status: MaterialStatus
    follow_up_action: Optional[str]
    reject_reason: Optional[str]
    error_details: Optional[str]
    
    processor: str
    created_at: datetime
    updated_at: datetime
    
    is_duplicate: bool
    original_batch_id: Optional[int]
    
    class Config:
        from_attributes = True


class StatisticsResponse(BaseModel):
    total: int
    normal: int
    pending_supplement: int
    blocked: int
    duplicate: int


class ErrorDetail(BaseModel):
    field: str
    message: str
    original_position: str


class MaterialSubmissionResponse(BaseModel):
    success: bool
    message: str
    certificate: Optional[BoothCertificateResponse]
    is_duplicate: bool
    errors: List[ErrorDetail] = []


class ExportQuery(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    mall_name: Optional[str] = None
    status: Optional[MaterialStatus] = None
