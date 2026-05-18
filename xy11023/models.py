from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class RegistrationStatus(str, enum.Enum):
    DRAFT = "草稿"
    SUBMITTED = "已提交"
    UNDER_REVIEW = "审核中"
    APPROVED = "已通过"
    REJECTED = "已拒绝"
    WITHDRAWN = "已撤回"
    MANUAL_PROCESSING = "人工处理中"


class PesticideCategory(str, enum.Enum):
    INSECTICIDE = "杀虫剂"
    FUNGICIDE = "杀菌剂"
    HERBICIDE = "除草剂"
    RODENTICIDE = "杀鼠剂"
    PLANT_GROWTH_REGULATOR = "植物生长调节剂"


class Farmer(Base):
    __tablename__ = "farmers"

    id = Column(Integer, primary_key=True, index=True)
    id_card = Column(String(18), unique=True, index=True, nullable=False)
    name = Column(String(50), nullable=False)
    phone = Column(String(20))
    village = Column(String(100))
    town = Column(String(100))
    county = Column(String(100))
    planting_area = Column(Float)
    planting_crop = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    registrations = relationship("PesticideRegistration", back_populates="farmer")


class PesticideRegistration(Base):
    __tablename__ = "pesticide_registrations"

    id = Column(Integer, primary_key=True, index=True)
    registration_no = Column(String(50), unique=True, index=True)
    farmer_id = Column(Integer, ForeignKey("farmers.id"), nullable=False)
    
    store_name = Column(String(100), nullable=False)
    store_address = Column(String(200))
    store_license_no = Column(String(50))
    
    pesticide_name = Column(String(100), nullable=False)
    pesticide_category = Column(Enum(PesticideCategory), nullable=False)
    pesticide_registration_no = Column(String(50))
    pesticide_manufacturer = Column(String(100))
    specification = Column(String(50))
    
    quantity = Column(Float, nullable=False)
    unit = Column(String(20), default="瓶")
    unit_price = Column(Float)
    total_amount = Column(Float)
    
    purchase_date = Column(DateTime(timezone=True), nullable=False)
    purpose = Column(String(200))
    crop_area = Column(Float)
    
    status = Column(Enum(RegistrationStatus), default=RegistrationStatus.DRAFT)
    auditor = Column(String(50))
    audit_opinion = Column(Text)
    audit_time = Column(DateTime(timezone=True))
    
    manual_processor = Column(String(50))
    manual_remark = Column(Text)
    manual_process_time = Column(DateTime(timezone=True))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    farmer = relationship("Farmer", back_populates="registrations")
    history = relationship("RegistrationHistory", back_populates="registration", order_by="RegistrationHistory.version.desc()")


class RegistrationHistory(Base):
    __tablename__ = "registration_history"

    id = Column(Integer, primary_key=True, index=True)
    registration_id = Column(Integer, ForeignKey("pesticide_registrations.id"), nullable=False)
    version = Column(Integer, nullable=False)
    
    changed_by = Column(String(50))
    change_type = Column(String(50))
    change_reason = Column(Text)
    
    store_name = Column(String(100))
    pesticide_name = Column(String(100))
    pesticide_category = Column(Enum(PesticideCategory))
    quantity = Column(Float)
    purchase_date = Column(DateTime(timezone=True))
    status = Column(Enum(RegistrationStatus))
    auditor = Column(String(50))
    audit_opinion = Column(Text)
    manual_processor = Column(String(50))
    manual_remark = Column(Text)
    
    snapshot_data = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    registration = relationship("PesticideRegistration", back_populates="history")


class PurchaseLimitRule(Base):
    __tablename__ = "purchase_limit_rules"

    id = Column(Integer, primary_key=True, index=True)
    pesticide_category = Column(Enum(PesticideCategory), unique=True, nullable=False)
    max_quantity_per_month = Column(Float, nullable=False)
    max_quantity_per_purchase = Column(Float, nullable=False)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
