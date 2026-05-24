from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field
import models


class SeedlingBatchBase(BaseModel):
    batch_no: str
    species: str
    quantity: int
    origin: str
    production_date: date


class SeedlingBatchCreate(SeedlingBatchBase):
    pass


class SeedlingBatch(SeedlingBatchBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class QuarantineCertificateBase(BaseModel):
    cert_no: str
    batch_no: str
    issue_date: date
    expiry_date: date
    issuer: str


class QuarantineCertificateCreate(QuarantineCertificateBase):
    pass


class QuarantineCertificate(BaseModel):
    id: int
    cert_no: str
    batch_no: str
    issue_date: date
    expiry_date: date
    issuer: str
    status: models.CertificateStatus
    created_at: datetime

    class Config:
        from_attributes = True

    @classmethod
    def from_orm(cls, obj):
        return cls(
            id=obj.id,
            cert_no=obj.cert_no,
            batch_no=obj.batch.batch_no if obj.batch else "",
            issue_date=obj.issue_date,
            expiry_date=obj.expiry_date,
            issuer=obj.issuer,
            status=obj.status,
            created_at=obj.created_at
        )


class DestinationBase(BaseModel):
    region_code: str
    region_name: str
    is_embargoed: bool = False
    embargo_reason: Optional[str] = None
    embargo_date: Optional[date] = None


class DestinationCreate(DestinationBase):
    pass


class Destination(DestinationBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class SalesOrderBase(BaseModel):
    order_no: str
    batch_no: str
    cert_no: Optional[str] = None
    region_code: str
    quantity: int
    customer: str
    remark: Optional[str] = None


class SalesOrderCreate(SalesOrderBase):
    pass


class SalesOrder(BaseModel):
    order_no: str
    batch_no: str
    cert_no: Optional[str] = None
    region_code: str
    quantity: int
    customer: str
    remark: Optional[str] = None
    id: int
    status: models.SalesOrderStatus
    is_split: bool
    parent_order_id: Optional[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

    @classmethod
    def from_orm(cls, obj):
        return cls(
            id=obj.id,
            order_no=obj.order_no,
            batch_no=obj.batch.batch_no if obj.batch else "",
            cert_no=obj.certificate.cert_no if obj.certificate else None,
            region_code=obj.destination.region_code if obj.destination else "",
            quantity=obj.quantity,
            customer=obj.customer,
            remark=obj.remark,
            status=obj.status,
            is_split=obj.is_split,
            parent_order_id=obj.parent_order_id,
            created_at=obj.created_at,
            updated_at=obj.updated_at
        )


class ReissueApplicationBase(BaseModel):
    order_no: str
    reason: str


class ReissueApplicationCreate(ReissueApplicationBase):
    pass


class ReissueApplicationSubmit(BaseModel):
    application_no: str
    new_cert_no: str


class ReissueApplicationReview(BaseModel):
    application_no: str
    status: models.ReissueStatus
    review_remark: str
    reviewer: str


class ReissueApplication(BaseModel):
    id: int
    application_no: str
    order_id: int
    reason: str
    status: models.ReissueStatus
    reviewer: Optional[str]
    review_remark: Optional[str]
    submitted_at: Optional[datetime]
    reviewed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class ShippingReportBase(BaseModel):
    order_no: str
    ship_date: date
    ship_quantity: int
    logistics_info: str
    cert_verified: bool = True


class ShippingReportCreate(ShippingReportBase):
    pass


class ShippingReport(ShippingReportBase):
    id: int
    report_no: str
    created_at: datetime

    class Config:
        from_attributes = True


class ProcessingTraceBase(BaseModel):
    order_no: str
    action: models.TraceAction
    operator: str = "system"
    detail: str
    result: str


class ProcessingTraceCreate(ProcessingTraceBase):
    pass


class ProcessingTrace(BaseModel):
    id: int
    order_id: int
    action: models.TraceAction
    operator: str
    detail: str
    result: str
    created_at: datetime

    class Config:
        from_attributes = True


class ManualOverride(BaseModel):
    order_no: str
    target_status: models.SalesOrderStatus
    operator: str
    reason: str


class RuleCheckResult(BaseModel):
    order_no: str
    cert_check: bool
    cert_message: str
    embargo_check: bool
    embargo_message: str
    final_status: models.SalesOrderStatus
    need_recheck: bool = False
    need_reissue: bool = False


class ErrorResponse(BaseModel):
    error_type: models.ErrorType
    message: str
    detail: Optional[str] = None


class OrderHistory(BaseModel):
    order: SalesOrder
    traces: List[ProcessingTrace]
    reissues: List[ReissueApplication]
    shipping_report: Optional[ShippingReport] = None
