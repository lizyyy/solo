from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import enum


class SyncStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
    PARTIAL = "partial"
    CONFLICT = "conflict"


class ConflictStatus(str, enum.Enum):
    OPEN = "open"
    RESOLVED = "resolved"
    IGNORED = "ignored"


class ConfirmationStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"


class SupplierBase(BaseModel):
    supplier_code: str
    supplier_name: str
    contact_info: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = True


class SupplierCreate(SupplierBase):
    pass


class Supplier(SupplierBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class SupplierProductBase(BaseModel):
    supplier_id: int
    supplier_sku: str
    product_name: Optional[str] = None
    raw_data: Dict[str, Any]
    field_version: int = 1


class SupplierProductCreate(SupplierProductBase):
    pass


class SupplierProduct(SupplierProductBase):
    id: int
    is_dirty: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class InternalCatalogBase(BaseModel):
    internal_sku: str
    product_name: str
    category: Optional[str] = None
    brand: Optional[str] = None
    specs: Optional[Dict[str, Any]] = None
    price: Optional[float] = None
    is_active: Optional[bool] = True


class InternalCatalogCreate(InternalCatalogBase):
    pass


class InternalCatalog(InternalCatalogBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class MappingRuleBase(BaseModel):
    rule_name: str
    field_mappings: Dict[str, Any]
    transformation_rules: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = True


class MappingRuleCreate(MappingRuleBase):
    pass


class MappingRule(MappingRuleBase):
    id: int
    version: int
    created_at: datetime
    updated_at: Optional[datetime]
    created_by: Optional[str]

    class Config:
        from_attributes = True


class ProductMappingBase(BaseModel):
    supplier_product_id: int
    internal_product_id: int
    mapping_rule_id: Optional[int] = None
    confidence_score: Optional[float] = None
    is_manual: bool = False
    mapped_fields: Optional[Dict[str, Any]] = None


class ProductMappingCreate(ProductMappingBase):
    pass


class ProductMapping(ProductMappingBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class MappingTimelineBase(BaseModel):
    mapping_id: int
    action: str
    action_details: Optional[Dict[str, Any]] = None
    performed_by: Optional[str] = None


class MappingTimelineCreate(MappingTimelineBase):
    pass


class MappingTimeline(MappingTimelineBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class SyncBatchBase(BaseModel):
    supplier_id: int
    idempotency_key: str


class SyncBatchCreate(SyncBatchBase):
    pass


class SyncBatch(SyncBatchBase):
    id: int
    batch_id: str
    status: SyncStatus
    total_items: int
    processed_items: int
    success_items: int
    failed_items: int
    conflict_items: int
    error_message: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class ConflictItemBase(BaseModel):
    batch_id: Optional[int] = None
    supplier_product_id: int
    conflict_type: str
    field_name: Optional[str] = None
    old_value: Optional[Dict[str, Any]] = None
    new_value: Optional[Dict[str, Any]] = None


class ConflictItemCreate(ConflictItemBase):
    pass


class ConflictItemResolve(BaseModel):
    resolution: Dict[str, Any]
    resolved_by: str


class ConflictItem(ConflictItemBase):
    id: int
    status: ConflictStatus
    resolution: Optional[Dict[str, Any]] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PendingConfirmationBase(BaseModel):
    batch_id: Optional[int] = None
    supplier_product_id: int
    field_name: str
    suggested_value: Optional[Dict[str, Any]] = None
    current_value: Optional[Dict[str, Any]] = None


class PendingConfirmationCreate(PendingConfirmationBase):
    pass


class PendingConfirmationConfirm(BaseModel):
    status: ConfirmationStatus
    confirmed_value: Optional[Dict[str, Any]] = None
    confirmed_by: str


class PendingConfirmation(PendingConfirmationBase):
    id: int
    status: ConfirmationStatus
    confirmed_value: Optional[Dict[str, Any]] = None
    confirmed_by: Optional[str] = None
    confirmed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BatchImportRequest(BaseModel):
    supplier_id: int
    idempotency_key: str
    products: List[Dict[str, Any]]


class SyncResponse(BaseModel):
    success: bool
    batch_id: str
    status: SyncStatus
    message: str


class ReportRequest(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    supplier_id: Optional[int] = None
    include_conflicts: bool = True
    include_pending: bool = True
