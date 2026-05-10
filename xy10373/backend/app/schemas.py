from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional, List


class PatientBase(BaseModel):
    patient_id: str = Field(..., max_length=20)
    name: str = Field(..., max_length=50)
    gender: str = Field(..., max_length=10)
    age: int
    id_card: Optional[str] = Field(None, max_length=18)
    ward: str = Field(..., max_length=50)
    bed_no: Optional[str] = Field(None, max_length=20)
    admission_date: date
    discharge_date: Optional[date] = None
    diagnosis: Optional[str] = Field(None, max_length=200)
    contact_phone: Optional[str] = Field(None, max_length=20)
    is_discharged: bool = False


class PatientCreate(PatientBase):
    pass


class PatientUpdate(BaseModel):
    name: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[int] = None
    id_card: Optional[str] = None
    ward: Optional[str] = None
    bed_no: Optional[str] = None
    admission_date: Optional[date] = None
    discharge_date: Optional[date] = None
    diagnosis: Optional[str] = None
    contact_phone: Optional[str] = None
    is_discharged: Optional[bool] = None


class PatientResponse(PatientBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class WardRuleBase(BaseModel):
    ward_name: str = Field(..., max_length=50)
    max_caregivers: int = 1
    default_validity_days: int = 7
    description: Optional[str] = Field(None, max_length=500)
    is_active: bool = True


class WardRuleCreate(WardRuleBase):
    pass


class WardRuleUpdate(BaseModel):
    max_caregivers: Optional[int] = None
    default_validity_days: Optional[int] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class WardRuleResponse(WardRuleBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class CaregiverBase(BaseModel):
    caregiver_id: str = Field(..., max_length=20)
    name: str = Field(..., max_length=50)
    gender: str = Field(..., max_length=10)
    id_card: str = Field(..., max_length=18)
    relation_to_patient: str = Field(..., max_length=50)
    phone: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = Field(None, max_length=200)


class CaregiverCreate(CaregiverBase):
    pass


class CaregiverUpdate(BaseModel):
    name: Optional[str] = None
    gender: Optional[str] = None
    relation_to_patient: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None


class CaregiverResponse(CaregiverBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class CareCertificateBase(BaseModel):
    patient_id: str
    caregiver_id: str
    issue_date: date
    expiry_date: date
    notes: Optional[str] = None
    source_file: Optional[str] = None


class CareCertificateCreate(CareCertificateBase):
    operator: str


class CareCertificateResponse(BaseModel):
    id: int
    certificate_no: str
    patient_id: str
    caregiver_id: str
    caregiver_name: Optional[str] = None
    issue_date: date
    expiry_date: date
    status: str
    notes: Optional[str] = None
    source_file: Optional[str] = None
    days_remaining: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ReplacementRequestBase(BaseModel):
    certificate_id: int
    new_caregiver_name: str
    new_caregiver_id_card: str
    new_caregiver_relation: str
    new_caregiver_phone: Optional[str] = None
    reason: str
    requested_by: str


class ReplacementRequestCreate(ReplacementRequestBase):
    pass


class ReplacementRequestReview(BaseModel):
    status: str
    approved_by: str
    approval_notes: Optional[str] = None


class ReplacementRequestResponse(BaseModel):
    id: int
    request_no: str
    certificate_id: int
    certificate_no: Optional[str] = None
    patient_id: str
    patient_name: Optional[str] = None
    old_caregiver_id: str
    old_caregiver_name: Optional[str] = None
    new_caregiver_name: str
    new_caregiver_id_card: str
    new_caregiver_relation: str
    new_caregiver_phone: Optional[str] = None
    reason: str
    requested_by: str
    request_date: datetime
    status: str
    approved_by: Optional[str] = None
    approval_date: Optional[datetime] = None
    approval_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class OperationLogResponse(BaseModel):
    id: int
    operation_type: str
    patient_id: Optional[str] = None
    patient_name: Optional[str] = None
    certificate_id: Optional[int] = None
    certificate_no: Optional[str] = None
    operator: str
    action: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    source_file: Optional[str] = None
    result: str
    notes: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class ValidationError(BaseModel):
    error_code: str
    message: str
    details: Optional[str] = None
