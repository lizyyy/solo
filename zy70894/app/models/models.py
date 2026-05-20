from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class RepairRecord(Base):
    __tablename__ = "repair_records"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(String, unique=True, index=True)
    work_order_no = Column(String, index=True)
    product_sn = Column(String, index=True)
    repair_date = Column(DateTime)
    defect_code = Column(String)
    defect_description = Column(Text)
    repair_station = Column(String)
    repair_result = Column(String)
    material_batch_no = Column(String, index=True)
    operator = Column(String)
    remarks = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    source_file = Column(String)

    work_order = relationship("WorkOrder", back_populates="repair_records")
    review_records = relationship("ReviewRecord", back_populates="repair_record")
    comparison_results = relationship("ComparisonResult", back_populates="repair_record")


class WorkOrder(Base):
    __tablename__ = "work_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String, unique=True, index=True)
    product_model = Column(String)
    planned_qty = Column(Integer)
    actual_qty = Column(Integer)
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    production_line = Column(String)
    status = Column(String)
    material_batch_no = Column(String, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    source_file = Column(String)

    repair_records = relationship("RepairRecord", back_populates="work_order")


class MaterialBatch(Base):
    __tablename__ = "material_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String, unique=True, index=True)
    material_code = Column(String)
    material_name = Column(String)
    supplier = Column(String)
    production_date = Column(DateTime)
    received_date = Column(DateTime)
    total_qty = Column(Integer)
    used_qty = Column(Integer, default=0)
    defect_qty = Column(Integer, default=0)
    storage_location = Column(String)
    quality_status = Column(String)
    remarks = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    trace_logs = relationship("MaterialTraceLog", back_populates="material_batch")


class MaterialTraceLog(Base):
    __tablename__ = "material_trace_logs"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String, ForeignKey("material_batches.batch_no"))
    work_order_no = Column(String, index=True)
    product_sn = Column(String, index=True)
    station = Column(String)
    operator = Column(String)
    operation_time = Column(DateTime)
    operation_type = Column(String)
    remarks = Column(Text)

    material_batch = relationship("MaterialBatch", back_populates="trace_logs")


class ComparisonResult(Base):
    __tablename__ = "comparison_results"

    id = Column(Integer, primary_key=True, index=True)
    comparison_batch_id = Column(String, index=True)
    repair_record_id = Column(Integer, ForeignKey("repair_records.id"))
    work_order_no = Column(String, index=True)
    product_sn = Column(String, index=True)
    match_status = Column(String)
    discrepancy_type = Column(String)
    discrepancy_details = Column(Text)
    responsible_station = Column(String)
    confidence_score = Column(Float)
    is_resolved = Column(Boolean, default=False)
    resolution_notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    repair_record = relationship("RepairRecord", back_populates="comparison_results")
    review_records = relationship("ReviewRecord", back_populates="comparison_result")


class ReviewRecord(Base):
    __tablename__ = "review_records"

    id = Column(Integer, primary_key=True, index=True)
    comparison_result_id = Column(Integer, ForeignKey("comparison_results.id"))
    repair_record_id = Column(Integer, ForeignKey("repair_records.id"))
    reviewer = Column(String)
    review_date = Column(DateTime(timezone=True), server_default=func.now())
    review_decision = Column(String)
    review_notes = Column(Text)
    old_status = Column(String)
    new_status = Column(String)
    old_discrepancy = Column(Text)
    new_discrepancy = Column(Text)
    is_overridden = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    comparison_result = relationship("ComparisonResult", back_populates="review_records")
    repair_record = relationship("RepairRecord", back_populates="review_records")


class ComparisonSummary(Base):
    __tablename__ = "comparison_summaries"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String, unique=True, index=True)
    total_records = Column(Integer, default=0)
    matched_records = Column(Integer, default=0)
    discrepancy_records = Column(Integer, default=0)
    pending_review = Column(Integer, default=0)
    resolved_records = Column(Integer, default=0)
    material_batch_issues = Column(Integer, default=0)
    station_issues = Column(Integer, default=0)
    repair_loop_issues = Column(Integer, default=0)
    multi_defect_issues = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
