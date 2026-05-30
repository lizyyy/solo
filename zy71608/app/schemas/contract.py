from datetime import datetime, date
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict


class ContractBase(BaseModel):
    contract_no: str = Field(..., max_length=50, description="合同编号")
    version: int = Field(default=1, ge=1, description="合同版本")
    tenant_name: str = Field(..., max_length=100, description="租户名称")
    tenant_id: Optional[str] = Field(default=None, max_length=50)
    store_code: Optional[str] = Field(default=None, max_length=50)
    store_name: Optional[str] = Field(default=None, max_length=100)
    floor: Optional[str] = Field(default=None, max_length=20)
    area: Optional[Decimal] = Field(default=None, max_digits=10, decimal_places=2)
    start_date: date = Field(..., description="合同起始日期")
    end_date: date = Field(..., description="合同结束日期")
    monthly_rent: Decimal = Field(..., max_digits=15, decimal_places=2, description="月租金标准")
    monthly_service_fee: Decimal = Field(default=Decimal("0"), max_digits=15, decimal_places=2)
    deposit_amount: Decimal = Field(default=Decimal("0"), max_digits=15, decimal_places=2)
    payment_cycle: str = Field(default="月付", max_length=20)
    status: str = Field(default="生效中", max_length=20)
    original_contract_id: Optional[int] = None
    remarks: Optional[str] = None


class ContractCreate(ContractBase):
    pass


class ContractUpdate(BaseModel):
    version: Optional[int] = None
    tenant_name: Optional[str] = None
    tenant_id: Optional[str] = None
    store_code: Optional[str] = None
    store_name: Optional[str] = None
    floor: Optional[str] = None
    area: Optional[Decimal] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    monthly_rent: Optional[Decimal] = None
    monthly_service_fee: Optional[Decimal] = None
    deposit_amount: Optional[Decimal] = None
    payment_cycle: Optional[str] = None
    status: Optional[str] = None
    remarks: Optional[str] = None


class ContractInfo(ContractBase):
    id: int
    created_at: datetime
    updated_at: datetime
    created_by: str
    updated_by: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class RentPlanBase(BaseModel):
    contract_id: int = Field(...)
    period_start: date = Field(...)
    period_end: date = Field(...)
    base_rent: Decimal = Field(..., max_digits=15, decimal_places=2)
    service_fee: Decimal = Field(default=Decimal("0"), max_digits=15, decimal_places=2)
    promotion_fee: Decimal = Field(default=Decimal("0"), max_digits=15, decimal_places=2)
    other_fees: Decimal = Field(default=Decimal("0"), max_digits=15, decimal_places=2)
    total_amount: Decimal = Field(..., max_digits=15, decimal_places=2)
    due_date: Optional[date] = None
    payment_status: str = Field(default="未支付", max_length=20)
    remarks: Optional[str] = None


class RentPlanCreate(RentPlanBase):
    pass


class RentPlanUpdate(BaseModel):
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    base_rent: Optional[Decimal] = None
    service_fee: Optional[Decimal] = None
    promotion_fee: Optional[Decimal] = None
    other_fees: Optional[Decimal] = None
    total_amount: Optional[Decimal] = None
    due_date: Optional[date] = None
    payment_status: Optional[str] = None
    remarks: Optional[str] = None


class RentPlanInfo(RentPlanBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
