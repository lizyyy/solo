from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base


user_role = Table(
    'user_role',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('user.id'), primary_key=True),
    Column('role_id', Integer, ForeignKey('role.id'), primary_key=True),
)


class Role(Base):
    __tablename__ = 'role'

    name = Column(String(50), unique=True, nullable=False)
    description = Column(String(255))

    permissions = relationship('RolePermission', back_populates='role', cascade='all, delete-orphan')
    users = relationship('User', secondary=user_role, back_populates='roles')

    def __repr__(self):
        return f'<Role {self.name}>'


class RolePermission(Base):
    __tablename__ = 'role_permission'

    role_id = Column(Integer, ForeignKey('role.id'), nullable=False)
    permission = Column(String(100), nullable=False)

    role = relationship('Role', back_populates='permissions')



class User(Base):
    __tablename__ = 'user'

    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    full_name = Column(String(100))
    is_active = Column(Integer, default=1)

    roles = relationship('Role', secondary=user_role, back_populates='users')

    def has_permission(self, permission: str) -> bool:
        for role in self.roles:
            for perm in role.permissions:
                if perm.permission == permission:
                    return True
        return False

    def __repr__(self):
        return f'<User {self.username}>'
