from datetime import datetime
from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field, ConfigDict

from app.models import ReviewStatus


class PrescriptionItemCreate(BaseModel):
    drug_name: str
    drug_code: Optional[str] = None
    specification: Optional[str] = None
    quantity: float
    unit: Optional[str] = None
    dosage: Optional[str] = None
    batch_no: Optional[str] = None


class PrescriptionCreate(BaseModel):
    prescription_no: str
    patient_name: Optional[str] = None
    patient_id: Optional[str] = None
    prescription_date: datetime
    doctor_name: Optional[str] = None
    department: Optional[str] = None
    diagnosis: Optional[str] = None
    batch_no: Optional[str] = None
    items: List[PrescriptionItemCreate] = Field(default_factory=list)


class InsuranceSettlementCreate(BaseModel):
    settlement_no: str
    prescription_no: str
    settlement_date: datetime
    total_amount: float = 0
    insurance_payment: float = 0
    personal_payment: float = 0
    batch_no: Optional[str] = None


class DrugInventoryCreate(BaseModel):
    drug_code: str
    drug_name: str
    batch_no: str
    quantity: float = 0
    unit: Optional[str] = None
    expiry_date: Optional[datetime] = None
    manufacturer: Optional[str] = None


class DrugReturnCreate(BaseModel):
    return_no: str
    prescription_no: str
    drug_name: str
    batch_no: Optional[str] = None
    return_quantity: float
    return_date: datetime
    return_reason: Optional[str] = None
    operator: Optional[str] = None
    batch_no_import: Optional[str] = None


class BatchImportRequest(BaseModel):
    prescriptions: List[PrescriptionCreate] = Field(default_factory=list)
    settlements: List[InsuranceSettlementCreate] = Field(default_factory=list)
    inventories: List[DrugInventoryCreate] = Field(default_factory=list)
    returns: List[DrugReturnCreate] = Field(default_factory=list)
    batch_no: Optional[str] = None


class ReviewStatusUpdate(BaseModel):
    status: ReviewStatus
    reviewer: Optional[str] = None
    review_comment: Optional[str] = None
    rectification_note: Optional[str] = None


class RuleResultResponse(BaseModel):
    rule_code: str
    rule_name: str
    passed: bool
    severity: str
    description: str
    affected_data: Dict[str, Any]


class ValidationResponse(BaseModel):
    prescription_no: str
    total_rules: int
    passed_count: int
    failed_count: int
    results: List[RuleResultResponse]
    has_high_severity_issues: bool


class BatchImportResponse(BaseModel):
    success: bool
    batch_no: str
    message: str
    imported: Dict[str, int]
    errors: List[str] = Field(default_factory=list)


class PrescriptionItemResponse(BaseModel):
    id: int
    drug_name: str
    drug_code: Optional[str]
    specification: Optional[str]
    quantity: float
    unit: Optional[str]
    dosage: Optional[str]
    batch_no: Optional[str]

    model_config = ConfigDict(from_attributes=True)


class PrescriptionResponse(BaseModel):
    id: int
    prescription_no: str
    patient_name: Optional[str]
    patient_id: Optional[str]
    prescription_date: datetime
    doctor_name: Optional[str]
    department: Optional[str]
    diagnosis: Optional[str]
    batch_no: Optional[str]
    items: List[PrescriptionItemResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ReviewRecordResponse(BaseModel):
    id: int
    prescription_id: int
    status: ReviewStatus
    reviewer: Optional[str]
    review_comment: Optional[str]
    rectification_note: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReportResponse(BaseModel):
    markdown_content: str
    generated_at: datetime
    batch_no: Optional[str] = None
    total_prescriptions: int
    passed_validations: int
    failed_validations: int
    high_severity_issues: int
