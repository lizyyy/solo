from datetime import datetime
from decimal import Decimal
from sqlalchemy import (
    Column, Integer, String, DateTime, Numeric, Boolean, Text,
    Index, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.database import Base


class LoanAccount(Base):
    __tablename__ = "loan_accounts"
    __table_args__ = (
        Index("idx_customer_id", "customer_id"),
        Index("idx_account_status", "status"),
        {"comment": "贷款账户表"},
    )

    id = Column(Integer, primary_key=True, autoincrement=True, comment="主键ID")
    
    account_no = Column(String(32), unique=True, nullable=False, index=True, comment="贷款账号")
    customer_id = Column(String(32), nullable=False, index=True, comment="客户ID")
    customer_name = Column(String(64), nullable=False, comment="客户姓名")
    
    loan_amount = Column(Numeric(18, 2), nullable=False, comment="贷款本金")
    remaining_principal = Column(Numeric(18, 2), nullable=False, default=Decimal("0"), comment="剩余本金")
    total_interest = Column(Numeric(18, 2), nullable=False, default=Decimal("0"), comment="总利息")
    paid_interest = Column(Numeric(18, 2), nullable=False, default=Decimal("0"), comment="已还利息")
    
    annual_interest_rate = Column(Numeric(8, 6), nullable=False, comment="年利率")
    extension_interest_rate = Column(Numeric(8, 6), nullable=True, comment="展期年利率")
    
    loan_term = Column(Integer, nullable=False, comment="贷款期限(月)")
    original_maturity_date = Column(DateTime, nullable=False, comment="原到期日")
    current_maturity_date = Column(DateTime, nullable=False, comment="当前到期日")
    
    credit_limit_used = Column(Numeric(18, 2), nullable=False, default=Decimal("0"), comment="占用额度")
    
    status = Column(String(16), nullable=False, default="ACTIVE", index=True, comment="账户状态")
    
    extension_count = Column(Integer, nullable=False, default=0, comment="已展期次数")
    max_extension_count = Column(Integer, nullable=False, default=2, comment="最大展期次数")
    max_extension_months = Column(Integer, nullable=False, default=6, comment="单次最大展期月数")
    
    current_repayment_plan_id = Column(Integer, ForeignKey("repayment_plans.id"), nullable=True, comment="当前还款计划ID")
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False, comment="更新时间")
    version = Column(Integer, nullable=False, default=0, comment="版本号(乐观锁)")
    
    repayment_plans = relationship("RepaymentPlan", back_populates="loan_account", foreign_keys="RepaymentPlan.loan_account_id")
    extension_applications = relationship("ExtensionApplication", back_populates="loan_account")
    credit_limit_records = relationship("CreditLimitRecord", back_populates="loan_account")
    penalty_snapshots = relationship("PenaltySnapshot", back_populates="loan_account")
