from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, date
from models import PrescriptionStatusEnum, ExceptionTypeEnum, RoleEnum


class DrugBase(BaseModel):
    name: str
    generic_name: Optional[str] = None
    manufacturer: Optional[str] = None
    unit: str
    min_dose_per_kg: float
    max_dose_per_kg: float
    dose_unit: str
    description: Optional[str] = None


class DrugCreate(DrugBase):
    created_by: str


class Drug(DrugBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class InventoryBatchBase(BaseModel):
    drug_id: int
    batch_number: str
    quantity: float
    unit: str
    expiration_date: date
    manufacturing_date: Optional[date] = None
    supplier: Optional[str] = None


class InventoryBatchCreate(InventoryBatchBase):
    created_by: str


class InventoryBatch(InventoryBatchBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ContraindicationBase(BaseModel):
    drug_a_id: int
    drug_b_id: int
    severity: str
    description: Optional[str] = None


class ContraindicationCreate(ContraindicationBase):
    created_by: str


class Contraindication(ContraindicationBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class PrescriptionItemBase(BaseModel):
    drug_id: int
    drug_name: str
    batch_id: Optional[int] = None
    batch_number: Optional[str] = None
    prescribed_dose: float
    dose_unit: str
    quantity: float
    quantity_unit: str
    frequency: Optional[str] = None
    duration: Optional[str] = None
    route: Optional[str] = None


class PrescriptionItemCreate(PrescriptionItemBase):
    pass


class PrescriptionItem(PrescriptionItemBase):
    id: int
    prescription_id: int
    calculated_min_dose: Optional[float] = None
    calculated_max_dose: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PrescriptionBase(BaseModel):
    prescription_no: str
    patient_name: str
    species: str
    weight: float
    weight_unit: str = "kg"
    age: Optional[str] = None
    doctor: str
    notes: Optional[str] = None


class PrescriptionCreate(PrescriptionBase):
    created_by: str
    items: List[PrescriptionItemCreate]


class Prescription(PrescriptionBase):
    id: int
    status: PrescriptionStatusEnum
    created_at: datetime
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None
    items: List[PrescriptionItem]

    class Config:
        from_attributes = True


class ValidationResultBase(BaseModel):
    exception_type: ExceptionTypeEnum
    severity: str
    message: str
    is_blocking: bool = False


class ValidationResultCreate(ValidationResultBase):
    prescription_item_id: int


class ValidationResult(ValidationResultBase):
    id: int
    prescription_item_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogBase(BaseModel):
    action: str
    previous_status: Optional[PrescriptionStatusEnum] = None
    new_status: Optional[PrescriptionStatusEnum] = None
    operator: str
    operator_role: RoleEnum
    reason: Optional[str] = None


class AuditLogCreate(AuditLogBase):
    prescription_id: int


class AuditLog(AuditLogBase):
    id: int
    prescription_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class PrescriptionReviewRequest(BaseModel):
    prescription_id: int
    reviewer: str
    reviewer_role: RoleEnum
    approved: bool
    reason: Optional[str] = None


class DispenseItemRequest(BaseModel):
    prescription_item_id: int
    batch_id: int
    quantity_dispensed: float
    unit: str


class DispenseRequest(BaseModel):
    prescription_id: int
    dispensed_by: str
    items: List[DispenseItemRequest]
    notes: Optional[str] = None


class ValidationSummary(BaseModel):
    total_items: int
    passed_count: int
    warning_count: int
    blocked_count: int
    blocking_exceptions: List[str]
    warning_exceptions: List[str]


class PrescriptionResponse(BaseModel):
    prescription: Prescription
    validation_summary: ValidationSummary
    validation_results: List[ValidationResult]


class PrescriptionQueryParams(BaseModel):
    doctor: Optional[str] = None
    status: Optional[PrescriptionStatusEnum] = None
    exception_type: Optional[ExceptionTypeEnum] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    operator: Optional[str] = None


class AuditLogQueryParams(BaseModel):
    prescription_id: Optional[int] = None
    operator: Optional[str] = None
    action: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class IdempotentRequest(BaseModel):
    idempotency_key: str


class ReportRow(BaseModel):
    prescription_no: str
    patient_name: str
    species: str
    weight: float
    doctor: str
    status: str
    drug_name: str
    prescribed_dose: float
    dose_unit: str
    batch_number: Optional[str] = None
    exception_type: Optional[str] = None
    exception_message: Optional[str] = None
    is_blocking: Optional[bool] = None
    operator: Optional[str] = None
    action_time: Optional[datetime] = None
