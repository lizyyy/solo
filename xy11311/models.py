from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from database import Base


class ChronicCondition(str, enum.Enum):
    DIABETES = "糖尿病"
    HYPERTENSION = "高血压"
    HEART_DISEASE = "心脏病"
    KIDNEY_DISEASE = "肾病"
    GOUT = "痛风"


class RecordStatus(str, enum.Enum):
    PASSED = "通过"
    BLOCKED = "拦截"


class ExceptionType(str, enum.Enum):
    DIABETES_RISK = "糖尿病禁忌"
    ALLERGY_RISK = "过敏风险"
    DUPLICATE_CHANGE = "重复改餐"
    NO_EXCEPTION = "无异常"


class Elderly(Base):
    __tablename__ = "elderly"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), index=True, nullable=False)
    room_number = Column(String(50))
    delivery_route = Column(String(100))
    phone = Column(String(20))
    chronic_conditions = Column(String(200))
    allergies = Column(String(200))
    dietary_restrictions = Column(String(200))
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    meal_records = relationship("MealRecord", back_populates="elderly")


class MealRecord(Base):
    __tablename__ = "meal_records"

    id = Column(Integer, primary_key=True, index=True)
    elderly_id = Column(Integer, ForeignKey("elderly.id"), nullable=False)
    meal_date = Column(DateTime, nullable=False, index=True)
    meal_type = Column(String(20))
    menu_items = Column(Text, nullable=False)
    status = Column(Enum(RecordStatus), nullable=False)
    exception_type = Column(Enum(ExceptionType), nullable=False)
    reason = Column(Text, nullable=False)
    handled_by = Column(String(100), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    elderly = relationship("Elderly", back_populates="meal_records")
    change_history = relationship("MealChangeHistory", back_populates="meal_record")


class MealChangeHistory(Base):
    __tablename__ = "meal_change_history"

    id = Column(Integer, primary_key=True, index=True)
    meal_record_id = Column(Integer, ForeignKey("meal_records.id"), nullable=False)
    previous_menu = Column(Text)
    new_menu = Column(Text)
    changed_by = Column(String(100), nullable=False)
    change_reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    meal_record = relationship("MealRecord", back_populates="change_history")
