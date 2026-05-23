from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from app.database import Base

class Sample(Base):
    __tablename__ = 'samples'

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String, index=True)
    cooperative = Column(String)
    sample_type = Column(String)
    sample_name = Column(String)
    sample_code = Column(String, unique=True, index=True)
    send_date = Column(DateTime)
    sender = Column(String)
    receiver = Column(String)
    quantity = Column(Integer)
    unit = Column(String)
    production_base = Column(String)
    harvest_date = Column(DateTime)
    remarks = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
