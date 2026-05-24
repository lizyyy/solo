from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime

Base = declarative_base()

class Performance(Base):
    __tablename__ = "performances"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    date = Column(DateTime, nullable=False)
    venue = Column(String(200), nullable=False)
    is_temporary = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String(50), default="pending")
    
    points = relationship("FireworkPoint", back_populates="performance")
    approvals = relationship("FireApproval", back_populates="performance")
    test_records = relationship("TestRecord", back_populates="performance")
    props = relationship("PropItem", back_populates="performance")
    reports = relationship("ApprovalReport", back_populates="performance")

class FireworkPoint(Base):
    __tablename__ = "firework_points"
    
    id = Column(Integer, primary_key=True, index=True)
    performance_id = Column(Integer, ForeignKey("performances.id"))
    location_code = Column(String(100), nullable=False)
    x_coordinate = Column(Float, nullable=False)
    y_coordinate = Column(Float, nullable=False)
    distance_to_audience = Column(Float, nullable=False)
    firework_type = Column(String(100), nullable=False)
    quantity = Column(Integer, nullable=False)
    safety_verified = Column(Boolean, default=False)
    verification_note = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    material_hash = Column(String(64), index=True)
    
    performance = relationship("Performance", back_populates="points")

class FireApproval(Base):
    __tablename__ = "fire_approvals"
    
    id = Column(Integer, primary_key=True, index=True)
    performance_id = Column(Integer, ForeignKey("performances.id"))
    department = Column(String(100), nullable=False)
    approver_name = Column(String(100), nullable=False)
    approval_time = Column(DateTime)
    status = Column(String(50), default="pending")
    certificate_number = Column(String(100))
    notes = Column(Text)
    material_hash = Column(String(64), index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    performance = relationship("Performance", back_populates="approvals")

class TestRecord(Base):
    __tablename__ = "test_records"
    
    id = Column(Integer, primary_key=True, index=True)
    performance_id = Column(Integer, ForeignKey("performances.id"))
    test_time = Column(DateTime, nullable=False)
    tester_name = Column(String(100), nullable=False)
    witness_name = Column(String(100), nullable=False)
    weather_condition = Column(String(100))
    test_result = Column(String(50), default="pending")
    video_evidence_url = Column(String(500))
    notes = Column(Text)
    material_hash = Column(String(64), index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    performance = relationship("Performance", back_populates="test_records")

class PropItem(Base):
    __tablename__ = "prop_items"
    
    id = Column(Integer, primary_key=True, index=True)
    performance_id = Column(Integer, ForeignKey("performances.id"))
    item_name = Column(String(200), nullable=False)
    quantity = Column(Integer, nullable=False)
    safety_rating = Column(String(50))
    storage_location = Column(String(200))
    handler = Column(String(100))
    material_hash = Column(String(64), index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    performance = relationship("Performance", back_populates="props")

class ApprovalReport(Base):
    __tablename__ = "approval_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    performance_id = Column(Integer, ForeignKey("performances.id"))
    report_number = Column(String(100), unique=True)
    overall_status = Column(String(50), default="pending")
    stage_manager_confirmed = Column(Boolean, default=False)
    fire_department_confirmed = Column(Boolean, default=False)
    prop_team_confirmed = Column(Boolean, default=False)
    generated_at = Column(DateTime, default=datetime.utcnow)
    pdf_path = Column(String(500))
    conclusion = Column(Text)
    
    performance = relationship("Performance", back_populates="reports")

class ApprovalHistory(Base):
    __tablename__ = "approval_history"
    
    id = Column(Integer, primary_key=True, index=True)
    performance_id = Column(Integer, ForeignKey("performances.id"))
    previous_status = Column(String(50))
    new_status = Column(String(50))
    changed_by = Column(String(100))
    change_reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
