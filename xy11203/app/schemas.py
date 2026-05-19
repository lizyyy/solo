from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field

from app.models.enums import MedicineType, BatchStatus, OperationType, RuleType, RuleResultStatus, UserRole


class UserBase(BaseModel):
    username: str
    full_name: str
    role: UserRole
    phone: Optional[str] = None
    email: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None
    user_id: Optional[int] = None


class MedicineBase(BaseModel):
    code: str
    name: str
    type: MedicineType
    manufacturer: Optional[str] = None
    specification: Optional[str] = None
    unit: str = "支"
    temperature_min: Optional[float] = None
    temperature_max: Optional[float] = None
    description: Optional[str] = None


class MedicineCreate(MedicineBase):
    pass


class MedicineResponse(MedicineBase):
    id: int
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BatchBase(BaseModel):
    batch_no: str
    medicine_id: int
    quantity: int = Field(gt=0)
    unit: str = "支"
    arrival_temperature: Optional[float] = None
    temperature_photo_path: Optional[str] = None
    damage_photo_path: Optional[str] = None
    damage_quantity: int = 0
    damage_description: Optional[str] = None
    production_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    remarks: Optional[str] = None


class BatchCreate(BatchBase):
    pass


class BatchResponse(BatchBase):
    id: int
    status: BatchStatus
    receiver_id: Optional[int] = None
    reviewer_id: Optional[int] = None
    approver_id: Optional[int] = None
    received_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    import_hash: Optional[str] = None
    created_at: Optional[datetime] = None
    medicine: Optional[MedicineResponse] = None

    class Config:
        from_attributes = True


class BatchUpdate(BaseModel):
    arrival_temperature: Optional[float] = None
    temperature_photo_path: Optional[str] = None
    damage_photo_path: Optional[str] = None
    damage_quantity: Optional[int] = None
    damage_description: Optional[str] = None
    remarks: Optional[str] = None


class BatchAction(BaseModel):
    reason: Optional[str] = None


class InventoryBase(BaseModel):
    medicine_id: int
    batch_id: int
    quantity: int
    available_quantity: int
    locked_quantity: int = 0
    damaged_quantity: int = 0
    warehouse_location: Optional[str] = None


class InventoryResponse(InventoryBase):
    id: int
    last_check_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    medicine: Optional[MedicineResponse] = None
    batch: Optional[BatchResponse] = None

    class Config:
        from_attributes = True


class RuleResultResponse(BaseModel):
    id: int
    batch_id: int
    rule_type: RuleType
    status: RuleResultStatus
    reason: str
    actual_value: Optional[str] = None
    expected_value: Optional[str] = None
    operator_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class OperationLogResponse(BaseModel):
    id: int
    operation_type: OperationType
    batch_id: Optional[int] = None
    operator_id: int
    before_data: Optional[str] = None
    after_data: Optional[str] = None
    change_reason: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ImportResult(BaseModel):
    batch_no: str
    status: str
    reason: Optional[str] = None
    batch_id: Optional[int] = None
    blocked_reasons: Optional[List[str]] = None


class ImportSummary(BaseModel):
    results: List[ImportResult]
    success_count: int
    skip_count: int


class BatchDetailResponse(BaseModel):
    batch: BatchResponse
    inventory: Optional[InventoryResponse] = None
    rule_results: List[RuleResultResponse]
    operation_logs: List[OperationLogResponse]
