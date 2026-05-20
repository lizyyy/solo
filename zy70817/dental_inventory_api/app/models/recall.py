from sqlalchemy import Column, String, DateTime, Integer, Text, Float
from datetime import datetime
from app.utils.database import Base

class RecallNotice(Base):
    __tablename__ = "recall_notices"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    notice_date = Column(DateTime)
    issuer = Column(String)
    affected_material = Column(String)
    affected_batches = Column(Text)
    reason = Column(Text)
    level = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Integer, default=1)

class StoreConsumption(Base):
    __tablename__ = "store_consumption"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(String, index=True)
    store_name = Column(String)
    batch_number = Column(String, index=True)
    material_name = Column(String)
    consumption_date = Column(DateTime)
    quantity = Column(Float)
    unit = Column(String)
    patient_id = Column(String, nullable=True)
    dentist = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
