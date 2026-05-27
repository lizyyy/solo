from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(64), unique=True, index=True, nullable=False)
    batch_type = Column(String(32), nullable=False)
    file_name = Column(String(256), nullable=False)
    record_count = Column(Integer, default=0)
    operator = Column(String(64), default="system")
    remark = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    requisitions = relationship("RequisitionRecord", back_populates="batch")
    employees = relationship("Employee", back_populates="batch")
    coupons = relationship("Coupon", back_populates="batch")


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    emp_no = Column(String(32), index=True, nullable=False)
    name = Column(String(64), nullable=False)
    department = Column(String(128), nullable=True)
    status = Column(String(16), default="active", index=True)
    phone = Column(String(32), nullable=True)
    id_card = Column(String(64), nullable=True)
    remark = Column(Text, nullable=True)
    batch_id = Column(Integer, ForeignKey("import_batches.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    batch = relationship("ImportBatch", back_populates="employees")

    __table_args__ = (
        Index("ix_emp_no_batch", "emp_no", "batch_id", unique=True),
    )


class Coupon(Base):
    __tablename__ = "coupons"

    id = Column(Integer, primary_key=True, index=True)
    coupon_code = Column(String(64), unique=True, index=True, nullable=False)
    coupon_type = Column(String(32), nullable=False, index=True)
    face_value = Column(Float, default=0)
    status = Column(String(16), default="unused", index=True)
    batch_no = Column(String(64), nullable=True)
    issued_emp_no = Column(String(32), nullable=True)
    issued_name = Column(String(64), nullable=True)
    expire_date = Column(String(16), nullable=True)
    batch_id = Column(Integer, ForeignKey("import_batches.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    batch = relationship("ImportBatch", back_populates="coupons")


class RequisitionRecord(Base):
    __tablename__ = "requisition_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("import_batches.id"), nullable=False)
    emp_no = Column(String(32), index=True, nullable=False)
    emp_name = Column(String(64), nullable=False)
    department = Column(String(128), nullable=True)
    coupon_code = Column(String(64), nullable=True)
    coupon_type = Column(String(32), nullable=True)
    claim_type = Column(String(16), default="线下领取", index=True)
    claim_date = Column(String(16), nullable=True)
    claim_amount = Column(Float, default=0)
    proxy_emp_no = Column(String(32), nullable=True)
    proxy_name = Column(String(64), nullable=True)
    remark = Column(Text, nullable=True)
    raw_data = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    batch = relationship("ImportBatch", back_populates="requisitions")
    reconciliation = relationship("ReconciliationRecord", back_populates="requisition", uselist=False)


class ReconciliationRecord(Base):
    __tablename__ = "reconciliation_records"

    id = Column(Integer, primary_key=True, index=True)
    requisition_id = Column(Integer, ForeignKey("requisition_records.id"), unique=True, nullable=False)
    batch_no = Column(String(64), index=True, nullable=False)

    employee_match = Column(String(16), default="matched")
    employee_mismatch_reason = Column(Text, nullable=True)
    coupon_match = Column(String(16), default="matched")
    coupon_mismatch_reason = Column(Text, nullable=True)

    is_resigned = Column(Boolean, default=False)
    resigned_detail = Column(Text, nullable=True)

    is_duplicate = Column(Boolean, default=False)
    duplicate_with = Column(String(256), nullable=True)

    is_proxy = Column(Boolean, default=False)
    proxy_detail = Column(Text, nullable=True)

    anomaly_flags = Column(Text, nullable=True)

    review_status = Column(String(16), default="pending", index=True)
    review_operator = Column(String(64), nullable=True)
    review_comment = Column(Text, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)

    final_status = Column(String(16), default="pending", index=True)
    final_amount = Column(Float, default=0)
    final_remark = Column(Text, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    requisition = relationship("RequisitionRecord", back_populates="reconciliation")
    review_logs = relationship("ReviewLog", back_populates="reconciliation")
    report_items = relationship("ReportItem", back_populates="reconciliation")


class ReviewLog(Base):
    __tablename__ = "review_logs"

    id = Column(Integer, primary_key=True, index=True)
    reconciliation_id = Column(Integer, ForeignKey("reconciliation_records.id"), nullable=False)
    action = Column(String(32), nullable=False)
    old_status = Column(String(16), nullable=True)
    new_status = Column(String(16), nullable=False)
    comment = Column(Text, nullable=True)
    operator = Column(String(64), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    reconciliation = relationship("ReconciliationRecord", back_populates="review_logs")


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    report_no = Column(String(64), unique=True, index=True, nullable=False)
    title = Column(String(256), nullable=False)
    batch_nos = Column(Text, nullable=True)
    total_records = Column(Integer, default=0)
    approved_count = Column(Integer, default=0)
    rejected_count = Column(Integer, default=0)
    pending_count = Column(Integer, default=0)
    returned_count = Column(Integer, default=0)
    total_amount = Column(Float, default=0)
    approved_amount = Column(Float, default=0)
    rejected_amount = Column(Float, default=0)
    generated_by = Column(String(64), default="system")
    file_name = Column(String(256), nullable=True)
    status = Column(String(16), default="generated")
    created_at = Column(DateTime, server_default=func.now())

    items = relationship("ReportItem", back_populates="report")


class ReportItem(Base):
    __tablename__ = "report_items"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("reports.id"), nullable=False)
    reconciliation_id = Column(Integer, ForeignKey("reconciliation_records.id"), nullable=False)
    snapshot = Column(Text, nullable=True)

    report = relationship("Report", back_populates="items")
    reconciliation = relationship("ReconciliationRecord", back_populates="report_items")
