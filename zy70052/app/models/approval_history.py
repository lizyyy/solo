from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, DateTime, Numeric, Boolean, Text,
    Index, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.database import Base


class ApprovalHistory(Base):
    __tablename__ = "approval_histories"
    __table_args__ = (
        Index("idx_application_id", "application_id"),
        Index("idx_approval_stage", "approval_stage"),
        Index("idx_operation_time", "operation_time"),
        Index("idx_operator_id", "operator_id"),
        {"comment": "审批历史表"},
    )

    id = Column(Integer, primary_key=True, autoincrement=True, comment="主键ID")
    
    application_id = Column(Integer, ForeignKey("extension_applications.id"), nullable=False, index=True, comment="申请ID")
    
    approval_stage = Column(String(16), nullable=False, index=True, comment="审批阶段")
    operation_type = Column(String(16), nullable=False, comment="操作类型")
    
    operation_time = Column(DateTime, default=datetime.utcnow, nullable=False, index=True, comment="操作时间")
    
    operator_id = Column(String(32), nullable=False, index=True, comment="操作人ID")
    operator_name = Column(String(64), nullable=False, comment="操作人姓名")
    
    operation_comment = Column(String(256), nullable=True, comment="操作意见")
    
    before_status = Column(String(16), nullable=False, comment="操作前状态")
    after_status = Column(String(16), nullable=False, comment="操作后状态")
    
    rule_check_result = Column(Text, nullable=True, comment="规则检查结果(JSON)")
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, comment="创建时间")
    
    application = relationship("ExtensionApplication", back_populates="approval_histories")


class RuleCheckSnapshot(Base):
    __tablename__ = "rule_check_snapshots"
    __table_args__ = (
        Index("idx_application_id", "application_id"),
        Index("idx_check_time", "check_time"),
        {"comment": "规则检查快照表"},
    )

    id = Column(Integer, primary_key=True, autoincrement=True, comment="主键ID")
    
    snapshot_no = Column(String(32), unique=True, nullable=False, index=True, comment="快照编号")
    application_id = Column(Integer, nullable=True, index=True, comment="申请ID")
    
    check_time = Column(DateTime, default=datetime.utcnow, nullable=False, index=True, comment="检查时间")
    
    overall_result = Column(String(16), nullable=False, comment="整体结果")
    
    loan_account_snapshot = Column(Text, nullable=True, comment="贷款账户快照(JSON)")
    repayment_plan_snapshot = Column(Text, nullable=True, comment="还款计划快照(JSON)")
    penalty_snapshot = Column(Text, nullable=True, comment="罚息快照(JSON)")
    limit_snapshot = Column(Text, nullable=True, comment="额度快照(JSON)")
    
    rule_results = Column(Text, nullable=False, comment="规则检查结果明细(JSON)")
    
    check_by_id = Column(String(32), nullable=True, comment="检查人ID")
    check_by_name = Column(String(64), nullable=True, comment="检查人姓名")
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, comment="创建时间")
