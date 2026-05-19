from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./print_quality_control.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class PaperBatch(Base):
    __tablename__ = "paper_batches"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String(100), unique=True, index=True, nullable=False)
    paper_type = Column(String(100), nullable=False)
    supplier = Column(String(100))
    received_date = Column(DateTime, default=datetime.utcnow)
    weight = Column(Float)
    thickness = Column(Float)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    quality_records = relationship("QualityRecord", back_populates="paper_batch")


class QualityRecord(Base):
    __tablename__ = "quality_records"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(100), index=True, nullable=False)
    order_number = Column(String(100), index=True)
    paper_batch_id = Column(Integer, ForeignKey("paper_batches.id"))
    sample_point = Column(String(100))
    lab_l = Column(Float, nullable=False)
    lab_a = Column(Float, nullable=False)
    lab_b = Column(Float, nullable=False)
    standard_l = Column(Float)
    standard_a = Column(Float)
    standard_b = Column(Float)
    delta_e = Column(Float)
    is_qualified = Column(Boolean, default=True)
    inspector = Column(String(100), index=True)
    inspection_time = Column(DateTime, index=True, default=datetime.utcnow)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    paper_batch = relationship("PaperBatch", back_populates="quality_records")
    rework_records = relationship("ReworkRecord", back_populates="quality_record")


class ReworkRecord(Base):
    __tablename__ = "rework_records"
    
    id = Column(Integer, primary_key=True, index=True)
    quality_record_id = Column(Integer, ForeignKey("quality_records.id"))
    rework_reason = Column(String(200), nullable=False)
    rework_type = Column(String(100), index=True)
    rework_operator = Column(String(100), index=True)
    rework_time = Column(DateTime, index=True, default=datetime.utcnow)
    before_status = Column(String(200))
    after_status = Column(String(200))
    is_successful = Column(Boolean, default=True)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    quality_record = relationship("QualityRecord", back_populates="rework_records")


class ImportErrorLog(Base):
    __tablename__ = "import_error_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    import_type = Column(String(50), index=True)
    source_file = Column(String(200))
    row_number = Column(Integer)
    original_data = Column(Text)
    error_message = Column(String(500))
    suggestion = Column(String(500))
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(String(100))
    resolved_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)


class OperationLog(Base):
    __tablename__ = "operation_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(String(50), index=True)
    operator = Column(String(100), index=True)
    target_table = Column(String(100))
    target_id = Column(Integer)
    old_value = Column(Text)
    new_value = Column(Text)
    operation_time = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
