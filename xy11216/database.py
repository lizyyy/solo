from sqlalchemy import create_engine, Column, Integer, String, DateTime, Float, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./quality_control.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class QualityControlRecord(Base):
    __tablename__ = "quality_control_records"

    id = Column(Integer, primary_key=True, index=True)
    record_type = Column(String(50), index=True)
    store_name = Column(String(100), index=True)
    responsible_person = Column(String(100), index=True)
    record_date = Column(DateTime, index=True)
    item_name = Column(String(200))
    temperature = Column(Float, nullable=True)
    sample_time = Column(DateTime, nullable=True)
    discard_time = Column(DateTime, nullable=True)
    status = Column(String(50), index=True)
    anomaly_type = Column(String(100), nullable=True)
    remarks = Column(Text, nullable=True)
    import_batch_id = Column(String(100), index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class ImportErrorLog(Base):
    __tablename__ = "import_error_logs"

    id = Column(Integer, primary_key=True, index=True)
    import_batch_id = Column(String(100), index=True)
    file_name = Column(String(200))
    row_number = Column(Integer)
    original_data = Column(Text)
    error_reason = Column(Text)
    fix_suggestion = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

class ImportHistory(Base):
    __tablename__ = "import_history"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(100), unique=True, index=True)
    file_name = Column(String(200))
    file_type = Column(String(20))
    total_records = Column(Integer)
    success_count = Column(Integer)
    error_count = Column(Integer)
    imported_by = Column(String(100))
    imported_at = Column(DateTime, default=datetime.utcnow)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    Base.metadata.create_all(bind=engine)
