from datetime import datetime, timedelta
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    full_name = Column(String(100), nullable=False)
    email = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    borrows = relationship("Borrow", back_populates="user")
    exchange_requests = relationship("ExchangeRequest", back_populates="requester")


class GasCylinder(Base):
    __tablename__ = "gas_cylinders"
    
    id = Column(Integer, primary_key=True, index=True)
    cylinder_code = Column(String(50), unique=True, index=True, nullable=False)
    gas_type = Column(String(100), nullable=False)
    danger_category = Column(String(50), nullable=False)
    capacity = Column(Float, nullable=False)
    current_level = Column(Float, nullable=False)
    status = Column(String(50), default="IN_STORAGE")
    location = Column(String(200), nullable=True)
    manufacturer = Column(String(100), nullable=True)
    production_date = Column(DateTime, nullable=True)
    inspection_date = Column(DateTime, nullable=True)
    next_inspection_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    borrows = relationship("Borrow", back_populates="cylinder")
    level_history = relationship("CylinderLevelHistory", back_populates="cylinder")
    warnings = relationship("CylinderWarning", back_populates="cylinder")
    exchange_requests = relationship("ExchangeRequest", back_populates="cylinder")
    
    def calculate_effective_threshold(self, base_threshold, danger_categories):
        category_info = danger_categories.get(self.danger_category, {})
        multiplier = category_info.get("warning_multiplier", 1.0)
        return base_threshold * multiplier
    
    def check_warning_level(self, warning_thresholds, danger_categories):
        effective_low = self.calculate_effective_threshold(warning_thresholds["LOW"], danger_categories)
        effective_critical = self.calculate_effective_threshold(warning_thresholds["CRITICAL"], danger_categories)
        effective_emergency = self.calculate_effective_threshold(warning_thresholds["EMERGENCY"], danger_categories)
        
        current_percentage = (self.current_level / self.capacity) * 100
        
        if current_percentage <= effective_emergency:
            return "EMERGENCY_WARNING"
        elif current_percentage <= effective_critical:
            return "CRITICAL_WARNING"
        elif current_percentage <= effective_low:
            return "LOW_WARNING"
        else:
            return None


class CylinderLevelHistory(Base):
    __tablename__ = "cylinder_level_history"
    
    id = Column(Integer, primary_key=True, index=True)
    cylinder_id = Column(Integer, ForeignKey("gas_cylinders.id"), nullable=False)
    previous_level = Column(Float, nullable=False)
    new_level = Column(Float, nullable=False)
    recorded_by = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    cylinder = relationship("GasCylinder", back_populates="level_history")


class Borrow(Base):
    __tablename__ = "borrows"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    cylinder_id = Column(Integer, ForeignKey("gas_cylinders.id"), nullable=False)
    purpose = Column(String(200), nullable=False)
    expected_return_date = Column(DateTime, nullable=False)
    actual_return_date = Column(DateTime, nullable=True)
    status = Column(String(50), default="ACTIVE")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="borrows")
    cylinder = relationship("GasCylinder", back_populates="borrows")
    
    def is_overdue(self):
        if self.actual_return_date:
            return False
        return datetime.utcnow() > self.expected_return_date


class CylinderWarning(Base):
    __tablename__ = "cylinder_warnings"
    
    id = Column(Integer, primary_key=True, index=True)
    cylinder_id = Column(Integer, ForeignKey("gas_cylinders.id"), nullable=False)
    warning_type = Column(String(50), nullable=False)
    message = Column(Text, nullable=False)
    severity = Column(String(20), default="MEDIUM")
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(String(100), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    cylinder = relationship("GasCylinder", back_populates="warnings")


class ExchangeRequest(Base):
    __tablename__ = "exchange_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    cylinder_id = Column(Integer, ForeignKey("gas_cylinders.id"), nullable=False)
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String(50), default="PENDING")
    approved_by = Column(String(100), nullable=True)
    approval_notes = Column(Text, nullable=True)
    new_cylinder_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    cylinder = relationship("GasCylinder", back_populates="exchange_requests")
    requester = relationship("User", back_populates="exchange_requests")
