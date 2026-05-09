from datetime import datetime
from decimal import Decimal
from sqlalchemy import (
    Column, Integer, String, DateTime, Numeric, Boolean, Text,
    Index, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.database import Base


class PenaltySnapshot(Base):
    __tablename__ = "penalty_snapshots"
    __table_args__ = (
        Index("idx_loan_account_id", "loan_account_id"),
        Index("idx_extension_application_id", "extension_application_id"),
        Index("idx_snapshot_time", "snapshot_time"),
        {"comment": "罚息快照表"},
    )

    id = Column(Integer, primary_key=True, autoincrement=True, comment="主键ID")
    
    snapshot_no = Column(String(32), unique=True, nullable=False, index=True, comment="快照编号")
    loan_account_id = Column(Integer, ForeignKey("loan_accounts.id"), nullable=False, index=True, comment="贷款账户ID")
    extension_application_id = Column(Integer, ForeignKey("extension_applications.id"), nullable=True, index=True, comment="关联展期申请ID")
    
    snapshot_time = Column(DateTime, default=datetime.utcnow, nullable=False, index=True, comment="快照时间")
    snapshot_reason = Column(String(64), nullable=False, comment="快照原因")
    
    overdue_principal = Column(Numeric(18, 2), nullable=False, default=Decimal("0"), comment="逾期本金")
    overdue_interest = Column(Numeric(18, 2), nullable=False, default=Decimal("0"), comment="逾期利息")
    overdue_days = Column(Integer, nullable=False, default=0, comment="逾期天数")
    
    penalty_amount = Column(Numeric(18, 2), nullable=False, default=Decimal("0"), comment="罚息金额")
    penalty_rate = Column(Numeric(8, 6), nullable=False, comment="罚息利率(日)")
    
    penalty_details = Column(Text, nullable=True, comment="罚息明细(JSON)")
    
    settled = Column(Boolean, nullable=False, default=False, comment="是否已结清")
    settled_at = Column(DateTime, nullable=True, comment="结清时间")
    settlement_amount = Column(Numeric(18, 2), nullable=True, comment="结清金额")
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, comment="创建时间")
    created_by = Column(String(64), nullable=True, comment="创建人")
    
    loan_account = relationship("LoanAccount", back_populates="penalty_snapshots")
