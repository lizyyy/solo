import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Enum, Boolean

from app.core.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    INSPECTOR = "inspector"
    RECTIFIER = "rectifier"
    REVIEWER = "reviewer"
    VIEWER = "viewer"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True)
    full_name = Column(String(100))
    phone = Column(String(20))
    
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.VIEWER)
    
    department = Column(String(100))
    
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
