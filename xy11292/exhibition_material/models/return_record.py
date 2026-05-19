from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Enum, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from .base import Base, TimestampMixin
from .exceptions import RecordStatus, AnomalyType

class ReturnRecord(Base, TimestampMixin):
    __tablename__ = "return_records"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    return_no = Column(String(50), unique=True, nullable=False, index=True)
    allocation_id = Column(Integer, ForeignKey("allocations.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    returned_at = Column(DateTime, nullable=False, default=datetime.now)
    received_by = Column(String(100), nullable=False, index=True)
    returned_by = Column(String(100), nullable=False)
    booth_number = Column(String(50), index=True)
    status = Column(Enum(RecordStatus), nullable=False, default=RecordStatus.PENDING)
    has_anomaly = Column(Boolean, default=False)
    anomaly_type = Column(Enum(AnomalyType))
    anomaly_remark = Column(Text)
    condition_remark = Column(Text)
    remarks = Column(Text)
    source_file = Column(String(500))
    source_line = Column(Integer)
    is_deleted = Column(Boolean, default=False)
    
    allocation = relationship("Allocation", back_populates="return_records")
    material = relationship("Material", back_populates="return_records")
    
    def __repr__(self):
        return f"<ReturnRecord {self.return_no}: {self.quantity}>"
    
    def to_dict(self, include_allocation=False, include_material=False):
        data = {
            "id": self.id,
            "return_no": self.return_no,
            "allocation_id": self.allocation_id,
            "material_id": self.material_id,
            "quantity": self.quantity,
            "returned_at": self.returned_at.isoformat() if self.returned_at else None,
            "received_by": self.received_by,
            "returned_by": self.returned_by,
            "booth_number": self.booth_number,
            "status": self.status.value,
            "has_anomaly": self.has_anomaly,
            "anomaly_type": self.anomaly_type.value if self.anomaly_type else None,
            "anomaly_remark": self.anomaly_remark,
            "condition_remark": self.condition_remark,
            "remarks": self.remarks,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
        if include_allocation and self.allocation:
            data["allocation"] = self.allocation.to_dict()
        if include_material and self.material:
            data["material"] = self.material.to_dict()
        return data
