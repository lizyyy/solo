from sqlalchemy import Column, Integer, String, Text, Date, DateTime, ForeignKey, Boolean, Enum, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class ElderStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"


class MealStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class ChronicDisease(str, enum.Enum):
    DIABETES = "diabetes"
    HYPERTENSION = "hypertension"
    HEART_DISEASE = "heart_disease"
    KIDNEY_DISEASE = "kidney_disease"
    GOUT = "gout"
    OTHER = "other"


class Elder(Base):
    __tablename__ = "elders"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    id_card = Column(String(18), unique=True, index=True)
    phone = Column(String(20))
    address = Column(Text)
    birth_date = Column(Date)
    gender = Column(String(10))
    room_number = Column(String(50))
    route_id = Column(Integer, ForeignKey("delivery_routes.id"), nullable=True)
    
    dietary_restrictions = Column(Text)
    chronic_diseases = Column(String(200))
    allergies = Column(Text)
    notes = Column(Text)
    
    status = Column(Enum(ElderStatus), default=ElderStatus.ACTIVE)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    route = relationship("DeliveryRoute", back_populates="elders")
    meal_distributions = relationship("MealDistribution", back_populates="elder")


class DeliveryRoute(Base):
    __tablename__ = "delivery_routes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text)
    sequence = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    elders = relationship("Elder", back_populates="route")
    menus = relationship("Menu", back_populates="route")


class Menu(Base):
    __tablename__ = "menus"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False, index=True)
    meal_type = Column(String(20), nullable=False)
    route_id = Column(Integer, ForeignKey("delivery_routes.id"), nullable=True)
    
    main_dish = Column(String(200), nullable=False)
    side_dish1 = Column(String(200))
    side_dish2 = Column(String(200))
    soup = Column(String(200))
    staple = Column(String(100))
    
    special_notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    route = relationship("DeliveryRoute", back_populates="menus")
    meal_distributions = relationship("MealDistribution", back_populates="menu")


class MealDistribution(Base):
    __tablename__ = "meal_distributions"

    id = Column(Integer, primary_key=True, index=True)
    elder_id = Column(Integer, ForeignKey("elders.id"), nullable=False)
    menu_id = Column(Integer, ForeignKey("menus.id"), nullable=False)
    
    special_requirements = Column(Text)
    actual_dishes = Column(Text)
    status = Column(Enum(MealStatus), default=MealStatus.PENDING)
    
    reviewed_by = Column(String(100))
    reviewed_at = Column(DateTime(timezone=True))
    review_notes = Column(Text)
    
    delivered_by = Column(String(100))
    delivered_at = Column(DateTime(timezone=True))
    delivery_notes = Column(Text)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    elder = relationship("Elder", back_populates="meal_distributions")
    menu = relationship("Menu", back_populates="meal_distributions")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(50), index=True)
    entity_id = Column(Integer)
    operator = Column(String(100))
    ip_address = Column(String(50))
    
    old_value = Column(Text)
    new_value = Column(Text)
    changes = Column(Text)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    hashed_password = Column(String(200), nullable=False)
    full_name = Column(String(100))
    role = Column(String(50), default="staff")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
