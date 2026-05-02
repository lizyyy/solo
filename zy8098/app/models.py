from sqlalchemy import Column, Integer, String, DateTime, Text, Float, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from .database import Base


class MealType(str, enum.Enum):
    BREAKFAST = "breakfast"
    LUNCH = "lunch"
    DINNER = "dinner"


class SampleStatus(str, enum.Enum):
    REGISTERED = "registered"
    IN_FRIDGE = "in_fridge"
    TAKEN_OUT = "taken_out"
    EXPIRED = "expired"


class Meal(Base):
    __tablename__ = "meals"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(String, index=True)
    meal_type = Column(String, index=True)
    dish_name = Column(String, index=True)
    kitchen = Column(String)
    chef = Column(String)
    ingredients = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    samples = relationship("Sample", back_populates="meal")


class Sample(Base):
    __tablename__ = "samples"

    id = Column(Integer, primary_key=True, index=True)
    box_code = Column(String, unique=True, index=True)
    meal_id = Column(Integer, ForeignKey("meals.id"))
    weight = Column(Float)
    registered_by = Column(String)
    registered_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default=SampleStatus.REGISTERED)
    expiry_time = Column(DateTime)

    meal = relationship("Meal", back_populates="samples")
    events = relationship("SampleEvent", back_populates="sample", order_by="SampleEvent.event_time")


class Fridge(Base):
    __tablename__ = "fridges"

    id = Column(Integer, primary_key=True, index=True)
    fridge_code = Column(String, unique=True, index=True)
    location = Column(String)
    temperature_min = Column(Float)
    temperature_max = Column(Float)
    retention_hours = Column(Integer, default=48)


class SampleEvent(Base):
    __tablename__ = "sample_events"

    id = Column(Integer, primary_key=True, index=True)
    sample_id = Column(Integer, ForeignKey("samples.id"))
    event_type = Column(String, index=True)
    event_time = Column(DateTime, index=True)
    fridge_code = Column(String, nullable=True)
    operator = Column(String)
    notes = Column(Text, nullable=True)
    sequence_number = Column(Integer)

    sample = relationship("Sample", back_populates="events")


class FridgeRule(Base):
    __tablename__ = "fridge_rules"

    id = Column(Integer, primary_key=True, index=True)
    rule_name = Column(String, index=True)
    fridge_code = Column(String)
    retention_hours = Column(Integer)
    temperature_min = Column(Float)
    temperature_max = Column(Float)
    priority = Column(Integer, default=0)
