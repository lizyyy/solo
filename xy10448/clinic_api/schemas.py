from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum


class VisitStatus(str, Enum):
    CREATED = "created"
    CHARGED = "charged"
    REFUNDED = "refunded"
    PARTIAL_REFUNDED = "partial_refunded"


class RefundType(str, Enum):
    FULL = "full"
    PARTIAL = "partial"


class SupplyBase(BaseModel):
    name: str
    code: str
    unit: str
    stock: float = 0
    safety_stock: float = 0
    cost_price: float = 0


class SupplyCreate(SupplyBase):
    pass


class SupplyUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    unit: Optional[str] = None
    stock: Optional[float] = None
    safety_stock: Optional[float] = None
    cost_price: Optional[float] = None


class Supply(SupplyBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SupplyTemplateBase(BaseModel):
    treatment_item_id: int
    supply_id: int
    quantity: float
    description: Optional[str] = None


class SupplyTemplateCreate(SupplyTemplateBase):
    pass


class SupplyTemplateUpdate(BaseModel):
    quantity: Optional[float] = None
    description: Optional[str] = None


class SupplyTemplate(SupplyTemplateBase):
    id: int
    created_at: datetime
    supply: Optional[Supply] = None

    class Config:
        from_attributes = True


class TreatmentItemBase(BaseModel):
    name: str
    code: str
    price: float
    description: Optional[str] = None
    is_active: bool = True


class TreatmentItemCreate(TreatmentItemBase):
    pass


class TreatmentItemUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    price: Optional[float] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class TreatmentItem(TreatmentItemBase):
    id: int
    created_at: datetime
    updated_at: datetime
    supply_templates: List[SupplyTemplate] = []

    class Config:
        from_attributes = True


class PatientBase(BaseModel):
    name: str
    phone: str
    id_card: Optional[str] = None


class PatientCreate(PatientBase):
    pass


class PatientUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    id_card: Optional[str] = None


class Patient(PatientBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class VisitItemBase(BaseModel):
    treatment_item_id: int
    quantity: int = 1


class VisitItemCreate(VisitItemBase):
    pass


class VisitItem(VisitItemBase):
    id: int
    unit_price: float
    subtotal: float
    treatment_item: Optional[TreatmentItem] = None

    class Config:
        from_attributes = True


class ActualSupplyBase(BaseModel):
    supply_id: int
    actual_quantity: float


class ActualSupplyCreate(ActualSupplyBase):
    is_additional: bool = False


class ActualSupplyUpdate(BaseModel):
    actual_quantity: Optional[float] = None


class ActualSupply(ActualSupplyBase):
    id: int
    visit_id: int
    template_quantity: float
    unit_cost: float
    total_cost: float
    is_additional: bool
    created_at: datetime
    supply: Optional[Supply] = None

    class Config:
        from_attributes = True


class VisitBase(BaseModel):
    patient_id: int
    notes: Optional[str] = None


class VisitCreate(VisitBase):
    visit_items: List[VisitItemCreate]
    notes: Optional[str] = None


class VisitUpdate(BaseModel):
    notes: Optional[str] = None


class Visit(VisitBase):
    id: int
    visit_number: str
    visit_date: datetime
    status: VisitStatus
    total_amount: float
    supply_cost: float
    created_at: datetime
    updated_at: datetime
    visit_items: List[VisitItem] = []
    actual_supplies: List[ActualSupply] = []

    class Config:
        from_attributes = True


class ChargeBase(BaseModel):
    operator: Optional[str] = None
    notes: Optional[str] = None


class ChargeCreate(ChargeBase):
    pass


class Charge(ChargeBase):
    id: int
    visit_id: int
    charge_number: str
    amount: float
    charge_date: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class RefundItemCreate(BaseModel):
    actual_supply_id: Optional[int] = None
    supply_id: int
    quantity: float


class RefundCreate(BaseModel):
    charge_id: int
    refund_type: RefundType
    amount: float
    stock_rollback: bool = False
    operator: Optional[str] = None
    reason: Optional[str] = None
    refund_items: Optional[List[RefundItemCreate]] = None


class RefundItem(BaseModel):
    id: int
    refund_id: int
    actual_supply_id: Optional[int]
    supply_id: int
    quantity: float
    rollback_quantity: float
    unit_cost: float
    rollback_reason: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class Refund(BaseModel):
    id: int
    visit_id: int
    charge_id: int
    refund_number: str
    refund_type: RefundType
    amount: float
    stock_rollback: bool
    rollback_reason: Optional[str]
    refund_date: datetime
    operator: Optional[str]
    reason: Optional[str]
    created_at: datetime
    refund_items: List[RefundItem] = []

    class Config:
        from_attributes = True


class StatisticsResponse(BaseModel):
    total_income: float
    total_supply_cost: float
    net_profit: float
    low_stock_alerts: List[dict]
    abnormal_visits: List[dict]


class StockCheckResult(BaseModel):
    supply_id: int
    supply_name: str
    required: float
    available: float
    is_sufficient: bool
