from sqlalchemy import Column, String, Integer, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from .base import Base

class Part(Base):
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    category = Column(String(100))
    unit = Column(String(20), default='个')
    unit_price = Column(Float, default=0)
    stock = Column(Integer, default=0)
    description = Column(Text, nullable=True)

    parts_usages = relationship("PartsUsage", back_populates="part")

class PartsUsage(Base):
    receipt_id = Column(Integer, ForeignKey('repairreceipts.id'), nullable=False)
    part_id = Column(Integer, ForeignKey('parts.id'), nullable=False)
    quantity = Column(Integer, default=1)
    unit_price = Column(Float, default=0)
    notes = Column(Text, nullable=True)

    receipt = relationship("RepairReceipt", back_populates="parts_usages")
    part = relationship("Part", back_populates="parts_usages")
