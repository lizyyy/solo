from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from app.models import (
    CustomerDemandStatus, AuntStatus, TrialScheduleStatus,
    DepositStatus, ReviewStatus, ConversionStatus
)


class AuditLogBase(BaseModel):
    operation_type: str
    entity_type: str
    entity_id: Optional[int] = None
    original_input: Optional[str] = None
    handler: str
    conclusion: Optional[str] = None


class AuditLogCreate(AuditLogBase):
    pass


class AuditLog(AuditLogBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class CustomerDemandBase(BaseModel):
    customer_name: str
    customer_phone: str
    address: Optional[str] = None
    service_type: Optional[str] = None
    required_skills: Optional[str] = None
    salary_expectation: Optional[float] = None
    work_time: Optional[str] = None
    remarks: Optional[str] = None


class CustomerDemandCreate(CustomerDemandBase):
    pass


class CustomerDemandUpdate(BaseModel):
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    address: Optional[str] = None
    service_type: Optional[str] = None
    required_skills: Optional[str] = None
    salary_expectation: Optional[float] = None
    work_time: Optional[str] = None
    remarks: Optional[str] = None
    status: Optional[CustomerDemandStatus] = None


class CustomerDemand(CustomerDemandBase):
    id: int
    status: CustomerDemandStatus
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_closed: bool
    closed_reason: Optional[str] = None
    closed_by: Optional[str] = None

    class Config:
        from_attributes = True


class AuntProfileBase(BaseModel):
    name: str
    phone: str
    id_card: str
    age: Optional[int] = None
    experience_years: Optional[int] = None
    skills: Optional[str] = None
    certificates: Optional[str] = None
    address: Optional[str] = None
    remarks: Optional[str] = None


class AuntProfileCreate(AuntProfileBase):
    pass


class AuntProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    id_card: Optional[str] = None
    age: Optional[int] = None
    experience_years: Optional[int] = None
    skills: Optional[str] = None
    certificates: Optional[str] = None
    address: Optional[str] = None
    remarks: Optional[str] = None
    status: Optional[AuntStatus] = None


class AuntProfile(AuntProfileBase):
    id: int
    status: AuntStatus
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TrialScheduleBase(BaseModel):
    demand_id: int
    aunt_id: int
    trial_start_time: datetime
    trial_end_time: datetime
    trial_address: Optional[str] = None
    trial_fee: Optional[float] = None
    remarks: Optional[str] = None
    created_by: str


class TrialScheduleCreate(TrialScheduleBase):
    pass


class TrialScheduleUpdate(BaseModel):
    trial_start_time: Optional[datetime] = None
    trial_end_time: Optional[datetime] = None
    trial_address: Optional[str] = None
    trial_fee: Optional[float] = None
    remarks: Optional[str] = None
    status: Optional[TrialScheduleStatus] = None


class TrialSchedule(TrialScheduleBase):
    id: int
    status: TrialScheduleStatus
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_cancelled: bool
    cancelled_reason: Optional[str] = None
    cancelled_by: Optional[str] = None

    class Config:
        from_attributes = True


class DepositBase(BaseModel):
    trial_schedule_id: int
    amount: float
    payment_method: Optional[str] = None
    transaction_id: Optional[str] = None
    remarks: Optional[str] = None
    created_by: str


class DepositCreate(DepositBase):
    pass


class DepositUpdate(BaseModel):
    payment_method: Optional[str] = None
    transaction_id: Optional[str] = None
    remarks: Optional[str] = None
    status: Optional[DepositStatus] = None


class Deposit(DepositBase):
    id: int
    status: DepositStatus
    paid_at: Optional[datetime] = None
    refunded_at: Optional[datetime] = None
    refund_reason: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ReviewBase(BaseModel):
    trial_schedule_id: int
    customer_id: Optional[int] = None
    reviewer: str
    overall_rating: int = Field(ge=1, le=5)
    skill_rating: int = Field(ge=1, le=5)
    attitude_rating: int = Field(ge=1, le=5)
    punctuality_rating: int = Field(ge=1, le=5)
    hygiene_rating: int = Field(ge=1, le=5)
    communication_rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None
    suggestion: Optional[str] = None


class ReviewCreate(ReviewBase):
    pass


class ReviewUpdate(BaseModel):
    overall_rating: Optional[int] = Field(None, ge=1, le=5)
    skill_rating: Optional[int] = Field(None, ge=1, le=5)
    attitude_rating: Optional[int] = Field(None, ge=1, le=5)
    punctuality_rating: Optional[int] = Field(None, ge=1, le=5)
    hygiene_rating: Optional[int] = Field(None, ge=1, le=5)
    communication_rating: Optional[int] = Field(None, ge=1, le=5)
    comment: Optional[str] = None
    suggestion: Optional[str] = None
    status: Optional[ReviewStatus] = None


class Review(ReviewBase):
    id: int
    status: ReviewStatus
    reviewed_by: Optional[str] = None
    review_comment: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_modified: bool
    modified_by: Optional[str] = None
    modified_reason: Optional[str] = None

    class Config:
        from_attributes = True


class ConversionBase(BaseModel):
    trial_schedule_id: int
    contract_start_date: Optional[datetime] = None
    contract_end_date: Optional[datetime] = None
    contract_salary: Optional[float] = None
    contract_remarks: Optional[str] = None
    conclusion: Optional[str] = None
    decided_by: Optional[str] = None


class ConversionCreate(ConversionBase):
    pass


class ConversionUpdate(BaseModel):
    status: Optional[ConversionStatus] = None
    contract_start_date: Optional[datetime] = None
    contract_end_date: Optional[datetime] = None
    contract_salary: Optional[float] = None
    contract_remarks: Optional[str] = None
    conclusion: Optional[str] = None
    decided_by: Optional[str] = None


class Conversion(ConversionBase):
    id: int
    status: ConversionStatus
    decided_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_withdrawn: bool
    withdrawn_reason: Optional[str] = None
    withdrawn_by: Optional[str] = None

    class Config:
        from_attributes = True


class TrialScheduleDetail(TrialSchedule):
    customer_demand: Optional[CustomerDemand] = None
    aunt: Optional[AuntProfile] = None
    deposits: List[Deposit] = []
    reviews: List[Review] = []
    conversion: Optional[Conversion] = None


class CloseDemandRequest(BaseModel):
    reason: str
    closed_by: str


class CancelScheduleRequest(BaseModel):
    reason: str
    cancelled_by: str


class ReviewDecisionRequest(BaseModel):
    status: ReviewStatus
    reviewed_by: str
    review_comment: Optional[str] = None


class ConversionDecisionRequest(BaseModel):
    status: ConversionStatus
    decided_by: str
    conclusion: Optional[str] = None
    contract_start_date: Optional[datetime] = None
    contract_end_date: Optional[datetime] = None
    contract_salary: Optional[float] = None


class WithdrawConversionRequest(BaseModel):
    reason: str
    withdrawn_by: str


class ManualCorrectionRequest(BaseModel):
    entity_type: str
    entity_id: int
    corrected_data: dict
    corrected_by: str
    correction_reason: str
