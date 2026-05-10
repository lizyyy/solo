from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

from app.models import (
    SupplierType, SupplierStatus, QualificationStatus,
    SwitchStatus, ApprovalStatus, ExceptionType
)


class QualificationBase(BaseModel):
    name: str
    certificate_number: str
    issue_date: datetime
    expiry_date: datetime
    status: QualificationStatus = QualificationStatus.VALID
    description: Optional[str] = None


class QualificationCreate(QualificationBase):
    pass


class Qualification(QualificationBase):
    id: int
    supplier_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class PriceSnapshotBase(BaseModel):
    product_code: str
    product_name: str
    unit_price: float


class PriceSnapshotCreate(PriceSnapshotBase):
    is_current: bool = True


class PriceSnapshot(PriceSnapshotBase):
    id: int
    supplier_id: int
    effective_date: datetime
    is_current: bool
    created_at: datetime

    class Config:
        from_attributes = True


class SupplierBase(BaseModel):
    name: str
    code: str
    type: SupplierType
    status: SupplierStatus = SupplierStatus.ACTIVE
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None


class SupplierCreate(SupplierBase):
    qualifications: Optional[List[QualificationCreate]] = None
    price_snapshots: Optional[List[PriceSnapshotCreate]] = None


class Supplier(SupplierBase):
    id: int
    created_at: datetime
    updated_at: datetime
    qualifications: List[Qualification] = []
    price_snapshots: List[PriceSnapshot] = []

    class Config:
        from_attributes = True


class ApprovalBase(BaseModel):
    approver: str
    approver_department: Optional[str] = None
    approval_level: int = 1
    comment: Optional[str] = None


class ApprovalCreate(ApprovalBase):
    switch_request_id: int


class Approval(ApprovalBase):
    id: int
    switch_request_id: int
    status: ApprovalStatus
    approved_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DeliveryImpactBase(BaseModel):
    original_delivery_date: datetime
    new_delivery_date: datetime
    delay_days: int
    impact_description: Optional[str] = None
    mitigation_measures: Optional[str] = None


class DeliveryImpactCreate(DeliveryImpactBase):
    switch_request_id: int


class DeliveryImpact(DeliveryImpactBase):
    id: int
    switch_request_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ExceptionRecordBase(BaseModel):
    exception_type: ExceptionType
    description: str
    detail: Optional[str] = None


class ExceptionRecordCreate(ExceptionRecordBase):
    switch_request_id: Optional[int] = None


class ExceptionRecord(ExceptionRecordBase):
    id: int
    switch_request_id: Optional[int] = None
    is_resolved: bool
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SwitchReportBase(BaseModel):
    content: str


class SwitchReportCreate(SwitchReportBase):
    switch_request_id: int


class SwitchReport(SwitchReportBase):
    id: int
    switch_request_id: int
    report_no: str
    generated_by: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SwitchRequestBase(BaseModel):
    primary_supplier_id: int
    alternative_supplier_id: int
    product_code: str
    product_name: str
    quantity: int
    reason: str
    requester: str
    requester_department: Optional[str] = None


class SwitchRequestCreate(SwitchRequestBase):
    pass


class SwitchRequest(SwitchRequestBase):
    id: int
    request_no: str
    status: SwitchStatus
    created_at: datetime
    updated_at: datetime
    approvals: List[Approval] = []
    delivery_impacts: List[DeliveryImpact] = []
    exceptions: List[ExceptionRecord] = []
    reports: List[SwitchReport] = []

    class Config:
        from_attributes = True


class SwitchRequestDetail(SwitchRequest):
    primary_supplier: Optional[Supplier] = None
    alternative_supplier: Optional[Supplier] = None


class QualificationCheckResult(BaseModel):
    supplier_id: int
    supplier_name: str
    passed: bool
    failed_qualifications: List[str] = []
    message: str


class PriceComparison(BaseModel):
    product_code: str
    product_name: str
    primary_price: float
    alternative_price: float
    price_difference: float
    price_difference_percent: float


class DeliveryImpactAnalysis(BaseModel):
    switch_request_id: int
    original_delivery_date: datetime
    new_delivery_date: datetime
    delay_days: int
    impact_level: str
    impact_description: str
    mitigation_measures: List[str]


class SwitchExecutionResult(BaseModel):
    success: bool
    switch_request_id: Optional[int] = None
    message: str
    details: Optional[dict] = None
