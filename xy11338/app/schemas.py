from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional, List
from app.models import UserRole, PartStatus, ClaimStatus, VerificationResult


class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    full_name: Optional[str] = None
    phone: Optional[str] = None
    role: UserRole


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class PartBase(BaseModel):
    part_code: str
    part_name: str
    category: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    unit_price: float
    stock_quantity: int = 0
    min_stock: int = 5
    location: Optional[str] = None
    batch_no: Optional[str] = None
    is_old_part: bool = False


class PartCreate(PartBase):
    pass


class PartResponse(PartBase):
    id: int
    status: PartStatus
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class IssueItemBase(BaseModel):
    part_id: int
    quantity: int
    unit_price: Optional[float] = None
    old_part_expected: bool = True
    remarks: Optional[str] = None


class IssueItemCreate(IssueItemBase):
    pass


class IssueItemResponse(IssueItemBase):
    id: int
    status: PartStatus
    old_part_returned: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class IssueBase(BaseModel):
    engineer_id: int
    work_order_no: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_address: Optional[str] = None
    appliance_type: Optional[str] = None
    appliance_model: Optional[str] = None
    fault_description: Optional[str] = None


class IssueCreate(IssueBase):
    items: List[IssueItemCreate]


class IssueResponse(IssueBase):
    id: int
    issue_no: str
    batch_no: str
    is_installed: bool
    installed_at: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]
    items: List[IssueItemResponse]
    
    class Config:
        from_attributes = True


class InstallationBase(BaseModel):
    issue_id: int
    engineer_id: int
    work_order_no: Optional[str] = None
    serial_number: Optional[str] = None
    installation_date: datetime
    customer_signature: Optional[str] = None
    remarks: Optional[str] = None


class InstallationCreate(InstallationBase):
    pass


class InstallationResponse(InstallationBase):
    id: int
    installation_no: str
    batch_no: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class ReturnItemBase(BaseModel):
    part_id: int
    quantity: int
    is_defective: bool = True
    defect_description: Optional[str] = None
    batch_no: Optional[str] = None


class ReturnItemCreate(ReturnItemBase):
    pass


class ReturnItemResponse(ReturnItemBase):
    id: int
    condition_verified: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class PartReturnBase(BaseModel):
    issue_id: int
    received_by_id: int
    return_date: datetime
    tracking_number: Optional[str] = None
    warehouse_remarks: Optional[str] = None


class PartReturnCreate(PartReturnBase):
    items: List[ReturnItemCreate]


class PartReturnResponse(PartReturnBase):
    id: int
    return_no: str
    batch_no: str
    created_at: datetime
    items: List[ReturnItemResponse]
    
    class Config:
        from_attributes = True


class ClaimItemBase(BaseModel):
    return_item_id: Optional[int] = None
    part_id: int
    part_code: str
    part_name: str
    quantity: int
    unit_price: float
    amount: float
    defect_code: Optional[str] = None
    defect_description: Optional[str] = None
    work_order_no: Optional[str] = None


class ClaimItemCreate(ClaimItemBase):
    pass


class ClaimItemResponse(ClaimItemBase):
    id: int
    is_duplicate: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class ClaimVerificationBase(BaseModel):
    rule_name: str
    result: VerificationResult
    reason: str
    affected_item_ids: Optional[str] = None


class ClaimVerificationCreate(ClaimVerificationBase):
    claim_id: int


class ClaimVerificationResponse(ClaimVerificationBase):
    id: int
    verified_by: Optional[int]
    verified_at: datetime
    
    class Config:
        from_attributes = True


class ClaimBase(BaseModel):
    vendor: str
    vendor_contact: Optional[str] = None
    vendor_phone: Optional[str] = None
    total_amount: float
    remarks: Optional[str] = None


class ClaimCreate(ClaimBase):
    items: List[ClaimItemCreate]


class ClaimResponse(ClaimBase):
    id: int
    claim_no: str
    status: ClaimStatus
    batch_no: str
    submitted_at: Optional[datetime]
    approved_at: Optional[datetime]
    paid_at: Optional[datetime]
    created_by: Optional[int]
    created_at: datetime
    updated_at: Optional[datetime]
    items: List[ClaimItemResponse]
    verifications: List[ClaimVerificationResponse]
    
    class Config:
        from_attributes = True


class WriteOffItemBase(BaseModel):
    part_id: int
    quantity: int
    unit_price: float
    amount: float
    reason: Optional[str] = None


class WriteOffItemCreate(WriteOffItemBase):
    pass


class WriteOffItemResponse(WriteOffItemBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class WriteOffBase(BaseModel):
    claim_id: Optional[int] = None
    total_amount: float
    reason: str


class WriteOffCreate(WriteOffBase):
    items: List[WriteOffItemCreate]


class WriteOffResponse(WriteOffBase):
    id: int
    write_off_no: str
    batch_no: str
    approved_by: Optional[int]
    approved_at: Optional[datetime]
    created_at: datetime
    items: List[WriteOffItemResponse]
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class VerificationDetail(BaseModel):
    rule_name: str
    result: VerificationResult
    reason: str
    affected_items: List[int] = []


class ClaimVerificationResult(BaseModel):
    overall_result: VerificationResult
    details: List[VerificationDetail]
    can_submit: bool


class BatchImportResponse(BaseModel):
    success: int
    failed: int
    skipped: int
    batch_no: str
    errors: List[str] = []
