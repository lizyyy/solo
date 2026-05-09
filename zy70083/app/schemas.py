from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from .models import ApplicationStatus


class QualificationRuleBase(BaseModel):
    rule_name: str
    rule_type: str
    description: Optional[str] = None
    min_income_threshold: Optional[float] = None
    max_income_threshold: Optional[float] = None
    min_social_insurance_months: Optional[int] = None
    max_housing_area_per_person: Optional[float] = None
    max_family_housing_area: Optional[float] = None


class QualificationRuleCreate(QualificationRuleBase):
    pass


class QualificationRuleResponse(QualificationRuleBase):
    id: int
    version: int
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FamilyMemberBase(BaseModel):
    name: str
    id_card: str
    relation: str
    is_main_applicant: bool = False
    monthly_income: Optional[float] = None
    social_insurance_months: Optional[int] = None
    housing_area_contribution: Optional[float] = None


class FamilyMemberCreate(FamilyMemberBase):
    pass


class FamilyMemberResponse(FamilyMemberBase):
    id: int

    class Config:
        from_attributes = True


class ApplicationRecordBase(BaseModel):
    application_number: str
    applicant_name: str
    applicant_id_card: str
    contact_phone: str
    household_address: str


class ApplicationRecordCreate(ApplicationRecordBase):
    family_members: List[FamilyMemberCreate]
    applied_rule_id: Optional[int] = None


class VerificationRecordResponse(BaseModel):
    id: int
    verification_type: str
    verification_status: str
    verification_result: Optional[str] = None
    verification_message: Optional[str] = None
    details: Optional[str] = None
    verified_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProcessingHistoryResponse(BaseModel):
    id: int
    previous_status: Optional[str] = None
    new_status: str
    checkpoint: Optional[str] = None
    action: str
    operator: Optional[str] = None
    remark: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ApplicationRecordResponse(ApplicationRecordBase):
    id: int
    current_status: str
    current_checkpoint: Optional[str] = None
    rejection_reason: Optional[str] = None

    family_members: List[FamilyMemberResponse] = []
    verification_records: List[VerificationRecordResponse] = []
    processing_history: List[ProcessingHistoryResponse] = []

    lottery_locked_at: Optional[datetime] = None
    lottery_pool_id: Optional[str] = None
    public_announcement_at: Optional[datetime] = None
    final_result: Optional[str] = None

    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class VerificationResult(BaseModel):
    passed: bool
    checkpoint: str
    message: str
    details: Optional[str] = None


class ObjectionRecordCreate(BaseModel):
    objector_name: str
    objector_contact: str
    objection_content: str


class ObjectionRecordResponse(BaseModel):
    id: int
    objector_name: str
    objector_contact: str
    objection_content: str
    objection_date: datetime
    handling_status: str
    handling_remark: Optional[str] = None
    handling_result: Optional[str] = None
    handled_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LotteryPoolCreate(BaseModel):
    pool_id: str
    pool_name: str
    lottery_year: int
    lottery_batch: int
    total_quota: int
    announcement_date: Optional[datetime] = None


class LotteryPoolResponse(LotteryPoolCreate):
    id: int
    locked_count: int
    selected_count: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class RetryRequest(BaseModel):
    operator: Optional[str] = None
    remark: Optional[str] = None


class BackgroundTaskResponse(BaseModel):
    id: int
    task_name: str
    task_type: str
    status: str
    progress: int
    retry_count: int
    max_retry: int
    error_message: Optional[str] = None
    last_error_at: Optional[datetime] = None
    last_success_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ApplicationStatusDetail(BaseModel):
    application_number: str
    current_status: str
    current_checkpoint: Optional[str] = None
    rejection_reason: Optional[str] = None
    last_processing_action: Optional[str] = None
    last_processing_time: Optional[datetime] = None
    can_retry: bool
    retry_suggestion: Optional[str] = None
