from sqlalchemy import Column, Integer, String, Float, Enum, Boolean, Text
from sqlalchemy.orm import relationship
from .base import Base, TimestampMixin
from .exceptions import MaterialType

class Material(Base, TimestampMixin):
    __tablename__ = "materials"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    type = Column(Enum(MaterialType), nullable=False, index=True)
    specification = Column(String(500))
    unit = Column(String(20), nullable=False)
    total_quantity = Column(Float, nullable=False, default=0)
    available_quantity = Column(Float, nullable=False, default=0)
    allocated_quantity = Column(Float, nullable=False, default=0)
    returned_quantity = Column(Float, nullable=False, default=0)
    location = Column(String(200))
    responsible_person = Column(String(100), index=True)
    is_active = Column(Boolean, default=True)
    remarks = Column(Text)
    
    allocations = relationship("Allocation", back_populates="material", cascade="all, delete-orphan")
    return_records = relationship("ReturnRecord", back_populates="material", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Material {self.code}: {self.name}>"
    
    def to_dict(self):
        return {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "type": self.type.value,
            "specification": self.specification,
            "unit": self.unit,
            "total_quantity": self.total_quantity,
            "available_quantity": self.available_quantity,
            "allocated_quantity": self.allocated_quantity,
            "returned_quantity": self.returned_quantity,
            "location": self.location,
            "responsible_person": self.responsible_person,
            "is_active": self.is_active,
            "remarks": self.remarks,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
