from datetime import datetime
from decimal import Decimal
from sqlalchemy import (
    Column, Integer, String, DateTime, Numeric, Boolean, Text,
    Index, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.database import Base


class RepaymentPlan(Base):
    __tablename__ = "repayment_plans"
    __table_args__ = (
        Index("idx_loan_account_id", "loan_account_id"),
        Index("idx_status", "status"),
        {"comment": "还款计划表"},
    )

    id = Column(Integer, primary_key=True, autoincrement=True, comment="主键ID")
    
    plan_no = Column(String(32), unique=True, nullable=False, index=True, comment="还款计划编号")
    loan_account_id = Column(Integer, ForeignKey("loan_accounts.id"), nullable=False, index=True, comment="贷款账户ID")
    
    version = Column(Integer, nullable=False, default=1, comment="计划版本")
    is_current = Column(Boolean, nullable=False, default=False, index=True, comment="是否当前计划")
    
    total_principal = Column(Numeric(18, 2), nullable=False, comment="计划总本金")
    total_interest = Column(Numeric(18, 2), nullable=False, comment="计划总利息")
    total_amount = Column(Numeric(18, 2), nullable=False, comment="计划总金额")
    
    start_date = Column(DateTime, nullable=False, comment="计划开始日期")
    end_date = Column(DateTime, nullable=False, comment="计划结束日期")
    
    source_type = Column(String(16), nullable=False, default="ORIGINAL", comment="计划来源")
    source_id = Column(Integer, nullable=True, comment="来源ID(关联展期申请等)")
    
    status = Column(String(16), nullable=False, default="ACTIVE", comment="计划状态")
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, comment="创建时间")
    created_by = Column(String(64), nullable=True, comment="创建人")
    
    loan_account = relationship("LoanAccount", back_populates="repayment_plans", foreign_keys=[loan_account_id])
    installments = relationship("RepaymentInstallment", back_populates="plan", cascade="all, delete-orphan")
    histories = relationship("RepaymentPlanHistory", back_populates="plan", cascade="all, delete-orphan")


class RepaymentInstallment(Base):
    __tablename__ = "repayment_installments"
    __table_args__ = (
        Index("idx_plan_id", "plan_id"),
        Index("idx_installment_no", "plan_id", "installment_no", unique=True),
        Index("idx_due_date", "due_date"),
        Index("idx_status", "status"),
        {"comment": "还款计划明细表"},
    )

    id = Column(Integer, primary_key=True, autoincrement=True, comment="主键ID")
    
    plan_id = Column(Integer, ForeignKey("repayment_plans.id"), nullable=False, index=True, comment="还款计划ID")
    installment_no = Column(Integer, nullable=False, comment="期次号")
    
    due_date = Column(DateTime, nullable=False, index=True, comment="到期日")
    principal = Column(Numeric(18, 2), nullable=False, comment="应还本金")
    interest = Column(Numeric(18, 2), nullable=False, comment="应还利息")
    amount = Column(Numeric(18, 2), nullable=False, comment="应还金额")
    
    paid_principal = Column(Numeric(18, 2), nullable=False, default=Decimal("0"), comment="已还本金")
    paid_interest = Column(Numeric(18, 2), nullable=False, default=Decimal("0"), comment="已还利息")
    paid_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0"), comment="已还金额")
    
    status = Column(String(16), nullable=False, default="PENDING", index=True, comment="还款状态")
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False, comment="更新时间")
    
    plan = relationship("RepaymentPlan", back_populates="installments")


class RepaymentPlanHistory(Base):
    __tablename__ = "repayment_plan_histories"
    __table_args__ = (
        Index("idx_plan_id", "plan_id"),
        Index("idx_change_type", "change_type"),
        {"comment": "还款计划变更历史表"},
    )

    id = Column(Integer, primary_key=True, autoincrement=True, comment="主键ID")
    
    plan_id = Column(Integer, ForeignKey("repayment_plans.id"), nullable=False, index=True, comment="还款计划ID")
    
    change_type = Column(String(32), nullable=False, index=True, comment="变更类型")
    change_reason = Column(String(256), nullable=False, comment="变更原因")
    
    before_data = Column(Text, nullable=True, comment="变更前数据(JSON)")
    after_data = Column(Text, nullable=True, comment="变更后数据(JSON)")
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, comment="创建时间")
    created_by = Column(String(64), nullable=True, comment="操作人")
    operation_source = Column(String(32), nullable=False, default="SYSTEM", comment="操作来源")
    related_application_id = Column(Integer, nullable=True, comment="关联申请ID")
    
    plan = relationship("RepaymentPlan", back_populates="histories")
