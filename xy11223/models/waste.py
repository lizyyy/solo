from sqlalchemy import Column, String, DateTime, Float, Integer, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base
from models.enums import RecordStatus


class WasteRecord(Base):
    __tablename__ = "waste_records"

    id = Column(String, primary_key=True, index=True)
    store_id = Column(String, ForeignKey("stores.id"), nullable=False, index=True)
    batch_id = Column(String, index=True)
    dish_name = Column(String, nullable=False, index=True)
    production_time = Column(DateTime, index=True)
    waste_time = Column(DateTime, nullable=False, index=True)
    expected_waste_time = Column(DateTime)
    waste_weight = Column(Float)
    waste_reason = Column(String)
    handler_id = Column(String, index=True)
    handler_name = Column(String)
    status = Column(String, default=RecordStatus.PENDING)
    source_file = Column(String)
    source_row = Column(Integer)
    batch_operation_id = Column(String, ForeignKey("batch_operations.id"))
    remarks = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    store = relationship("Store", back_populates="waste_records")
    rule_results = relationship("RuleResult", back_populates="waste_record")
    reviews = relationship("ReviewRecord", back_populates="waste_record")
    batch_operation = relationship("BatchOperation")

    @property
    def delay_hours(self) -> float:
        if not self.waste_time or not self.expected_waste_time:
            return 0.0
        delta = self.waste_time - self.expected_waste_time
        return max(0, delta.total_seconds() / 3600)

    def to_dict(self, include_relations: bool = False):
        data = {
            "id": self.id,
            "store_id": self.store_id,
            "batch_id": self.batch_id,
            "dish_name": self.dish_name,
            "production_time": self.production_time.isoformat() if self.production_time else None,
            "waste_time": self.waste_time.isoformat() if self.waste_time else None,
            "expected_waste_time": self.expected_waste_time.isoformat() if self.expected_waste_time else None,
            "waste_weight": self.waste_weight,
            "waste_reason": self.waste_reason,
            "handler_id": self.handler_id,
            "handler_name": self.handler_name,
            "status": self.status,
            "remarks": self.remarks,
            "delay_hours": self.delay_hours
        }
        if include_relations and self.store:
            data["store"] = self.store.to_dict()
        return data
