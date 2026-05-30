from sqlalchemy import create_engine, Column, String, Float, Integer, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import sessionmaker, declarative_base
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./collateral.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class CollateralBatch(Base):
    __tablename__ = "collateral_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String, unique=True, index=True, nullable=False)
    batch_date = Column(String, nullable=False)
    source_file = Column(String, nullable=False)
    total_records = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    exception_count = Column(Integer, default=0)
    status = Column(String, default="processing")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    processed_by = Column(String, default="system")
    remark = Column(Text, default="")


class CollateralRecord(Base):
    __tablename__ = "collateral_records"

    id = Column(Integer, primary_key=True, index=True)
    record_key = Column(String, unique=True, index=True, nullable=False)
    batch_id = Column(String, index=True, nullable=False)
    collateral_code = Column(String, index=True, nullable=False)
    collateral_name = Column(String)
    collateral_type = Column(String)
    market_value = Column(Float, default=0)
    face_value = Column(Float, default=0)
    discount_rate = Column(Float, default=0)
    calculated_discount = Column(Float, default=0)
    final_discount = Column(Float, default=0)
    status = Column(String, default="pending")
    is_exception = Column(Boolean, default=False)
    exception_code = Column(String)
    exception_msg = Column(Text)
    exception_suggestion = Column(Text)
    current_version = Column(Integer, default=1)
    has_manual_note = Column(Boolean, default=False)
    latest_note = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class StatusHistory(Base):
    __tablename__ = "status_history"

    id = Column(Integer, primary_key=True, index=True)
    record_key = Column(String, index=True, nullable=False)
    batch_id = Column(String, index=True, nullable=False)
    version = Column(Integer, default=1)
    old_status = Column(String)
    new_status = Column(String)
    old_discount = Column(Float)
    new_discount = Column(Float)
    change_reason = Column(Text)
    operator = Column(String, default="system")
    operation_type = Column(String)
    remark = Column(Text)
    created_at = Column(DateTime, default=datetime.now)


class ManualNote(Base):
    __tablename__ = "manual_notes"

    id = Column(Integer, primary_key=True, index=True)
    record_key = Column(String, index=True, nullable=False)
    batch_id = Column(String, index=True, nullable=False)
    note_content = Column(Text, nullable=False)
    operator = Column(String, nullable=False)
    overridden = Column(Boolean, default=False)
    overridden_by = Column(String)
    overridden_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.now)


class ExportSnapshot(Base):
    __tablename__ = "export_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    snapshot_id = Column(String, unique=True, index=True, nullable=False)
    batch_id = Column(String, index=True, nullable=False)
    export_type = Column(String, default="review")
    record_count = Column(Integer, default=0)
    export_hash = Column(String, nullable=False)
    exported_by = Column(String, default="system")
    created_at = Column(DateTime, default=datetime.now)
    remark = Column(Text)


Base.metadata.create_all(bind=engine)
