from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Text, Boolean, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class Bill(Base):
    __tablename__ = "bills"

    id = Column(Integer, primary_key=True, index=True)
    bill_no = Column(String(100), index=True, comment="票据号")
    bill_type = Column(String(50), index=True, comment="票据类型：invoice/statement/settlement")
    amount = Column(Float, comment="金额")
    fee_amount = Column(Float, default=0.0, comment="手续费")
    bill_date = Column(Date, index=True, comment="票据日期")
    due_date = Column(Date, index=True, comment="到期日期")
    payer = Column(String(200), comment="付款方")
    payee = Column(String(200), comment="收款方")
    serial_no = Column(String(100), index=True, comment="流水号")
    bank_account = Column(String(100), comment="银行账号")
    status = Column(String(50), default="pending", index=True, comment="状态")
    anomaly_type = Column(String(50), nullable=True, index=True, comment="异常类型")
    anomaly_reason = Column(Text, nullable=True, comment="异常原因说明")
    source_file = Column(String(200), comment="来源文件名")
    source_type = Column(String(50), comment="来源类型：invoice/statement")
    related_statement_id = Column(Integer, nullable=True, comment="关联对账单ID")
    related_invoice_id = Column(Integer, nullable=True, comment="关联票据ID")
    remark = Column(Text, nullable=True, comment="备注")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    created_by = Column(String(50), default="system")

    review_records = relationship("ReviewRecord", back_populates="bill", cascade="all, delete-orphan")
    history_records = relationship("HistoryRecord", back_populates="bill", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_serial_bill", "serial_no", "bill_no", unique=False),
        Index("idx_due_status", "due_date", "status"),
    )


class ReviewRecord(Base):
    __tablename__ = "review_records"

    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("bills.id"), index=True)
    review_action = Column(String(50), comment="复核操作：confirm/reject/mark_pending")
    review_result = Column(String(50), comment="复核结果")
    review_reason = Column(Text, comment="复核原因")
    review_evidence = Column(Text, comment="复核依据（文件名/链接）")
    reviewed_by = Column(String(50), default="operator")
    reviewed_at = Column(DateTime, default=datetime.now)
    previous_status = Column(String(50), comment="变更前状态")
    new_status = Column(String(50), comment="变更后状态")

    bill = relationship("Bill", back_populates="review_records")


class HistoryRecord(Base):
    __tablename__ = "history_records"

    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("bills.id"), index=True)
    operation_type = Column(String(50), comment="操作类型：import/revise/confirm/export")
    field_name = Column(String(100), nullable=True, comment="修改字段")
    old_value = Column(Text, nullable=True, comment="旧值")
    new_value = Column(Text, nullable=True, comment="新值")
    operator = Column(String(50), default="operator")
    operated_at = Column(DateTime, default=datetime.now)
    remark = Column(Text, nullable=True, comment="操作说明")

    bill = relationship("Bill", back_populates="history_records")


class UploadFile(Base):
    __tablename__ = "upload_files"

    id = Column(Integer, primary_key=True, index=True)
    file_name = Column(String(200), comment="文件名")
    file_path = Column(String(500), comment="文件路径")
    file_type = Column(String(50), comment="文件类型：invoice/statement/settlement")
    upload_time = Column(DateTime, default=datetime.now)
    upload_by = Column(String(50), default="operator")
    record_count = Column(Integer, default=0, comment="记录数")
    processed = Column(Boolean, default=False, comment="是否已处理")
    processed_at = Column(DateTime, nullable=True)
    remark = Column(Text, nullable=True)
