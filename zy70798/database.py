from sqlalchemy import create_engine, Column, String, Integer, DateTime, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_quarantine.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class QuarantinedTest(Base):
    __tablename__ = "quarantined_tests"

    id = Column(Integer, primary_key=True, index=True)
    test_name = Column(String, index=True, nullable=False)
    test_path = Column(String, nullable=False)
    quarantine_reason = Column(Text, nullable=False)
    reason_category = Column(String, index=True)
    owner = Column(String, index=True, nullable=False)
    owner_email = Column(String)
    quarantine_date = Column(DateTime, nullable=False)
    expiry_date = Column(DateTime, index=True, nullable=False)
    last_run_date = Column(DateTime)
    last_run_result = Column(String)
    last_run_build_url = Column(String)
    consecutive_passes = Column(Integer, default=0)
    total_runs_since_quarantine = Column(Integer, default=0)
    status = Column(String, index=True, default="active")
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CleanupReport(Base):
    __tablename__ = "cleanup_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_date = Column(DateTime, default=datetime.utcnow)
    total_quarantined = Column(Integer, default=0)
    expired = Column(Integer, default=0)
    expiring_soon = Column(Integer, default=0)
    ready_for_cleanup = Column(Integer, default=0)
    requires_manual_review = Column(Integer, default=0)
    report_content = Column(Text)
    generated_by = Column(String)


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
