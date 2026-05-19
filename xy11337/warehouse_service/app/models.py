from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()


class Pickup(Base):
    __tablename__ = "pickups"
    
    id = Column(Integer, primary_key=True, index=True)
    pickup_no = Column(String(50), unique=True, index=True, nullable=False)
    work_order_no = Column(String(50), index=True, nullable=False)
    engineer = Column(String(100), index=True, nullable=False)
    part_code = Column(String(100), nullable=False)
    part_name = Column(String(200), nullable=False)
    quantity = Column(Integer, nullable=False)
    pickup_date = Column(DateTime, nullable=False)
    remark = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    returns = relationship("Return", back_populates="pickup")
    claims = relationship("Claim", back_populates="pickup")


class Return(Base):
    __tablename__ = "returns"
    
    id = Column(Integer, primary_key=True, index=True)
    return_no = Column(String(50), unique=True, index=True, nullable=False)
    pickup_no = Column(String(50), ForeignKey("pickups.pickup_no"), nullable=False)
    return_date = Column(DateTime, nullable=False)
    return_quantity = Column(Integer, nullable=False)
    is_defective = Column(Boolean, default=True)
    defect_description = Column(Text, nullable=True)
    receiver = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    pickup = relationship("Pickup", back_populates="returns")


class Claim(Base):
    __tablename__ = "claims"
    
    id = Column(Integer, primary_key=True, index=True)
    claim_no = Column(String(50), unique=True, index=True, nullable=False)
    pickup_no = Column(String(50), ForeignKey("pickups.pickup_no"), nullable=False)
    vendor = Column(String(200), nullable=False)
    claim_date = Column(DateTime, nullable=False)
    claim_amount = Column(Float, nullable=False)
    status = Column(String(50), default="pending", nullable=False)
    approver = Column(String(100), nullable=True)
    remark = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    pickup = relationship("Pickup", back_populates="claims")


class Anomaly(Base):
    __tablename__ = "anomalies"
    
    id = Column(Integer, primary_key=True, index=True)
    anomaly_no = Column(String(50), unique=True, index=True, nullable=False)
    pickup_no = Column(String(50), nullable=False)
    anomaly_type = Column(String(100), index=True, nullable=False)
    description = Column(Text, nullable=False)
    severity = Column(String(50), default="medium", nullable=False)
    status = Column(String(50), default="open", nullable=False)
    handler = Column(String(100), index=True, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class ReviewRecord(Base):
    __tablename__ = "review_records"
    
    id = Column(Integer, primary_key=True, index=True)
    review_no = Column(String(50), unique=True, index=True, nullable=False)
    reviewer = Column(String(100), index=True, nullable=False)
    review_date = Column(DateTime, default=datetime.now)
    total_pickups = Column(Integer, default=0)
    matched_count = Column(Integer, default=0)
    unmatched_count = Column(Integer, default=0)
    anomaly_count = Column(Integer, default=0)
    remark = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
