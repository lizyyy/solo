from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
from models import (
    ParticipantType, IDCardType, MaterialStatus, 
    ReturnReasonCategory, ReportStatus
)
import re

class ParticipantBase(BaseModel):
    participant_code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=200)
    type: ParticipantType
    contact_person: Optional[str] = Field(None, max_length=100)
    contact_phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=200)
    booth_number: Optional[str] = Field(None, max_length=50)
    company_name: Optional[str] = Field(None, max_length=200)

class ParticipantCreate(ParticipantBase):
    pass

class ParticipantUpdate(BaseModel):
    name: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    email: Optional[str] = None
    booth_number: Optional[str] = None
    company_name: Optional[str] = None
    is_active: Optional[bool] = None

class ParticipantResponse(ParticipantBase):
    id: int
    created_at: datetime
    updated_at: datetime
    is_active: bool

    class Config:
        from_attributes = True

class ReturnReasonBase(BaseModel):
    code: str = Field(..., max_length=50)
    category: ReturnReasonCategory
    description: str = Field(..., max_length=500)
    needs_manual_review: bool = False

class ReturnReasonCreate(ReturnReasonBase):
    pass

class ReturnReasonResponse(ReturnReasonBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class PersonMaterialBase(BaseModel):
    material_code: str = Field(..., max_length=100)
    id_card_type: IDCardType
    name: str = Field(..., max_length=100)
    id_card_number: str = Field(..., max_length=50)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=200)
    photo_url: Optional[str] = Field(None, max_length=500)
    company: Optional[str] = Field(None, max_length=200)
    position: Optional[str] = Field(None, max_length=100)
    idempotency_key: Optional[str] = Field(None, max_length=100)

    @validator('id_card_number')
    def validate_id_card(cls, v):
        if v and not re.match(r'^\d{17}[\dXx]$', v):
            raise ValueError('身份证号格式不正确')
        return v

class PersonMaterialCreate(PersonMaterialBase):
    participant_code: str

class PersonMaterialUpdate(BaseModel):
    name: Optional[str] = None
    id_card_number: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    photo_url: Optional[str] = None
    company: Optional[str] = None
    position: Optional[str] = None

class PersonMaterialResponse(PersonMaterialBase):
    id: int
    participant_id: int
    version: int
    status: MaterialStatus
    return_note: Optional[str]
    created_at: datetime
    updated_at: datetime
    submitted_at: Optional[datetime]
    reviewed_at: Optional[datetime]

    class Config:
        from_attributes = True

class MaterialSubmitRequest(BaseModel):
    material_code: str
    idempotency_key: Optional[str] = None

class MaterialReturnRequest(BaseModel):
    material_code: str
    return_reason_code: str
    return_note: Optional[str] = None

class MaterialApproveRequest(BaseModel):
    material_code: str

class BatchCreate(BaseModel):
    batch_code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=200)
    description: Optional[str] = None
    id_card_type: IDCardType
    material_codes: List[str]

class BatchAddMaterialsRequest(BaseModel):
    material_codes: List[str]

class BatchReturnMaterialsRequest(BaseModel):
    return_items: List[dict]

class BatchResponse(BaseModel):
    id: int
    batch_code: str
    name: str
    description: Optional[str]
    id_card_type: IDCardType
    status: str
    total_count: int
    returned_count: int
    approved_count: int
    created_at: datetime
    closed_at: Optional[datetime]

    class Config:
        from_attributes = True

class ReportGenerateRequest(BaseModel):
    batch_code: str
    report_code: str
    name: str
    file_format: str = "xlsx"

class ReportResponse(BaseModel):
    id: int
    report_code: str
    batch_id: int
    name: str
    status: ReportStatus
    file_url: Optional[str]
    file_format: str
    statistics: Optional[str]
    generated_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True

class IDCardRuleBase(BaseModel):
    card_type: IDCardType
    allowed_participant_types: Optional[str] = None
    max_count_per_participant: int = 100
    required_fields: Optional[str] = None
    photo_requirements: Optional[str] = None

class IDCardRuleResponse(IDCardRuleBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: Optional[dict] = None

class ErrorCodes:
    MISSING_FIELDS = "MISSING_FIELDS"
    INVALID_STATUS = "INVALID_STATUS"
    NEEDS_MANUAL_REVIEW = "NEEDS_MANUAL_REVIEW"
    ALREADY_PROCESSED = "ALREADY_PROCESSED"
    DUPLICATE_SUBMISSION = "DUPLICATE_SUBMISSION"
    NOT_FOUND = "NOT_FOUND"
    VALIDATION_ERROR = "VALIDATION_ERROR"
