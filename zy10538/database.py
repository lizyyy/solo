from sqlalchemy import create_engine, Column, String, Integer, DateTime, Text, JSON, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os

DATABASE_URL = "sqlite:///./complaint_materials.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class ComplaintMaterial(Base):
    __tablename__ = "complaint_materials"

    id = Column(Integer, primary_key=True, index=True)
    complaint_no = Column(String, index=True, nullable=False)
    material_type = Column(String, nullable=False)
    batch_no = Column(Integer, default=1)
    status = Column(String, default="pending")
    missing_description = Column(Text, nullable=True)
    material_report = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    submitted_by = Column(String, nullable=True)
    auditor = Column(String, nullable=True)
    audit_time = Column(DateTime, nullable=True)
    audit_comment = Column(Text, nullable=True)
    raw_input = Column(JSON, nullable=True)
    processing_basis = Column(Text, nullable=True)
    final_conclusion = Column(Text, nullable=True)
    is_deleted = Column(Integer, default=0)
    parent_id = Column(Integer, ForeignKey("complaint_materials.id"), nullable=True)
    children = relationship("ComplaintMaterial", backref="parent", remote_side=[id])
    correction_history = relationship("MaterialCorrection", back_populates="material")


class MaterialCorrection(Base):
    __tablename__ = "material_corrections"

    id = Column(Integer, primary_key=True, index=True)
    material_id = Column(Integer, ForeignKey("complaint_materials.id"))
    corrected_by = Column(String, nullable=False)
    correction_reason = Column(Text, nullable=False)
    old_values = Column(JSON, nullable=False)
    new_values = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    material = relationship("ComplaintMaterial", back_populates="correction_history")


class MaterialChecklist(Base):
    __tablename__ = "material_checklists"

    id = Column(Integer, primary_key=True, index=True)
    complaint_type = Column(String, nullable=False)
    required_materials = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Integer, default=1)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing = db.query(MaterialChecklist).first()
        if not existing:
            default_checklists = [
                MaterialChecklist(
                    complaint_type="service_complaint",
                    required_materials={
                        "complaint_form": "投诉申请表",
                        "identity_proof": "身份证明",
                        "service_contract": "服务合同",
                        "payment_proof": "支付凭证"
                    }
                ),
                MaterialChecklist(
                    complaint_type="product_complaint",
                    required_materials={
                        "complaint_form": "投诉申请表",
                        "identity_proof": "身份证明",
                        "purchase_proof": "购买凭证",
                        "product_photo": "产品照片",
                        "quality_report": "质量检测报告"
                    }
                )
            ]
            db.add_all(default_checklists)
            db.commit()
    finally:
        db.close()
