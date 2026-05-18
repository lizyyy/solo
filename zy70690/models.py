from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

Base = declarative_base()

class ParticipantType(str, enum.Enum):
    EXHIBITOR = "参展商"
    CONSTRUCTOR = "搭建商"
    MEDIA = "媒体"

class IDCardType(str, enum.Enum):
    EXHIBITOR_PASS = "参展商证"
    CONSTRUCTOR_PASS = "搭建商证"
    MEDIA_PASS = "记者证"
    WORKER_PASS = "工作人员证"
    VIP_PASS = "VIP证"

class MaterialStatus(str, enum.Enum):
    DRAFT = "草稿"
    SUBMITTED = "已提交"
    UNDER_REVIEW = "审核中"
    RETURNED = "已退回"
    RESUBMITTED = "重新提交"
    APPROVED = "已通过"
    REJECTED = "已拒绝"
    NEEDS_MANUAL_REVIEW = "需要人工复核"
    PROCESSED = "已制证"

class ReturnReasonCategory(str, enum.Enum):
    MISSING_INFO = "信息缺失"
    INVALID_PHOTO = "照片无效"
    ID_CARD_ERROR = "证件错误"
    FORMAT_ERROR = "格式错误"
    DUPLICATE = "重复提交"
    OTHER = "其他"

class ReportStatus(str, enum.Enum):
    PENDING = "待生成"
    GENERATING = "生成中"
    COMPLETED = "已完成"
    FAILED = "生成失败"

class Participant(Base):
    __tablename__ = "participants"
    
    id = Column(Integer, primary_key=True, index=True)
    participant_code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(200), nullable=False)
    type = Column(Enum(ParticipantType), nullable=False, index=True)
    contact_person = Column(String(100))
    contact_phone = Column(String(50))
    email = Column(String(200))
    booth_number = Column(String(50))
    company_name = Column(String(200))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    materials = relationship("PersonMaterial", back_populates="participant")

class IDCardRule(Base):
    __tablename__ = "id_card_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    card_type = Column(Enum(IDCardType), unique=True, nullable=False)
    allowed_participant_types = Column(String(200))
    max_count_per_participant = Column(Integer, default=10)
    required_fields = Column(Text)
    photo_requirements = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class ReturnReason(Base):
    __tablename__ = "return_reasons"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False)
    category = Column(Enum(ReturnReasonCategory), nullable=False)
    description = Column(String(500), nullable=False)
    needs_manual_review = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class PersonMaterial(Base):
    __tablename__ = "person_materials"
    
    id = Column(Integer, primary_key=True, index=True)
    material_code = Column(String(100), unique=True, index=True, nullable=False)
    participant_id = Column(Integer, ForeignKey("participants.id"), nullable=False)
    id_card_type = Column(Enum(IDCardType), nullable=False)
    version = Column(Integer, default=1, nullable=False)
    idempotency_key = Column(String(100), unique=True, index=True)
    
    name = Column(String(100), nullable=False)
    id_card_number = Column(String(50), nullable=False)
    phone = Column(String(50))
    email = Column(String(200))
    photo_url = Column(String(500))
    company = Column(String(200))
    position = Column(String(100))
    
    status = Column(Enum(MaterialStatus), default=MaterialStatus.DRAFT, nullable=False, index=True)
    current_return_reason_id = Column(Integer, ForeignKey("return_reasons.id"))
    return_note = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    submitted_at = Column(DateTime)
    reviewed_at = Column(DateTime)
    
    participant = relationship("Participant", back_populates="materials")
    return_reason = relationship("ReturnReason")
    batch_items = relationship("BatchItem", back_populates="material", foreign_keys="BatchItem.material_id")
    version_history = relationship("MaterialVersionHistory", back_populates="material")

class MaterialVersionHistory(Base):
    __tablename__ = "material_version_history"
    
    id = Column(Integer, primary_key=True, index=True)
    material_id = Column(Integer, ForeignKey("person_materials.id"), nullable=False)
    version = Column(Integer, nullable=False)
    status = Column(Enum(MaterialStatus), nullable=False)
    name = Column(String(100))
    id_card_number = Column(String(50))
    phone = Column(String(50))
    email = Column(String(200))
    photo_url = Column(String(500))
    company = Column(String(200))
    position = Column(String(100))
    return_reason_id = Column(Integer, ForeignKey("return_reasons.id"))
    return_note = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String(100))
    
    material = relationship("PersonMaterial", back_populates="version_history")

class CertificateBatch(Base):
    __tablename__ = "certificate_batches"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    id_card_type = Column(Enum(IDCardType), nullable=False)
    status = Column(String(50), default="open")
    total_count = Column(Integer, default=0)
    returned_count = Column(Integer, default=0)
    approved_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    closed_at = Column(DateTime)
    created_by = Column(String(100))
    
    items = relationship("BatchItem", back_populates="batch")
    reports = relationship("BatchReport", back_populates="batch")

class BatchItem(Base):
    __tablename__ = "batch_items"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("certificate_batches.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("person_materials.id"), nullable=False)
    material_version = Column(Integer, nullable=False)
    status_at_batch_time = Column(Enum(MaterialStatus), nullable=False)
    is_returned = Column(Boolean, default=False)
    return_reason_id = Column(Integer, ForeignKey("return_reasons.id"))
    return_note = Column(Text)
    returned_at = Column(DateTime)
    resubmitted_material_id = Column(Integer, ForeignKey("person_materials.id"))
    
    batch = relationship("CertificateBatch", back_populates="items")
    material = relationship("PersonMaterial", back_populates="batch_items", foreign_keys=[material_id])
    return_reason = relationship("ReturnReason")
    resubmitted_material = relationship("PersonMaterial", foreign_keys=[resubmitted_material_id])

class BatchReport(Base):
    __tablename__ = "batch_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    report_code = Column(String(50), unique=True, index=True, nullable=False)
    batch_id = Column(Integer, ForeignKey("certificate_batches.id"), nullable=False)
    name = Column(String(200), nullable=False)
    status = Column(Enum(ReportStatus), default=ReportStatus.PENDING)
    file_url = Column(String(500))
    file_format = Column(String(20), default="xlsx")
    statistics = Column(Text)
    generated_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    generated_by = Column(String(100))
    
    batch = relationship("CertificateBatch", back_populates="reports")
