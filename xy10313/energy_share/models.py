from datetime import datetime
from enum import Enum
from sqlalchemy import create_engine, Column, Integer, String, Float, Date, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

Base = declarative_base()


class RecordStatus(str, Enum):
    DRAFT = "draft"
    TRIAL = "trial"
    CONFIRMED = "confirmed"
    REVISED = "revised"
    CANCELLED = "cancelled"


class DisputeStatus(str, Enum):
    PENDING = "pending"
    RESOLVED = "resolved"
    REJECTED = "rejected"


class House(Base):
    __tablename__ = "houses"
    
    id = Column(Integer, primary_key=True)
    room_number = Column(String(50), unique=True, nullable=False, index=True)
    owner_name = Column(String(100))
    area = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    occupancy_statuses = relationship("OccupancyStatus", back_populates="house")
    reductions = relationship("Reduction", back_populates="house")
    bill_details = relationship("BillDetail", back_populates="house")
    disputes = relationship("Dispute", back_populates="house")


class OccupancyStatus(Base):
    __tablename__ = "occupancy_statuses"
    
    id = Column(Integer, primary_key=True)
    house_id = Column(Integer, ForeignKey("houses.id"), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date)
    is_vacant = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String(50))
    
    house = relationship("House", back_populates="occupancy_statuses")


class CommonMeterBill(Base):
    __tablename__ = "common_meter_bills"
    
    id = Column(Integer, primary_key=True)
    billing_month = Column(String(7), unique=True, nullable=False, index=True)
    electricity_kwh = Column(Float, nullable=False)
    electricity_unit_price = Column(Float, nullable=False)
    water_tons = Column(Float, default=0)
    water_unit_price = Column(Float, default=0)
    total_amount = Column(Float, nullable=False)
    meter_reading_start = Column(Float)
    meter_reading_end = Column(Float)
    record_status = Column(String(20), default=RecordStatus.DRAFT.value)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    bill_details = relationship("BillDetail", back_populates="common_bill")
    audit_logs = relationship("AuditLog", back_populates="bill")


class Reduction(Base):
    __tablename__ = "reductions"
    
    id = Column(Integer, primary_key=True)
    house_id = Column(Integer, ForeignKey("houses.id"), nullable=False)
    billing_month = Column(String(7), index=True)
    reduction_type = Column(String(50))
    reduction_percent = Column(Float)
    reduction_amount = Column(Float)
    reason = Column(Text)
    valid_from = Column(Date)
    valid_to = Column(Date)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String(50))
    
    house = relationship("House", back_populates="reductions")


class BillDetail(Base):
    __tablename__ = "bill_details"
    
    id = Column(Integer, primary_key=True)
    common_bill_id = Column(Integer, ForeignKey("common_meter_bills.id"), nullable=False)
    house_id = Column(Integer, ForeignKey("houses.id"), nullable=False)
    billing_month = Column(String(7), index=True)
    
    original_share_amount = Column(Float, nullable=False)
    reduction_amount = Column(Float, default=0)
    final_amount = Column(Float, nullable=False)
    
    area = Column(Float)
    area_weight = Column(Float)
    is_vacant = Column(Boolean, default=False)
    vacant_days_ratio = Column(Float, default=0)
    reduction_detail = Column(Text)
    calculation_note = Column(Text)
    
    has_issue = Column(Boolean, default=False)
    issue_description = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    version = Column(Integer, default=1)
    
    common_bill = relationship("CommonMeterBill", back_populates="bill_details")
    house = relationship("House", back_populates="bill_details")
    disputes = relationship("Dispute", back_populates="bill_detail")


class Dispute(Base):
    __tablename__ = "disputes"
    
    id = Column(Integer, primary_key=True)
    bill_detail_id = Column(Integer, ForeignKey("bill_details.id"), nullable=False)
    house_id = Column(Integer, ForeignKey("houses.id"), nullable=False)
    billing_month = Column(String(7), index=True)
    
    disputed_amount = Column(Float)
    customer_objection = Column(Text)
    status = Column(String(20), default=DisputeStatus.PENDING.value)
    resolution = Column(Text)
    resolved_at = Column(DateTime)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String(50))
    
    bill_detail = relationship("BillDetail", back_populates="disputes")
    house = relationship("House", back_populates="disputes")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True)
    bill_id = Column(Integer, ForeignKey("common_meter_bills.id"))
    operation = Column(String(50), nullable=False)
    old_status = Column(String(20))
    new_status = Column(String(20))
    old_data = Column(Text)
    new_data = Column(Text)
    operated_by = Column(String(50))
    operated_at = Column(DateTime, default=datetime.utcnow)
    reason = Column(Text)
    
    bill = relationship("CommonMeterBill", back_populates="audit_logs")


class DataIssue(Base):
    __tablename__ = "data_issues"
    
    id = Column(Integer, primary_key=True)
    billing_month = Column(String(7), index=True)
    issue_type = Column(String(50), nullable=False)
    related_entity = Column(String(50))
    related_key = Column(String(100))
    description = Column(Text, nullable=False)
    is_resolved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class EngineFactory:
    _engine = None
    
    @classmethod
    def get_engine(cls, db_path: str = "energy_share.db"):
        if cls._engine is None:
            cls._engine = create_engine(f"sqlite:///{db_path}", echo=False)
        return cls._engine
    
    @classmethod
    def get_session(cls, db_path: str = "energy_share.db"):
        engine = cls.get_engine(db_path)
        Session = sessionmaker(bind=engine)
        return Session()
    
    @classmethod
    def init_db(cls, db_path: str = "energy_share.db"):
        engine = cls.get_engine(db_path)
        Base.metadata.create_all(engine)
