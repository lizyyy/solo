from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import BaseModel


class User(BaseModel):
    __tablename__ = "users"

    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=True, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    last_login_at = Column(DateTime, nullable=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=True)

    roles = relationship("UserRole", back_populates="user", cascade="all, delete-orphan")
    store = relationship("Store", back_populates="users", foreign_keys="[User.store_id]")
