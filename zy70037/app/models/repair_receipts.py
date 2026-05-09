from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from .base import Base

class RepairReceipt(Base):
    dispatch_id = Column(Integer, ForeignKey('dispatches.id'), nullable=False)
    worker_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    receipt_code = Column(String(50), unique=True, nullable=False)
    arrival_time = Column(DateTime, nullable=False)
    departure_time = Column(DateTime, nullable=True)
    diagnosis = Column(Text, nullable=False)
    solution = Column(Text, nullable=False)
    work_hours = Column(Float, default=0)
    status = Column(String(50), default='in_progress', nullable=False)
    store_feedback = Column(Text, nullable=True)
    store_rating = Column(Integer, nullable=True)

    dispatch = relationship("Dispatch", back_populates="repair_receipts")
    worker = relationship("User", back_populates="repair_receipts")
    parts_usages = relationship("PartsUsage", back_populates="receipt")
