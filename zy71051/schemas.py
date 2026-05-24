from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional, List
from enum import Enum


class DistributionStatus(str, Enum):
    PENDING = "pending"
    PREPARED = "prepared"
    DISTRIBUTED = "distributed"
    SIGNED = "signed"
    STOPPED = "stopped"
    CANCELLED = "cancelled"


class StopStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class DisputeStatus(str, Enum):
    PENDING = "pending"
    RESOLVED = "resolved"
    REJECTED = "rejected"


class ElderBase(BaseModel):
    name: str
    id_card: str
    room_number: Optional[str] = None
    bed_number: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[int] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None


class ElderCreate(ElderBase):
    pass


class ElderUpdate(ElderBase):
    is_active: Optional[bool] = None


class Elder(ElderBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PrescriptionItemBase(BaseModel):
    medicine_name: str
    specification: Optional[str] = None
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    usage: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None


class PrescriptionItemCreate(PrescriptionItemBase):
    pass


class PrescriptionItem(PrescriptionItemBase):
    id: int
    prescription_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class PrescriptionBase(BaseModel):
    elder_id: int
    doctor_name: Optional[str] = None
    diagnosis: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None
    source: Optional[str] = None
    remark: Optional[str] = None


class PrescriptionCreate(PrescriptionBase):
    items: List[PrescriptionItemCreate]
    created_by: str


class PrescriptionUpdate(BaseModel):
    doctor_name: Optional[str] = None
    diagnosis: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None
    remark: Optional[str] = None


class Prescription(PrescriptionBase):
    id: int
    version: int
    is_active: bool
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items: List[PrescriptionItem] = []

    class Config:
        from_attributes = True


class StopRequestBase(BaseModel):
    prescription_id: int
    applicant: str
    applicant_role: Optional[str] = None
    reason: str
    effective_date: date
    source: Optional[str] = None
    remark: Optional[str] = None


class StopRequestCreate(StopRequestBase):
    batch_no: Optional[str] = None


class StopRequestUpdate(BaseModel):
    status: StopStatus
    approved_by: str
    remark: Optional[str] = None


class StopRequest(StopRequestBase):
    id: int
    batch_no: Optional[str] = None
    status: StopStatus
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    is_withdrawn: bool
    withdrawn_at: Optional[datetime] = None
    withdrawn_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MedicineBoxBase(BaseModel):
    elder_id: int
    prescription_id: Optional[int] = None
    batch_no: str
    box_no: Optional[str] = None
    distribution_date: date
    time_slot: Optional[str] = None
    medicines: Optional[str] = None
    source: Optional[str] = None
    remark: Optional[str] = None


class MedicineBoxCreate(MedicineBoxBase):
    prepared_by: Optional[str] = None


class MedicineBoxUpdate(BaseModel):
    status: Optional[DistributionStatus] = None
    signed_by: Optional[str] = None
    remark: Optional[str] = None


class MedicineBox(MedicineBoxBase):
    id: int
    status: DistributionStatus
    prepared_by: Optional[str] = None
    prepared_at: Optional[datetime] = None
    signed_by: Optional[str] = None
    signed_at: Optional[datetime] = None
    is_supplementary: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SignatureBase(BaseModel):
    medicine_box_id: int
    nurse_name: str
    is_backfilled: bool = False
    backfill_reason: Optional[str] = None
    backfilled_by: Optional[str] = None
    receiver_name: Optional[str] = None
    receiver_relation: Optional[str] = None


class SignatureCreate(SignatureBase):
    pass


class Signature(SignatureBase):
    id: int
    sign_time: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class DisputeBase(BaseModel):
    medicine_box_id: int
    reporter: str
    reporter_role: Optional[str] = None
    dispute_type: Optional[str] = None
    description: str


class DisputeCreate(DisputeBase):
    pass


class DisputeHandle(BaseModel):
    handler: str
    handle_result: str
    status: DisputeStatus


class Dispute(DisputeBase):
    id: int
    status: DisputeStatus
    handler: Optional[str] = None
    handle_result: Optional[str] = None
    handled_at: Optional[datetime] = None
    before_data: Optional[str] = None
    after_data: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OperationLogBase(BaseModel):
    operation_type: str
    resource_type: Optional[str] = None
    resource_id: Optional[int] = None
    batch_no: Optional[str] = None
    operator: str
    operator_role: Optional[str] = None
    source: Optional[str] = None
    before_data: Optional[str] = None
    after_data: Optional[str] = None
    change_summary: Optional[str] = None
    ip_address: Optional[str] = None


class OperationLogCreate(OperationLogBase):
    pass


class OperationLog(OperationLogBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class BatchUploadBase(BaseModel):
    batch_no: str
    upload_type: str
    uploader: str
    remark: Optional[str] = None


class BatchUploadCreate(BatchUploadBase):
    resubmitted_from: Optional[str] = None


class BatchUploadUpdate(BaseModel):
    status: Optional[str] = None
    total_count: Optional[int] = None
    success_count: Optional[int] = None
    fail_count: Optional[int] = None
    remark: Optional[str] = None


class BatchUploadWithdraw(BaseModel):
    withdrawn_by: str
    withdraw_reason: str


class BatchUpload(BatchUploadBase):
    id: int
    total_count: int
    success_count: int
    fail_count: int
    status: str
    is_withdrawn: bool
    withdrawn_at: Optional[datetime] = None
    withdrawn_by: Optional[str] = None
    withdraw_reason: Optional[str] = None
    resubmitted_from: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DistributionReportQuery(BaseModel):
    start_date: date
    end_date: date
    elder_id: Optional[int] = None
    status: Optional[DistributionStatus] = None
    batch_no: Optional[str] = None


class DistributionStats(BaseModel):
    total_boxes: int
    signed_count: int
    pending_count: int
    stopped_count: int
    cancelled_count: int
    dispute_count: int
    backfill_count: int
    sign_rate: float


class StopInterceptionCheck(BaseModel):
    elder_id: int
    distribution_date: date
    prescription_id: Optional[int] = None
