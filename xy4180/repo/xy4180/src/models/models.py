from datetime import datetime
from enum import Enum
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Text,
    ForeignKey, Boolean, Enum as SQLEnum
)
from sqlalchemy.orm import relationship, DeclarativeBase


class Base(DeclarativeBase):
    pass


class MaterialStatus(str, Enum):
    AVAILABLE = "可用"
    BORROWED = "借出"
    RETURNED = "已归还"
    DAMAGED = "损坏"
    LOST = "丢失"


class ReturnStatus(str, Enum):
    PENDING = "待归还"
    PARTIAL = "部分归还"
    COMPLETED = "已完成"
    OVERDUE = "已超时"


class Team(Base):
    __tablename__ = "teams"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    team_code = Column(String(50), unique=True, nullable=False, index=True)
    team_name = Column(String(200), nullable=False)
    booth_number = Column(String(50))
    contact_person = Column(String(100))
    contact_phone = Column(String(50))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    borrow_records = relationship("BorrowRecord", back_populates="team")
    return_records = relationship("ReturnRecord", back_populates="team")
    
    def __repr__(self):
        return f"<Team(id={self.id}, code='{self.team_code}', name='{self.team_name}')>"


class Material(Base):
    __tablename__ = "materials"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    barcode = Column(String(100), unique=True, nullable=False, index=True)
    material_type = Column(String(100), nullable=False)
    material_name = Column(String(200), nullable=False)
    specification = Column(String(200))
    weight_kg = Column(Float, nullable=False, default=0.0)
    status = Column(SQLEnum(MaterialStatus), default=MaterialStatus.AVAILABLE)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    borrow_items = relationship("BorrowItem", back_populates="material")
    return_items = relationship("ReturnItem", back_populates="material")
    
    def __repr__(self):
        return f"<Material(id={self.id}, barcode='{self.barcode}', name='{self.material_name}')>"


class BorrowRecord(Base):
    __tablename__ = "borrow_records"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    borrow_code = Column(String(100), unique=True, nullable=False, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    borrow_date = Column(DateTime, nullable=False, default=datetime.now)
    expected_return_date = Column(DateTime)
    deposit_amount = Column(Float, default=0.0)
    deposit_slip_code = Column(String(100), index=True)
    borrower_name = Column(String(100))
    status = Column(SQLEnum(ReturnStatus), default=ReturnStatus.PENDING)
    remarks = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    team = relationship("Team", back_populates="borrow_records")
    borrow_items = relationship("BorrowItem", back_populates="borrow_record", cascade="all, delete-orphan")
    return_records = relationship("ReturnRecord", back_populates="borrow_record")
    
    def __repr__(self):
        return f"<BorrowRecord(id={self.id}, code='{self.borrow_code}')>"


class BorrowItem(Base):
    __tablename__ = "borrow_items"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    borrow_record_id = Column(Integer, ForeignKey("borrow_records.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    returned_quantity = Column(Integer, default=0)
    is_returned = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now)
    
    borrow_record = relationship("BorrowRecord", back_populates="borrow_items")
    material = relationship("Material", back_populates="borrow_items")
    
    def __repr__(self):
        return f"<BorrowItem(id={self.id}, borrow_record_id={self.borrow_record_id}, material_id={self.material_id})>"


class ReturnRecord(Base):
    __tablename__ = "return_records"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    return_code = Column(String(100), unique=True, nullable=False, index=True)
    borrow_record_id = Column(Integer, ForeignKey("borrow_records.id"), nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    return_date = Column(DateTime, nullable=False, default=datetime.now)
    total_weight_kg = Column(Float, default=0.0)
    deposit_returned = Column(Float, default=0.0)
    is_deposit_settled = Column(Boolean, default=False)
    receiver_name = Column(String(100))
    status = Column(SQLEnum(ReturnStatus), default=ReturnStatus.PARTIAL)
    remarks = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    borrow_record = relationship("BorrowRecord", back_populates="return_records")
    team = relationship("Team", back_populates="return_records")
    return_items = relationship("ReturnItem", back_populates="return_record", cascade="all, delete-orphan")
    damage_records = relationship("DamageRecord", back_populates="return_record")
    
    def __repr__(self):
        return f"<ReturnRecord(id={self.id}, code='{self.return_code}')>"


class ReturnItem(Base):
    __tablename__ = "return_items"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    return_record_id = Column(Integer, ForeignKey("return_records.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    borrow_item_id = Column(Integer, ForeignKey("borrow_items.id"))
    quantity = Column(Integer, nullable=False, default=1)
    weight_kg = Column(Float, default=0.0)
    has_damage = Column(Boolean, default=False)
    damage_record_id = Column(Integer, ForeignKey("damage_records.id"))
    remarks = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    
    return_record = relationship("ReturnRecord", back_populates="return_items")
    material = relationship("Material", back_populates="return_items")
    damage_record = relationship("DamageRecord", uselist=False, foreign_keys=[damage_record_id])
    
    def __repr__(self):
        return f"<ReturnItem(id={self.id}, return_record_id={self.return_record_id})>"


class DamageRecord(Base):
    __tablename__ = "damage_records"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    return_record_id = Column(Integer, ForeignKey("return_records.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    damage_type = Column(String(100))
    damage_description = Column(Text, nullable=False)
    photo_path = Column(String(500))
    responsible_person = Column(String(100))
    estimated_cost = Column(Float, default=0.0)
    is_approved = Column(Boolean, default=False)
    remarks = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    
    return_record = relationship("ReturnRecord", back_populates="damage_records")
    
    def __repr__(self):
        return f"<DamageRecord(id={self.id}, material_id={self.material_id})>"


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    operation_type = Column(String(50), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=False)
    operation_data = Column(Text)
    before_data = Column(Text)
    after_data = Column(Text)
    operator = Column(String(100))
    is_undone = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now)
    
    def __repr__(self):
        return f"<AuditLog(id={self.id}, type='{self.operation_type}')>"


class AnomalyRecord(Base):
    __tablename__ = "anomaly_records"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    anomaly_type = Column(String(100), nullable=False)
    borrow_record_id = Column(Integer, ForeignKey("borrow_records.id"))
    return_record_id = Column(Integer, ForeignKey("return_records.id"))
    material_id = Column(Integer, ForeignKey("materials.id"))
    team_id = Column(Integer, ForeignKey("teams.id"))
    description = Column(Text, nullable=False)
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(String(100))
    resolved_at = Column(DateTime)
    remarks = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    
    def __repr__(self):
        return f"<AnomalyRecord(id={self.id}, type='{self.anomaly_type}')>"
