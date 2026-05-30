from sqlalchemy import Column, Integer, String, Date, Numeric, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import BaseModel
from app.models.enums import ContractStatus


class Contract(Base, BaseModel):
    __tablename__ = "contracts"

    contract_no = Column(String(50), index=True, nullable=False)
    version = Column(Integer, default=1, nullable=False)
    tenant_name = Column(String(100), index=True, nullable=False)
    tenant_id = Column(String(50), index=True)
    store_code = Column(String(50), index=True)
    store_name = Column(String(100))
    floor = Column(String(20))
    area = Column(Numeric(10, 2))
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    monthly_rent = Column(Numeric(15, 2), nullable=False)
    monthly_service_fee = Column(Numeric(15, 2), default=0)
    deposit_amount = Column(Numeric(15, 2), default=0)
    payment_cycle = Column(String(20), default="月付")
    status = Column(String(20), default=ContractStatus.ACTIVE.value)
    original_contract_id = Column(Integer, ForeignKey("contracts.id"))
    remarks = Column(Text)

    rent_plans = relationship("RentPlan", back_populates="contract")
    reductions = relationship("ReductionApplication", back_populates="contract")
    supplementary_agreements = relationship("SupplementaryAgreement", back_populates="contract")


class RentPlan(Base, BaseModel):
    __tablename__ = "rent_plans"

    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=False)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    base_rent = Column(Numeric(15, 2), nullable=False)
    service_fee = Column(Numeric(15, 2), default=0)
    promotion_fee = Column(Numeric(15, 2), default=0)
    other_fees = Column(Numeric(15, 2), default=0)
    total_amount = Column(Numeric(15, 2), nullable=False)
    due_date = Column(Date)
    payment_status = Column(String(20), default="未支付")
    remarks = Column(Text)

    contract = relationship("Contract", back_populates="rent_plans")
