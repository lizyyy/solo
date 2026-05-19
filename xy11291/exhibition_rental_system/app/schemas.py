from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Any


class UserBase(BaseModel):
    username: str
    email: str
    full_name: Optional[str] = None
    phone: Optional[str] = None
    role: str = "staff"


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserSafeResponse(BaseModel):
    id: int
    username: str
    full_name: Optional[str] = None
    role: str

    class Config:
        from_attributes = True


class BoothBase(BaseModel):
    booth_number: str
    company_name: str
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    area: Optional[float] = None


class BoothCreate(BoothBase):
    pass


class BoothResponse(BoothBase):
    id: int
    status: str
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class BoothSafeResponse(BaseModel):
    id: int
    booth_number: str
    company_name: str

    class Config:
        from_attributes = True


class EquipmentBase(BaseModel):
    barcode: str
    name: str
    category: str
    specification: Optional[str] = None
    daily_rate: float
    deposit: float
    current_location: Optional[str] = None
    remarks: Optional[str] = None


class EquipmentCreate(EquipmentBase):
    pass


class EquipmentResponse(EquipmentBase):
    id: int
    status: str
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class RentalItemBase(BaseModel):
    equipment_id: int
    quantity: int = 1
    remarks: Optional[str] = None


class RentalItemCreate(RentalItemBase):
    pass


class RentalItemResponse(RentalItemBase):
    id: int
    rental_id: int
    daily_rate: float
    deposit: float
    status: str
    equipment: EquipmentResponse

    class Config:
        from_attributes = True


class RentalBase(BaseModel):
    booth_id: int
    remarks: Optional[str] = None


class RentalCreate(RentalBase):
    items: List[RentalItemCreate]


class RentalResponse(RentalBase):
    id: int
    rental_no: str
    operator_id: int
    status: str
    total_amount: float
    total_deposit: float
    actual_damage_fee: float
    start_time: datetime
    end_time: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]
    booth: BoothResponse
    items: List[RentalItemResponse]

    class Config:
        from_attributes = True


class ReturnItemBase(BaseModel):
    equipment_id: int
    quantity: int
    status: str = "good"
    damage_level: Optional[str] = None
    damage_fee: float = 0
    remarks: Optional[str] = None


class ReturnItemCreate(ReturnItemBase):
    pass


class ReturnCreate(BaseModel):
    rental_id: int
    items: List[ReturnItemCreate]
    remarks: Optional[str] = None


class ReturnItemResponse(ReturnItemBase):
    id: int
    return_record_id: int

    class Config:
        from_attributes = True


class ReturnResponse(BaseModel):
    id: int
    rental_id: int
    operator_id: int
    total_items: int
    returned_items: int
    damage_fee: float
    refund_amount: float
    remarks: Optional[str]
    created_at: datetime
    items: List[ReturnItemResponse]

    class Config:
        from_attributes = True


class RuleResult(BaseModel):
    passed: bool
    rule_name: str
    message: str
    details: Optional[dict] = None


class BatchResult(BaseModel):
    success_count: int
    failed_count: int
    total_count: int
    successful: List[Any]
    failed: List[dict]


class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int]
    action: str
    resource_type: str
    resource_id: Optional[int]
    status: str
    reason: str
    ip_address: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
