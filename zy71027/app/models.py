from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base
import enum

class DrugType(str, enum.Enum):
    NARCOTIC = "麻醉药品"
    PSYCHOTROPIC = "精神药品"
    TOXIC = "毒性药品"
    RADIOACTIVE = "放射性药品"

class HandoverStatus(str, enum.Enum):
    DRAFT = "草稿"
    SUBMITTED = "已提交"
    FIRST_SIGNED = "第一签"
    SECOND_SIGNED = "第二签"
    VERIFIED = "已核验"
    CONFLICT = "有冲突"
    REJECTED = "已驳回"
    WITHDRAWN = "已撤回"
    MANUAL_FIXED = "人工修正"
    COMPLETED = "已完成"

class PrescriptionStatus(str, enum.Enum):
    PENDING = "待核销"
    VERIFIED = "已核验"
    USED = "已核销"
    CANCELLED = "已作废"

class DiscrepancyType(str, enum.Enum):
    PRESCRIPTION_NOT_VERIFIED = "处方未核验"
    QUANTITY_MISMATCH = "数量倒挂"
    INVENTORY_SHORTAGE = "库存不足"
    DOUBLE_SIGN_ABNORMAL = "双签异常"
    BATCH_MISMATCH = "批号不符"
    TIME_ABNORMAL = "时间异常"

class Drug(Base):
    __tablename__ = "drugs"
    
    id = Column(Integer, primary_key=True, index=True)
    drug_code = Column(String(50), unique=True, index=True, nullable=False)
    drug_name = Column(String(100), nullable=False)
    drug_type = Column(String(50), nullable=False)
    specification = Column(String(100))
    manufacturer = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    batches = relationship("DrugBatch", back_populates="drug")
    prescriptions = relationship("Prescription", back_populates="drug")

class DrugBatch(Base):
    __tablename__ = "drug_batches"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(100), unique=True, index=True, nullable=False)
    drug_id = Column(Integer, ForeignKey("drugs.id"), nullable=False)
    production_date = Column(DateTime)
    expiry_date = Column(DateTime)
    initial_quantity = Column(Float, nullable=False)
    current_quantity = Column(Float, nullable=False)
    unit = Column(String(20), default="支")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    drug = relationship("Drug", back_populates="batches")
    inventory_records = relationship("InventoryRecord", back_populates="batch")
    handover_items = relationship("HandoverItem", back_populates="batch")

class Prescription(Base):
    __tablename__ = "prescriptions"
    
    id = Column(Integer, primary_key=True, index=True)
    prescription_no = Column(String(50), unique=True, index=True, nullable=False)
    drug_id = Column(Integer, ForeignKey("drugs.id"), nullable=False)
    batch_no = Column(String(100))
    patient_name = Column(String(50))
    quantity = Column(Float, nullable=False)
    unit = Column(String(20), default="支")
    doctor_name = Column(String(50))
    prescribed_at = Column(DateTime(timezone=True))
    status = Column(String(50), default=PrescriptionStatus.PENDING)
    verified_by = Column(String(50))
    verified_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    drug = relationship("Drug", back_populates="prescriptions")
    handover_items = relationship("HandoverItem", back_populates="prescription")

class InventoryRecord(Base):
    __tablename__ = "inventory_records"
    
    id = Column(Integer, primary_key=True, index=True)
    record_no = Column(String(50), unique=True, index=True, nullable=False)
    batch_id = Column(Integer, ForeignKey("drug_batches.id"), nullable=False)
    change_type = Column(String(50), nullable=False)
    change_quantity = Column(Float, nullable=False)
    balance_quantity = Column(Float, nullable=False)
    operator = Column(String(50))
    remark = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    batch = relationship("DrugBatch", back_populates="inventory_records")

class HandoverRecord(Base):
    __tablename__ = "handover_records"
    
    id = Column(Integer, primary_key=True, index=True)
    handover_no = Column(String(50), unique=True, index=True, nullable=False)
    shift_type = Column(String(50), nullable=False)
    from_nurse = Column(String(50), nullable=False)
    to_nurse = Column(String(50), nullable=False)
    handover_time = Column(DateTime(timezone=True))
    status = Column(String(50), default=HandoverStatus.DRAFT)
    first_signature = Column(String(50))
    first_signed_at = Column(DateTime(timezone=True))
    first_sign_remark = Column(String(200))
    second_signature = Column(String(50))
    second_signed_at = Column(DateTime(timezone=True))
    second_sign_remark = Column(String(200))
    is_late_sign = Column(Boolean, default=False)
    sign_time_abnormal = Column(Boolean, default=False)
    reviewer = Column(String(50))
    reviewed_at = Column(DateTime(timezone=True))
    reject_reason = Column(Text)
    previous_handover_id = Column(Integer, ForeignKey("handover_records.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    items = relationship("HandoverItem", back_populates="handover")
    discrepancies = relationship("DiscrepancyReport", back_populates="handover")
    previous_handover = relationship("HandoverRecord", remote_side=[id])

class HandoverItem(Base):
    __tablename__ = "handover_items"
    
    id = Column(Integer, primary_key=True, index=True)
    handover_id = Column(Integer, ForeignKey("handover_records.id"), nullable=False)
    drug_id = Column(Integer, ForeignKey("drugs.id"))
    batch_id = Column(Integer, ForeignKey("drug_batches.id"))
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"))
    drug_name = Column(String(100), nullable=False)
    batch_no = Column(String(100), nullable=False)
    prescription_no = Column(String(50))
    prescription_quantity = Column(Float, default=0)
    inventory_quantity = Column(Float, default=0)
    handover_quantity = Column(Float, nullable=False)
    unit = Column(String(20), default="支")
    is_consistent = Column(Boolean, default=True)
    remark = Column(Text)
    
    handover = relationship("HandoverRecord", back_populates="items")
    batch = relationship("DrugBatch", back_populates="handover_items")
    prescription = relationship("Prescription", back_populates="handover_items")

class DiscrepancyReport(Base):
    __tablename__ = "discrepancy_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    report_no = Column(String(50), unique=True, index=True, nullable=False)
    handover_id = Column(Integer, ForeignKey("handover_records.id"), nullable=False)
    discrepancy_type = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    prescription_quantity = Column(Float)
    inventory_quantity = Column(Float)
    handover_quantity = Column(Float)
    difference = Column(Float)
    status = Column(String(50), default="待处理")
    handled_by = Column(String(50))
    handled_at = Column(DateTime(timezone=True))
    handle_result = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    handover = relationship("HandoverRecord", back_populates="discrepancies")

class OperationLog(Base):
    __tablename__ = "operation_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    handover_id = Column(Integer, ForeignKey("handover_records.id"))
    operation = Column(String(100), nullable=False)
    operator = Column(String(50))
    remark = Column(Text)
    previous_status = Column(String(50))
    new_status = Column(String(50))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
