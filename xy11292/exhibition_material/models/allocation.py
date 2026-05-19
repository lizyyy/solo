from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Enum, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from .base import Base, TimestampMixin
from .exceptions import RecordStatus, AnomalyType

class Allocation(Base, TimestampMixin):
    __tablename__ = "allocations"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    allocation_no = Column(String(50), unique=True, nullable=False, index=True)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    booth_number = Column(String(50), nullable=False, index=True)
    quantity = Column(Float, nullable=False)
    allocated_at = Column(DateTime, nullable=False, default=datetime.now)
    expected_return_at = Column(DateTime)
    responsible_person = Column(String(100), nullable=False, index=True)
    contact_phone = Column(String(20))
    status = Column(Enum(RecordStatus), nullable=False, default=RecordStatus.PENDING)
    has_anomaly = Column(Boolean, default=False)
    anomaly_type = Column(Enum(AnomalyType))
    anomaly_remark = Column(Text)
    approved_by = Column(String(100))
    approved_at = Column(DateTime)
    remarks = Column(Text)
    source_file = Column(String(500))
    source_line = Column(Integer)
    is_deleted = Column(Boolean, default=False)
    
    material = relationship("Material", back_populates="allocations")
    return_records = relationship("ReturnRecord", back_populates="allocation", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Allocation {self.allocation_no}: {self.booth_number}>"
    
    @property
    def returned_quantity(self):
        return sum(r.quantity for r in self.return_records if not r.is_deleted)
    
    @property
    def remaining_quantity(self):
        return self.quantity - self.returned_quantity
    
    def to_dict(self, include_material=False):
        data = {
            "id": self.id,
            "allocation_no": self.allocation_no,
            "material_id": self.material_id,
            "booth_number": self.booth_number,
            "quantity": self.quantity,
            "returned_quantity": self.returned_quantity,
            "remaining_quantity": self.remaining_quantity,
            "allocated_at": self.allocated_at.isoformat() if self.allocated_at else None,
            "expected_return_at": self.expected_return_at.isoformat() if self.expected_return_at else None,
            "responsible_person": self.responsible_person,
            "contact_phone": self.contact_phone,
            "status": self.status.value,
            "has_anomaly": self.has_anomaly,
            "anomaly_type": self.anomaly_type.value if self.anomaly_type else None,
            "anomaly_remark": self.anomaly_remark,
            "approved_by": self.approved_by,
            "approved_at": self.approved_at.isoformat() if self.approved_at else None,
            "remarks": self.remarks,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
        if include_material and self.material:
            data["material"] = self.material.to_dict()
        return data
