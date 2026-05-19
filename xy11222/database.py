from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./quality_control.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class SampleRetention(Base):
    __tablename__ = "sample_retentions"
    id = Column(Integer, primary_key=True, index=True)
    idempotency_key = Column(String, unique=True, index=True)
    dish_name = Column(String, index=True)
    dish_code = Column(String, index=True)
    sample_time = Column(DateTime)
    sample_quantity = Column(String)
    keeper = Column(String)
    storage_location = Column(String)
    retention_hours = Column(Integer, default=48)
    expire_time = Column(DateTime)
    status = Column(String, default="active")
    inspection_time = Column(DateTime, nullable=True)
    inspector = Column(String, nullable=True)
    inspection_result = Column(String, nullable=True)
    destroy_time = Column(DateTime, nullable=True)
    destroyer = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    history = relationship("SampleHistory", back_populates="sample")

class FridgeTemperature(Base):
    __tablename__ = "fridge_temperatures"
    id = Column(Integer, primary_key=True, index=True)
    idempotency_key = Column(String, unique=True, index=True)
    fridge_code = Column(String, index=True)
    fridge_name = Column(String)
    measure_time = Column(DateTime)
    temperature = Column(Float)
    min_temperature = Column(Float, default=0)
    max_temperature = Column(Float, default=8)
    is_normal = Column(Boolean)
    recorder = Column(String)
    remark = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class WasteRecord(Base):
    __tablename__ = "waste_records"
    id = Column(Integer, primary_key=True, index=True)
    idempotency_key = Column(String, unique=True, index=True)
    dish_name = Column(String)
    dish_code = Column(String)
    waste_time = Column(DateTime)
    waste_quantity = Column(String)
    waste_reason = Column(String)
    handler = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ImportError(Base):
    __tablename__ = "import_errors"
    id = Column(Integer, primary_key=True, index=True)
    import_batch_id = Column(String, index=True)
    file_name = Column(String)
    sheet_name = Column(String, nullable=True)
    row_number = Column(Integer)
    original_data = Column(Text)
    error_reason = Column(String)
    suggestion = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class SampleHistory(Base):
    __tablename__ = "sample_histories"
    id = Column(Integer, primary_key=True, index=True)
    sample_id = Column(Integer, ForeignKey("sample_retentions.id"))
    action = Column(String)
    action_time = Column(DateTime, default=datetime.utcnow)
    operator = Column(String)
    remark = Column(String, nullable=True)
    sample = relationship("SampleRetention", back_populates="history")

Base.metadata.create_all(bind=engine)
