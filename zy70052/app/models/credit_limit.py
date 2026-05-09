from datetime import datetime
from decimal import Decimal
from sqlalchemy import (
    Column, Integer, String, DateTime, Numeric, Boolean, Text,
    Index, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.database import Base


class CreditLimitRecord(Base):
    __tablename__ = "credit_limit_records"
    __table_args__ = (
        Index("idx_customer_id", "customer_id"),
        Index("idx_loan_account_id", "loan_account_id"),
        Index("idx_operation_time", "operation_time"),
        Index("idx_operation_type", "operation_type"),
        {"comment": "额度变更记录表"},
    )

    id = Column(Integer, primary_key=True, autoincrement=True, comment="主键ID")
    
    record_no = Column(String(32), unique=True, nullable=False, index=True, comment="记录编号")
    customer_id = Column(String(32), nullable=False, index=True, comment="客户ID")
    loan_account_id = Column(Integer, ForeignKey("loan_accounts.id"), nullable=True, index=True, comment="贷款账户ID")
    
    operation_type = Column(String(16), nullable=False, index=True, comment="操作类型")
    operation_reason = Column(String(256), nullable=True, comment="操作原因")
    
    before_limit = Column(Numeric(18, 2), nullable=False, comment="变更前可用额度")
    before_used = Column(Numeric(18, 2), nullable=False, comment="变更前已用额度")
    
    after_limit = Column(Numeric(18, 2), nullable=False, comment="变更后可用额度")
    after_used = Column(Numeric(18, 2), nullable=False, comment="变更后已用额度")
    
    change_amount = Column(Numeric(18, 2), nullable=False, comment="变更金额")
    
    operation_time = Column(DateTime, default=datetime.utcnow, nullable=False, index=True, comment="操作时间")
    operator_id = Column(String(32), nullable=True, comment="操作人ID")
    operator_name = Column(String(64), nullable=True, comment="操作人姓名")
    
    related_application_id = Column(Integer, nullable=True, comment="关联申请ID")
    related_business_no = Column(String(32), nullable=True, comment="关联业务编号")
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, comment="创建时间")
    
    loan_account = relationship("LoanAccount", back_populates="credit_limit_records")
