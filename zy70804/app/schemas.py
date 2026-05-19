from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models import BatchStatus, DeclarationItemStatus, OperationType


class DeclarationBatchBase(BaseModel):
    batch_no: str = Field(..., max_length=50)
    declaration_port: Optional[str] = None
    declaration_date: Optional[datetime] = None
    ebp_no: Optional[str] = None
    currency: str = "CNY"
    created_by: Optional[str] = None
    remark: Optional[str] = None


class DeclarationBatchCreate(DeclarationBatchBase):
    pass


class DeclarationBatchUpdate(BaseModel):
    status: Optional[BatchStatus] = None
    remark: Optional[str] = None


class DeclarationBatch(DeclarationBatchBase):
    id: int
    status: BatchStatus
    total_items: int
    total_amount: float
    total_tax: float
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DeclarationItemBase(BaseModel):
    item_no: Optional[str] = None
    sku: Optional[str] = None
    product_name: Optional[str] = None
    specification: Optional[str] = None
    hs_code: Optional[str] = None
    origin_country: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    total_price: Optional[float] = None
    currency: Optional[str] = None
    exchange_rate: float = 1.0
    category_code: Optional[str] = None
    category_name: Optional[str] = None
    remark: Optional[str] = None


class DeclarationItemCreate(DeclarationItemBase):
    pass


class DeclarationItemUpdate(BaseModel):
    status: Optional[DeclarationItemStatus] = None
    remark: Optional[str] = None


class DeclarationItem(DeclarationItemBase):
    id: int
    batch_id: int
    total_price_cny: Optional[float] = None
    tax_rate: Optional[float] = None
    tax_amount: Optional[float] = None
    tax_amount_cny: Optional[float] = None
    status: DeclarationItemStatus
    is_supplement_tax: bool
    supplement_tax_count: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class HsCodeBase(BaseModel):
    code: str
    name: str
    tax_rate: float
    additional_tax_rate: float = 0
    unit: Optional[str] = None
    category_code: Optional[str] = None
    category_name: Optional[str] = None
    effective_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    remark: Optional[str] = None


class HsCodeCreate(HsCodeBase):
    pass


class HsCode(HsCodeBase):
    id: int
    is_valid: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RejectionNoticeBase(BaseModel):
    rejection_no: str
    rejection_date: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    rejection_type: Optional[str] = None
    handler: Optional[str] = None
    remark: Optional[str] = None


class RejectionNoticeCreate(RejectionNoticeBase):
    batch_id: int


class RejectionNotice(RejectionNoticeBase):
    id: int
    batch_id: int
    is_resolved: bool
    handled_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TaxCertificateBase(BaseModel):
    certificate_no: str
    certificate_type: Optional[str] = None
    issue_date: Optional[datetime] = None
    tax_type: Optional[str] = None
    tax_amount: float
    currency: str = "CNY"
    reason: Optional[str] = None
    handler: Optional[str] = None
    source_type: Optional[str] = None
    source_id: Optional[str] = None
    remark: Optional[str] = None


class TaxCertificateCreate(TaxCertificateBase):
    item_id: int
    batch_id: Optional[int] = None
    declaration_item_no: Optional[str] = None


class TaxCertificate(TaxCertificateBase):
    id: int
    item_id: int
    batch_id: Optional[int] = None
    declaration_item_no: Optional[str] = None
    is_valid: bool
    created_at: datetime

    class Config:
        from_attributes = True


class OperationLogBase(BaseModel):
    operation_type: OperationType
    operator: str
    reason: Optional[str] = None
    remark: Optional[str] = None


class OperationLogCreate(OperationLogBase):
    batch_id: Optional[int] = None
    item_id: Optional[int] = None
    before_data: Optional[str] = None
    after_data: Optional[str] = None


class OperationLog(OperationLogBase):
    id: int
    batch_id: Optional[int] = None
    item_id: Optional[int] = None
    operation_time: datetime
    before_data: Optional[str] = None
    after_data: Optional[str] = None

    class Config:
        from_attributes = True


class BatchDetailResponse(DeclarationBatch):
    items: List[DeclarationItem] = []
    operations: List[OperationLog] = []
    rejection_notices: List[RejectionNotice] = []


class ItemDetailResponse(DeclarationItem):
    operations: List[OperationLog] = []
    tax_certificates: List[TaxCertificate] = []


class TaxCertificateTraceResponse(BaseModel):
    certificate: TaxCertificate
    item: Optional[DeclarationItem] = None
    batch: Optional[DeclarationBatch] = None
    operations: List[OperationLog] = []
