from sqlalchemy import create_engine, Column, String, Float, DateTime, Integer, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./load_test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class LoadTestReport(Base):
    __tablename__ = "load_test_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(String(100), unique=True, index=True)
    report_name = Column(String(200))
    source_format = Column(String(50))
    imported_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text, nullable=True)


class LoadTestScenario(Base):
    __tablename__ = "load_test_scenarios"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(String(100), index=True)
    scenario_name = Column(String(200), index=True)
    throughput = Column(Float)
    p95 = Column(Float)
    error_rate = Column(Float)
    concurrency = Column(Float, nullable=True)
    duration = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ComparisonResult(Base):
    __tablename__ = "comparison_results"

    id = Column(Integer, primary_key=True, index=True)
    comparison_id = Column(String(100), index=True)
    base_report_id = Column(String(100))
    target_report_id = Column(String(100))
    scenario_name = Column(String(200))
    throughput_degradation = Column(Float)
    p95_degradation = Column(Float)
    error_rate_increase = Column(Float)
    conclusion = Column(String(50))
    need_manual_review = Column(Boolean, default=False)
    reviewed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text, nullable=True)


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
