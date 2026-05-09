from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import BaseModel


class Role(BaseModel):
    __tablename__ = "roles"

    name = Column(String(50), unique=True, nullable=False)
    code = Column(String(50), unique=True, nullable=False, index=True)
    description = Column(String(255), nullable=True)
    is_system = Column(Boolean, default=False, nullable=False)

    permissions = relationship("RolePermission", back_populates="role", cascade="all, delete-orphan")
    users = relationship("UserRole", back_populates="role", cascade="all, delete-orphan")


class Permission(BaseModel):
    __tablename__ = "permissions"

    name = Column(String(50), nullable=False)
    code = Column(String(100), unique=True, nullable=False, index=True)
    module = Column(String(50), nullable=False)
    description = Column(String(255), nullable=True)

    roles = relationship("RolePermission", back_populates="permission", cascade="all, delete-orphan")


class RolePermission(BaseModel):
    __tablename__ = "role_permissions"

    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False, index=True)
    permission_id = Column(Integer, ForeignKey("permissions.id"), nullable=False, index=True)

    role = relationship("Role", back_populates="permissions")
    permission = relationship("Permission", back_populates="roles")


class UserRole(BaseModel):
    __tablename__ = "user_roles"

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False, index=True)

    user = relationship("User", back_populates="roles")
    role = relationship("Role", back_populates="users")
