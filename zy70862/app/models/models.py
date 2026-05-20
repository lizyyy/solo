from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class MaterialRequisition(Base):
    __tablename__ = "material_requisitions"

    id = Column(Integer, primary_key=True, index=True)
    requisition_no = Column(String, unique=True, index=True)
    repair_team = Column(String, index=True)
    vehicle_no = Column(String, index=True)
    requisition_date = Column(DateTime)
    material_code = Column(String, index=True)
    material_name = Column(String)
    specification = Column(String)
    quantity = Column(Float)
    unit = Column(String)
    batch_no = Column(String, index=True)
    is_emergency = Column(Boolean, default=False)
    operator = Column(String)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    review_records = relationship("ReviewRecord", back_populates="requisition")
    batch_traces = relationship("BatchTrace", back_populates="requisition")


class VehicleMaterial(Base):
    __tablename__ = "vehicle_materials"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_no = Column(String, index=True)
    check_date = Column(DateTime)
    material_code = Column(String, index=True)
    material_name = Column(String)
    specification = Column(String)
    start_quantity = Column(Float)
    end_quantity = Column(Float)
    used_quantity = Column(Float)
    unit = Column(String)
    batch_no = Column(String, index=True)
    checker = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class Inventory(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True)
    material_code = Column(String, unique=True, index=True)
    material_name = Column(String)
    specification = Column(String)
    quantity = Column(Float)
    unit = Column(String)
    warehouse = Column(String, index=True)
    batch_no = Column(String, index=True)
    safety_stock = Column(Float)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class BatchTrace(Base):
    __tablename__ = "batch_traces"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String, index=True)
    material_code = Column(String, index=True)
    material_name = Column(String)
    source_type = Column(String)
    source_id = Column(Integer)
    source_no = Column(String)
    action_type = Column(String)
    quantity = Column(Float)
    operator = Column(String)
    operation_date = Column(DateTime)
    remark = Column(Text)
    requisition_id = Column(Integer, ForeignKey("material_requisitions.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    requisition = relationship("MaterialRequisition", back_populates="batch_traces")


class ReviewRecord(Base):
    __tablename__ = "review_records"

    id = Column(Integer, primary_key=True, index=True)
    requisition_id = Column(Integer, ForeignKey("material_requisitions.id"))
    reviewer = Column(String)
    review_date = Column(DateTime, default=datetime.utcnow)
    review_status = Column(String)
    review_remark = Column(Text)
    previous_status = Column(String)
    diff_explanation = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    requisition = relationship("MaterialRequisition", back_populates="review_records")


class ReconciliationDiff(Base):
    __tablename__ = "reconciliation_diffs"

    id = Column(Integer, primary_key=True, index=True)
    diff_no = Column(String, unique=True, index=True)
    diff_type = Column(String, index=True)
    requisition_id = Column(Integer, ForeignKey("material_requisitions.id"))
    material_code = Column(String, index=True)
    material_name = Column(String)
    requisition_quantity = Column(Float)
    vehicle_quantity = Column(Float)
    inventory_quantity = Column(Float)
    diff_quantity = Column(Float)
    explanation = Column(Text)
    status = Column(String, default="pending")
    is_approved = Column(Boolean, default=False)
    approver = Column(String)
    approval_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ReconciliationSummary(Base):
    __tablename__ = "reconciliation_summaries"

    id = Column(Integer, primary_key=True, index=True)
    summary_date = Column(DateTime, unique=True)
    total_requisitions = Column(Integer, default=0)
    emergency_requisitions = Column(Integer, default=0)
    total_diffs = Column(Integer, default=0)
    resolved_diffs = Column(Integer, default=0)
    pending_diffs = Column(Integer, default=0)
    negative_inventory_count = Column(Integer, default=0)
    return_diff_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
