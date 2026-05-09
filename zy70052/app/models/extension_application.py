from datetime import datetime
from decimal import Decimal
from sqlalchemy import (
    Column, Integer, String, DateTime, Numeric, Boolean, Text,
    Index, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.database import Base


class ExtensionApplication(Base):
    __tablename__ = "extension_applications"
    __table_args__ = (
        Index("idx_loan_account_id", "loan_account_id"),
        Index("idx_status", "status"),
        Index("idx_applicant_id", "applicant_id"),
        {"comment": "展期申请表"},
    )

    id = Column(Integer, primary_key=True, autoincrement=True, comment="主键ID")
    
    application_no = Column(String(32), unique=True, nullable=False, index=True, comment="申请编号")
    loan_account_id = Column(Integer, ForeignKey("loan_accounts.id"), nullable=False, index=True, comment="贷款账户ID")
    
    extension_months = Column(Integer, nullable=False, comment="展期月数")
    extension_reason = Column(String(256), nullable=True, comment="展期原因")
    extension_interest_rate = Column(Numeric(8, 6), nullable=True, comment="展期执行利率")
    
    requested_at = Column(DateTime, default=datetime.utcnow, nullable=False, comment="申请时间")
    applicant_id = Column(String(32), nullable=False, index=True, comment="申请人ID")
    applicant_name = Column(String(64), nullable=False, comment="申请人姓名")
    
    status = Column(String(16), nullable=False, default="PENDING", index=True, comment="申请状态")
    
    first_approver_id = Column(String(32), nullable=True, comment="初审人ID")
    first_approver_name = Column(String(64), nullable=True, comment="初审人姓名")
    first_approval_at = Column(DateTime, nullable=True, comment="初审时间")
    first_approval_comment = Column(String(256), nullable=True, comment="初审意见")
    
    final_approver_id = Column(String(32), nullable=True, comment="终审人ID")
    final_approver_name = Column(String(64), nullable=True, comment="终审人姓名")
    final_approval_at = Column(DateTime, nullable=True, comment="终审时间")
    final_approval_comment = Column(String(256), nullable=True, comment="终审意见")
    
    rejected_by_id = Column(String(32), nullable=True, comment="驳回人ID")
    rejected_by_name = Column(String(64), nullable=True, comment="驳回人姓名")
    rejected_at = Column(DateTime, nullable=True, comment="驳回时间")
    reject_reason = Column(String(256), nullable=True, comment="驳回原因")
    
    cancelled_by_id = Column(String(32), nullable=True, comment="撤销人ID")
    cancelled_by_name = Column(String(64), nullable=True, comment="撤销人姓名")
    cancelled_at = Column(DateTime, nullable=True, comment="撤销时间")
    
    executed_at = Column(DateTime, nullable=True, comment="执行时间")
    executed_status = Column(String(16), nullable=True, comment="执行状态")
    execution_error = Column(Text, nullable=True, comment="执行错误信息")
    
    new_repayment_plan_id = Column(Integer, ForeignKey("repayment_plans.id"), nullable=True, comment="新还款计划ID")
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False, comment="更新时间")
    
    rule_check_snapshot_id = Column(Integer, nullable=True, comment="规则检查快照ID")
    
    loan_account = relationship("LoanAccount", back_populates="extension_applications")
    approval_histories = relationship("ApprovalHistory", back_populates="application", cascade="all, delete-orphan")
