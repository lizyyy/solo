from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class LightingSet(Base):
    __tablename__ = "lighting_sets"

    id = Column(Integer, primary_key=True, index=True)
    set_code = Column(String(50), unique=True, index=True, nullable=False)
    set_name = Column(String(200), nullable=False)
    store = Column(String(100), nullable=False)
    responsible_person = Column(String(100), nullable=False)
    status = Column(String(50), nullable=False, default="available")
    total_value = Column(Float, default=0.0)
    daily_rental_price = Column(Float, nullable=False)
    created_date = Column(DateTime(timezone=True), server_default=func.now())
    last_updated = Column(DateTime(timezone=True), onupdate=func.now())
    expected_return_date = Column(DateTime(timezone=True), nullable=True)
    actual_return_date = Column(DateTime(timezone=True), nullable=True)
    customer_name = Column(String(200), nullable=True)
    customer_phone = Column(String(50), nullable=True)
    event_name = Column(String(200), nullable=True)
    event_location = Column(String(300), nullable=True)
    remarks = Column(Text, nullable=True)
    completeness_score = Column(Float, default=100.0)

    items = relationship("LightingSetItem", back_populates="lighting_set", cascade="all, delete-orphan")


class LightingSetItem(Base):
    __tablename__ = "lighting_set_items"

    id = Column(Integer, primary_key=True, index=True)
    lighting_set_id = Column(Integer, ForeignKey("lighting_sets.id"), nullable=False)
    item_code = Column(String(50), nullable=False)
    item_name = Column(String(200), nullable=False)
    category = Column(String(100), nullable=False)
    brand = Column(String(100), nullable=True)
    model = Column(String(100), nullable=True)
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Float, nullable=False)
    status = Column(String(50), nullable=False, default="normal")
    serial_number = Column(String(200), nullable=True)
    purchase_date = Column(DateTime(timezone=True), nullable=True)
    last_maintenance_date = Column(DateTime(timezone=True), nullable=True)
    condition_description = Column(Text, nullable=True)

    lighting_set = relationship("LightingSet", back_populates="items")
