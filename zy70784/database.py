from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, JSON, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./sql_erase.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    sql_content = Column(Text, nullable=False)
    params = Column(JSON, nullable=True)
    processed_sql = Column(Text, nullable=True)
    status = Column(String(20), default="pending", index=True)
    created_by = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    risk_fragments = relationship("RiskFragment", back_populates="task", cascade="all, delete-orphan")
    operation_logs = relationship("OperationLog", back_populates="task", cascade="all, delete-orphan")


class RiskFragment(Base):
    __tablename__ = "risk_fragments"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    original_value = Column(String(500), nullable=False)
    replaced_value = Column(String(200), nullable=True)
    rule_id = Column(Integer, ForeignKey("erase_rules.id"), nullable=True)
    position_start = Column(Integer)
    position_end = Column(Integer)
    risk_level = Column(String(20), default="medium")
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    task = relationship("Task", back_populates="risk_fragments")
    rule = relationship("EraseRule")


class EraseRule(Base):
    __tablename__ = "erase_rules"

    id = Column(Integer, primary_key=True, index=True)
    rule_name = Column(String(100), nullable=False)
    pattern = Column(String(500), nullable=False)
    replacement = Column(String(200), nullable=False)
    rule_type = Column(String(50), default="regex")
    risk_level = Column(String(20), default="medium")
    is_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    operation_type = Column(String(50), nullable=False)
    operator = Column(String(100), nullable=False)
    from_status = Column(String(20))
    to_status = Column(String(20))
    comments = Column(Text)
    original_data = Column(JSON)
    modified_data = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    task = relationship("Task", back_populates="operation_logs")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
