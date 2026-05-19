from sqlalchemy import Column, String, DateTime, Float, Integer, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
from database import Base
from models.enums import RecordStatus, SampleType


class FoodSample(Base):
    __tablename__ = "food_samples"

    id = Column(String, primary_key=True, index=True)
    store_id = Column(String, ForeignKey("stores.id"), nullable=False, index=True)
    batch_id = Column(String, index=True)
    dish_name = Column(String, nullable=False, index=True)
    sample_type = Column(String, nullable=False)
    sample_time = Column(DateTime, nullable=False, index=True)
    sample_weight = Column(Float)
    storage_location = Column(String)
    keeper_id = Column(String, index=True)
    keeper_name = Column(String)
    expire_time = Column(DateTime, nullable=False)
    disposal_time = Column(DateTime)
    disposal_person = Column(String)
    status = Column(String, default=RecordStatus.PENDING)
    source_file = Column(String)
    source_row = Column(Integer)
    batch_operation_id = Column(String, ForeignKey("batch_operations.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    store = relationship("Store", back_populates="samples")
    rule_results = relationship("RuleResult", back_populates="sample")
    reviews = relationship("ReviewRecord", back_populates="sample")
    batch_operation = relationship("BatchOperation")

    @property
    def is_expired(self) -> bool:
        if not self.expire_time:
            return False
        return datetime.utcnow() > self.expire_time

    @property
    def retention_hours(self) -> float:
        if not self.sample_time or not self.expire_time:
            return 0.0
        delta = self.expire_time - self.sample_time
        return delta.total_seconds() / 3600

    def to_dict(self, include_relations: bool = False):
        data = {
            "id": self.id,
            "store_id": self.store_id,
            "batch_id": self.batch_id,
            "dish_name": self.dish_name,
            "sample_type": self.sample_type,
            "sample_time": self.sample_time.isoformat() if self.sample_time else None,
            "sample_weight": self.sample_weight,
            "storage_location": self.storage_location,
            "keeper_id": self.keeper_id,
            "keeper_name": self.keeper_name,
            "expire_time": self.expire_time.isoformat() if self.expire_time else None,
            "disposal_time": self.disposal_time.isoformat() if self.disposal_time else None,
            "disposal_person": self.disposal_person,
            "status": self.status,
            "is_expired": self.is_expired,
            "retention_hours": self.retention_hours
        }
        if include_relations and self.store:
            data["store"] = self.store.to_dict()
        return data
