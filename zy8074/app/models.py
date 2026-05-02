from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class Inventory(Base):
    __tablename__ = "inventory"
    rfid = Column(String, primary_key=True, index=True)
    type = Column(String, nullable=False)
    room = Column(String, nullable=False)
    hotel = Column(String, nullable=False)
    wash_cycles = Column(Integer, default=0)

class Batch(Base):
    __tablename__ = "batches"
    id = Column(String, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    hotel = Column(String, nullable=False)
    linen_items = relationship("LinenStatus", back_populates="batch")

class LinenStatus(Base):
    __tablename__ = "linen_status"
    id = Column(Integer, primary_key=True, autoincrement=True)
    rfid = Column(String, ForeignKey("inventory.rfid"), nullable=False, index=True)
    batch_id = Column(String, ForeignKey("batches.id"), index=True)
    status = Column(String, nullable=False)
    send_time = Column(DateTime)
    receive_time = Column(DateTime)
    last_scan_time = Column(DateTime)
    loss_flag = Column(String, default="")
    notes = Column(Text, default="")
    
    batch = relationship("Batch", back_populates="linen_items")
    inventory = relationship("Inventory")

class ScanRecord(Base):
    __tablename__ = "scan_records"
    id = Column(Integer, primary_key=True, autoincrement=True)
    rfid = Column(String, nullable=False, index=True)
    action = Column(String, nullable=False)
    timestamp = Column(DateTime, nullable=False)
    batch_id = Column(String, ForeignKey("batches.id"), index=True)
