from sqlalchemy import Column, String, DateTime, Float, Integer, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base
from models.enums import RecordStatus


class TemperatureRecord(Base):
    __tablename__ = "temperature_records"

    id = Column(String, primary_key=True, index=True)
    store_id = Column(String, ForeignKey("stores.id"), nullable=False, index=True)
    fridge_id = Column(String, index=True)
    fridge_name = Column(String, index=True)
    record_time = Column(DateTime, nullable=False, index=True)
    temperature = Column(Float, nullable=False)
    min_temperature = Column(Float, default=0.0)
    max_temperature = Column(Float, default=8.0)
    recorder_id = Column(String, index=True)
    recorder_name = Column(String)
    status = Column(String, default=RecordStatus.PENDING)
    source_file = Column(String)
    source_row = Column(Integer)
    batch_operation_id = Column(String, ForeignKey("batch_operations.id"))
    remarks = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    store = relationship("Store", back_populates="temperature_records")
    rule_results = relationship("RuleResult", back_populates="temperature_record")
    reviews = relationship("ReviewRecord", back_populates="temperature_record")
    batch_operation = relationship("BatchOperation")

    @property
    def is_abnormal(self) -> bool:
        if self.temperature is None:
            return True
        return self.temperature < self.min_temperature or self.temperature > self.max_temperature

    @property
    def temperature_deviation(self) -> float:
        if self.temperature is None:
            return 0.0
        if self.temperature < self.min_temperature:
            return self.temperature - self.min_temperature
        if self.temperature > self.max_temperature:
            return self.temperature - self.max_temperature
        return 0.0

    def to_dict(self, include_relations: bool = False):
        data = {
            "id": self.id,
            "store_id": self.store_id,
            "fridge_id": self.fridge_id,
            "fridge_name": self.fridge_name,
            "record_time": self.record_time.isoformat() if self.record_time else None,
            "temperature": self.temperature,
            "min_temperature": self.min_temperature,
            "max_temperature": self.max_temperature,
            "recorder_id": self.recorder_id,
            "recorder_name": self.recorder_name,
            "status": self.status,
            "remarks": self.remarks,
            "is_abnormal": self.is_abnormal,
            "temperature_deviation": self.temperature_deviation
        }
        if include_relations and self.store:
            data["store"] = self.store.to_dict()
        return data
