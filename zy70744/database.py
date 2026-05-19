from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os

DB_PATH = os.environ.get("DB_PATH", "featureflag_conflict.db")
SQLALCHEMY_DATABASE_URL = f"sqlite:///./{DB_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class FeatureFlag(Base):
    __tablename__ = "feature_flags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    description = Column(Text)
    conditions = Column(JSON, nullable=False)
    priority = Column(Integer, default=0)
    user_group = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    conflicts = relationship("ConflictRecord", back_populates="feature_flag")


class ConflictRecord(Base):
    __tablename__ = "conflict_records"

    id = Column(Integer, primary_key=True, index=True)
    feature_flag_id = Column(Integer, ForeignKey("feature_flags.id"))
    user_id = Column(String, index=True)
    conflicting_flags = Column(JSON, nullable=False)
    matched_conditions = Column(JSON, nullable=False)
    final_result = Column(JSON)
    status = Column(String, default="pending")
    resolution = Column(Text)
    resolved_by = Column(String)
    resolved_at = Column(DateTime)
    original_input = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    feature_flag = relationship("FeatureFlag", back_populates="conflicts")


class ResolutionLog(Base):
    __tablename__ = "resolution_logs"

    id = Column(Integer, primary_key=True, index=True)
    conflict_id = Column(Integer, ForeignKey("conflict_records.id"))
    action = Column(String, nullable=False)
    operator = Column(String, nullable=False)
    conclusion = Column(Text)
    previous_status = Column(String)
    new_status = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
