from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Enum as SQLEnum, Boolean
import enum

from app.core.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    METROLOGIST = "metrologist"
    WORKSHOP_USER = "workshop_user"
    APPROVER = "approver"
    VIEWER = "viewer"


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    email = Column(String(100))
    phone = Column(String(20))
    department = Column(String(100))
    
    role = Column(SQLEnum(UserRole), default=UserRole.VIEWER, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
