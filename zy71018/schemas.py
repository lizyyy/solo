from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional, List


class BatteryTypeBase(BaseModel):
    code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    un_code: Optional[str] = Field(None, max_length=20)
    packing_group: Optional[str] = Field(None, max_length=10)
    is_lithium: bool = True
    watt_hour: Optional[str] = Field(None, max_length=50)
    weight_per_unit: Optional[str] = Field(None, max_length=50)


class BatteryTypeCreate(BatteryTypeBase):
    pass


class BatteryType(BatteryTypeBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CarrierBase(BaseModel):
    code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=100)
    contact_info: Optional[str] = None


class CarrierCreate(CarrierBase):
    pass


class Carrier(CarrierBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CarrierRuleBase(BaseModel):
    carrier_id: int
    rule_code: str = Field(..., max_length=50)
    rule_name: str = Field(..., max_length=200)
    description: Optional[str] = None
    allowed_battery_types: Optional[str] = Field(None, max_length=500)
    max_watt_hour: Optional[str] = Field(None, max_length=50)
    max_weight: Optional[str] = Field(None, max_length=50)
    packaging_requirements: Optional[str] = None
    effective_date: date
    expiry_date: Optional[date] = None


class CarrierRuleCreate(CarrierRuleBase):
    pass


class CarrierRule(CarrierRuleBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProductBase(BaseModel):
    sku: str = Field(..., max_length=100)
    name: str = Field(..., max_length=200)
    description: Optional[str] = None
    battery_type_code: Optional[str] = Field(None, max_length=50)
    battery_quantity: Optional[int] = None
    weight: Optional[str] = Field(None, max_length=50)
    origin_country: Optional[str] = Field(None, max_length=50)
    hs_code: Optional[str] = Field(None, max_length=50)


class ProductCreate(ProductBase):
    pass


class Product(ProductBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DeclarationItemBase(BaseModel):
    product_id: int
    quantity: int
    unit_price: Optional[str] = Field(None, max_length=50)
    battery_info_override: Optional[str] = None


class DeclarationItemCreate(DeclarationItemBase):
    pass


class DeclarationItem(DeclarationItemBase):
    id: int
    declaration_id: int
    product: Product
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DeclarationBase(BaseModel):
    business_no: str = Field(..., max_length=100)
    warehouse_code: Optional[str] = Field(None, max_length=50)
    carrier_id: Optional[int] = None
    battery_type_id: Optional[int] = None
    destination_country: Optional[str] = Field(None, max_length=50)
    total_weight: Optional[str] = Field(None, max_length=50)
    total_battery_count: Optional[int] = None
    applicant: Optional[str] = Field(None, max_length=100)
    remarks: Optional[str] = None


class DeclarationCreate(DeclarationBase):
    items: List[DeclarationItemCreate] = []


class Declaration(DeclarationBase):
    id: int
    declaration_no: Optional[str] = Field(None, max_length=100)
    status: str
    reviewer: Optional[str] = None
    review_time: Optional[datetime] = None
    processor: Optional[str] = None
    process_time: Optional[datetime] = None
    closer: Optional[str] = None
    close_time: Optional[datetime] = None
    items: List[DeclarationItem] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DeclarationUpdate(BaseModel):
    warehouse_code: Optional[str] = None
    carrier_id: Optional[int] = None
    battery_type_id: Optional[int] = None
    destination_country: Optional[str] = None
    total_weight: Optional[str] = None
    total_battery_count: Optional[int] = None
    remarks: Optional[str] = None


class ReturnReceiptBase(BaseModel):
    declaration_id: int
    receipt_no: str = Field(..., max_length=100)
    return_date: Optional[datetime] = None
    return_reason: str = Field(..., max_length=200)
    return_reason_code: Optional[str] = Field(None, max_length=50)
    detailed_reason: Optional[str] = None


class ReturnReceiptCreate(ReturnReceiptBase):
    pass


class ReturnReceipt(ReturnReceiptBase):
    id: int
    attributed_to: Optional[str] = None
    attribution_notes: Optional[str] = None
    is_resolved: bool
    resolved_by: Optional[str] = None
    resolved_time: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReturnReceiptAttribute(BaseModel):
    attributed_to: str = Field(..., max_length=100)
    attribution_notes: Optional[str] = None


class AuditTrailBase(BaseModel):
    declaration_id: int
    action: str = Field(..., max_length=50)
    from_status: Optional[str] = Field(None, max_length=50)
    to_status: Optional[str] = Field(None, max_length=50)
    operator: Optional[str] = Field(None, max_length=100)
    reason: Optional[str] = Field(None, max_length=500)
    details: Optional[str] = None
    ip_address: Optional[str] = Field(None, max_length=50)


class AuditTrailCreate(AuditTrailBase):
    pass


class AuditTrail(AuditTrailBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class DeclarationReportBase(BaseModel):
    declaration_id: int
    report_type: str = Field(..., max_length=50)
    report_content: str
    generated_by: Optional[str] = Field(None, max_length=100)


class DeclarationReportCreate(DeclarationReportBase):
    pass


class DeclarationReport(DeclarationReportBase):
    id: int
    generated_at: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ErrorResponse(BaseModel):
    error_code: str
    error_type: str
    message: str
    details: Optional[dict] = None


class DeclarationReviewRequest(BaseModel):
    reviewer: str
    review_notes: Optional[str] = None


class DeclarationProcessRequest(BaseModel):
    processor: str
    process_notes: Optional[str] = None


class DeclarationReopenRequest(BaseModel):
    operator: str
    reason: str


class DeclarationCloseRequest(BaseModel):
    closer: str
    close_notes: Optional[str] = None


class IdempotentResponse(BaseModel):
    is_duplicate: bool
    existing_declaration: Optional[Declaration] = None
    message: str
