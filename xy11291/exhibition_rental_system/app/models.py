from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True)
    email = Column(String(100), unique=True, index=True)
    hashed_password = Column(String(255))
    full_name = Column(String(100))
    phone = Column(String(20))
    role = Column(String(20), default="staff")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    audit_logs = relationship("AuditLog", back_populates="user")


class Booth(Base):
    __tablename__ = "booths"

    id = Column(Integer, primary_key=True, index=True)
    booth_number = Column(String(20), unique=True, index=True)
    company_name = Column(String(100))
    contact_person = Column(String(100))
    contact_phone = Column(String(20))
    area = Column(Float)
    status = Column(String(20), default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    rentals = relationship("Rental", back_populates="booth")


class Equipment(Base):
    __tablename__ = "equipment"

    id = Column(Integer, primary_key=True, index=True)
    barcode = Column(String(50), unique=True, index=True)
    name = Column(String(100))
    category = Column(String(50))
    specification = Column(String(200))
    status = Column(String(20), default="available")
    daily_rate = Column(Float)
    deposit = Column(Float)
    current_location = Column(String(100))
    remarks = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    rentals = relationship("RentalItem", back_populates="equipment")
    damage_records = relationship("DamageRecord", back_populates="equipment")


class Rental(Base):
    __tablename__ = "rentals"

    id = Column(Integer, primary_key=True, index=True)
    rental_no = Column(String(50), unique=True, index=True)
    booth_id = Column(Integer, ForeignKey("booths.id"))
    operator_id = Column(Integer)
    status = Column(String(20), default="active")
    total_amount = Column(Float, default=0)
    total_deposit = Column(Float, default=0)
    actual_damage_fee = Column(Float, default=0)
    remarks = Column(Text)
    start_time = Column(DateTime(timezone=True), server_default=func.now())
    end_time = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    booth = relationship("Booth", back_populates="rentals")
    items = relationship("RentalItem", back_populates="rental")
    return_records = relationship("ReturnRecord", back_populates="rental")


class RentalItem(Base):
    __tablename__ = "rental_items"

    id = Column(Integer, primary_key=True, index=True)
    rental_id = Column(Integer, ForeignKey("rentals.id"))
    equipment_id = Column(Integer, ForeignKey("equipment.id"))
    quantity = Column(Integer, default=1)
    daily_rate = Column(Float)
    deposit = Column(Float)
    status = Column(String(20), default="borrowed")
    remarks = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    rental = relationship("Rental", back_populates="items")
    equipment = relationship("Equipment", back_populates="rentals")


class ReturnRecord(Base):
    __tablename__ = "return_records"

    id = Column(Integer, primary_key=True, index=True)
    rental_id = Column(Integer, ForeignKey("rentals.id"))
    operator_id = Column(Integer)
    total_items = Column(Integer)
    returned_items = Column(Integer)
    damage_fee = Column(Float, default=0)
    refund_amount = Column(Float, default=0)
    remarks = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    rental = relationship("Rental", back_populates="return_records")
    items = relationship("ReturnItem", back_populates="return_record")


class ReturnItem(Base):
    __tablename__ = "return_items"

    id = Column(Integer, primary_key=True, index=True)
    return_record_id = Column(Integer, ForeignKey("return_records.id"))
    equipment_id = Column(Integer)
    quantity = Column(Integer)
    status = Column(String(20))
    damage_level = Column(String(20))
    damage_fee = Column(Float, default=0)
    remarks = Column(Text)

    return_record = relationship("ReturnRecord", back_populates="items")


class DamageRecord(Base):
    __tablename__ = "damage_records"

    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"))
    rental_id = Column(Integer)
    return_record_id = Column(Integer)
    operator_id = Column(Integer)
    damage_level = Column(String(20))
    description = Column(Text)
    fee = Column(Float)
    status = Column(String(20), default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    equipment = relationship("Equipment", back_populates="damage_records")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String(50))
    resource_type = Column(String(50))
    resource_id = Column(Integer)
    status = Column(String(20))
    reason = Column(Text)
    request_data = Column(Text)
    response_data = Column(Text)
    ip_address = Column(String(50))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="audit_logs")
