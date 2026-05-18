from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from models import RegistrationStatus, PesticideCategory


class FarmerBase(BaseModel):
    id_card: str = Field(..., max_length=18, description="身份证号")
    name: str = Field(..., max_length=50, description="姓名")
    phone: Optional[str] = Field(None, max_length=20, description="电话")
    village: Optional[str] = Field(None, max_length=100, description="村")
    town: Optional[str] = Field(None, max_length=100, description="乡镇")
    county: Optional[str] = Field(None, max_length=100, description="区县")
    planting_area: Optional[float] = Field(None, description="种植面积(亩)")
    planting_crop: Optional[str] = Field(None, max_length=100, description="种植作物")


class FarmerCreate(FarmerBase):
    pass


class Farmer(FarmerBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class PesticideRegistrationBase(BaseModel):
    farmer_id: int
    store_name: str = Field(..., max_length=100, description="门店名称")
    store_address: Optional[str] = Field(None, max_length=200, description="门店地址")
    store_license_no: Optional[str] = Field(None, max_length=50, description="门店经营许可证号")
    pesticide_name: str = Field(..., max_length=100, description="农药名称")
    pesticide_category: PesticideCategory = Field(..., description="农药类别")
    pesticide_registration_no: Optional[str] = Field(None, max_length=50, description="农药登记证号")
    pesticide_manufacturer: Optional[str] = Field(None, max_length=100, description="生产厂家")
    specification: Optional[str] = Field(None, max_length=50, description="规格")
    quantity: float = Field(..., gt=0, description="购买数量")
    unit: str = Field("瓶", max_length=20, description="单位")
    unit_price: Optional[float] = Field(None, description="单价")
    total_amount: Optional[float] = Field(None, description="总金额")
    purchase_date: datetime = Field(..., description="购买日期")
    purpose: Optional[str] = Field(None, max_length=200, description="使用用途")
    crop_area: Optional[float] = Field(None, description="适用作物面积(亩)")


class PesticideRegistrationCreate(PesticideRegistrationBase):
    pass


class PesticideRegistrationUpdate(BaseModel):
    store_name: Optional[str] = None
    store_address: Optional[str] = None
    store_license_no: Optional[str] = None
    pesticide_name: Optional[str] = None
    pesticide_category: Optional[PesticideCategory] = None
    pesticide_registration_no: Optional[str] = None
    pesticide_manufacturer: Optional[str] = None
    specification: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    total_amount: Optional[float] = None
    purchase_date: Optional[datetime] = None
    purpose: Optional[str] = None
    crop_area: Optional[float] = None


class AuditRequest(BaseModel):
    auditor: str
    audit_opinion: Optional[str] = None


class ManualProcessRequest(BaseModel):
    manual_processor: str
    manual_remark: str


class PesticideRegistration(PesticideRegistrationBase):
    id: int
    registration_no: str
    status: RegistrationStatus
    auditor: Optional[str]
    audit_opinion: Optional[str]
    audit_time: Optional[datetime]
    manual_processor: Optional[str]
    manual_remark: Optional[str]
    manual_process_time: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]
    farmer: Farmer

    class Config:
        from_attributes = True


class RegistrationHistoryBase(BaseModel):
    registration_id: int
    version: int
    changed_by: Optional[str] = None
    change_type: str
    change_reason: Optional[str] = None
    store_name: Optional[str] = None
    pesticide_name: Optional[str] = None
    pesticide_category: Optional[PesticideCategory] = None
    quantity: Optional[float] = None
    purchase_date: Optional[datetime] = None
    status: Optional[RegistrationStatus] = None
    auditor: Optional[str] = None
    audit_opinion: Optional[str] = None
    manual_processor: Optional[str] = None
    manual_remark: Optional[str] = None
    snapshot_data: Optional[str] = None


class RegistrationHistory(RegistrationHistoryBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class PesticideRegistrationWithHistory(PesticideRegistration):
    history: List[RegistrationHistory]

    class Config:
        from_attributes = True


class PurchaseLimitRuleBase(BaseModel):
    pesticide_category: PesticideCategory
    max_quantity_per_month: float
    max_quantity_per_purchase: float


class PurchaseLimitRuleCreate(PurchaseLimitRuleBase):
    pass


class PurchaseLimitRule(PurchaseLimitRuleBase):
    id: int
    is_active: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True
