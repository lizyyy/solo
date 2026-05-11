from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class UserBase(BaseModel):
    username: str
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    is_admin: bool = False


class UserCreate(UserBase):
    pass


class UserResponse(UserBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class GasCylinderBase(BaseModel):
    cylinder_code: str
    gas_type: str
    danger_category: str
    capacity: float = Field(gt=0)
    current_level: float = Field(ge=0)
    location: Optional[str] = None
    manufacturer: Optional[str] = None
    production_date: Optional[datetime] = None
    inspection_date: Optional[datetime] = None
    next_inspection_date: Optional[datetime] = None


class GasCylinderCreate(GasCylinderBase):
    pass


class GasCylinderUpdate(BaseModel):
    current_level: Optional[float] = Field(ge=0)
    status: Optional[str] = None
    location: Optional[str] = None


class GasCylinderResponse(GasCylinderBase):
    id: int
    status: str
    current_level_percentage: float
    created_at: datetime
    updated_at: datetime
    danger_category_info: dict
    
    class Config:
        from_attributes = True


class BorrowBase(BaseModel):
    user_id: int
    cylinder_id: int
    purpose: str
    expected_return_date: datetime
    notes: Optional[str] = None


class BorrowCreate(BorrowBase):
    pass


class BorrowResponse(BorrowBase):
    id: int
    actual_return_date: Optional[datetime] = None
    status: str
    is_overdue: bool
    created_at: datetime
    updated_at: datetime
    user: Optional[UserResponse] = None
    cylinder: Optional[GasCylinderResponse] = None
    
    class Config:
        from_attributes = True


class CylinderLevelHistoryResponse(BaseModel):
    id: int
    cylinder_id: int
    previous_level: float
    new_level: float
    recorded_by: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class CylinderWarningBase(BaseModel):
    cylinder_id: int
    warning_type: str
    message: str
    severity: str = "MEDIUM"


class CylinderWarningCreate(CylinderWarningBase):
    pass


class CylinderWarningResponse(CylinderWarningBase):
    id: int
    is_resolved: bool
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class ExchangeRequestBase(BaseModel):
    cylinder_id: int
    requester_id: int
    reason: str


class ExchangeRequestCreate(ExchangeRequestBase):
    pass


class ExchangeRequestUpdate(BaseModel):
    status: Optional[str] = None
    approved_by: Optional[str] = None
    approval_notes: Optional[str] = None
    new_cylinder_id: Optional[int] = None


class ExchangeRequestResponse(ExchangeRequestBase):
    id: int
    status: str
    approved_by: Optional[str] = None
    approval_notes: Optional[str] = None
    new_cylinder_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class SafetyReportResponse(BaseModel):
    total_cylinders: int
    cylinders_by_danger_category: dict
    warning_cylinders: dict
    active_borrows: int
    overdue_borrows: int
    pending_exchanges: int
    report_generated_at: datetime


class APIErrorResponse(BaseModel):
    success: bool = False
    error_code: str
    message: str
    details: Optional[dict] = None
