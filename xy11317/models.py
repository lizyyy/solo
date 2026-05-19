from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field
from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean, Text, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()

class ComplaintStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    MERGED = "merged"
    APPROVED = "approved"
    REJECTED = "rejected"

class Responsibility(str, Enum):
    DRIVER = "driver"
    COMPANY = "company"
    TRAFFIC = "traffic"
    WEATHER = "weather"
    PARENT = "parent"
    UNCLEAR = "unclear"

class GPSStatus(str, Enum):
    COMPLETE = "complete"
    PARTIAL = "partial"
    MISSING = "missing"

class ParentComplaintDB(Base):
    __tablename__ = "parent_complaints"
    
    id = Column(Integer, primary_key=True, index=True)
    complaint_no = Column(String, unique=True, index=True)
    parent_name = Column(String)
    parent_phone = Column(String)
    student_name = Column(String)
    school_name = Column(String)
    route_no = Column(String)
    bus_no = Column(String)
    scheduled_arrival = Column(DateTime)
    actual_arrival = Column(DateTime)
    delay_minutes = Column(Integer)
    complaint_reason = Column(Text)
    complaint_time = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default=ComplaintStatus.PENDING)
    merged_into = Column(Integer, ForeignKey("parent_complaints.id"), nullable=True)
    merged_complaints = relationship("ParentComplaintDB", remote_side=[id])
    responsibility = Column(String, nullable=True)
    final_decision = Column(Text, nullable=True)
    decided_by = Column(String, nullable=True)
    decided_at = Column(DateTime, nullable=True)
    gps_status = Column(String, nullable=True)
    gps_gap_minutes = Column(Integer, default=0)
    cross_site = Column(Boolean, default=False)
    site_count = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class GPSRecordDB(Base):
    __tablename__ = "gps_records"
    
    id = Column(Integer, primary_key=True, index=True)
    bus_no = Column(String, index=True)
    route_no = Column(String)
    record_time = Column(DateTime, index=True)
    latitude = Column(Float)
    longitude = Column(Float)
    speed = Column(Float)
    site_no = Column(String, nullable=True)
    site_name = Column(String, nullable=True)
    is_arrival = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class DriverCheckinDB(Base):
    __tablename__ = "driver_checkins"
    
    id = Column(Integer, primary_key=True, index=True)
    driver_id = Column(String, index=True)
    driver_name = Column(String)
    bus_no = Column(String)
    route_no = Column(String)
    checkin_type = Column(String)
    checkin_time = Column(DateTime)
    site_no = Column(String, nullable=True)
    site_name = Column(String, nullable=True)
    location_lat = Column(Float, nullable=True)
    location_lng = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class DecisionRecordDB(Base):
    __tablename__ = "decision_records"
    
    id = Column(Integer, primary_key=True, index=True)
    complaint_id = Column(Integer, ForeignKey("parent_complaints.id"))
    rule_name = Column(String)
    rule_result = Column(String)
    reason = Column(Text)
    evidence = Column(JSON)
    is_blocked = Column(Boolean, default=False)
    operator = Column(String, nullable=True)
    operation_time = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

class OperationLogDB(Base):
    __tablename__ = "operation_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    operator = Column(String)
    operation = Column(String)
    target_type = Column(String)
    target_id = Column(Integer)
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class SystemConfigDB(Base):
    __tablename__ = "system_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    config_key = Column(String, unique=True, index=True)
    config_value = Column(Text)
    description = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ParentComplaint(BaseModel):
    complaint_no: str
    parent_name: str
    parent_phone: str
    student_name: str
    school_name: str
    route_no: str
    bus_no: str
    scheduled_arrival: datetime
    actual_arrival: datetime
    delay_minutes: int
    complaint_reason: str
    complaint_time: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class GPSRecord(BaseModel):
    bus_no: str
    route_no: str
    record_time: datetime
    latitude: float
    longitude: float
    speed: float
    site_no: Optional[str] = None
    site_name: Optional[str] = None
    is_arrival: bool = False
    
    class Config:
        from_attributes = True

class DriverCheckin(BaseModel):
    driver_id: str
    driver_name: str
    bus_no: str
    route_no: str
    checkin_type: str
    checkin_time: datetime
    site_no: Optional[str] = None
    site_name: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    
    class Config:
        from_attributes = True

class ComplaintWithDetails(BaseModel):
    id: int
    complaint_no: str
    parent_name: str
    parent_phone: str
    student_name: str
    school_name: str
    route_no: str
    bus_no: str
    scheduled_arrival: datetime
    actual_arrival: datetime
    delay_minutes: int
    complaint_reason: str
    complaint_time: datetime
    status: ComplaintStatus
    responsibility: Optional[Responsibility] = None
    final_decision: Optional[str] = None
    gps_status: Optional[str] = None
    gps_gap_minutes: int = 0
    cross_site: bool = False
    site_count: int = 1
    created_at: datetime
    
    class Config:
        from_attributes = True

class DecisionRecord(BaseModel):
    id: int
    complaint_id: int
    rule_name: str
    rule_result: str
    reason: str
    evidence: dict
    is_blocked: bool
    operator: Optional[str] = None
    operation_time: datetime
    
    class Config:
        from_attributes = True
