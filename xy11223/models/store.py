from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class Store(Base):
    __tablename__ = "stores"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    manager_id = Column(String, nullable=False, index=True)
    manager_name = Column(String, nullable=False)
    region = Column(String, index=True)
    city = Column(String)
    address = Column(String)
    phone = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    samples = relationship("FoodSample", back_populates="store")
    temperature_records = relationship("TemperatureRecord", back_populates="store")
    waste_records = relationship("WasteRecord", back_populates="store")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "manager_id": self.manager_id,
            "manager_name": self.manager_name,
            "region": self.region,
            "city": self.city,
            "address": self.address,
            "phone": self.phone,
            "is_active": self.is_active
        }
