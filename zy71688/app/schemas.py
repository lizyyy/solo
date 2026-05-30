from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.models import AppealStatus, MaterialStatus, FlagType


class MedicalRecordIn(BaseModel):
    diagnosis_code: Optional[str] = None
    diagnosis_name: Optional[str] = None
    admission_date: Optional[str] = None
    discharge_date: Optional[str] = None
    department: Optional[str] = None
    attending_doctor: Optional[str] = None
    summary: Optional[str] = None


class MedicalRecordOut(MedicalRecordIn):
    id: int
    appeal_id: int

    model_config = {"from_attributes": True}


class DeductionIn(BaseModel):
    item_code: Optional[str] = None
    item_name: Optional[str] = None
    deduction_amount: Optional[float] = 0.0
    reason_code: Optional[str] = None
    reason_text: Optional[str] = None
    rule_version: Optional[str] = None
    is_disputed: Optional[bool] = True


class DeductionOut(DeductionIn):
    id: int
    appeal_id: int

    model_config = {"from_attributes": True}


class MaterialIn(BaseModel):
    category: str
    file_name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[MaterialStatus] = MaterialStatus.MISSING


class MaterialOut(MaterialIn):
    id: int
    appeal_id: int
    uploaded_at: Optional[datetime] = None
    verified_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class RuleMatchIn(BaseModel):
    deduction_id: Optional[int] = None
    rule_code: Optional[str] = None
    rule_name: Optional[str] = None
    rule_version: Optional[str] = None
    is_version_latest: Optional[bool] = True
    match_result: Optional[str] = None
    explanation: Optional[str] = None


class RuleMatchOut(RuleMatchIn):
    id: int
    appeal_id: int

    model_config = {"from_attributes": True}


class AppealCreate(BaseModel):
    patient_name: str
    admission_no: Optional[str] = None
    insurance_no: Optional[str] = None
    operator: Optional[str] = None
    medical_record: Optional[MedicalRecordIn] = None
    deductions: Optional[list[DeductionIn]] = None
    materials: Optional[list[MaterialIn]] = None


class AppealUpdate(BaseModel):
    patient_name: Optional[str] = None
    admission_no: Optional[str] = None
    insurance_no: Optional[str] = None
    operator: Optional[str] = None
    status: Optional[AppealStatus] = None
    reviewer: Optional[str] = None


class AppealOut(BaseModel):
    id: int
    appeal_no: str
    patient_name: str
    admission_no: Optional[str] = None
    insurance_no: Optional[str] = None
    status: AppealStatus
    operator: Optional[str] = None
    reviewer: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    medical_record: Optional[MedicalRecordOut] = None
    deductions: Optional[list[DeductionOut]] = None
    materials: Optional[list[MaterialOut]] = None
    rule_matches: Optional[list[RuleMatchOut]] = None

    model_config = {"from_attributes": True}


class ProcessingIn(BaseModel):
    material_check_passed: Optional[bool] = False
    material_check_note: Optional[str] = None
    rule_check_passed: Optional[bool] = False
    rule_check_note: Optional[str] = None
    progress_note: Optional[str] = None
    difference_explanation: Optional[str] = None
    processed_by: Optional[str] = None


class ProcessingOut(ProcessingIn):
    id: int
    appeal_id: int
    processed_at: datetime

    model_config = {"from_attributes": True}


class ReviewIn(BaseModel):
    result: str
    comment: Optional[str] = None
    reviewed_by: Optional[str] = None


class ReviewOut(ReviewIn):
    id: int
    appeal_id: int
    reviewed_at: datetime

    model_config = {"from_attributes": True}


class FlagOut(BaseModel):
    id: int
    appeal_id: int
    flag_type: FlagType
    detail: Optional[str] = None
    is_resolved: bool
    created_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ChangeHistoryOut(BaseModel):
    id: int
    appeal_id: int
    field_name: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    changed_by: Optional[str] = None
    changed_at: datetime
    reason: Optional[str] = None

    model_config = {"from_attributes": True}


class CleanResult(BaseModel):
    rows: list[dict]
    duplicate_count: int
    typo_corrections: list[str]
    removed_empty_rows: int


class FlagResolveIn(BaseModel):
    is_resolved: bool = True
